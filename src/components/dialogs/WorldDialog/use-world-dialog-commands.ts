import { nextTick, ref } from "vue";

import { favoriteRequest } from "../../../api/favorite";
import { miscRequest } from "../../../api/misc";
import { userRequest } from "../../../api/user";
import { worldRequest } from "../../../api/world";
import { handleImageUploadInput, resizeImageToFitLimits, uploadImageLegacy } from "../../../coordinators/image-upload-coordinator";
import { openExternalLink } from "../../../shared/utils/app-actions";
import { replaceVrcPackageUrl } from "../../../shared/utils/url-utils";
import { readFileAsBase64, withUploadTimeout } from "../../../shared/utils/image-upload";
import { removeWorldFromCache } from "../../../coordinators/world-coordinator";

export function useWorldDialogCommands(
  worldDialog,
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
  }
) {
  const worldAllowedDomainsDialog = ref({
    visible: false,
    worldId: "",
    urlList: [],
  });
  const isSetWorldTagsDialogVisible = ref(false);
  const newInstanceDialogLocationTag = ref("");
  const cropDialogOpen = ref(false);
  const cropDialogFile = ref(null);
  const changeWorldImageLoading = ref(false);

  function onFileChangeWorldImage(e) {
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

  async function onCropConfirmWorld(blob) {
    changeWorldImageLoading.value = true;
    try {
      await withUploadTimeout(
        (async () => {
          const base64Body = await readFileAsBase64(blob);
          const base64File = await resizeImageToFitLimits(base64Body);
          await uploadImageLegacy("world", {
            entityId: worldDialog.value.id,
            imageUrl: worldDialog.value.ref.imageUrl,
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

  function showNewInstanceDialog(tag) {
    newInstanceDialogLocationTag.value = "";
    nextTick(() => (newInstanceDialogLocationTag.value = tag));
  }

  function copyWorldUrl() {
    navigator.clipboard
      .writeText(`https://vrchat.com/home/world/${worldDialog.value.id}`)
      .then(() => {
        toast.success(t("message.world.url_copied"));
      })
      .catch((err) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function copyWorldName() {
    navigator.clipboard
      .writeText(worldDialog.value.ref.name)
      .then(() => {
        toast.success(t("message.world.name_copied"));
      })
      .catch((err) => {
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
      .catch((err) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function showWorldAllowedDomainsDialog() {
    const D = worldAllowedDomainsDialog.value;
    D.worldId = worldDialog.value.id;
    D.urlList = worldDialog.value.ref?.urlList ?? [];
    D.visible = true;
  }

  function showPreviousInstancesListDialog(worldRef) {
    openPreviousInstancesListDialog("world", worldRef);
  }

  function promptRenameWorld(world) {
    modalStore
      .prompt({
        title: t("prompt.rename_world.header"),
        description: t("prompt.rename_world.description"),
        confirmText: t("prompt.rename_world.ok"),
        cancelText: t("prompt.rename_world.cancel"),
        inputValue: world.ref.name,
        errorMessage: t("prompt.rename_world.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== world.ref.name) {
          worldRequest
            .saveWorld({
              id: world.id,
              name: value,
            })
            .then((args) => {
              toast.success(t("prompt.rename_world.message.success"));
              return args;
            });
        }
      })
      .catch(() => {});
  }

  function promptChangeWorldDescription(world) {
    modalStore
      .prompt({
        title: t("prompt.change_world_description.header"),
        description: t("prompt.change_world_description.description"),
        confirmText: t("prompt.change_world_description.ok"),
        cancelText: t("prompt.change_world_description.cancel"),
        inputValue: world.ref.description,
        errorMessage: t("prompt.change_world_description.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== world.ref.description) {
          worldRequest
            .saveWorld({
              id: world.id,
              description: value,
            })
            .then((args) => {
              toast.success(t("prompt.change_world_description.message.success"));
              return args;
            });
        }
      })
      .catch(() => {});
  }

  function promptChangeWorldCapacity(world) {
    modalStore
      .prompt({
        title: t("prompt.change_world_capacity.header"),
        description: t("prompt.change_world_capacity.description"),
        confirmText: t("prompt.change_world_capacity.ok"),
        cancelText: t("prompt.change_world_capacity.cancel"),
        inputValue: world.ref.capacity,
        pattern: /\d+$/,
        errorMessage: t("prompt.change_world_capacity.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== world.ref.capacity) {
          worldRequest
            .saveWorld({
              id: world.id,
              capacity: Number(value),
            })
            .then((args) => {
              toast.success(t("prompt.change_world_capacity.message.success"));
              return args;
            });
        }
      })
      .catch(() => {});
  }

  function promptChangeWorldRecommendedCapacity(world) {
    modalStore
      .prompt({
        title: t("prompt.change_world_recommended_capacity.header"),
        description: t("prompt.change_world_recommended_capacity.description"),
        confirmText: t("prompt.change_world_capacity.ok"),
        cancelText: t("prompt.change_world_capacity.cancel"),
        inputValue: world.ref.recommendedCapacity,
        pattern: /\d+$/,
        errorMessage: t("prompt.change_world_recommended_capacity.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== world.ref.recommendedCapacity) {
          worldRequest
            .saveWorld({
              id: world.id,
              recommendedCapacity: Number(value),
            })
            .then((args) => {
              toast.success(t("prompt.change_world_recommended_capacity.message.success"));
              return args;
            });
        }
      })
      .catch(() => {});
  }

  function promptChangeWorldYouTubePreview(world) {
    modalStore
      .prompt({
        title: t("prompt.change_world_preview.header"),
        description: t("prompt.change_world_preview.description"),
        confirmText: t("prompt.change_world_preview.ok"),
        cancelText: t("prompt.change_world_preview.cancel"),
        inputValue: world.ref.previewYoutubeId,
        errorMessage: t("prompt.change_world_preview.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        value = value.trim();
        const currentId = world.ref.previewYoutubeId || "";
        if (value !== currentId) {
          let processedValue = value;
          if (value.length > 11) {
            try {
              const url = new URL(value);
              const id1 = url.pathname;
              const id2 = url.searchParams.get("v");
              if (id1 && id1.length === 12) {
                processedValue = id1.substring(1, 12);
              }
              if (id2 && id2.length === 11) {
                processedValue = id2;
              }
            } catch {
              toast.error(t("prompt.change_world_preview.message.error"));
              return;
            }
          }
          if (processedValue !== currentId) {
            worldRequest
              .saveWorld({
                id: world.id,
                previewYoutubeId: processedValue,
              })
              .then((args) => {
                toast.success(t("prompt.change_world_preview.message.success"));
                return args;
              });
          }
        }
      })
      .catch(() => {});
  }

  function buildCommandMap() {
    const D = () => worldDialog.value;

    return {
      Refresh: () => {
        const { tag, shortName } = D().$location;
        showWorldDialog(tag, shortName, { forceRefresh: true });
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
        handler: (id) => {
          favoriteRequest.deleteFavorite({ objectId: id });
        },
      },
      "Make Home": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.make_home"),
          }),
        }),
        handler: (id) => {
          userRequest.saveCurrentUser({ homeLocation: id }).then((args) => {
            toast.success(t("message.world.home_updated"));
            return args;
          });
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
          userRequest.saveCurrentUser({ homeLocation: "" }).then((args) => {
            toast.success(t("message.world.home_reset"));
            return args;
          });
        },
      },
      Publish: {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.publish_to_labs"),
          }),
        }),
        handler: (id) => {
          worldRequest.publishWorld({ worldId: id }).then((args) => {
            toast.success(t("message.world.published"));
            return args;
          });
        },
      },
      Unpublish: {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.unpublish"),
          }),
        }),
        handler: (id) => {
          worldRequest.unpublishWorld({ worldId: id }).then((args) => {
            toast.success(t("message.world.unpublished"));
            return args;
          });
        },
      },
      "Delete Persistent Data": {
        confirm: () => ({
          title: t("confirm.title"),
          description: t("confirm.command_question", {
            command: t("dialog.world.actions.delete_persistent_data"),
          }),
        }),
        handler: (id) => {
          miscRequest.deleteWorldPersistData({ worldId: id }).then((args) => {
            if (args.params.worldId === worldDialog.value.id && worldDialog.value.visible) {
              worldDialog.value.hasPersistData = false;
            }
            toast.success(t("message.world.persistent_data_deleted"));
            return args;
          });
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
        handler: (id) => {
          worldRequest.deleteWorld({ worldId: id }).then((args) => {
            const { json } = args;
            removeWorldFromCache(json.id);
            if (worldDialog.value.ref.authorId === json.authorId) {
              const map = new Map();
              for (const ref of cachedWorlds.values()) {
                if (ref.authorId === json.authorId) {
                  map.set(ref.id, ref);
                }
              }
              const array = Array.from(map.values());
              userDialog.value.worlds = array;
            }
            toast.success(t("message.world.deleted"));
            worldDialog.value.visible = false;
            return args;
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

  function worldDialogCommand(command) {
    const D = worldDialog.value;
    if (D.visible === false) {
      return;
    }

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
