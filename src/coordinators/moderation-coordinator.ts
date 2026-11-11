import { avatarModerationRequest } from "../api/avatar-moderation";
import { playerModerationRequest } from "../api/player-moderation";
import { useAvatarStore } from "../stores/avatar";
import { useModerationStore } from "../stores/moderation";

export function runRefreshPlayerModerationsFlow(): Promise<void> {
  const moderationStore = useModerationStore();
  const avatarStore = useAvatarStore();

  if (moderationStore.playerModerationTable.loading) {
    return Promise.resolve();
  }
  moderationStore.playerModerationTable.loading = true;
  moderationStore.expirePlayerModerations();
  return Promise.all([playerModerationRequest.getPlayerModerations(), avatarModerationRequest.getAvatarModerations()])
    .then((res) => {
      avatarStore.resetCachedAvatarModerations();
      for (const json of res[1].json) {
        avatarStore.applyAvatarModeration(json);
      }
      for (const json of res[0].json) {
        moderationStore.applyPlayerModeration(json);
      }
      moderationStore.deleteExpiredPlayerModerations();
    })
    .catch((error: unknown) => {
      console.error("Failed to load player/avatar moderations:", error);
    })
    .finally(() => {
      moderationStore.playerModerationTable.loading = false;
    });
}
