import { ref } from "vue";

import { avatarModerationRequest, avatarRequest, favoriteRequest } from "../../../api";
import { removeAvatarFromCache } from "../../../coordinators/avatar-coordinator";
import { copyToClipboard, openExternalLink, replaceVrcPackageUrl } from "../../../shared/utils";
import { handleImageUploadInput, resizeImageToFitLimits, uploadImageLegacy } from "../../../coordinators/image-upload-coordinator";
import { readFileAsBase64, withUploadTimeout } from "../../../shared/utils/image-upload";

export function useAvatarDialogCommands(
  avatarDialog,
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
  }
) {
  const cropDialogOpen = ref(false);
  const cropDialogFile = ref(null);
  const changeAvatarImageLoading = ref(false);

  function showChangeAvatarImageDialog() {
    document.getElementById("AvatarImageUploadButton").click();
  }

  function onFileChangeAvatarImage(e) {
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

  async function onCropConfirmAvatar(blob) {
    changeAvatarImageLoading.value = true;
    try {
      await withUploadTimeout(
        (async () => {
          const base64Body = await readFileAsBase64(blob);
          const base64File = await resizeImageToFitLimits(base64Body);
          if (LINUX) {
            const args = await avatarRequest.uploadAvatarImage(base64File);
            const fileUrl = args.json.versions[args.json.versions.length - 1].file.url;
            await avatarRequest.saveAvatar({
              id: avatarDialog.value.id,
              imageUrl: fileUrl,
            });
          } else {
            await uploadImageLegacy("avatar", {
              entityId: avatarDialog.value.id,
              imageUrl: avatarDialog.value.ref.imageUrl,
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

  function promptRenameAvatar(avatar) {
    modalStore
      .prompt({
        title: t("prompt.rename_avatar.header"),
        description: t("prompt.rename_avatar.description"),
        confirmText: t("prompt.rename_avatar.ok"),
        cancelText: t("prompt.rename_avatar.cancel"),
        inputValue: avatar.ref.name,
        errorMessage: t("prompt.rename_avatar.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== avatar.ref.name) {
          avatarRequest
            .saveAvatar({
              id: avatar.id,
              name: value,
            })
            .then((args) => {
              applyAvatar(args.json);
              toast.success(t("prompt.rename_avatar.message.success"));
              return args;
            });
        }
      })
      .catch(() => {});
  }

  function promptChangeAvatarDescription(avatar) {
    modalStore
      .prompt({
        title: t("prompt.change_avatar_description.header"),
        description: t("prompt.change_avatar_description.description"),
        confirmText: t("prompt.change_avatar_description.ok"),
        cancelText: t("prompt.change_avatar_description.cancel"),
        inputValue: avatar.ref.description,
        errorMessage: t("prompt.change_avatar_description.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== avatar.ref.description) {
          avatarRequest
            .saveAvatar({
              id: avatar.id,
              description: value,
            })
            .then((args) => {
              applyAvatar(args.json);
              toast.success(t("prompt.change_avatar_description.message.success"));
              return args;
            });
        }
      })
      .catch(() => {});
  }

  function copyAvatarUrl(id) {
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
        copyToClipboard(D().ref.name);
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
        handler: (id) => {
          favoriteRequest.deleteFavorite({ objectId: id });
        },
      },
      "Select Fallback Avatar": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.select_fallback"),
          }),
        }),
        handler: (id) => {
          avatarRequest.selectFallbackAvatar({ avatarId: id }).then((args) => {
            toast.success(t("message.avatar.fallback_changed"));
            return args;
          });
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
        handler: (id) => {
          avatarModerationRequest
            .sendAvatarModeration({
              avatarModerationType: "block",
              targetAvatarId: id,
            })
            .then((args) => {
              applyAvatarModeration(args.json);
              toast.success(t("message.avatar.blocked"));
              return args;
            });
        },
      },
      "Unblock Avatar": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.unblock"),
          }),
        }),
        handler: (id) => {
          avatarModerationRequest
            .deleteAvatarModeration({
              avatarModerationType: "block",
              targetAvatarId: id,
            })
            .then((args) => {
              cachedAvatarModerations.delete(args.params.targetAvatarId);
              const D = avatarDialog.value;
              if (args.params.avatarModerationType === "block" && D.id === args.params.targetAvatarId) {
                D.isBlocked = false;
              }
            });
        },
      },
      "Make Public": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.make_public"),
          }),
        }),
        handler: (id) => {
          avatarRequest.saveAvatar({ id, releaseStatus: "public" }).then((args) => {
            applyAvatar(args.json);
            toast.success(t("message.avatar.updated_public"));
            return args;
          });
        },
      },
      "Make Private": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.make_private"),
          }),
        }),
        handler: (id) => {
          avatarRequest.saveAvatar({ id, releaseStatus: "private" }).then((args) => {
            applyAvatar(args.json);
            toast.success(t("message.avatar.updated_private"));
            return args;
          });
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
        handler: (id) => {
          avatarRequest.deleteAvatar({ avatarId: id }).then((args) => {
            const { json } = args;
            removeAvatarFromCache(json.id);
            if (userDialog.value.id === json.authorId) {
              const map = new Map();
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
          });
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
        handler: (id) => {
          avatarRequest.deleteImposter({ avatarId: id }).then((args) => {
            toast.success(t("message.avatar.impostor_deleted"));
            showAvatarDialog(id);
            return args;
          });
        },
      },
      "Create Imposter": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.avatar.actions.create_impostor"),
          }),
        }),
        handler: (id) => {
          avatarRequest.createImposter({ avatarId: id }).then((args) => {
            toast.success(t("message.avatar.impostor_queued"));
            return args;
          });
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
        handler: (id) => {
          avatarRequest
            .deleteImposter({ avatarId: id })
            .then((args) => {
              showAvatarDialog(id);
              return args;
            })
            .finally(() => {
              avatarRequest.createImposter({ avatarId: id }).then((args) => {
                toast.success(t("message.avatar.impostor_regenerated"));
                return args;
              });
            });
        },
      },
    };
  }

  const commandMap = buildCommandMap();

  let componentCallbacks = {};

  function registerCallbacks(callbacks) {
    componentCallbacks = callbacks;
  }

  function avatarDialogCommand(command) {
    const D = avatarDialog.value;
    const entry = commandMap[command];

    if (!entry) {
      return;
    }

    if (typeof entry === "string") {
      const cb = componentCallbacks[entry];
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
      modalStore.confirm(entry.confirm()).then(({ ok }) => {
        if (ok) {
          entry.handler(D.id);
        }
      });
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
