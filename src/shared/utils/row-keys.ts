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

export function createTableRowIds() {
  const rowKey = createRowKeys();
  return (row: { rowId?: unknown; type?: unknown }): string => (typeof row.rowId === "number" ? `row:${row.rowId}:${String(row.type)}` : `live:${rowKey(row)}`);
}
