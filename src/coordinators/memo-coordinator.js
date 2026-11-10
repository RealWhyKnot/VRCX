import { useFriendStore, useUserStore } from "../stores";
import { database } from "../services/database";
import { syncFriendSearchIndex } from "./search-index-coordinator";

async function migrateMemos() {
  const json = JSON.parse(await VRCXStorage.GetAll());
  for (const line in json) {
    if (line.substring(0, 8) === "memo_usr") {
      const userId = line.substring(5);
      const memo = json[line];
      if (memo) {
        await saveUserMemo(userId, memo);
        VRCXStorage.Remove(`memo_${userId}`);
      }
    }
  }
}

function applyUserMemo(userId, memo) {
  const userStore = useUserStore();
  const friendStore = useFriendStore();
  const text = String(memo || "");
  const ref = userStore.cachedUsers.get(userId);
  if (ref) {
    ref.$memo = text;
  }
  const ctx = friendStore.friends.get(userId);
  if (ctx) {
    ctx.$nickName = text ? text.split("\n")[0] : "";
    syncFriendSearchIndex(ctx);
  }
}

async function getUserMemo(userId) {
  try {
    const row = await database.getUserMemo(userId);
    applyUserMemo(userId, row.memo);
    return row;
  } catch (err) {
    console.error(err);
    return {
      userId: "",
      editedAt: "",
      memo: "",
    };
  }
}

async function saveUserMemo(id, memo) {
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
  const memos = await database.getAllUserMemos();
  memos.forEach((memo) => {
    applyUserMemo(memo.userId, memo.memo);
  });
}

async function getWorldMemo(worldId) {
  try {
    return await database.getWorldMemo(worldId);
  } catch (err) {
    console.error(err);
    return {
      worldId: "",
      editedAt: "",
      memo: "",
    };
  }
}

export { migrateMemos, getUserMemo, saveUserMemo, getAllUserMemos, getWorldMemo };
