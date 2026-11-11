export function resolveFavoriteGroups(stored: string[], allKeys: string[]): string[] {
  if (stored.length === 0) {
    return allKeys;
  }
  return stored;
}

export function normalizeFavoriteGroupsChange(value: string[] | null | undefined, allKeys: string[]): string[] {
  if (!value || value.length === 0) {
    return [];
  }
  if (value.length >= allKeys.length && allKeys.every((k) => value.includes(k))) {
    return [];
  }
  return value;
}
