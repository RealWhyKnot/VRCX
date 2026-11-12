import { imageRequest } from "../api/image";
import { userRequest } from "../api/user";
import { readFileOwner, readFileUploader, type FileOwner } from "../shared/utils/instance-faces";
import { useUserStore } from "../stores/user";

export type PictureInfo = { owner: FileOwner; uploaderId: string };

const lookups = new Map<string, Promise<PictureInfo>>();

export function lookUpPicture(fileId: string): Promise<PictureInfo> {
  const running = lookups.get(fileId);
  if (running) {
    return running;
  }
  const lookup = imageRequest.getAvatarImages({ fileId }).then(
    ({ json }) => ({ owner: readFileOwner(json), uploaderId: readFileUploader(json) }),
    (err: unknown) => {
      lookups.delete(fileId);
      throw err;
    }
  );
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
