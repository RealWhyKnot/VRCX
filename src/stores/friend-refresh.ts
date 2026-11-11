import { friendRequest } from "../api/friend";
import { userRequest } from "../api/user";
import { AppDebug } from "../services/app-config";
import { watchState } from "../services/watch-state";
import { executeWithBackoff } from "../shared/utils/retry";
import { createRateLimiter } from "../shared/utils/throttle";
import type { FriendContext, FriendListEntry } from "./friend-types";

const MAX_OFFSET = 7500;
const PAGE_SIZE = 50;
const CONCURRENCY = 5;
const RATE_PER_MINUTE = 60;
const MAX_RETRY = 5;
const RETRY_BASE_DELAY = 1000;

export function isRateLimitError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const status = "status" in err ? err.status : undefined;
  const message = "message" in err ? err.message : undefined;
  return status === 429 || (typeof message === "string" && message.includes("429"));
}

export async function bulkRefreshFriends(args: { offline: boolean }): Promise<FriendListEntry[]> {
  const rateLimiter = createRateLimiter({
    limitPerInterval: RATE_PER_MINUTE,
    intervalMs: 60_000,
  });

  async function fetchPage(offset: number): Promise<FriendListEntry[]> {
    return executeWithBackoff(
      async () => {
        const { json } = await friendRequest.getFriends({
          ...args,
          n: PAGE_SIZE,
          offset,
        });
        return Array.isArray(json) ? json : [];
      },
      {
        maxRetries: MAX_RETRY,
        baseDelay: RETRY_BASE_DELAY,
        shouldRetry: isRateLimitError,
      }
    );
  }

  let nextOffset = 0;
  let isStopRequested = false;
  const friends: FriendListEntry[] = [];

  function getNextOffset(): number | null {
    if (isStopRequested) return null;
    const cur = nextOffset;
    nextOffset += PAGE_SIZE;
    if (cur > MAX_OFFSET) return null;
    return cur;
  }

  async function worker(): Promise<void> {
    for (let offset = getNextOffset(); offset !== null; offset = getNextOffset()) {
      await rateLimiter.wait();

      const page = await fetchPage(offset);
      if (page.length === 0) {
        isStopRequested = true;
        break;
      }
      friends.push(...page);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return friends;
}

export async function refetchBrokenFriends(friendsArray: FriendListEntry[], friends: ReadonlyMap<string, FriendContext>): Promise<FriendListEntry[]> {
  for (const [i, friend] of friendsArray.entries()) {
    try {
      let stateInput: FriendContext["state"] = "offline";
      if (friend.platform === "web") {
        stateInput = "active";
      } else if (friend.platform) {
        stateInput = "online";
      }
      const ref = friends.get(friend.id);
      if (ref?.state !== stateInput) {
        if (AppDebug.debugFriendState) {
          console.log(`Refetching friend state it does not match ${friend.displayName} from ${ref?.state} to ${stateInput}`, friend);
        }
        const args = await userRequest.getUser({
          userId: friend.id,
        });
        friendsArray[i] = args.json;
      } else if (friend.location === "traveling") {
        if (AppDebug.debugFriendState) {
          console.log("Refetching traveling friend", friend.displayName);
        }
        const args = await userRequest.getUser({
          userId: friend.id,
        });
        friendsArray[i] = args.json;
      }
    } catch (err) {
      console.error(err);
    }
  }
  return friendsArray;
}

export async function refreshRemainingFriends(friends: FriendListEntry[], currentUserFriendIds: readonly string[]): Promise<FriendListEntry[]> {
  const friendsSet = new Set(friends.map((x) => x.id));
  for (const userId of currentUserFriendIds) {
    if (!friendsSet.has(userId)) {
      try {
        if (!watchState.isLoggedIn) {
          console.error(`User isn't logged in`);
          return friends;
        }
        console.log("Fetching remaining friend", userId);
        const args = await userRequest.getUser({ userId });
        friends.push(args.json);
      } catch (err) {
        console.error(err);
      }
    }
  }
  return friends;
}
