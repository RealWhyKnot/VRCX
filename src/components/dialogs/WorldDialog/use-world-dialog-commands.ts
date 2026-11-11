import { nextTick, ref } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { toast as vueSonnerToast } from "vue-sonner";

import { favoriteRequest } from "../../../api/favorite";
import { miscRequest } from "../../../api/misc";
import { userRequest } from "../../../api/user";
import { worldRequest } from "../../../api/world";
import { handleImageUploadInput, resizeImageToFitLimits, uploadImageLegacy } from "../../../coordinators/image-upload-coordinator";
import type { runNewInstanceSelfInviteFlow } from "../../../coordinators/invite-coordinator";
import { openExternalLink } from "../../../shared/utils/app-actions";
import { replaceVrcPackageUrl } from "../../../shared/utils/url-utils";
import { readFileAsBase64, withUploadTimeout } from "../../../shared/utils/image-upload";
import type { WorldRef } from "../../../shared/utils/world-transforms";
import type { showWorldDialog } from "../../../coordinators/world-coordinator";
import { removeWorldFromCache } from "../../../coordinators/world-coordinator";
import type { useFavoriteStore } from "../../../stores/favorite";
import type { useGalleryStore } from "../../../stores/gallery";
import type { useInstanceStore } from "../../../stores/instance";
import type { useModalStore } from "../../../stores/modal";
import type { useUserStore } from "../../../stores/user";
import type { useWorldStore } from "../../../stores/world";
import { logError } from "../../../stores/vrcx-messages";
import { useWorldDialogPrompts } from "./use-world-dialog-prompts";

type Translate = ReturnType<typeof useI18n>["t"];
type ModalStore = ReturnType<typeof useModalStore>;
type WorldDialogState = ReturnType<typeof useWorldStore>["worldDialog"];
type UserDialogState = ReturnType<typeof useUserStore>["userDialog"];
type ConfirmOptions = Parameters<ModalStore["confirm"]>[0];

export type WorldAllowedDomainsState = {
  visible: boolean;
  worldId: string;
  urlList: string[];
};

type CommandEntry =
  | string
  | (() => void)
  | {
      confirm?: () => ConfirmOptions;
      handler: (id: string) => void;
    };

type WorldDialogCommandDeps = {
  t: Translate;
  toast: Pick<typeof vueSonnerToast, "success" | "error">;
  modalStore: Pick<ModalStore, "confirm" | "prompt">;
  userDialog: Ref<Pick<UserDialogState, "worlds">>;
  cachedWorlds: ReturnType<typeof useWorldStore>["cachedWorlds"];
  showWorldDialog: typeof showWorldDialog;
  showFavoriteDialog: ReturnType<typeof useFavoriteStore>["showFavoriteDialog"];
  newInstanceSelfInvite: typeof runNewInstanceSelfInviteFlow;
  showPreviousInstancesListDialog: ReturnType<typeof useInstanceStore>["showPreviousInstancesListDialog"];
  showFullscreenImageDialog: ReturnType<typeof useGalleryStore>["showFullscreenImageDialog"];
};

