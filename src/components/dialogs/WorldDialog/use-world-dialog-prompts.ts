import type { useI18n } from "vue-i18n";
import type { toast as vueSonnerToast } from "vue-sonner";

import { worldRequest } from "../../../api/world";
import type { useModalStore } from "../../../stores/modal";
import type { useWorldStore } from "../../../stores/world";
import { logError } from "../../../stores/vrcx-messages";

type Translate = ReturnType<typeof useI18n>["t"];
type ModalStore = ReturnType<typeof useModalStore>;
type WorldDialogState = ReturnType<typeof useWorldStore>["worldDialog"];

type WorldDialogPromptDeps = {
  t: Translate;
  toast: Pick<typeof vueSonnerToast, "success" | "error">;
  modalStore: Pick<ModalStore, "prompt">;
};

export function useWorldDialogPrompts({ t, toast, modalStore }: WorldDialogPromptDeps) {
  function promptRenameWorld(world: WorldDialogState) {
    modalStore
      .prompt({
        title: t("prompt.rename_world.header"),
        description: t("prompt.rename_world.description"),
        confirmText: t("prompt.rename_world.ok"),
        cancelText: t("prompt.rename_world.cancel"),
        inputValue: world.ref.name ?? "",
        errorMessage: t("prompt.rename_world.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== world.ref.name) {
          void worldRequest
            .saveWorld({
              id: world.id,
              name: value,
            })
            .then((args) => {
              toast.success(t("prompt.rename_world.message.success"));
              return args;
            })
            .catch(logError);
        }
      })
      .catch(logError);
  }

  function promptChangeWorldDescription(world: WorldDialogState) {
    modalStore
      .prompt({
        title: t("prompt.change_world_description.header"),
        description: t("prompt.change_world_description.description"),
        confirmText: t("prompt.change_world_description.ok"),
        cancelText: t("prompt.change_world_description.cancel"),
        inputValue: world.ref.description ?? "",
        errorMessage: t("prompt.change_world_description.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== world.ref.description) {
          void worldRequest
            .saveWorld({
              id: world.id,
              description: value,
            })
            .then((args) => {
              toast.success(t("prompt.change_world_description.message.success"));
              return args;
            })
            .catch(logError);
        }
      })
      .catch(logError);
  }

  function promptChangeWorldCapacity(world: WorldDialogState) {
    const currentCapacity: unknown = world.ref.capacity;
    modalStore
      .prompt({
        title: t("prompt.change_world_capacity.header"),
        description: t("prompt.change_world_capacity.description"),
        confirmText: t("prompt.change_world_capacity.ok"),
        cancelText: t("prompt.change_world_capacity.cancel"),
        inputValue: world.ref.capacity?.toString() ?? "",
        pattern: /\d+$/,
        errorMessage: t("prompt.change_world_capacity.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== currentCapacity) {
          void worldRequest
            .saveWorld({
              id: world.id,
              capacity: Number(value),
            })
            .then((args) => {
              toast.success(t("prompt.change_world_capacity.message.success"));
              return args;
            })
            .catch(logError);
        }
      })
      .catch(logError);
  }

  function promptChangeWorldRecommendedCapacity(world: WorldDialogState) {
    const currentRecommendedCapacity: unknown = world.ref.recommendedCapacity;
    modalStore
      .prompt({
        title: t("prompt.change_world_recommended_capacity.header"),
        description: t("prompt.change_world_recommended_capacity.description"),
        confirmText: t("prompt.change_world_capacity.ok"),
        cancelText: t("prompt.change_world_capacity.cancel"),
        inputValue: world.ref.recommendedCapacity?.toString() ?? "",
        pattern: /\d+$/,
        errorMessage: t("prompt.change_world_recommended_capacity.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value && value !== currentRecommendedCapacity) {
          void worldRequest
            .saveWorld({
              id: world.id,
              recommendedCapacity: Number(value),
            })
            .then((args) => {
              toast.success(t("prompt.change_world_recommended_capacity.message.success"));
              return args;
            })
            .catch(logError);
        }
      })
      .catch(logError);
  }

  function promptChangeWorldYouTubePreview(world: WorldDialogState) {
    modalStore
      .prompt({
        title: t("prompt.change_world_preview.header"),
        description: t("prompt.change_world_preview.description"),
        confirmText: t("prompt.change_world_preview.ok"),
        cancelText: t("prompt.change_world_preview.cancel"),
        inputValue: world.ref.previewYoutubeId ?? "",
        errorMessage: t("prompt.change_world_preview.input_error"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        const trimmed = value.trim();
        const currentId = world.ref.previewYoutubeId ?? "";
        if (trimmed !== currentId) {
          let processedValue = trimmed;
          if (trimmed.length > 11) {
            try {
              const url = new URL(trimmed);
              const id1 = url.pathname;
              const id2 = url.searchParams.get("v");
              if (id1.length === 12) {
                processedValue = id1.substring(1, 12);
              }
              if (id2?.length === 11) {
                processedValue = id2;
              }
            } catch {
              toast.error(t("prompt.change_world_preview.message.error"));
              return;
            }
          }
          if (processedValue !== currentId) {
            void worldRequest
              .saveWorld({
                id: world.id,
                previewYoutubeId: processedValue,
              })
              .then((args) => {
                toast.success(t("prompt.change_world_preview.message.success"));
                return args;
              })
              .catch(logError);
          }
        }
      })
      .catch(logError);
  }

  return {
    promptRenameWorld,
    promptChangeWorldDescription,
    promptChangeWorldCapacity,
    promptChangeWorldRecommendedCapacity,
    promptChangeWorldYouTubePreview,
  };
}
