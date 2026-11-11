import { computed, ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { GroupGallery, GroupGalleryImage } from "vrchat";

import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { hasGroupPermission } from "../../../shared/utils/group";
import { removeFromArray } from "../../../shared/utils/base/array";
import type { Json } from "../../../types/vrcx";
import type { GroupDialogState } from "../../../stores/group-types";

type ConfirmOptions = { title: string; description: string; destructive?: boolean };

export type GalleryEntry = Json<GroupGallery>;

export type GalleryImageEntry = Json<GroupGalleryImage>;

type GalleryStatus = { blue?: boolean; green?: boolean; red?: boolean };

type CreateGalleryFields = Omit<Parameters<typeof groupRequest.createGroupGallery>[0], "groupId">;

type UpdateGalleryFields = Omit<Parameters<typeof groupRequest.editGroupGallery>[0], "groupId" | "galleryId">;

export type GalleryNameSource = Omit<GalleryEntry, "name"> & { name?: string | null | undefined };

export type GroupGalleriesSource = Omit<GroupDialogState, "ref"> & {
  ref: Omit<GroupDialogState["ref"], "galleries"> & { galleries?: GalleryNameSource[] | null | undefined };
};

type GroupGalleriesDeps = {
  t: (key: string, named?: Record<string, unknown>) => string;
  modalStore: { confirm: (options: ConfirmOptions) => Promise<{ ok: boolean }> };
  currentUser: Ref<{ id: string }>;
};

export function useGroupGalleries(groupDialog: Ref<GroupGalleriesSource>, deps: GroupGalleriesDeps) {
  const { t, modalStore, currentUser } = deps;
  const groupDialogGalleryCurrentName = ref("0");
  const isGroupGalleryLoading = ref(false);

  const groupGalleryTabs = computed(() =>
    (groupDialog.value.ref.galleries ?? []).map((gallery, index) => ({
      value: String(index),
      label: gallery.name ?? "",
    }))
  );

  function groupGalleryStatus(gallery: GalleryEntry) {
    const style: GalleryStatus = {};
    if (!gallery.membersOnly) {
      style.blue = true;
    } else if (!gallery.roleIdsToView) {
      style.green = true;
    } else {
      style.red = true;
    }
    return style;
  }

  function updateGroupDialogData(obj: Partial<GroupGalleriesSource>) {
    groupDialog.value = {
      ...groupDialog.value,
      ...obj,
    };
  }

  async function getGroupGalleries() {
    updateGroupDialogData({ ...groupDialog.value, galleries: {} });
    groupDialogGalleryCurrentName.value = "0";
    isGroupGalleryLoading.value = true;
    const groupId = groupDialog.value.id;
    const tasks = (groupDialog.value.ref.galleries ?? []).flatMap((gallery) => (gallery.id ? [getGroupGallery(groupId, gallery.id)] : []));
    await Promise.allSettled(tasks);
    isGroupGalleryLoading.value = false;
  }

  async function getGroupGallery(groupId: string, galleryId: string) {
    try {
      const params = {
        groupId,
        galleryId,
        n: 100,
        offset: 0,
      };
      const count = 50;
      for (let i = 0; i < count; i++) {
        const args = await queryRequest.fetch("groupGallery", params);
        if (!Array.isArray(args.json)) {
          throw new TypeError("Group gallery response is not a list");
        }
        for (const json of args.json) {
          const key = json.galleryId;
          if (groupDialog.value.id === json.groupId && key !== undefined) {
            const images = (groupDialog.value.galleries[key] ??= []);
            images.push(json);
          }
        }
        params.offset += 100;
        if (args.json.length < 100) {
          break;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  function hasAnyGroupRole(roleIds: string[] | null | undefined) {
    const myRoleIds = groupDialog.value.ref.myMember?.roleIds ?? [];
    return Boolean(roleIds?.some((roleId) => myRoleIds.includes(roleId)));
  }

  function canManageGroupGalleries() {
    return hasGroupPermission(groupDialog.value.ref, "group-galleries-manage");
  }

  function canManageGallery(gallery: GalleryEntry) {
    return canManageGroupGalleries() || hasAnyGroupRole(gallery.roleIdsToManage);
  }

  function canSubmitToGallery(gallery: GalleryEntry) {
    return canManageGallery(gallery) || hasAnyGroupRole(gallery.roleIdsToSubmit);
  }

  function canDeleteImage(gallery: GalleryEntry, image: GalleryImageEntry) {
    return canManageGallery(gallery) || image.submittedByUserId === currentUser.value.id;
  }

  async function createGallery(fields: CreateGalleryFields) {
    const args = await groupRequest.createGroupGallery({
      groupId: groupDialog.value.id,
      ...fields,
    });
    if (groupDialog.value.id !== args.params.groupId) {
      return false;
    }
    groupDialog.value.ref.galleries ??= [];
    groupDialog.value.ref.galleries.push(args.json);
    if (args.json.id !== undefined) {
      groupDialog.value.galleries[args.json.id] = [];
    }
    groupDialogGalleryCurrentName.value = String(groupDialog.value.ref.galleries.length - 1);
    toast.success(t("dialog.group.gallery.created"));
    return true;
  }

  async function deleteGallery(gallery: GalleryEntry) {
    if (gallery.id === undefined) {
      return;
    }
    const { ok } = await modalStore.confirm({
      description: t("confirm.delete_gallery", { name: gallery.name }),
      title: t("confirm.title"),
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const args = await groupRequest.deleteGroupGallery({
      groupId: groupDialog.value.id,
      galleryId: gallery.id,
    });
    if (groupDialog.value.id !== args.params.groupId) {
      return;
    }
    if (groupDialog.value.ref.galleries) {
      removeFromArray(groupDialog.value.ref.galleries, gallery);
    }
    const removedGalleryId = gallery.id;
    groupDialog.value.galleries = Object.fromEntries(Object.entries(groupDialog.value.galleries).filter(([galleryId]) => galleryId !== removedGalleryId));
    groupDialogGalleryCurrentName.value = "0";
    toast.success(t("dialog.group.gallery.deleted"));
  }

  async function updateGallery(galleryId: string, fields: UpdateGalleryFields) {
    const args = await groupRequest.editGroupGallery({
      groupId: groupDialog.value.id,
      galleryId,
      ...fields,
    });
    if (groupDialog.value.id !== args.params.groupId) {
      return false;
    }
    const gallery = groupDialog.value.ref.galleries?.find((item) => item.id === galleryId);
    if (gallery) {
      Object.assign(gallery, args.json);
    }
    toast.success(t("dialog.group.gallery.saved"));
    return true;
  }

  async function addGalleryImage(galleryId: string, fileId: string) {
    const args = await groupRequest.addGroupGalleryImage({
      groupId: groupDialog.value.id,
      galleryId,
      fileId,
    });
    if (groupDialog.value.id !== args.params.groupId) {
      return;
    }
    if (!args.json.approved) {
      toast.success(t("dialog.group.gallery.image_pending_approval"));
      return;
    }
    const images = (groupDialog.value.galleries[galleryId] ??= []);
    images.unshift(args.json);
    toast.success(t("dialog.group.gallery.image_added"));
  }

  async function deleteGalleryImage(image: GalleryImageEntry) {
    if (image.groupId === undefined || image.galleryId === undefined || image.id === undefined) {
      return;
    }
    const { ok } = await modalStore.confirm({
      description: t("confirm.delete_gallery_image"),
      title: t("confirm.title"),
      destructive: true,
    });
    if (!ok) {
      return;
    }
    const args = await groupRequest.deleteGroupGalleryImage({
      groupId: image.groupId,
      galleryId: image.galleryId,
      imageId: image.id,
    });
    if (groupDialog.value.id !== args.params.groupId) {
      return;
    }
    const images = groupDialog.value.galleries[image.galleryId];
    if (images) {
      removeFromArray(images, image);
    }
    toast.success(t("dialog.group.gallery.image_deleted"));
  }

  return {
    isGroupGalleryLoading,
    groupDialogGalleryCurrentName,
    groupGalleryTabs,
    groupGalleryStatus,
    getGroupGalleries,
    getGroupGallery,
    canManageGroupGalleries,
    canManageGallery,
    canSubmitToGallery,
    canDeleteImage,
    createGallery,
    deleteGallery,
    updateGallery,
    addGalleryImage,
    deleteGalleryImage,
  };
}