export function useWorldDialogCommands(
  worldDialog: Ref<WorldDialogState>,
  {
    t,
    toast,
    modalStore,
    userDialog,
    cachedWorlds,
    showWorldDialog,
    showFavoriteDialog,
    newInstanceSelfInvite,
    showPreviousInstancesListDialog: openPreviousInstancesListDialog,
    showFullscreenImageDialog,
  }: WorldDialogCommandDeps
) {
  const worldAllowedDomainsDialog = ref<WorldAllowedDomainsState>({
    visible: false,
    worldId: "",
    urlList: [],
  });
  const isSetWorldTagsDialogVisible = ref(false);
  const newInstanceDialogLocationTag = ref<string | undefined>("");
  const cropDialogOpen = ref(false);
  const cropDialogFile = ref<File | null>(null);
  const changeWorldImageLoading = ref(false);
  const { promptRenameWorld, promptChangeWorldDescription, promptChangeWorldCapacity, promptChangeWorldRecommendedCapacity, promptChangeWorldYouTubePreview } =
    useWorldDialogPrompts({ t, toast, modalStore });

  function onFileChangeWorldImage(e: Event) {
    const { file, clearInput } = handleImageUploadInput(e, {
      inputSelector: "#WorldImageUploadButton",
      tooLargeMessage: () => t("message.file.too_large"),
      invalidTypeMessage: () => t("message.file.not_image"),
    });
    if (!file) {
      return;
    }
    if (!worldDialog.value.visible || worldDialog.value.loading) {
      clearInput();
      return;
    }
    clearInput();
    cropDialogFile.value = file;
    cropDialogOpen.value = true;
  }

  async function onCropConfirmWorld(blob: Blob | null) {
    changeWorldImageLoading.value = true;
    try {
      if (!blob) {
        throw new Error("No world image to upload");
      }
      await withUploadTimeout(
        (async () => {
          const base64Body = await readFileAsBase64(blob);
          const base64File = await resizeImageToFitLimits(base64Body);
          await uploadImageLegacy("world", {
            entityId: worldDialog.value.id,
            imageUrl: worldDialog.value.ref.imageUrl ?? "",
            base64File,
            blob,
          });
        })()
      );
      toast.success(t("message.upload.success"));
    } catch (error) {
      console.error("World image upload process failed:", error);
      toast.error(t("message.upload.error"));
    } finally {
      changeWorldImageLoading.value = false;
      cropDialogOpen.value = false;
    }
  }

  function showNewInstanceDialog(tag: string | undefined) {
    newInstanceDialogLocationTag.value = "";
    nextTick(() => (newInstanceDialogLocationTag.value = tag)).catch(logError);
  }

  function copyWorldUrl() {
    navigator.clipboard
      .writeText(`https://vrchat.com/home/world/${worldDialog.value.id}`)
      .then(() => {
        toast.success(t("message.world.url_copied"));
      })
      .catch((err: unknown) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function copyWorldName() {
    navigator.clipboard
      .writeText(String(worldDialog.value.ref.name))
      .then(() => {
        toast.success(t("message.world.name_copied"));
      })
      .catch((err: unknown) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function copyWorldId() {
    navigator.clipboard
      .writeText(worldDialog.value.id)
      .then(() => {
        toast.success(t("message.world.id_copied"));
      })
      .catch((err: unknown) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function showWorldAllowedDomainsDialog() {
    const D = worldAllowedDomainsDialog.value;
    D.worldId = worldDialog.value.id;
    D.urlList = worldDialog.value.ref.urlList ?? [];
    D.visible = true;
  }

  function showPreviousInstancesListDialog(worldRef: WorldDialogState["ref"]) {
    void openPreviousInstancesListDialog("world", worldRef).catch(logError);
  }

  function buildCommandMap() {
    const D = () => worldDialog.value;

    return {
      Refresh: () => {
        const { tag, shortName } = D().$location;
        showWorldDialog(tag ?? "", shortName ?? null, { forceRefresh: true });
      },
      Share: () => {
        copyWorldUrl();
      },
      "Copy World Name": () => {
        copyWorldName();
      },
      "Copy World ID": () => {
        copyWorldId();
      },
      "Previous Instances": () => {
        showPreviousInstancesListDialog(D().ref);
      },
      "New Instance": () => {
        showNewInstanceDialog(D().$location.tag);
      },
      "New Instance and Self Invite": () => {
        newInstanceSelfInvite(D().id);
      },
      "Add Favorite": () => {
        showFavoriteDialog("world", D().id);
      },
      "Download Unity Package": () => {
        openExternalLink(replaceVrcPackageUrl(D().ref.unityPackageUrl));
      },
      Rename: () => {
        promptRenameWorld(D());
      },
      "Change Description": () => {
        promptChangeWorldDescription(D());
      },
      "Change Capacity": () => {
        promptChangeWorldCapacity(D());
      },
      "Change Recommended Capacity": () => {
        promptChangeWorldRecommendedCapacity(D());
      },
      "Change YouTube Preview": () => {
        promptChangeWorldYouTubePreview(D());
      },

      "Change Tags": "showSetWorldTagsDialog",
      "Change Allowed Domains": "showWorldAllowedDomainsDialog",
      "Change Image": "showChangeWorldImageDialog",

      "Delete Favorite": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.favorites_tooltip"),
          }),
        }),
        handler: (id: string) => {
          void favoriteRequest.deleteFavorite({ objectId: id }).catch(logError);
        },
      },
      "Make Home": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.make_home"),
          }),
        }),
        handler: (id: string) => {
          void userRequest
            .saveCurrentUser({ homeLocation: id })
            .then((args) => {
              toast.success(t("message.world.home_updated"));
              return args;
            })
            .catch(logError);
        },
      },
      "Reset Home": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.reset_home"),
          }),
        }),
        handler: () => {
          void userRequest
            .saveCurrentUser({ homeLocation: "" })
            .then((args) => {
              toast.success(t("message.world.home_reset"));
              return args;
            })
            .catch(logError);
        },
      },
      Publish: {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.publish_to_labs"),
          }),
        }),
        handler: (id: string) => {
          void worldRequest
            .publishWorld({ worldId: id })
            .then((args) => {
              toast.success(t("message.world.published"));
              return args;
            })
            .catch(logError);
        },
      },
      Unpublish: {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.unpublish"),
          }),
        }),
        handler: (id: string) => {
          void worldRequest
            .unpublishWorld({ worldId: id })
            .then((args) => {
              toast.success(t("message.world.unpublished"));
              return args;
            })
            .catch(logError);
        },
      },
      "Delete Persistent Data": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.delete_persistent_data"),
          }),
        }),
        handler: (id: string) => {
          void miscRequest
            .deleteWorldPersistData({ worldId: id })
            .then((args) => {
              if (args.params.worldId === worldDialog.value.id && worldDialog.value.visible) {
                worldDialog.value.hasPersistData = false;
              }
              toast.success(t("message.world.persistent_data_deleted"));
              return args;
            })
            .catch(logError);
        },
      },
      Delete: {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.delete"),
          }),
          destructive: true,
        }),
        handler: (id: string) => {
          void worldRequest
            .deleteWorld({ worldId: id })
            .then((args) => {
              const { json } = args;
              removeWorldFromCache(json.id);
              if (worldDialog.value.ref.authorId === json.authorId) {
                const map = new Map<string, WorldRef>();
                for (const ref of cachedWorlds.values()) {
                  if (ref.authorId === json.authorId) {
                    map.set(ref.id, ref);
                  }
                }
                const array = Array.from(map.values(), (ref) => ({ ...ref, favorites: ref.favorites ?? 0 }));
                userDialog.value.worlds = array;
              }
              toast.success(t("message.world.deleted"));
              worldDialog.value.visible = false;
              return args;
            })
            .catch(logError);
        },
      },
    };
  }

  const commandMap = new Map<string, CommandEntry>(Object.entries(buildCommandMap()));

  let componentCallbacks = new Map<string, () => void>();

  function registerCallbacks(callbacks: Record<string, () => void>) {
    componentCallbacks = new Map(Object.entries(callbacks));
  }

  function worldDialogCommand(command: string) {
    const D = worldDialog.value;
    if (!D.visible) {
      return;
    }

    const entry = commandMap.get(command);

    if (!entry) {
      return;
    }

    if (typeof entry === "string") {
      const cb = componentCallbacks.get(entry);
      if (cb) {
        cb();
      }
      return;
    }

    if (typeof entry === "function") {
      entry();
      return;
    }

    if (entry.confirm) {
      void modalStore
        .confirm(entry.confirm())
        .then(({ ok }) => {
          if (ok) {
            entry.handler(D.id);
          }
        })
        .catch(logError);
    }
  }

  return {
    worldAllowedDomainsDialog,
    isSetWorldTagsDialogVisible,
    newInstanceDialogLocationTag,
    cropDialogOpen,
    cropDialogFile,
    changeWorldImageLoading,
    worldDialogCommand,
    onFileChangeWorldImage,
    onCropConfirmWorld,
    showNewInstanceDialog,
    copyWorldUrl,
    copyWorldName,
    copyWorldId,
    showWorldAllowedDomainsDialog,
    showPreviousInstancesListDialog,
    showFullscreenImageDialog,
    promptRenameWorld,
    promptChangeWorldDescription,
    promptChangeWorldCapacity,
    promptChangeWorldRecommendedCapacity,
    promptChangeWorldYouTubePreview,
    registerCallbacks,
  };
}
