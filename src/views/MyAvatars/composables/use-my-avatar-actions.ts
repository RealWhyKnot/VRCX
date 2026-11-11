import { ref, type Ref } from "vue";
import { toast } from "vue-sonner";
import type { ComposerTranslation } from "vue-i18n";
import type { UpdateAvatarRequest } from "vrchat";
import { isLinuxHost } from "@/shared/constants/platform";
import { avatarRequest } from "../../../api/avatar";
import { applyAvatar, selectAvatarWithoutConfirmation, showAvatarDialog } from "../../../coordinators/avatar-coordinator";
import { announceImpostorQueued } from "../../../coordinators/impostor-queue-coordinator";
import { handleImageUploadInput, resizeImageToFitLimits, uploadImageLegacy } from "../../../coordinators/image-upload-coordinator";
import { logFailure } from "../../../stores/log-failure";
import { useModalStore } from "../../../stores/modal";
import { database } from "../../../services/database";
import { readFileAsBase64, withUploadTimeout } from "../../../shared/utils/image-upload";
import type { AvatarContextAction, AvatarTag, AvatarTagSavePayload, MyAvatar } from "../types";

type MyAvatarActionsOptions = {
  t: ComposerTranslation;
  avatars: Ref<MyAvatar[]>;
  avatarTagsMap: Ref<Map<string | null, AvatarTag[]>>;
  currentAvatarId: Ref<string | undefined>;
  imageUploadInput: Ref<HTMLInputElement | null>;
  refreshAvatars: () => Promise<void>;
};

