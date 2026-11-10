export function isSpacer(col) {
  return col?.id === "__spacer";
}

export function isStretch(col) {
  return !!col?.columnDef?.meta?.stretch;
}

export function resolveHeaderLabel(col) {
  const label = col?.columnDef?.meta?.label;
  if (typeof label === "function") return label();
  return label ?? col?.id ?? "";
}

export function getToggleableColumns(cols) {
  if (!Array.isArray(cols)) return [];
  return cols.filter((col) => {
    if (isSpacer(col)) return false;
    if (col.columnDef?.meta?.disableVisibilityToggle) return false;
    if (!col.columnDef?.meta?.label) return false;
    return true;
  });
}

export function getColStyle(col) {
  if (isSpacer(col)) return { width: "0px" };
  if (isStretch(col)) return null;

  const size = col?.getSize?.();
  if (!Number.isFinite(size)) return null;
  return { width: `${size}px` };
}

export function isReorderable(header, getPinnedState) {
  const col = header?.column;
  if (!col) return false;
  if (isSpacer(col)) return false;
  if (!col.columnDef?.meta?.label) return false;
  if (getPinnedState?.(col)) return false;
  if (col.columnDef?.meta?.disableReorder) return false;
  return true;
}
