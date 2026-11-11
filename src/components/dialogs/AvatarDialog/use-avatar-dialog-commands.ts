import { ref } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { toast as vueSonnerToast } from "vue-sonner";

import { avatarModerationRequest } from "../../../api/avatar-moderation";
import { avatarRequest } from "../../../api/avatar";
import { favoriteRequest } from "../../../api/favorite";
import { removeAvatarFromCache } from "../../../coordinators/avatar-coordinator";
import { announceImpostorQueued } from "../../../coordinators/impostor-queue-coordinator";
import type { applyAvatar, showAvatarDialog } from "../../../coordinators/avatar-coordinator";
import { copyToClipboard, openExternalLink } from "../../../shared/utils/app-actions";
import { replaceVrcPackageUrl } from "../../../shared/utils/url-utils";
import { handleImageUploadInput, resizeImageToFitLimits, uploadImageLegacy } from "../../../coordinators/image-upload-coordinator";
import { readFileAsBase64, withUploadTimeout } from "../../../shared/utils/image-upload";
import { isLinuxHost } from "../../../shared/constants/platform";
import type { AvatarRef } from "../../../shared/utils/avatar-transforms";
import type { useAvatarStore } from "../../../stores/avatar";
import type { useModalStore } from "../../../stores/modal";
import type { useUiStore } from "../../../stores/ui";
import type { useUserStore } from "../../../stores/user";
import type { useFavoriteStore } from "../../../stores/favorite";
import { logError } from "../../../stores/vrcx-messages";

type Translate = ReturnType<typeof useI18n>["t"];
type ModalStore = ReturnType<typeof useModalStore>;
type AvatarDialogState = ReturnType<typeof useAvatarStore>["avatarDialog"];
type AvatarDialogCommandState = Pick<AvatarDialogState, "id" | "visible" | "loading" | "isBlocked"> & {
  ref: Pick<AvatarDialogState["ref"], "name" | "description" | "imageUrl" | "unityPackageUrl">;
};
type UserDialogState = ReturnType<typeof useUserStore>["userDialog"];
type ConfirmOptions = Parameters<ModalStore["confirm"]>[0];
type Toast = Pick<typeof vueSonnerToast, "success" | "error">;

type CommandEntry =
  | string
  | (() => void)
  | {
      confirm?: () => ConfirmOptions;
      handler: (id: string) => void;
    };

type AvatarDialogCommandDeps = {
  t: Translate;
  toast: Toast;
  modalStore: Pick<ModalStore, "confirm" | "prompt">;
  userDialog: Ref<Pick<UserDialogState, "id">>;
  cachedAvatars: Pick<Map<string, AvatarRef>, "values">;
  cachedAvatarModerations: Pick<Map<string, unknown>, "delete">;
  showAvatarDialog: typeof showAvatarDialog;
  showFavoriteDialog: ReturnType<typeof useFavoriteStore>["showFavoriteDialog"];
  applyAvatarModeration: ReturnType<typeof useAvatarStore>["applyAvatarModeration"];
  applyAvatar: typeof applyAvatar;
  sortUserDialogAvatars: ReturnType<typeof useUserStore>["sortUserDialogAvatars"];
  uiStore: Pick<ReturnType<typeof useUiStore>, "jumpBackDialogCrumb">;
};

