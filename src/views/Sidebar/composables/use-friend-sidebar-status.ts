import { computed } from "vue";
import type { Ref } from "vue";
import type { ComposerTranslation } from "vue-i18n";
import { toast } from "vue-sonner";
import type { UserStatus } from "vrchat";
import { userRequest } from "../../../api/user";
import { logFailure } from "../../../stores/log-failure";
import type { CurrentUserState } from "../../../stores/user-state";

type StatusOption = { value: UserStatus; statusClass: string; label: string };
export type StatusPreset = { status: UserStatus; statusDescription: string };

type FriendSidebarStatusDeps = {
  t: ComposerTranslation;
  currentUser: Ref<CurrentUserState>;
  showEditProfileDialog: () => void;
};

export function useFriendSidebarStatus({ t, currentUser, showEditProfileDialog }: FriendSidebarStatusDeps) {
  const statusOptions = computed<StatusOption[]>(() => [
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
  ]);

  const recentStatuses = computed(() => {
    const history = currentUser.value.statusHistory;
    if (!history.length) return [];
    return history.slice(0, 10);
  });

  function changeStatus(value: UserStatus) {
    void userRequest
      .saveCurrentUser({ status: value })
      .then(() => {
        toast.success("Status updated");
      })
      .catch(logFailure("change status"));
  }

  function setStatusFromHistory(status: string) {
    void userRequest
      .saveCurrentUser({ statusDescription: status })
      .then(() => {
        toast.success("Status updated");
      })
      .catch(logFailure("set status from history"));
  }

  function getPresetDisplayText(preset: StatusPreset): string {
    if (preset.statusDescription) return preset.statusDescription;
    const option = statusOptions.value.find((o) => o.value === preset.status);
    const label = option?.label;
    if (label) return label;
    return preset.status;
  }

  function applyStatusPreset(preset: StatusPreset) {
    void userRequest
      .saveCurrentUser({
        status: preset.status,
        statusDescription: preset.statusDescription,
      })
      .then(() => {
        toast.success("Status updated");
      })
      .catch(logFailure("apply status preset"));
  }

  function openEditProfileFromSidebar() {
    showEditProfileDialog();
  }

  return {
    statusOptions,
    recentStatuses,
    changeStatus,
    setStatusFromHistory,
    getPresetDisplayText,
    applyStatusPreset,
    openEditProfileFromSidebar,
  };
}
