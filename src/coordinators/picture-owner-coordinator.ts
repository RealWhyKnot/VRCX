import { imageRequest } from "../api/image";
import { userRequest } from "../api/user";
import { readFileOwner, readFileUploader, type FileOwner } from "../shared/utils/instance-faces";
import { useUserStore } from "../stores/user";

export type PictureInfo = { owner: FileOwner; uploaderId: string };

const MAX_LOOKUPS = 2000;
const RETRY_AFTER_MS = 5 * 60 * 1000;

const lookups = new Map<string, Promise<PictureInfo>>();
const failedAt = new Map<string, number>();

function forgetOldest<Value>(entries: Map<string, Value>) {
  if (entries.size >= MAX_LOOKUPS) {
    for (const key of entries.keys()) {
      entries.delete(key);
      break;
    }
  }
}

export function lookUpPicture(fileId: string): Promise<PictureInfo> {
  const running = lookups.get(fileId);
  if (running) {
    return running;
  }
  const failed = failedAt.get(fileId);
  if (failed !== undefined && Date.now() - failed < RETRY_AFTER_MS) {
    return Promise.reject(new Error(`Picture ${fileId} could not be looked up a moment ago`));
  }
  const lookup = imageRequest.getAvatarImages({ fileId }).then(
    ({ json }) => ({ owner: readFileOwner(json), uploaderId: readFileUploader(json) }),
    (err: unknown) => {
      lookups.delete(fileId);
      forgetOldest(failedAt);
      failedAt.set(fileId, Date.now());
      throw err;
    }
  );
  forgetOldest(lookups);
  lookups.set(fileId, lookup);
  return lookup;
}

export async function pictureOwnerName(userId: string): Promise<string> {
  const cached = useUserStore().cachedUsers.get(userId);
  if (cached?.displayName) {
    return cached.displayName;
  }
  const { ref } = await userRequest.getUser({ userId });
  return ref.displayName;
}