export function useAvatarDialogCommands(
  avatarDialog: Ref<AvatarDialogCommandState>,
  {
    t,
    toast,
    modalStore,
    userDialog,
    cachedAvatars,
    cachedAvatarModerations,
    showAvatarDialog,
    showFavoriteDialog,
    applyAvatarModeration,
    applyAvatar,
    sortUserDialogAvatars,
    uiStore,
  }: AvatarDialogCommandDeps
) {
  const cropDialogOpen = ref(false);
  const cropDialogFile = ref<File | null>(null);
  const changeAvatarImageLoading = ref(false);

  function showChangeAvatarImageDialog() {
    const button = document.getElementById("AvatarImageUploadButton");
    if (!(button instanceof HTMLElement)) {
      throw new TypeError("AvatarImageUploadButton is missing");
    }
    button.click();
  }

  function onFileChangeAvatarImage(e: Event) {
    const { file, clearInput } = handleImageUploadInput(e, {
      inputSelector: "#AvatarImageUploadButton",
      tooLargeMessage: () => t("message.file.too_large"),
      invalidTypeMessage: () => t("message.file.not_image"),
    });
    if (!file) {
      return;
    }
    if (!avatarDialog.value.visible || avatarDialog.value.loading) {
      clearInput();
      return;
    }
    clearInput();
    cropDialogFile.value = file;
    cropDialogOpen.value = true;
  }

  async function onCropConfirmAvatar(blob: Blob | null) {
    changeAvatarImageLoading.value = true;
    try {
      if (!blob) {
        throw new Error("No avatar image to upload");
      }
      await withUploadTimeout(
        (async () => {
          const base64Body = await readFileAsBase64(blob);
          const base64File = await resizeImageToFitLimits(base64Body);
          if (isLinuxHost()) {
            const args = await avatarRequest.uploadAvatarImage(base64File);
            const latestVersion = args.json.versions.at(-1);
            if (!latestVersion) {
              throw new Error("Avatar image upload returned no versions");
            }
            const latestFile = latestVersion.file;
            if (!latestFile) {
              throw new Error("Avatar image upload returned no file");
            }
            await avatarRequest.saveAvatar({
              id: avatarDialog.value.id,
              imageUrl: latestFile.url,
            });
          } else {
            await uploadImageLegacy("avatar", {
              entityId: avatarDialog.value.id,
              imageUrl: avatarDialog.value.ref.imageUrl ?? "",
              base64File,
              blob,
            });
          }
        })()
      );
      toast.success(t("message.upload.success"));

      const avatarId = avatarDialog.value.id;
      showAvatarDialog(avatarId, { forceRefresh: true });
    } catch (error) {
      console.error("avatar image upload process failed:", error);
      toast.error(t("message.upload.error"));
    } finally {
      changeAvatarImageLoading.value = false;
      cropDialogOpen.value = false;
    }
  }

  function promptRenameAvatar(avatar: AvatarDialogCommandState) {
    modalStore
      .prompt({
        title: t("prompt.rename_avatar.header"),
        description: t("prompt.rename_avatar.description"),
        confirmText: t("prompt.rename_avatar.ok"),
        cancelText: t("prompt.rename_avatar.cancel"),
        inputValue: avatar.ref.name ?? "",
        errorMessage: t("prompt.rename_avatar.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== avatar.ref.name) {
          void avatarRequest
            .saveAvatar({
              id: avatar.id,
              name: value,
            })
            .then((args) => {
              applyAvatar(args.json);
              toast.success(t("prompt.rename_avatar.message.success"));
              return args;
            })
            .catch(logError);
        }
      })
      .catch(logError);
  }

  function promptChangeAvatarDescription(avatar: AvatarDialogCommandState) {
    modalStore
      .prompt({
        title: t("prompt.change_avatar_description.header"),
        description: t("prompt.change_avatar_description.description"),
        confirmText: t("prompt.change_avatar_description.ok"),
        cancelText: t("prompt.change_avatar_description.cancel"),
        inputValue: avatar.ref.description ?? "",
        errorMessage: t("prompt.change_avatar_description.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== avatar.ref.description) {
          void avatarRequest
            .saveAvatar({
              id: avatar.id,
              description: value,
            })
            .then((args) => {
              applyAvatar(args.json);
              toast.success(t("prompt.change_avatar_description.message.success"));
              return args;
            })
            .catch(logError);
        }
      })
      .catch(logError);
  }

  function copyAvatarUrl(id: string) {
    copyToClipboard(`https://vrchat.com/home/avatar/${id}`);
  }

  function buildCommandMap() {
    const D = () => avatarDialog.value;

    return {
      Refresh: () => {
        showAvatarDialog(D().id, { forceRefresh: true });
      },
      Share: () => {
        copyAvatarUrl(D().id);
      },
      "Copy Avatar Name": () => {
        copyToClipboard(String(D().ref.name));
      },
      "Copy Avatar ID": () => {
        copyToClipboard(D().id);
      },
      Rename: () => {
        promptRenameAvatar(D());
      },
      "Change Image": () => {
        showChangeAvatarImageDialog();
      },
      "Change Description": () => {
        promptChangeAvatarDescription(D());
      },
      "Download Unity Package": () => {
        openExternalLink(replaceVrcPackageUrl(D().ref.unityPackageUrl));
      },
      "Add Favorite": () => {
        showFavoriteDialog("avatar", D().id);
      },

      "Change Content Tags": "showSetAvatarTagsDialog",
      "Change Styles and Author Tags": "showSetAvatarStylesDialog",

      "Delete Favorite": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.favorite_tooltip"),
          }),
        }),
        handler: (id: string) => {
          void favoriteRequest.deleteFavorite({ objectId: id }).catch(logError);
        },
      },
      "Select Fallback Avatar": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.select_fallback"),
          }),
        }),
        handler: (id: string) => {
          void avatarRequest
            .selectFallbackAvatar({ avatarId: id })
            .then((args) => {
              toast.success(t("message.avatar.fallback_changed"));
              return args;
            })
            .catch(logError);
        },
      },
      "Block Avatar": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.block"),
          }),
          destructive: true,
        }),
        handler: (id: string) => {
          void avatarModerationRequest
            .sendAvatarModeration({
              avatarModerationType: "block",
              targetAvatarId: id,
            })
            .then((args) => {
              applyAvatarModeration(args.json);
              toast.success(t("message.avatar.blocked"));
              return args;
            })
            .catch(logError);
        },
      },
      "Unblock Avatar": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.unblock"),
          }),
        }),
        handler: (id: string) => {
          void avatarModerationRequest
            .deleteAvatarModeration({
              avatarModerationType: "block",
              targetAvatarId: id,
            })
            .then((args) => {
              cachedAvatarModerations.delete(args.params.targetAvatarId);
              const D = avatarDialog.value;
              if (D.id === args.params.targetAvatarId) {
                D.isBlocked = false;
              }
            })
            .catch(logError);
        },
      },
      "Make Public": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.make_public"),
          }),
        }),
        handler: (id: string) => {
          void avatarRequest
            .saveAvatar({ id, releaseStatus: "public" })
            .then((args) => {
              applyAvatar(args.json);
              toast.success(t("message.avatar.updated_public"));
              return args;
            })
            .catch(logError);
        },
      },
      "Make Private": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.make_private"),
          }),
        }),
        handler: (id: string) => {
          void avatarRequest
            .saveAvatar({ id, releaseStatus: "private" })
            .then((args) => {
              applyAvatar(args.json);
              toast.success(t("message.avatar.updated_private"));
              return args;
            })
            .catch(logError);
        },
      },
      Delete: {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.delete"),
          }),
          destructive: true,
        }),
        handler: (id: string) => {
          void avatarRequest
            .deleteAvatar({ avatarId: id })
            .then((args) => {
              const { json } = args;
              removeAvatarFromCache(json.id);
              if (userDialog.value.id === json.authorId) {
                const map = new Map<string, AvatarRef>();
                for (const ref of cachedAvatars.values()) {
                  if (ref.authorId === json.authorId) {
                    map.set(ref.id, ref);
                  }
                }
                const array = Array.from(map.values());
                sortUserDialogAvatars(array);
              }

              toast.success(t("message.avatar.deleted"));
              uiStore.jumpBackDialogCrumb();
              return args;
            })
            .catch(logError);
        },
      },
      "Delete Imposter": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.delete_impostor"),
          }),
          destructive: true,
        }),
        handler: (id: string) => {
          void avatarRequest
            .deleteImposter({ avatarId: id })
            .then((args) => {
              toast.success(t("message.avatar.impostor_deleted"));
              showAvatarDialog(id);
              return args;
            })
            .catch(logError);
        },
      },
      "Create Imposter": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.create_impostor"),
          }),
        }),
        handler: (id: string) => {
          void avatarRequest
            .createImposter({ avatarId: id })
            .then(() => announceImpostorQueued())
            .catch(logError);
        },
      },
      "Regenerate Imposter": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.regenerate_impostor"),
          }),
          destructive: true,
        }),
        handler: (id: string) => {
          void avatarRequest
            .deleteImposter({ avatarId: id })
            .then((args) => {
              showAvatarDialog(id);
              return args;
            })
            .finally(() => {
              void avatarRequest
                .createImposter({ avatarId: id })
                .then((args) => {
                  toast.success(t("message.avatar.impostor_regenerated"));
                  return args;
                })
                .catch(logError);
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

  function avatarDialogCommand(command: string) {
    const D = avatarDialog.value;
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
    cropDialogOpen,
    cropDialogFile,
    changeAvatarImageLoading,
    avatarDialogCommand,
    onFileChangeAvatarImage,
    onCropConfirmAvatar,
    registerCallbacks,
    copyAvatarUrl,
  };
}
