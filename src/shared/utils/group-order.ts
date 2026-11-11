import { moveArrayItem } from "./base/array";

export function normalizeGroupOrder(order: readonly string[], groupIds: readonly string[]): string[] {
  const validGroupIds = new Set(groupIds);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const groupId of order) {
    if (validGroupIds.has(groupId) && !seen.has(groupId)) {
      normalized.push(groupId);
      seen.add(groupId);
    }
  }
  for (const groupId of groupIds) {
    if (!seen.has(groupId)) {
      normalized.push(groupId);
      seen.add(groupId);
    }
  }

  return normalized;
}

export function moveGroupInOrder(order: string[], groupId: string, toIndex: number): boolean {
  const fromIndex = order.indexOf(groupId);
  if (fromIndex === -1 || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) {
    return false;
  }

  moveArrayItem(order, fromIndex, toIndex);
  return true;
}
