import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { nextTick, reactive } from "vue";

type SentMessage = {
  type: string;
  payload: {
    seq?: number;
    query?: string;
    currentUserId?: string;
  };
};

type MockWorker = {
  onmessage: ((event: { data: unknown }) => void) | null;
  postMessage: Mock<(message: SentMessage) => void>;
  emit: (data: unknown) => void;
};

type FriendEntry = {
  id: string;
  name?: string;
  memo?: string;
  ref?: {
    id: string;
    note?: string;
    currentAvatarThumbnailImageUrl?: string;
  };
};

const mocks = vi.hoisted(() => {
  const workerInstances: MockWorker[] = [];
  return { workerInstances };
});

vi.mock("../../src/stores/quick-search-worker.ts?worker&inline", () => ({
  default: class MockSearchWorker implements MockWorker {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    readonly postMessage = vi.fn<(message: SentMessage) => void>();

    constructor() {
      mocks.workerInstances.push(this);
    }

    emit(data: unknown) {
      this.onmessage?.({ data });
    }
  },
}));

const friendStore = reactive({ friends: new Map<string, FriendEntry>() });
const searchIndexStore = reactive({
  version: 0,
  getSnapshot() {
    const friendsList: { id: string; name: string | undefined; memo: string; note: string; imageUrl: string }[] = [];
    for (const ctx of friendStore.friends.values()) {
      if (ctx.ref === undefined) continue;
      friendsList.push({
        id: ctx.id,
        name: ctx.name,
        memo: ctx.memo ?? "",
        note: ctx.ref.note ?? "",
        imageUrl: ctx.ref.currentAvatarThumbnailImageUrl ?? "",
      });
    }
    return {
      friends: friendsList,
      avatars: [],
      worlds: [],
      groups: [],
      favAvatars: [],
      favWorlds: [],
    };
  },
});
const userStore = reactive({ currentUser: { id: "usr_me" } });

vi.mock("../../src/stores/friend", () => ({
  useFriendStore: () => friendStore,
}));
vi.mock("../../src/stores/search-index", () => ({
  useSearchIndexStore: () => searchIndexStore,
}));
vi.mock("../../src/stores/user", () => ({
  useUserStore: () => userStore,
}));

const showUserDialog = vi.fn<(...args: unknown[]) => void>();
const showAvatarDialog = vi.fn<(...args: unknown[]) => void>();
const showWorldDialog = vi.fn<(...args: unknown[]) => void>();
const showGroupDialog = vi.fn<(...args: unknown[]) => void>();

vi.mock("../../src/coordinators/user-coordinator", () => ({
  showUserDialog: (...args: unknown[]) => showUserDialog(...args),
}));
vi.mock("../../src/coordinators/avatar-coordinator", () => ({
  showAvatarDialog: (...args: unknown[]) => showAvatarDialog(...args),
}));
vi.mock("../../src/coordinators/world-coordinator", () => ({
  showWorldDialog: (...args: unknown[]) => showWorldDialog(...args),
}));
vi.mock("../../src/coordinators/group-dialog-coordinator", () => ({
  showGroupDialog: (...args: unknown[]) => showGroupDialog(...args),
}));

import { useQuickSearchStore } from "../../src/stores/quick-search";

function firstWorker(): MockWorker {
  const worker = mocks.workerInstances[0];
  if (!worker) throw new Error("quick search worker was not created");
  return worker;
}

function lastSent(worker: MockWorker): SentMessage {
  const call = worker.postMessage.mock.calls.at(-1);
  if (!call) throw new Error("worker received no messages");
  return call[0];
}

function seqOf(message: SentMessage): number {
  const seq = message.payload.seq;
  if (seq === undefined) throw new Error("message has no seq");
  return seq;
}

describe("useQuickSearchStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workerInstances.length = 0;
    setActivePinia(createPinia());
    friendStore.friends.clear();
    searchIndexStore.version = 0;
    userStore.currentUser.id = "usr_me";
  });

  test("discards stale worker results and applies the latest seq only", async () => {
    const store = useQuickSearchStore();
    store.setQuery("ab");
    await nextTick();

    const worker = firstWorker();
    const firstMsg = lastSent(worker);
    expect(firstMsg.type).toBe("search");

    store.setQuery("abc");
    await nextTick();
    const secondMsg = lastSent(worker);
    expect(seqOf(secondMsg)).toBeGreaterThan(seqOf(firstMsg));

    worker.emit({
      type: "searchResult",
      payload: {
        seq: seqOf(firstMsg),
        friends: [{ id: "usr_old", name: "Old" }],
        ownAvatars: [],
        favAvatars: [],
        ownWorlds: [],
        favWorlds: [],
        ownGroups: [],
        joinedGroups: [],
      },
    });
    expect(store.friendResults).toEqual([]);

    friendStore.friends.set("usr_new", {
      id: "usr_new",
      ref: { id: "usr_new" },
    });
    worker.emit({
      type: "searchResult",
      payload: {
        seq: seqOf(secondMsg),
        friends: [{ id: "usr_new", name: "New" }],
        ownAvatars: [],
        favAvatars: [],
        ownWorlds: [],
        favWorlds: [],
        ownGroups: [],
        joinedGroups: [],
      },
    });

    expect(store.friendResults).toHaveLength(1);
    expect(store.friendResults[0]?.id).toBe("usr_new");
  });

  test("short query clears results and blocks stale refill", async () => {
    const store = useQuickSearchStore();
    store.setQuery("ab");
    await nextTick();

    const worker = firstWorker();
    const firstSeq = seqOf(lastSent(worker));

    store.setQuery("");
    await nextTick();
    expect(store.friendResults).toEqual([]);

    worker.emit({
      type: "searchResult",
      payload: {
        seq: firstSeq,
        friends: [{ id: "usr_old", name: "Old" }],
        ownAvatars: [],
        favAvatars: [],
        ownWorlds: [],
        favWorlds: [],
        ownGroups: [],
        joinedGroups: [],
      },
    });

    expect(store.friendResults).toEqual([]);
  });

  test("re-dispatches search when currentUserId changes and query is active", async () => {
    const store = useQuickSearchStore();
    store.setQuery("ab");
    await nextTick();

    const worker = firstWorker();
    const callsBefore = worker.postMessage.mock.calls.length;

    userStore.currentUser.id = "usr_other";
    await nextTick();

    const callsAfter = worker.postMessage.mock.calls.length;
    expect(callsAfter).toBeGreaterThan(callsBefore);

    const lastMessage = lastSent(worker);
    expect(lastMessage.type).toBe("search");
    expect(lastMessage.payload.currentUserId).toBe("usr_other");
  });

  test("re-dispatches search after index update when query is active", async () => {
    vi.useFakeTimers();
    const store = useQuickSearchStore();
    store.isOpen = true;
    await nextTick();

    store.setQuery("ab");
    await nextTick();

    const worker = firstWorker();
    const callsBefore = worker.postMessage.mock.calls.length;

    searchIndexStore.version++;
    await nextTick();

    vi.advanceTimersByTime(200);
    await nextTick();

    const newCalls = worker.postMessage.mock.calls.slice(callsBefore);
    const types = newCalls.map(([message]) => message.type);
    expect(types).toContain("updateIndex");
    expect(types).toContain("search");

    const updateIdx = types.indexOf("updateIndex");
    const searchIdx = types.lastIndexOf("search");
    expect(updateIdx).toBeLessThan(searchIdx);

    vi.useRealTimers();
  });
});
