import { useFriendStore } from "../stores/friend";
import { useUserStore } from "../stores/user";
import { database } from "../services/database";
import { syncFriendSearchIndex } from "./search-index-coordinator";

type UserMemo = { userId: string; editedAt: string; memo: string };
type WorldMemo = { worldId: string; editedAt: string; memo: string };
type UserMemoEntry = { userId: string; memo: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUserMemo(value: unknown): value is UserMemo {
  return isRecord(value) && typeof value["userId"] === "string" && typeof value["editedAt"] === "string" && typeof value["memo"] === "string";
}

function isWorldMemo(value: unknown): value is WorldMemo {
  return isRecord(value) && typeof value["worldId"] === "string" && typeof value["editedAt"] === "string" && typeof value["memo"] === "string";
}

function isUserMemoEntry(value: unknown): value is UserMemoEntry {
  return isRecord(value) && typeof value["userId"] === "string" && (typeof value["memo"] === "string" || value["memo"] === null);
}

function emptyUserMemo(): UserMemo {
  return {
    userId: "",
    editedAt: "",
    memo: "",
  };
}

function emptyWorldMemo(): WorldMemo {
  return {
    worldId: "",
    editedAt: "",
    memo: "",
  };
}

async function migrateMemos() {
  const json: unknown = JSON.parse(await VRCXStorage.GetAll());
  if (!isRecord(json)) {
    return;
  }
  for (const [line, memo] of Object.entries(json)) {
    if (line.startsWith("memo_usr")) {
      const userId = line.substring(5);
      if (typeof memo === "string" && memo) {
        await saveUserMemo(userId, memo);
        VRCXStorage.Remove(`memo_${userId}`).catch((err: unknown) => console.error(err));
      }
    }
  }
}

function applyUserMemo(userId: string, memo: string | null | undefined) {
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const text = memo ?? "";
  const ref = userStore.cachedUsers.get(userId);
  if (ref) {
    ref.$memo = text;
  }
  const ctx = friendStore.friends.get(userId);
  if (ctx) {
    ctx.$nickName = text.split("\n")[0] ?? "";
    syncFriendSearchIndex(ctx);
  }
}

async function getUserMemo(userId: string): Promise<UserMemo> {
  try {
    const row: unknown = await database.getUserMemo(userId);
    const memo = isUserMemo(row) ? row : emptyUserMemo();
    applyUserMemo(userId, memo.memo);
    return memo;
  } catch (err) {
    console.error(err);
    return emptyUserMemo();
  }
}

async function saveUserMemo(id: string, memo: string) {
  const userStore = useUserStore();
  if (memo) {
    await database.setUserMemo({
      userId: id,
      editedAt: new Date().toJSON(),
      memo,
    });
  } else {
    await database.deleteUserMemo(id);
  }
  applyUserMemo(id, memo);
  if (userStore.userDialog.id === id) {
    userStore.setUserDialogMemo(memo);
  }
}

async function getAllUserMemos() {
  const memos: unknown = await database.getAllUserMemos();
  if (!Array.isArray(memos)) {
    return;
  }
  const entries: unknown[] = memos;
  for (const entry of entries) {
    if (isUserMemoEntry(entry)) {
      applyUserMemo(entry.userId, entry.memo);
    }
  }
}

async function getWorldMemo(worldId: string): Promise<WorldMemo> {
  try {
    const row: unknown = await database.getWorldMemo(worldId);
    return isWorldMemo(row) ? row : emptyWorldMemo();
  } catch (err) {
    console.error(err);
    return emptyWorldMemo();
  }
}

export { migrateMemos, getUserMemo, saveUserMemo, getAllUserMemos, getWorldMemo };
