import type { useI18n } from "vue-i18n";

import { isPromptResult } from "./photon-guards";
import type { useVrStore } from "./vr";
import type { useModalStore } from "./modal";
import type { PhotonState } from "./photon-types";

export type CreatePhotonTimeoutPromptsDeps = {
  vrStore: ReturnType<typeof useVrStore>;
  modalStore: ReturnType<typeof useModalStore>;
  state: PhotonState;
  t: ReturnType<typeof useI18n>["t"];
};

export function createPhotonTimeoutPrompts(deps: CreatePhotonTimeoutPromptsDeps) {
  const { vrStore, modalStore, state, t } = deps;

  function promptPhotonOverlayMessageTimeout() {
    modalStore
      .prompt({
        title: t("prompt.overlay_message_timeout.header"),
        description: t("prompt.overlay_message_timeout.description"),
        confirmText: t("prompt.overlay_message_timeout.ok"),
        cancelText: t("prompt.overlay_message_timeout.cancel"),
        inputValue: (state.photonOverlayMessageTimeout / 1000).toString(),
        pattern: /\d+$/,
        errorMessage: t("prompt.overlay_message_timeout.input_error"),
      })
      .then((result: unknown) => {
        if (!isPromptResult(result) || !result.ok) return;
        const value = result.value;
        if (value && !isNaN(Number(value))) {
          state.photonOverlayMessageTimeout = Math.trunc(Number(value) * 1000);
          vrStore.updateVRConfigVars();
        }
      })
      .catch((error: unknown) => console.debug(error));
  }

  function promptPhotonLobbyTimeoutThreshold() {
    modalStore
      .prompt({
        title: t("prompt.photon_lobby_timeout.header"),
        description: t("prompt.photon_lobby_timeout.description"),
        confirmText: t("prompt.photon_lobby_timeout.ok"),
        cancelText: t("prompt.photon_lobby_timeout.cancel"),
        inputValue: (state.photonLobbyTimeoutThreshold / 1000).toString(),
        pattern: /\d+$/,
        errorMessage: t("prompt.photon_lobby_timeout.input_error"),
      })
      .then((result: unknown) => {
        if (!isPromptResult(result) || !result.ok) return;
        const value = result.value;
        if (value && !isNaN(Number(value))) {
          state.photonLobbyTimeoutThreshold = Math.trunc(Number(value) * 1000);
        }
      })
      .catch((error: unknown) => console.debug(error));
  }

  return {
    promptPhotonOverlayMessageTimeout,
    promptPhotonLobbyTimeoutThreshold,
  };
}
