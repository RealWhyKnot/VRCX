import { type Ref } from "vue";
import type { FavoriteGroupSlot, LocalFavoriteGroups } from "./favorite-types";

export function createFavoriteSlot(type: string, name: string, displayName: string, capacity: number): FavoriteGroupSlot {
  return {
    assign: false,
    key: `${type}:${name}`,
    type,
    name,
    displayName,
    capacity,
    count: 0,
    visibility: "private",
  };
}

export function flattenFavoriteGroups<T>(groups: LocalFavoriteGroups<T>): T[] {
  return Object.values(groups).flatMap((group) => group ?? []);
}

export function syncFavoriteSelection(list: { id: string }[], selectionRef: Ref<string[]>) {
  const availableIds = new Set(list.map((item) => item.id));
  const filtered = selectionRef.value.filter((id) => availableIds.has(id));
  if (filtered.length !== selectionRef.value.length) {
    selectionRef.value = filtered;
  }
}
