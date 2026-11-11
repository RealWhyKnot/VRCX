function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function removeFromArray<T>(array: T[], item: T): boolean {
  const index = array.indexOf(item);
  if (index === -1) {
    return false;
  }
  array.splice(index, 1);
  return true;
}

function arraysMatch(a: unknown, b: unknown): boolean {
  if (!isUnknownArray(a) || !isUnknownArray(b)) {
    return false;
  }
  return a.length === b.length && a.every((element, index) => JSON.stringify(element) === JSON.stringify(b[index]));
}

function moveArrayItem(array: unknown[] | null | undefined, fromIndex: number, toIndex: number): void {
  if (!array || fromIndex === toIndex) {
    return;
  }
  if (fromIndex < 0 || fromIndex >= array.length) {
    return;
  }
  if (toIndex < 0 || toIndex >= array.length) {
    return;
  }
  array.splice(toIndex, 0, ...array.splice(fromIndex, 1));
}

function replaceReactiveObject<V>(target: Record<string, V>, source: Record<string, V>): void {
  for (const key of Object.keys(target)) {
    Reflect.deleteProperty(target, key);
  }

  for (const [key, value] of Object.entries(source)) {
    target[key] = value;
  }
}

export { removeFromArray, arraysMatch, moveArrayItem, replaceReactiveObject };
