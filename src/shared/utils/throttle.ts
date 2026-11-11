export function createRateLimiter({ limitPerInterval, intervalMs }: { limitPerInterval: number; intervalMs: number }) {
  const stamps: number[] = [];

  async function throttle(): Promise<void> {
    const now = Date.now();
    let oldest = stamps[0];
    while (oldest !== undefined && now - oldest > intervalMs) {
      stamps.shift();
      oldest = stamps[0];
    }
    if (stamps.length >= limitPerInterval) {
      const wait = intervalMs - (now - (stamps[0] ?? Number.NaN));
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }
    stamps.push(Date.now());
  }

  return {
    async schedule<T>(fn: () => T | Promise<T>): Promise<T> {
      await throttle();
      return fn();
    },
    async wait(): Promise<void> {
      await throttle();
    },
    clear(): void {
      stamps.length = 0;
    },
  };
}
