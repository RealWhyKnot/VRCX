import type { Ref } from "vue";

import { HueToHex, updateTrustColorClasses } from "../../shared/utils/base/ui";
import { configRepository } from "../../services/config";
import { computeTrustLevel } from "../../shared/utils/user-transforms";
import { getNameColour } from "../../shared/utils/user";
import { saveSetting } from "./appearance-helpers";
import type { TrustColors } from "./appearance-helpers";
import { watchState } from "../../services/watch-state";
import type { useUserStore } from "../user";

export type TrustTarget = {
  id: string;
  tags: readonly string[];
  developerType: string;
  $isModerator: boolean;
  $isTroll: boolean;
  $isProbableTroll: boolean;
  $trustLevel: string;
  $trustClass: string;
  $trustSortNum: number;
  $userColour: string;
};

export type ColourPair = [string, number];

function isColourPair(entry: unknown): entry is ColourPair {
  return Array.isArray(entry) && typeof entry[0] === "string" && typeof entry[1] === "number";
}

export function toColourPairs(value: unknown): ColourPair[] {
  const source: readonly unknown[] = Array.isArray(value) ? value : typeof value === "object" && value !== null ? Object.entries(value) : [];
  return source.filter(isColourPair);
}

export function applyTrustLevelToUser(
  user: TrustTarget,
  trustColors: TrustColors,
  isRandomColours: boolean,
  isFriendsLoaded: boolean,
  isDarkMode: boolean
): void {
  const trust = computeTrustLevel(user.tags, user.developerType);
  user.$isModerator = trust.isModerator;
  user.$isTroll = trust.isTroll;
  user.$isProbableTroll = trust.isProbableTroll;
  user.$trustLevel = trust.trustLevel;
  user.$trustClass = trust.trustClass;
  user.$trustSortNum = trust.trustSortNum;
  if (isRandomColours && isFriendsLoaded) {
    if (!user.$userColour) {
      getNameColour(user.id, isDarkMode)
        .then((colour) => {
          user.$userColour = colour;
        })
        .catch((error: unknown) => console.error(error));
    }
  } else {
    user.$userColour = trustColors[trust.trustColorKey] ?? "";
  }
}

export function applyHueColours(users: Map<string, TrustTarget>, hues: ColourPair[], isDarkMode: boolean): void {
  for (const [userId, hue] of hues) {
    const user = users.get(userId);
    if (user !== undefined) {
      user.$userColour = HueToHex(hue, isDarkMode);
    }
  }
}

export type TrustColourDeps = {
  userStore: ReturnType<typeof useUserStore>;
  trustColor: Ref<TrustColors>;
  randomUserColours: Ref<boolean>;
  isDarkMode: Ref<boolean>;
  setRandomUserColours: () => void;
};

export function createTrustColourControls({ userStore, trustColor, randomUserColours, isDarkMode, setRandomUserColours }: TrustColourDeps) {
  function setTrustColor(color: TrustColors) {
    trustColor.value = color;
    saveSetting(configRepository.setString("VRCX_trustColor", JSON.stringify(trustColor.value)));
  }

  function applyUserTrustLevel(user: TrustTarget) {
    applyTrustLevelToUser(user, trustColor.value, randomUserColours.value, watchState.isFriendsLoaded, isDarkMode.value);
  }

  async function userColourInit(customFunc?: (userIds: IterableIterator<string>) => unknown) {
    const bulk: unknown = customFunc ? customFunc(userStore.cachedUsers.keys()) : await AppApi.GetColourBulk(Array.from(userStore.cachedUsers.keys()));
    if (!bulk) {
      console.warn("No user colour data found");
      return;
    }
    applyHueColours(userStore.cachedUsers, toColourPairs(bulk), isDarkMode.value);
  }

  async function tryInitUserColours() {
    if (!randomUserColours.value) {
      return;
    }
    const colour = await getNameColour(userStore.currentUser.id, isDarkMode.value);
    userStore.setCurrentUserColour(colour);
    await userColourInit();
  }

  async function updateTrustColor(field?: string, color?: string, isRandomColourRequested = false) {
    if (isRandomColourRequested) {
      setRandomUserColours();
    }
    if (typeof userStore.currentUser.id === "undefined") {
      return;
    }
    if (field && color) {
      setTrustColor({
        ...trustColor.value,
        [field]: color,
      });
    }
    if (randomUserColours.value) {
      const colour = await getNameColour(userStore.currentUser.id, isDarkMode.value);
      userStore.setCurrentUserColour(colour);
      await userColourInit();
    } else {
      applyUserTrustLevel(userStore.currentUser);
      userStore.cachedUsers.forEach((user) => {
        applyUserTrustLevel(user);
      });
    }
    updateTrustColorClasses(trustColor.value);
  }

  return { setTrustColor, applyUserTrustLevel, userColourInit, tryInitUserColours, updateTrustColor };
}
