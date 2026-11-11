type BackoffOptions = {
  maxRetries?: number;
  baseDelay?: number;
  shouldRetry?: (err: unknown) => boolean;
};

export async function executeWithBackoff<T>(fn: () => Promise<T>, options: BackoffOptions = {}): Promise<T> {
  const { maxRetries = 5, baseDelay = 1000, shouldRetry = () => true } = options;

  async function attempt(remaining: number): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (remaining <= 0 || !shouldRetry(err)) {
        throw err;
      }
      const delay = baseDelay * 2 ** (maxRetries - remaining);
      await new Promise<void>((resolve) => setTimeout(resolve, delay));
      return attempt(remaining - 1);
    }
  }

  return attempt(maxRetries);
}
