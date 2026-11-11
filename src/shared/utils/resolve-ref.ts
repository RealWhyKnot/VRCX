type RefRecord = Record<string, unknown>;

type ResolveRefOptions = {
  emptyDefault: RefRecord;
  idAlias: string;
  nameKey: string;
  fetchFn: (id: string) => Promise<unknown>;
};

function isRefRecord(value: unknown): value is RefRecord {
  return typeof value === "object" && value !== null;
}

function firstTruthy(...values: unknown[]): unknown {
  return values.find((value) => Boolean(value));
}

function toIdText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function toRefSource(input: unknown, nameKey: string): RefRecord {
  if (typeof input === "string") {
    return { id: input, [nameKey]: "" };
  }
  return isRefRecord(input) ? input : {};
}

async function resolveRef(input: unknown, { emptyDefault, idAlias, nameKey, fetchFn }: ResolveRefOptions): Promise<RefRecord> {
  if (!input) {
    return emptyDefault;
  }
  const source = toRefSource(input, nameKey);
  const id = toIdText(firstTruthy(source["id"], source[idAlias]));
  let name: unknown = firstTruthy(source[nameKey]) ?? "";
  if (id && !name) {
    try {
      const args = await fetchFn(id);
      const fetchedRef = isRefRecord(args) && isRefRecord(args["ref"]) ? args["ref"] : undefined;
      name = firstTruthy(fetchedRef?.[nameKey], name) ?? "";
      return { ...fetchedRef, id, [nameKey]: name };
    } catch {
      return { ...source, id, [nameKey]: name };
    }
  }
  return { ...source, id, [nameKey]: name };
}

export { resolveRef };
