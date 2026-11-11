import type { useI18n } from "vue-i18n";
import type { Ref } from "vue";

import { configRepository } from "../../services/config";
import { logSaveFailure, logDialogFailure } from "./advanced-failure-logs";
import type { useVRCXUpdaterStore } from "../vrcx-updater";
import type { useModalStore } from "../modal";

export type CreateAdvancedSentryDeps = {
  VRCXUpdaterStore: ReturnType<typeof useVRCXUpdaterStore>;
  modalStore: ReturnType<typeof useModalStore>;
  sentryErrorReporting: Ref<boolean>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createAdvancedSentry(deps: CreateAdvancedSentryDeps) {
  const { VRCXUpdaterStore, modalStore, sentryErrorReporting, t } = deps;

  function checkSentryConsent() {
    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.anonymous_error_reporting.consent_description"),
        title: t("view.settings.advanced.advanced.anonymous_error_reporting.consent_title"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        void modalStore
          .confirm({
            description: t("view.settings.advanced.advanced.anonymous_error_reporting.enabled_restart_description"),
            title: t("confirm.restart_required_title"),
            confirmText: t("confirm.restart_now"),
            cancelText: t("confirm.restart_later"),
          })
          .then(({ ok }) => {
            if (!ok) return;

            sentryErrorReporting.value = true;
            void configRepository.setBool("VRCX_SentryEnabled", true).catch(logSaveFailure);

            VRCXUpdaterStore.restartVRCX(false);
          })
          .catch(logDialogFailure);
      })
      .catch(logDialogFailure);
  }

  function setSentryErrorReporting() {
    if (VRCXUpdaterStore.branch !== "Nightly") return;

    void modalStore
      .confirm({
        description: t("view.settings.advanced.advanced.anonymous_error_reporting.disabled_restart_description"),
        title: t("confirm.restart_required_title"),
        confirmText: t("confirm.restart_now"),
        cancelText: t("confirm.restart_later"),
      })
      .then(async ({ ok }) => {
        if (!ok) return;

        sentryErrorReporting.value = !sentryErrorReporting.value;
        await configRepository.setBool("VRCX_SentryEnabled", sentryErrorReporting.value);
        VRCXUpdaterStore.restartVRCX(false);
      })
      .catch(logDialogFailure);
  }

  return {
    checkSentryConsent,
    setSentryErrorReporting,
  };
}
