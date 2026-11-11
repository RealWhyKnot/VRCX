type CacheEntry<K, V> = { key: K; value: V };

type EvictOptions<K, V> = {
  sortFn?: (a: CacheEntry<K, V>, b: CacheEntry<K, V>) => number;
  logLabel?: string;
};

export function evictMapCache<K, V>(
  cache: Map<K, V>,
  maxSize: number,
  isRetainedFn: (value: V, key: K) => boolean,
  options: EvictOptions<K, V> = {}
): { deletedCount: number } {
  if (cache.size <= maxSize) {
    return { deletedCount: 0 };
  }

  const { sortFn, logLabel } = options;
  const overBy = cache.size - maxSize;

  if (sortFn) {
    const removable: CacheEntry<K, V>[] = [];
    for (const [key, value] of cache) {
      if (isRetainedFn(value, key)) {
        continue;
      }
      removable.push({ key, value });
    }
    removable.sort(sortFn);
    const toDelete = Math.min(overBy, removable.length);
    for (const entry of removable.slice(0, toDelete)) {
      cache.delete(entry.key);
    }
    if (logLabel) {
      console.log(`${logLabel}: Deleted ${toDelete}. Current cache size: ${cache.size}`);
    }
    return { deletedCount: toDelete };
  }

  let deletedCount = 0;
  const keysToDelete: K[] = [];
  for (const [key, value] of cache) {
    if (isRetainedFn(value, key)) {
      continue;
    }
    if (deletedCount >= overBy) {
      break;
    }
    keysToDelete.push(key);
    deletedCount++;
  }
  for (const key of keysToDelete) {
    cache.delete(key);
  }
  if (logLabel) {
    console.log(`${logLabel}: Deleted ${deletedCount}. Current cache size: ${cache.size}`);
  }
  return { deletedCount };
}
