import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SearchWorkerResponse } from "../../src/stores/quick-search-worker-protocol";

type MessageListener = (event: { data: unknown }) => void;

function setupWorkerHarness() {
  const sent: SearchWorkerResponse[] = [];
  let handler: MessageListener | undefined;

  vi.stubGlobal("self", {
    addEventListener: vi.fn((event: string, callback: MessageListener) => {
      if (event === "message") handler = callback;
    }),
    postMessage: vi.fn((payload: SearchWorkerResponse) => {
      sent.push(payload);
    }),
  });

  return {
    sent,
    dispatch: (data: unknown) => handler?.({ data }),
  };
}

function lastSent(sent: SearchWorkerResponse[]): SearchWorkerResponse {
  const last = sent.at(-1);
  if (!last) throw new Error("the worker posted no search result");
  return last;
}

describe("quickSearchWorker message protocol", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("returns empty search result for short query", async () => {
    const harness = setupWorkerHarness();
    await import("../../src/stores/quick-search-worker.ts");

    harness.dispatch({
      type: "search",
      payload: {
        seq: 7,
        query: "a",
        currentUserId: "usr_me",
        language: "en-US",
      },
    });

    expect(harness.sent).toHaveLength(1);
    expect(harness.sent[0]).toEqual({
      type: "searchResult",
      payload: {
        seq: 7,
        friends: [],
        ownAvatars: [],
        favAvatars: [],
        ownWorlds: [],
        favWorlds: [],
        ownGroups: [],
        joinedGroups: [],
      },
    });
  });

  test("deduplicates favorites and joined groups against own results", async () => {
    const harness = setupWorkerHarness();
    await import("../../src/stores/quick-search-worker.ts");

    harness.dispatch({
      type: "updateIndex",
      payload: {
        friends: [],
        avatars: [
          {
            id: "avtr_1",
            name: "Alpha Avatar",
            authorId: "usr_me",
            imageUrl: "",
          },
        ],
        worlds: [
          {
            id: "wrld_1",
            name: "Alpha World",
            authorId: "usr_me",
            imageUrl: "",
          },
        ],
        groups: [
          {
            id: "grp_1",
            name: "Alpha Group",
            ownerId: "usr_me",
            imageUrl: "",
          },
        ],
        favAvatars: [{ id: "avtr_1", name: "Alpha Avatar", imageUrl: "" }],
        favWorlds: [{ id: "wrld_1", name: "Alpha World", imageUrl: "" }],
      },
    });

    harness.dispatch({
      type: "search",
      payload: {
        seq: 8,
        query: "Alpha",
        currentUserId: "usr_me",
        language: "en-US",
      },
    });

    const result = lastSent(harness.sent);
    expect(result.type).toBe("searchResult");
    expect(result.payload.seq).toBe(8);
    expect(result.payload.ownAvatars).toHaveLength(1);
    expect(result.payload.favAvatars).toHaveLength(0);
    expect(result.payload.ownWorlds).toHaveLength(1);
    expect(result.payload.favWorlds).toHaveLength(0);
    expect(result.payload.ownGroups).toHaveLength(1);
    expect(result.payload.joinedGroups).toHaveLength(0);
  });
});
