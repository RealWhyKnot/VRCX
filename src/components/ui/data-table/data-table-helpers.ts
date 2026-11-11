import type { CSSProperties } from "vue";

export type ColumnLike = {
  readonly id: string;
  readonly columnDef: { readonly meta?: unknown };
  getSize?: () => number;
};

type HeaderLike<TColumn extends ColumnLike> = {
  readonly column?: TColumn | undefined;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readMeta(col: ColumnLike | null | undefined): Record<string, unknown> {
  return asRecord(col?.columnDef.meta);
}

function isLabelGetter(value: unknown): value is () => string {
  return typeof value === "function";
}

export function isSpacer(col: { readonly id: string } | null | undefined): boolean {
  return col?.id === "__spacer";
}

export function isStretch(col: ColumnLike | null | undefined): boolean {
  return Boolean(readMeta(col)["stretch"]);
}

export function resolveHeaderLabel(col: ColumnLike | null | undefined): string {
  const label = readMeta(col)["label"];
  if (isLabelGetter(label)) return label();
  if (typeof label === "string") return label;
  return col?.id ?? "";
}

export function getToggleableColumns<TColumn extends ColumnLike>(cols: readonly TColumn[] | null | undefined): TColumn[] {
  if (!cols) return [];
  return cols.filter((col) => {
    if (isSpacer(col)) return false;
    const meta = readMeta(col);
    if (meta["disableVisibilityToggle"]) return false;
    if (!meta["label"]) return false;
    return true;
  });
}

export function getColStyle(col: ColumnLike | null | undefined): CSSProperties | null {
  if (isSpacer(col)) return { width: "0px" };
  if (isStretch(col)) return null;

  const size = col?.getSize?.();
  if (size === undefined || !Number.isFinite(size)) return null;
  return { width: `${size}px` };
}

export function isReorderable<TColumn extends ColumnLike>(
  header: HeaderLike<TColumn> | null | undefined,
  getPinnedState: ((col: TColumn) => unknown) | undefined
): boolean {
  const col = header?.column;
  if (!col) return false;
  if (isSpacer(col)) return false;
  const meta = readMeta(col);
  if (!meta["label"]) return false;
  if (getPinnedState?.(col)) return false;
  if (meta["disableReorder"]) return false;
  return true;
}
