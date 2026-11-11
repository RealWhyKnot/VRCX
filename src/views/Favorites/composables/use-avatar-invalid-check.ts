import { markRaw, reactive } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { useFavoritesGroupPanel } from "./use-favorites-group-panel.ts";
import { useModalStore } from "../../../stores/modal";
import { checkInvalidLocalAvatars, removeInvalidLocalAvatars } from "../../../coordinators/favorite-local-avatars";
import { InvalidAvatarsProgressToast } from "../components/invalid-avatars-progress-toast.tsx";

export function useAvatarInvalidCheck({
  handleGroupMenuVisible,
  localGroupMenuKey,
}: {
  handleGroupMenuVisible: ReturnType<typeof useFavoritesGroupPanel>["handleGroupMenuVisible"];
  localGroupMenuKey: ReturnType<typeof useFavoritesGroupPanel>["localGroupMenuKey"];
}) {
  const { t } = useI18n();
  const modalStore = useModalStore();

  async function handleCheckInvalidAvatars(groupName: string) {
    handleGroupMenuVisible(localGroupMenuKey(groupName), false);

    const startCheckResult = await modalStore.confirm({
      description: t("view.favorite.avatars.check_description"),
      title: t("view.favorite.avatars.check_invalid"),
      confirmText: t("confirm.confirm_button"),
      cancelText: t("confirm.cancel_button"),
    });

    if (!startCheckResult.ok) {
      return;
    }

    const progressState = reactive({
      current: 0,
      total: 0,
      percentage: 0,
    });

    let progressToastId: string | number | undefined;

    try {
      progressToastId = toast(markRaw(InvalidAvatarsProgressToast), {
        duration: Infinity,
        componentProps: {
          t,
          progress: progressState,
          onDismiss: () => {
            if (progressToastId) {
              toast.dismiss(progressToastId);
            }
          },
        },
      });

      const result = await checkInvalidLocalAvatars(groupName, (current, total) => {
        progressState.current = current;
        progressState.total = total;
        progressState.percentage = total ? Math.floor((current / total) * 100) : 0;
      });

      if (progressToastId) {
        toast.dismiss(progressToastId);
      }

      if (result.invalid === 0) {
        toast.success(t("view.favorite.avatars.no_invalid_found"));
        return;
      }

      const invalidIdsText = result.invalidIds.join("\n");

      const confirmDeleteResult = await modalStore.confirm({
        description:
          t("view.favorite.avatars.confirm_delete_description", { count: result.invalid }) +
          `\n\n${t("view.favorite.avatars.removed_list_header")}\n` +
          invalidIdsText,
        title: t("view.favorite.avatars.confirm_delete_invalid"),
        confirmText: t("confirm.confirm_button"),
        cancelText: t("view.favorite.avatars.copy_removed_ids"),
        destructive: true,
      });

      if (!confirmDeleteResult.ok) {
        if (confirmDeleteResult.reason === "cancel") {
          navigator.clipboard
            .writeText(invalidIdsText)
            .then(() => {
              toast.success(t("view.favorite.avatars.copied_ids"));
            })
            .catch(() => {
              toast.error(t("view.favorite.avatars.copy_failed"));
            });
        }
        toast.info(t("view.favorite.avatars.delete_cancelled"));
        return;
      }

      const removeResult = await removeInvalidLocalAvatars(result.invalidIds, groupName);

      toast.success(
        t("view.favorite.avatars.delete_summary", {
          removed: removeResult.removed,
        })
      );
    } catch (err) {
      if (progressToastId) {
        toast.dismiss(progressToastId);
      }
      console.error(err);
      toast.error(err instanceof Error && err.message ? err.message : String(err));
    }
  }

  return { handleCheckInvalidAvatars };
}
