import { computed, effectScope, shallowReactive, type ComputedRef, type Ref } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { lookUpPictureOwner, pictureOwnerName } from "../coordinators/picture-owner-coordinator";
import { showUserDialog } from "../coordinators/user-coordinator";
import { database } from "../services/database";
import {
  buildFaceIndex,
  buildInstanceFaces,
  buildStrangerFaces,
  type FaceOwner,
  type FaceSource,
  type InstanceFace,
  type InstanceFaces,
  type KnownUser,
} from "../shared/utils/instance-faces";
import { userImage } from "../shared/utils/user";
import { useFriendStore } from "../stores/friend";
import { useUserStore } from "../stores/user";
import { logError } from "../stores/vrcx-messages";
import type { VrcxUser } from "../types/vrcx";

const NO_FACES: InstanceFaces = { faces: [], hiddenCount: 0 };
const MAX_OWNERS = 5000;

function toKnownUser(user: VrcxUser, isFriend: boolean): KnownUser {
  return {
    id: user.id,
    name: user.displayName,
    iconUrl: userImage(user, true),
    ownedIconUrls: [user.userIcon, user.profilePicOverride].filter((url) => typeof url === "string" && url.length > 0),
    location: user.location,
    isFriend,
  };
}

type KnownFaces = {
  owners: Map<string, FaceOwner>;
  faceIndex: ComputedRef<Map<string, KnownUser>>;
  friendsByLocation: ComputedRef<Map<string, KnownUser[]>>;
};

const knownFacesByStore = new WeakMap<object, KnownFaces>();

function buildKnownFaces(): KnownFaces {
  const friendStore = useFriendStore();
  const userStore = useUserStore();
  const knownUsers = computed(() => {
    const users = new Map<string, KnownUser>();
    for (const user of userStore.cachedUsers.values()) {
      users.set(user.id, toKnownUser(user, friendStore.friends.has(user.id)));
    }
    for (const friend of friendStore.friends.values()) {
      if (friend.ref) {
        users.set(friend.id, toKnownUser(friend.ref, true));
      }
    }
    return users;
  });
  const friendsByLocation = computed(() => {
    const byLocation = new Map<string, KnownUser[]>();
    for (const user of knownUsers.value.values()) {
      if (user.isFriend && user.location) {
        byLocation.set(user.location, [...(byLocation.get(user.location) ?? []), user]);
      }
    }
    return byLocation;
  });
  return {
    owners: shallowReactive(new Map<string, FaceOwner>()),
    faceIndex: computed(() => buildFaceIndex(knownUsers.value.values())),
    friendsByLocation,
  };
}

export function useKnownFaces(): KnownFaces {
  const store = useUserStore();
  const existing = knownFacesByStore.get(store);
  if (existing) {
    return existing;
  }
  const created = effectScope(true).run(buildKnownFaces) ?? buildKnownFaces();
  knownFacesByStore.set(store, created);
  return created;
}

export function useInstanceFaces(sources: Ref<FaceSource[]>) {
  const { t } = useI18n();
  const { owners, faceIndex, friendsByLocation } = useKnownFaces();

  const facesByLocation = computed(() => {
    const byLocation = new Map<string, InstanceFaces>();
    for (const instance of sources.value) {
      byLocation.set(instance.location, buildInstanceFaces(instance, friendsByLocation.value.get(instance.location) ?? [], faceIndex.value));
    }
    return byLocation;
  });

  const strangersByLocation = computed(() => {
    const byLocation = new Map<string, InstanceFaces>();
    for (const instance of sources.value) {
      byLocation.set(instance.location, buildStrangerFaces(instance, friendsByLocation.value.get(instance.location) ?? [], faceIndex.value));
    }
    return byLocation;
  });

  function facesFor(location: string): InstanceFaces {
    return facesByLocation.value.get(location) ?? NO_FACES;
  }

  function strangersFor(location: string): InstanceFaces {
    return strangersByLocation.value.get(location) ?? NO_FACES;
  }

  async function resolveOwner(fileId: string): Promise<FaceOwner | null> {
    const known = owners.get(fileId);
    if (known) {
      return known;
    }
    const { owner, isAvatarWearer } = await lookUpPictureOwner(fileId);
    if (owner.kind === "unknown") {
      return null;
    }
    const resolved: FaceOwner =
      owner.kind === "avatar"
        ? { kind: "avatar" }
        : {
            kind: "user",
            userId: owner.userId,
            name: await pictureOwnerName(owner.userId).catch((err: unknown) => {
              logError(err);
              return "";
            }),
          };
    if (owners.size >= MAX_OWNERS) {
      for (const oldest of owners.keys()) {
        owners.delete(oldest);
        break;
      }
    }
    owners.set(fileId, resolved);
    const saved = resolved.kind === "user" ? { userId: resolved.userId, name: resolved.name } : { userId: "", name: "" };
    if (resolved.kind === "avatar" || resolved.name) {
      void database.savePictureOwner(fileId, isAvatarWearer ? "wearer" : resolved.kind, saved.userId, saved.name, new Date().toJSON()).catch(logError);
    }
    return resolved;
  }

  async function peek(face: InstanceFace): Promise<void> {
    if (face.kind === "unknown") {
      await resolveOwner(face.fileId);
    }
  }

  async function identify(face: InstanceFace): Promise<void> {
    if (face.kind === "known") {
      showUserDialog(face.userId);
      return;
    }
    try {
      const owner = await resolveOwner(face.fileId);
      if (owner?.kind === "user") {
        showUserDialog(owner.userId);
      } else if (owner?.kind === "avatar") {
        toast.info(t("view.tools.instance_browser.face_is_avatar"));
      } else {
        toast.info(t("view.tools.instance_browser.face_not_found"));
      }
    } catch (err) {
      logError(err);
      toast.info(t("view.tools.instance_browser.face_not_found"));
    }
  }

  return { facesFor, strangersFor, identify, peek, owners };
}
