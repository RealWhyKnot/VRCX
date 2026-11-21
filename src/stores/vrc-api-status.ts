import { readonly, ref } from "vue";

const failureWindow = 60_000;
const failureThreshold = 3;
const failures: number[] = [];
const hasRecentFailures = ref(false);
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

export const hasVrcApiTrouble = readonly(hasRecentFailures);

function clearFailures() {
  clearTimeout(expiryTimer);
  expiryTimer = undefined;
  failures.length = 0;
  hasRecentFailures.value = false;
}

export function recordVrcApiStatus(status: number, now?: number) {
  if (status >= 200 && status < 300) {
    if (failures.length) clearFailures();
  } else if (status === 0 || (status >= 500 && status < 600)) {
    const failedAt = now ?? Date.now();
    while (failures[0] !== undefined && failedAt - failures[0] >= failureWindow) failures.shift();
    if (!failures.length && hasRecentFailures.value) clearFailures();
    failures.push(failedAt);
    if (failures.length > failureThreshold) failures.shift();
    if (failures.length === failureThreshold || hasRecentFailures.value) {
      hasRecentFailures.value = true;
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(clearFailures, failureWindow);
    }
  }
}
