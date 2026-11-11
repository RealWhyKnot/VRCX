import { createPinia } from "pinia";

import { getSentry, isSentryOptedIn } from "../plugins/sentry";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { useActivityStore } from "./activity";
import { useAppearanceSettingsStore } from "./settings/appearance";
import { useAuthStore } from "./auth";
import { useAvatarProviderStore } from "./avatar-provider";
import { useAvatarStore } from "./avatar";
import { useChartsStore } from "./charts";
import { useDashboardStore } from "./dashboard";
import { useExternalLinkStore } from "./external-link";
import { useDiscordPresenceSettingsStore } from "./settings/discord-presence";
import { useFavoriteStore } from "./favorite";
import { useFeedStore } from "./feed";
import { useFriendStore } from "./friend";
import { useGalleryStore } from "./gallery";
import { useGameLogStore } from "./gameLog";
import { useGameStore } from "./game";
import { useGeneralSettingsStore } from "./settings/general";
import { useQuickSearchStore } from "./quick-search";
import { useGroupStore } from "./group";
import { useInstanceStore } from "./instance";
import { useInviteStore } from "./invite";
import { useLaunchStore } from "./launch";
import { useLocationStore } from "./location";
import { useModalStore } from "./modal";
import { useModerationStore } from "./moderation";
import { useNotificationStore } from "./notification";
import { useNotificationsSettingsStore } from "./settings/notifications";
import { usePhotonStore } from "./photon";
import { useSearchStore } from "./search";
import { useSharedFeedStore } from "./shared-feed";
import { useUiStore } from "./ui";
import { useToolsStore } from "./tools";
import { useUpdateLoopStore } from "./update-loop";
import { useUserStore } from "./user";
import { useVRCXUpdaterStore } from "./vrcx-updater";
import { useVrStore } from "./vr";
import { useVrcStatusStore } from "./vrc-status";
import { useVrcxStore } from "./vrcx";
import { useWorldStore } from "./world";
import { useWristOverlaySettingsStore } from "./settings/wrist-overlay";

export const pinia = createPinia();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stateSlice(state: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = state[key];
  return isRecord(value) ? value : {};
}

async function registerSentryPiniaPlugin() {
  if (!isBuildNightly) return;
  if (!(await isSentryOptedIn())) return;

  const Sentry = await getSentry();
  if (Sentry === null) return;

  pinia.use(
    Sentry.createSentryPiniaPlugin({
      stateTransformer: (state: Record<string, unknown>) => ({
        ...state,
        Auth: null,
        Feed: null,
        Favorite: null,
        Friend: null,
        User: {
          ...stateSlice(state, "User"),
          currentUser: null,
          subsetOfLanguages: null,
        },
        GameLog: {
          ...stateSlice(state, "GameLog"),
          gameLogTable: null,
        },
        Notification: {
          ...stateSlice(state, "Notification"),
          notificationTable: null,
        },
        Moderation: {
          ...stateSlice(state, "Moderation"),
          playerModerationTable: null,
          cachedPlayerModerations: null,
          cachedPlayerModerationsUserIds: null,
        },
        Photon: null,
        SharedFeed: {
          ...stateSlice(state, "SharedFeed"),
          sharedFeedData: null,
        },
        Group: {
          ...stateSlice(state, "Group"),
          groupInstances: null,
          inGameGroupOrder: null,
        },
        Avatar: {
          ...stateSlice(state, "Avatar"),
          avatarHistory: null,
        },
        Gallery: {
          ...stateSlice(state, "Gallery"),
          emojiTable: null,
          galleryTable: null,
          instanceStickersCache: null,
          inventoryTable: null,
          printTable: null,
          stickerTable: null,
          VRCPlusIconsTable: null,
        },
      }),
    })
  );
}

export async function initPiniaPlugins() {
  await registerSentryPiniaPlugin();
}

export function createGlobalStores() {
  return {
    advancedSettings: useAdvancedSettingsStore(),
    activity: useActivityStore(),
    appearanceSettings: useAppearanceSettingsStore(),
    discordPresenceSettings: useDiscordPresenceSettingsStore(),
    generalSettings: useGeneralSettingsStore(),
    notificationsSettings: useNotificationsSettingsStore(),
    wristOverlaySettings: useWristOverlaySettingsStore(),
    avatarProvider: useAvatarProviderStore(),
    externalLink: useExternalLinkStore(),
    favorite: useFavoriteStore(),
    friend: useFriendStore(),
    photon: usePhotonStore(),
    user: useUserStore(),
    vrcxUpdater: useVRCXUpdaterStore(),
    avatar: useAvatarStore(),
    world: useWorldStore(),
    group: useGroupStore(),
    location: useLocationStore(),
    instance: useInstanceStore(),
    moderation: useModerationStore(),
    invite: useInviteStore(),
    gallery: useGalleryStore(),
    notification: useNotificationStore(),
    feed: useFeedStore(),
    ui: useUiStore(),
    tools: useToolsStore(),
    gameLog: useGameLogStore(),
    search: useSearchStore(),
    game: useGameStore(),
    launch: useLaunchStore(),
    vr: useVrStore(),
    vrcx: useVrcxStore(),
    sharedFeed: useSharedFeedStore(),
    updateLoop: useUpdateLoopStore(),
    auth: useAuthStore(),
    vrcStatus: useVrcStatusStore(),
    charts: useChartsStore(),
    dashboard: useDashboardStore(),
    modal: useModalStore(),
    quickSearch: useQuickSearchStore(),
  };
}
