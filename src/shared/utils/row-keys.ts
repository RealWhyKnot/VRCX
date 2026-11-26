export function createRowKeys() {
  const keys = new WeakMap<object, number>();
  let lastKey = 0;
  return (row: object): number => {
    const known = keys.get(row);
    if (known !== undefined) {
      return known;
    }
    lastKey += 1;
    keys.set(row, lastKey);
    return lastKey;
  };
}
