import { useLocalStorage } from "@vueuse/core";
import * as workerTimers from "worker-timers";

import { useGeneralSettingsStore } from "../stores/settings/general";

const recentActions = useLocalStorage<Record<string, number>>("VRCX_recentActions", {});

const TRACKED_ACTIONS = new Set([
  "Send Friend Request",
  "Invite",
  "Invite Photo",
  "Invite Message",
  "Request Invite",
  "Request Invite Photo",
  "Request Invite Message",
]);

const RECENT_ACTIONS_PURGE_MS = 30000;
let recentActionsPurgeTimer: number | null = null;

function purgeExpiredRecentActions(): void {
  const cooldownMs = useGeneralSettingsStore().recentActionCooldownMinutes * 60 * 1000;
  const now = Date.now();
  for (const key of Object.keys(recentActions.value)) {
    const ts = recentActions.value[key];
    if (!ts || now - ts >= cooldownMs) {
      Reflect.deleteProperty(recentActions.value, key);
    }
  }
}

function ensureRecentActionsPurge(): void {
  if (recentActionsPurgeTimer !== null) {
    return;
  }
  recentActionsPurgeTimer = workerTimers.setInterval(purgeExpiredRecentActions, RECENT_ACTIONS_PURGE_MS);
}

export function recordRecentAction(userId: string, actionType: string): void {
  if (!TRACKED_ACTIONS.has(actionType)) {
    return;
  }
  ensureRecentActionsPurge();
  recentActions.value[`${userId}:${actionType}`] = Date.now();
}

export function isActionRecent(userId: string, actionType: string): boolean {
  const generalSettings = useGeneralSettingsStore();
  if (!generalSettings.recentActionCooldownEnabled) {
    return false;
  }
  ensureRecentActionsPurge();
  const key = `${userId}:${actionType}`;
  const ts = recentActions.value[key];
  if (!ts) {
    return false;
  }
  const cooldownMs = generalSettings.recentActionCooldownMinutes * 60 * 1000;
  if (Date.now() - ts < cooldownMs) {
    return true;
  }

  Reflect.deleteProperty(recentActions.value, key);
  return false;
}

export function clearRecentActions(): void {
  recentActions.value = {};
}
