import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { userRequest } from "../../../../api/user";
import { logError } from "../../../../stores/notification/errors";

type AccountStandingDetail = {
  sanctionCount: number;
  issueClearDays: number;
};

export function useAccountStanding(isOwnProfileOpen: () => boolean) {
  const { t } = useI18n();
  const detail = ref<AccountStandingDetail | null>(null);

  async function loadAccountStanding(): Promise<void> {
    try {
      const { json } = await userRequest.getAccountStanding();
      detail.value = {
        sanctionCount: Array.isArray(json.sanctions) ? json.sanctions.length : 0,
        issueClearDays: typeof json.issueClearDays === "number" ? json.issueClearDays : 0,
      };
    } catch (err) {
      detail.value = null;
      logError(err);
    }
  }

  watch(
    isOwnProfileOpen,
    (isOpen) => {
      if (isOpen) {
        loadAccountStanding().catch(logError);
      }
    },
    { immediate: true }
  );

  const accountStandingTooltip = computed(() => {
    const lines = [t("dialog.user.tags.account_standing")];
    if (detail.value) {
      lines.push(t("dialog.user.tags.account_standing_sanctions", { count: detail.value.sanctionCount }));
      if (detail.value.issueClearDays > 0) {
        lines.push(t("dialog.user.tags.account_standing_clear_days", { count: detail.value.issueClearDays }));
      }
    }
    return lines.join("\n");
  });

  return { accountStandingTooltip, loadAccountStanding };
}
