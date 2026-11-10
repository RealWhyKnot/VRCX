import { avatarModerationRequest, playerModerationRequest } from "../api";
import { useAvatarStore } from "../stores/avatar";
import { useModerationStore } from "../stores/moderation";

export async function runRefreshPlayerModerationsFlow() {
  const moderationStore = useModerationStore();
  const avatarStore = useAvatarStore();

  if (moderationStore.playerModerationTable.loading) {
    return;
  }
  moderationStore.playerModerationTable.loading = true;
  moderationStore.expirePlayerModerations();
  Promise.all([playerModerationRequest.getPlayerModerations(), avatarModerationRequest.getAvatarModerations()])
    .then((res) => {
      avatarStore.resetCachedAvatarModerations();
      if (res[1]?.json) {
        for (const json of res[1].json) {
          avatarStore.applyAvatarModeration(json);
        }
      }
      if (res[0]?.json) {
        for (const json of res[0].json) {
          moderationStore.applyPlayerModeration(json);
        }
      }
      moderationStore.deleteExpiredPlayerModerations();
    })
    .catch((error) => {
      console.error("Failed to load player/avatar moderations:", error);
    })
    .finally(() => {
      moderationStore.playerModerationTable.loading = false;
    });
}
