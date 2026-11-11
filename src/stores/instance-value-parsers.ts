import type { GroupAccessType } from "vrchat";

import { accessTypeLocaleKeyMap } from "../shared/constants/access-type";

export function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function joinTimeOrNow(storedJoinTime: number | undefined): number {
  if (storedJoinTime) {
    return storedJoinTime;
  }
  return Date.now();
}

export function groupAccessTypeOf(value: string): GroupAccessType | undefined {
  if (value === "members" || value === "plus" || value === "public") {
    return value;
  }
  return undefined;
}

export function localeKeyOf(accessType: string): string | undefined {
  const entry = Object.entries(accessTypeLocaleKeyMap).find(([name]) => name === accessType);
  return entry?.[1];
}
