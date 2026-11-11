import { computed } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { playerModerationRequest, type InstanceModerationType } from "../../../../api/player-moderation";
import { hasGroupPermission } from "../../../../shared/utils/group";
import { parseLocation } from "../../../../shared/utils/location-parser";
import { useGameStore } from "../../../../stores/game";
import { useGroupStore } from "../../../../stores/group";
import { useLocationStore } from "../../../../stores/location";
import { useModalStore } from "../../../../stores/modal";
import { useUserStore } from "../../../../stores/user";
import { logError } from "../../../../stores/vrcx-messages";

export const MODERATION_REASON_MAX_LENGTH = 200;

const REASON_PATTERN = new RegExp(`^.{1,${String(MODERATION_REASON_MAX_LENGTH)}}$`, "su");

type GroupLookup = (groupId: string) => { myMember?: { permissions?: readonly string[] | null } | null } | undefined;

export function canModerateInstance(location: string, currentUserId: string, findGroup: GroupLookup): boolean {
  const parsed = parseLocation(location);
  if (!parsed.isRealInstance || !parsed.worldId || !parsed.instanceId || !currentUserId) {
    return false;
  }
  if (parsed.groupId) {
    return hasGroupPermission(findGroup(parsed.groupId), "group-instance-moderate");
  }
  return parsed.userId === currentUserId;
}

export function useInstanceModeration() {
  const { t } = useI18n();
  const modalStore = useModalStore();
  const groupStore = useGroupStore();
  const { userDialog, currentUser } = storeToRefs(useUserStore());
  const { isGameRunning } = storeToRefs(useGameStore());
  const { lastLocation } = storeToRefs(useLocationStore());

  const canModerateTarget = computed(() => {
    const targetId = userDialog.value.id;
    return (
      isGameRunning.value &&
      targetId !== "" &&
      targetId !== currentUser.value.id &&
      lastLocation.value.playerList.has(targetId) &&
      canModerateInstance(lastLocation.value.location, currentUser.value.id, (groupId) => groupStore.cachedGroups.get(groupId))
    );
  });

  async function run(type: InstanceModerationType): Promise<void> {
    const userId = userDialog.value.id;
    const name = userDialog.value.ref.displayName ?? userId;
    const { worldId, instanceId } = parseLocation(lastLocation.value.location);
    const { ok, value } = await modalStore.prompt({
      title: t(`dialog.user.actions.instance_${type}`),
      description: t("dialog.user.actions.instance_moderation_reason", { name }),
      pattern: REASON_PATTERN,
      errorMessage: t("dialog.user.actions.instance_moderation_reason_invalid", { max: MODERATION_REASON_MAX_LENGTH }),
    });
    const reason = Array.from(new Intl.Segmenter().segment(value.trim()), (part) => part.segment)
      .slice(0, MODERATION_REASON_MAX_LENGTH)
      .join("");
    if (!ok || !reason) {
      return;
    }
    await playerModerationRequest.moderateInstanceUser({
      userId,
      type,
      reason,
      worldId,
      instanceId,
    });
    toast.success(t(`message.user.instance_${type}_done`, { name }));
  }

  function moderateTarget(type: InstanceModerationType): void {
    void run(type).catch(logError);
  }

  return { canModerateTarget, moderateTarget };
}