export function useMyAvatarActions({ t, avatars, avatarTagsMap, currentAvatarId, imageUploadInput, refreshAvatars }: MyAvatarActionsOptions) {
  const modalStore = useModalStore();
  const cropDialogOpen = ref(false);
  const cropDialogFile = ref<File | null>(null);
  const changeImageAvatarRef = ref<MyAvatar | null>(null);
  const manageTagsOpen = ref(false);
  const manageTagsAvatar = ref<MyAvatar | null>(null);

  function handleShowAvatarDialog(avatarId: string) {
    showAvatarDialog(avatarId);
  }

  function handleWearAvatar(avatarId: string) {
    if (currentAvatarId.value === avatarId) {
      return;
    }
    const avatar = avatars.value.find((a) => a.id === avatarId);
    const avatarName = avatar?.name === undefined || avatar.name === "" ? avatarId : avatar.name;
    void modalStore
      .confirm({
        title: t("confirm.title"),
        description: `${t("confirm.select_avatar")}\n${avatarName}`,
      })
      .then(({ ok }) => {
        if (ok) {
          void selectAvatarWithoutConfirmation(avatarId).catch(logFailure("Failed to select avatar"));
        }
      })
      .catch(logFailure("Failed to confirm avatar selection"));
  }

  function confirmAndRun(labelKey: string, fn: () => void) {
    void modalStore
      .confirm({
        title: t("confirm.title"),
        description: t("confirm.command_question", {
          command: t(labelKey),
        }),
      })
      .then(({ ok }) => {
        if (ok) fn();
      })
      .catch(logFailure("Failed to confirm avatar command"));
  }

  function saveAvatarField(fields: UpdateAvatarRequest, successMessage: string) {
    void avatarRequest
      .saveAvatar(fields)
      .then((args) => {
        applyAvatar(args.json);
        toast.success(successMessage);
        void refreshAvatars().catch(logFailure("Failed to refresh avatars"));
      })
      .catch(logFailure("Failed to save avatar"));
  }

  function handleContextMenuAction(action: AvatarContextAction, avatarRef: MyAvatar) {
    switch (action) {
      case "details":
        showAvatarDialog(avatarRef.id);
        break;
      case "wear":
        handleWearAvatar(avatarRef.id);
        break;
      case "makePrivate":
        confirmAndRun("dialog.avatar.actions.make_private", () => {
          saveAvatarField({ id: avatarRef.id, releaseStatus: "private" }, t("message.avatar.updated_private"));
        });
        break;
      case "makePublic":
        confirmAndRun("dialog.avatar.actions.make_public", () => {
          saveAvatarField({ id: avatarRef.id, releaseStatus: "public" }, t("message.avatar.updated_public"));
        });
        break;
      case "rename":
        void modalStore
          .prompt({
            title: t("prompt.rename_avatar.header"),
            description: t("prompt.rename_avatar.description"),
            confirmText: t("prompt.rename_avatar.ok"),
            cancelText: t("prompt.rename_avatar.cancel"),
            inputValue: avatarRef.name,
            errorMessage: t("prompt.rename_avatar.input_error"),
          })
          .then(({ ok, value }) => {
            if (!ok) return;
            if (value && value !== avatarRef.name) {
              saveAvatarField({ id: avatarRef.id, name: value }, t("prompt.rename_avatar.message.success"));
            }
          })
          .catch(logFailure("Failed to rename avatar"));
        break;
      case "changeDescription":
        void modalStore
          .prompt({
            title: t("prompt.change_avatar_description.header"),
            description: t("prompt.change_avatar_description.description"),
            confirmText: t("prompt.change_avatar_description.ok"),
            cancelText: t("prompt.change_avatar_description.cancel"),
            inputValue: avatarRef.description,
            errorMessage: t("prompt.change_avatar_description.input_error"),
          })
          .then(({ ok, value }) => {
            if (!ok) return;
            if (value && value !== avatarRef.description) {
              saveAvatarField({ id: avatarRef.id, description: value }, t("prompt.change_avatar_description.message.success"));
            }
          })
          .catch(logFailure("Failed to change avatar description"));
        break;
      case "createImpostor":
        confirmAndRun("dialog.avatar.actions.create_impostor", () => {
          void avatarRequest
            .createImposter({ avatarId: avatarRef.id })
            .then(() => announceImpostorQueued())
            .catch(logFailure("Failed to create avatar impostor"));
        });
        break;
      case "changeImage":
        changeImageAvatarRef.value = avatarRef;
        imageUploadInput.value?.click();
        break;
      case "manageTags":
        manageTagsAvatar.value = avatarRef;
        manageTagsOpen.value = true;
        break;
      case "changeTags":
      case "changeStyles":
        showAvatarDialog(avatarRef.id);
        break;
    }
  }

  async function onSaveTags({ avatarId, tags: newEntries }: AvatarTagSavePayload) {
    const avatar = avatars.value.find((a) => a.id === avatarId);
    const oldEntries = avatar?.$tags ?? [];
    const oldMap = new Map<string, AvatarTag>(oldEntries.map((e): [string, AvatarTag] => [e.tag, e]));
    const newMap = new Map<string, AvatarTag>(newEntries.map((e): [string, AvatarTag] => [e.tag, e]));

    for (const [name] of oldMap) {
      if (!newMap.has(name)) {
        await database.removeAvatarTag(avatarId, name);
      }
    }

    for (const [name, entry] of newMap) {
      const old = oldMap.get(name);
      if (!old) {
        await database.addAvatarTag(avatarId, name, entry.color);
      } else if (old.color !== entry.color) {
        await database.updateAvatarTagColor(avatarId, name, entry.color);
      }
    }

    if (avatar) {
      avatar.$tags = newEntries;
    }
    avatarTagsMap.value.set(avatarId, newEntries);
    avatarTagsMap.value = new Map(avatarTagsMap.value);
  }

  function onFileChangeAvatarImage(e: Event) {
    const { file, clearInput } = handleImageUploadInput(e, {
      inputSelector: imageUploadInput.value,
      tooLargeMessage: () => t("message.file.too_large"),
      invalidTypeMessage: () => t("message.file.not_image"),
    });
    if (!file) {
      return;
    }
    clearInput();
    cropDialogFile.value = file;
    cropDialogOpen.value = true;
  }

  async function onCropConfirmAvatar(blob: File | Blob | null) {
    const avatarRef = changeImageAvatarRef.value;
    if (!avatarRef || blob === null) return;
    try {
      await withUploadTimeout(
        (async () => {
          const base64Body = await readFileAsBase64(blob);
          const base64File = await resizeImageToFitLimits(base64Body);
          if (isLinuxHost()) {
            const args = await avatarRequest.uploadAvatarImage(base64File);
            const fileUrl = args.json.versions.at(-1)?.file?.url;
            if (!fileUrl) {
              throw new Error("Avatar image upload returned no file version");
            }
            await avatarRequest.saveAvatar({
              id: avatarRef.id,
              imageUrl: fileUrl,
            });
          } else {
            await uploadImageLegacy("avatar", {
              entityId: avatarRef.id,
              imageUrl: avatarRef.imageUrl,
              base64File,
              blob,
            });
          }
        })()
      );
      toast.success(t("message.upload.success"));
      void refreshAvatars().catch(logFailure("Failed to refresh avatars"));
    } catch (error) {
      console.error("avatar image upload process failed:", error);
      toast.error(t("message.upload.error"));
    } finally {
      cropDialogOpen.value = false;
      changeImageAvatarRef.value = null;
    }
  }

  return {
    cropDialogOpen,
    cropDialogFile,
    manageTagsOpen,
    manageTagsAvatar,
    handleShowAvatarDialog,
    handleWearAvatar,
    handleContextMenuAction,
    onSaveTags,
    onFileChangeAvatarImage,
    onCropConfirmAvatar,
  };
}
