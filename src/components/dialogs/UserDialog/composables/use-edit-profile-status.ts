import { computed } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import type { UserStatus } from "vrchat";
import type { CurrentUserState, EditProfileDialogState } from "@/stores/user-state";
import { isUserStatus, useStatusPresets } from "./use-status-presets";
import type { StatusPreset } from "./use-status-presets";

type Translate = ReturnType<typeof useI18n>["t"];
type StatusOption = { value: UserStatus; statusClass: string; label: string };

export function useEditProfileStatus(editProfileDialog: Ref<EditProfileDialogState>, currentUser: Ref<CurrentUserState>, t: Translate) {
  const { presets, addPreset, removePreset, getStatusClass, MAX_PRESETS: maxPresets } = useStatusPresets();

  const statusOptions = computed(() => {
    const options: StatusOption[] = [
      {
        value: "join me",
        statusClass: "joinme",
        label: t("dialog.user.status.join_me"),
      },
      {
        value: "active",
        statusClass: "online",
        label: t("dialog.user.status.online"),
      },
      {
        value: "ask me",
        statusClass: "askme",
        label: t("dialog.user.status.ask_me"),
      },
      {
        value: "busy",
        statusClass: "busy",
        label: t("dialog.user.status.busy"),
      },
    ];
    if (currentUser.value.$isModerator) {
      options.push({
        value: "offline",
        statusClass: "offline",
        label: t("dialog.user.status.offline"),
      });
    }
    return options;
  });

  const selectedStatusOption = computed(() => statusOptions.value.find((option) => option.value === editProfileDialog.value.status));
  const historyItems = computed(() => editProfileDialog.value.socialStatusHistoryTable);

  function getStatusLabel(status: string) {
    const option = statusOptions.value.find((item) => item.value === status);
    if (!option?.label) {
      return status;
    }
    return option.label;
  }

  function applyPreset(preset: StatusPreset) {
    editProfileDialog.value.status = preset.status;
    editProfileDialog.value.statusDescription = preset.statusDescription;
  }

  async function handleSavePreset() {
    const D = editProfileDialog.value;
    if (!isUserStatus(D.status)) return;
    const result = await addPreset(D.status, D.statusDescription);
    if (result === "ok") {
      toast.success(t("dialog.social_status.preset_saved"));
    } else if (result === "exists") {
      toast.info(t("dialog.social_status.preset_exists"));
    } else {
      toast.warning(t("dialog.social_status.preset_limit", { max: maxPresets }));
    }
  }

  async function handleDeletePreset(index: number) {
    await removePreset(index);
  }

  function handleSocialStatusChange(value: unknown) {
    editProfileDialog.value.status = String(value);
  }

  function setSocialStatusFromHistory(val: { status: string } | null) {
    if (val === null) {
      return;
    }
    editProfileDialog.value.statusDescription = val.status;
  }

  return {
    presets,
    getStatusClass,
    statusOptions,
    selectedStatusOption,
    historyItems,
    getStatusLabel,
    applyPreset,
    handleSavePreset,
    handleDeletePreset,
    handleSocialStatusChange,
    setSocialStatusFromHistory,
  };
}
