export function evictMapCache(cache, maxSize, isRetainedFn, opts = {}) {
  if (cache.size <= maxSize) {
    return { deletedCount: 0 };
  }

  const { sortFn, logLabel } = opts;
  const overBy = cache.size - maxSize;

  if (sortFn) {
    const removable = [];
    for (const [key, value] of cache) {
      if (isRetainedFn(value, key)) {
        continue;
      }
      removable.push({ key, value });
    }
    removable.sort(sortFn);
    const toDelete = Math.min(overBy, removable.length);
    for (let i = 0; i < toDelete; i++) {
      cache.delete(removable[i].key);
    }
    if (logLabel) {
      console.log(`${logLabel}: Deleted ${toDelete}. Current cache size: ${cache.size}`);
    }
    return { deletedCount: toDelete };
  }

  let deletedCount = 0;
  const keysToDelete = [];
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
