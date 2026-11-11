import { ref } from "vue";
import type { UserStatus } from "vrchat";
import { configRepository } from "../../../../services/config";

export type StatusPreset = { status: UserStatus; statusDescription: string };

export type AddStatusPresetResult = "limit" | "exists" | "ok";

const STORAGE_KEY = "VRCX_statusPresets";
const MAX_PRESETS = 10;

const STATUS_CLASS_MAP = {
  "join me": "joinme",
  active: "online",
  "ask me": "askme",
  busy: "busy",
  offline: "offline",
} as const satisfies Record<UserStatus, string>;

const presets = ref<StatusPreset[]>([]);
let loadPromise: Promise<void> | null = null;

export function isUserStatus(value: string): value is UserStatus {
  return Object.hasOwn(STATUS_CLASS_MAP, value);
}

function isStatusPreset(value: unknown): value is StatusPreset {
  if (typeof value !== "object" || value === null) return false;
  if (!("status" in value) || !("statusDescription" in value)) return false;
  return typeof value.status === "string" && isUserStatus(value.status) && typeof value.statusDescription === "string";
}

export function useStatusPresets() {
  async function loadPresets() {
    try {
      const stored: unknown[] = await configRepository.getArray(STORAGE_KEY, []);
      presets.value = stored.filter(isStatusPreset);
    } catch {
      presets.value = [];
    }
  }

  async function addPreset(status: UserStatus, statusDescription: string): Promise<AddStatusPresetResult> {
    if (presets.value.length >= MAX_PRESETS) {
      return "limit";
    }
    const hasDuplicate = presets.value.some((p) => p.status === status && p.statusDescription === statusDescription);
    if (hasDuplicate) {
      return "exists";
    }
    presets.value.push({ status, statusDescription });
    await configRepository.setArray(STORAGE_KEY, presets.value);
    return "ok";
  }

  async function removePreset(index: number) {
    presets.value.splice(index, 1);
    await configRepository.setArray(STORAGE_KEY, presets.value);
  }

  function getStatusClass(status: UserStatus): string {
    return STATUS_CLASS_MAP[status];
  }

  loadPromise ??= loadPresets();

  return {
    presets,
    loadPresets,
    addPreset,
    removePreset,
    getStatusClass,
    MAX_PRESETS,
  };
}
