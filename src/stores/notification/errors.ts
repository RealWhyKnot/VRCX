export function logError(err: unknown) {
  console.error(err);
}

export function hasStatus(err: unknown, status: number): boolean {
  return typeof err === "object" && err !== null && "status" in err && err.status === status;
}

export function isRateLimited(err: unknown): boolean {
  return hasStatus(err, 429);
}
