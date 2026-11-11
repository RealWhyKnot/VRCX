import { cellNumber, cellText } from "./cells.ts";
import { sqliteService } from "../sqlite.ts";

type MutualGraphMeta = {
  lastFetchedAt: string | null;
  optedOut: boolean;
};

type MutualGraphMetaUpdate = {
  lastFetchedAt?: string | null;
  optedOut?: boolean;
};

type MutualGraphMetaEntry = {
  optedOut: boolean;
};

function textOrNull(cell: unknown): string | null {
  const text = cellText(cell) ?? "";
  return text.length > 0 ? text : null;
}

const mutualGraph = {
  async getMutualGraphSnapshot(): Promise<Map<string, string[]>> {
    const snapshot = new Map<string, string[]>();
    const friendRows = await sqliteService.rows(DatabaseApi.GetMutualGraphFriends());
    for (const row of friendRows) {
      const friendId = cellText(row[0]);
      if (friendId && !snapshot.has(friendId)) {
        snapshot.set(friendId, []);
      }
    }
    const linkRows = await sqliteService.rows(DatabaseApi.GetMutualGraphLinks());
    for (const row of linkRows) {
      const friendId = cellText(row[0]);
      const mutualId = cellText(row[1]);
      if (!friendId || !mutualId) {
        continue;
      }
      const list = snapshot.get(friendId) ?? [];
      snapshot.set(friendId, list);
      list.push(mutualId);
    }
    return snapshot;
  },

  async saveMutualGraphSnapshot(entries: Map<string, Iterable<string>>): Promise<void> {
    const friendIds: string[] = [];
    const edgeFriendIds: string[] = [];
    const edgeMutualIds: string[] = [];
    for (const [friendId, mutualIds] of entries) {
      if (!friendId) {
        continue;
      }
      friendIds.push(friendId);
      for (const mutual of mutualIds) {
        if (!mutual) {
          continue;
        }
        edgeFriendIds.push(friendId);
        edgeMutualIds.push(mutual);
      }
    }
    await sqliteService.run(DatabaseApi.SaveMutualGraph(friendIds, edgeFriendIds, edgeMutualIds));
  },

  async updateMutualsForFriend(friendId: string, mutualIds: Iterable<string>): Promise<void> {
    if (!friendId) {
      return;
    }
    const validMutualIds: string[] = [];
    for (const mutual of mutualIds) {
      if (mutual) {
        validMutualIds.push(mutual);
      }
    }
    await sqliteService.run(DatabaseApi.UpdateMutualsForFriend(friendId, validMutualIds));
  },

  async getMutualCountForAllUsers(): Promise<Map<string, number>> {
    const mutualCountMap = new Map<string, number>();
    const rows = await sqliteService.rows(DatabaseApi.GetMutualCounts());
    for (const row of rows) {
      const mutualId = cellText(row[0]);
      if (mutualId) {
        mutualCountMap.set(mutualId, cellNumber(row[1]) ?? 0);
      }
    }
    return mutualCountMap;
  },

  async upsertMutualGraphMeta(friendId: string, { lastFetchedAt, optedOut }: MutualGraphMetaUpdate): Promise<void> {
    if (!friendId) {
      return;
    }
    const fetchedAt = lastFetchedAt ?? "";
    const time = fetchedAt.length > 0 ? fetchedAt : new Date().toISOString();
    await sqliteService.run(DatabaseApi.UpsertMutualGraphMeta(friendId, time, optedOut === true));
  },

  async bulkUpsertMutualGraphMeta(entries: Map<string, MutualGraphMetaEntry>): Promise<void> {
    if (entries.size === 0) {
      return;
    }
    const optedInIds: string[] = [];
    const optedOutIds: string[] = [];
    for (const [friendId, { optedOut }] of entries) {
      if (!friendId) {
        continue;
      }
      if (optedOut) {
        optedOutIds.push(friendId);
      } else {
        optedInIds.push(friendId);
      }
    }
    await sqliteService.run(DatabaseApi.BulkUpsertMutualGraphMeta(new Date().toISOString(), optedInIds, optedOutIds));
  },

  async getMutualGraphMeta(): Promise<Map<string, MutualGraphMeta>> {
    const metaMap = new Map<string, MutualGraphMeta>();
    const rows = await sqliteService.rows(DatabaseApi.GetMutualGraphMeta());
    for (const row of rows) {
      const friendId = cellText(row[0]);
      if (friendId) {
        metaMap.set(friendId, {
          lastFetchedAt: textOrNull(row[1]),
          optedOut: cellNumber(row[2]) === 1,
        });
      }
    }
    return metaMap;
  },
};

export { mutualGraph };
