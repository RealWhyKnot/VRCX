import type { AcceptableValue } from "reka-ui";
import { groupRequest } from "../../../api/group";
export type CalendarEventParams = Parameters<typeof groupRequest.createGroupEvent>[0];
export type CalendarEventRecurrence = NonNullable<CalendarEventParams["recurrence"]>;
export type CalendarDayOfWeek = NonNullable<CalendarEventRecurrence["daysOfWeek"]>[number];
export type CalendarEventPlatform = NonNullable<CalendarEventParams["platforms"]>[number];
type CalendarEventFrequency = CalendarEventRecurrence["frequency"];
type CalendarEventAccess = CalendarEventParams["accessType"];
type CalendarEventCategory = CalendarEventParams["category"];

export const categoryOptions: CalendarEventCategory[] = [
  "arts",
  "avatars",
  "dance",
  "education",
  "exploration",
  "film_media",
  "gaming",
  "hangout",
  "music",
  "other",
  "performance",
  "roleplaying",
  "wellness",
];
export const platformOptions: CalendarEventPlatform[] = ["android", "ios", "standalonewindows"];
const weekDays: CalendarDayOfWeek[] = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

export function isAccessType(value: string): value is CalendarEventAccess {
  return value === "group" || value === "public";
}

export function isCategory(value: string): value is CalendarEventCategory {
  return categoryOptions.some((category) => category === value);
}

export function isPlatform(value: string): value is CalendarEventPlatform {
  return platformOptions.some((platform) => platform === value);
}

export function isWeekDay(value: unknown): value is CalendarDayOfWeek {
  return weekDays.some((day) => day === value);
}

export function isFrequency(value: AcceptableValue): value is CalendarEventFrequency {
  return value === "daily" || value === "weekly" || value === "monthly" || value === "yearly";
}

export function toLocalDateTime(value: string | undefined) {
  const date = new Date(value ?? "");
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIsoDateTime(value: string) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
