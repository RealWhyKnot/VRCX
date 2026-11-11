function cellText(cell: unknown): string | null {
  return typeof cell === "string" ? cell : null;
}

function cellNumber(cell: unknown): number | null {
  return typeof cell === "number" ? cell : null;
}

export { cellNumber, cellText };
