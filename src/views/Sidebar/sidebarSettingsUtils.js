export function resolveFavoriteGroups(stored, allKeys) {
  if (stored.length === 0) {
    return allKeys;
  }
  return stored;
}

export function normalizeFavoriteGroupsChange(value, allKeys) {
  if (!value || value.length === 0) {
    return [];
  }
  if (value.length >= allKeys.length && allKeys.every((k) => value.includes(k))) {
    return [];
  }
  return value;
}
