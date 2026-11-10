async function resolveRef(input, { emptyDefault, idAlias, nameKey, fetchFn }) {
  if (!input) {
    return emptyDefault;
  }
  if (typeof input === "string") {
    input = { id: input, [nameKey]: "" };
  }
  const id = input.id || input[idAlias] || "";
  let name = input[nameKey] || "";
  if (id && !name) {
    try {
      const args = await fetchFn(id);
      name = args?.ref?.[nameKey] || name;
      return { ...args.ref, id, [nameKey]: name };
    } catch {
      return { ...input, id, [nameKey]: name };
    }
  }
  return { ...input, id, [nameKey]: name };
}

export { resolveRef };
