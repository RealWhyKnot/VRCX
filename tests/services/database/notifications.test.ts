import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { DatabaseRow } from "../../../src/services/sqlite.ts";

const mocks = vi.hoisted(() => ({
  rowQueue: [] as DatabaseRow[][],
  calls: [] as { method: string; args: unknown[] }[],
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: () => Promise.resolve(mocks.rowQueue.shift() ?? []),
    run: () => Promise.resolve(),
  },
}));
vi.mock("../../../src/services/database/index.ts", () => ({
  dbVars: {
    maxTableSize: 500,
  },
}));

import { notifications } from "../../../src/services/database/notifications.ts";

function callsTo(method: string): unknown[][] {
  return mocks.calls.filter((call) => call.method === method).map((call) => call.args);
}

beforeEach(() => {
  mocks.rowQueue.splice(0);
  mocks.calls.splice(0);
  vi.stubGlobal(
    "DatabaseApi",
    new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args: unknown[]) => {
            mocks.calls.push({ method: String(method), args });
            return Promise.resolve("");
          },
      }
    )
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("notifications v1 reads", () => {
  test("returns rows newest first and maps the expired flag and details", async () => {
    mocks.rowQueue.push([
      ["n1", "2026-01-01T00:00:00Z", "Invite", "usr_a", "Alice", "usr_me", "come", "wrld_1", "World", "img1", "", "", "", 0],
      ["n2", "2026-01-02T00:00:00Z", "Friend", "usr_b", "Bob", "usr_me", "hi", "", "", "", "", "", "", 1],
    ]);

    const result = await notifications.getNotifications();

    expect(callsTo("GetNotifications")).toEqual([[500]]);
    expect(result.map((row) => row.id)).toEqual(["n2", "n1"]);
    expect(result[0]).toMatchObject({ $isExpired: true, senderUsername: "Bob", details: { worldId: "", imageUrl: "" } });
    expect(result[1]).toMatchObject({
      $isExpired: false,
      details: { worldId: "wrld_1", worldName: "World", imageUrl: "img1", inviteMessage: "", requestMessage: "", responseMessage: "" },
    });
  });

  test("uses the default row limit for a lookup and passes filters and VIP ids through", async () => {
    mocks.rowQueue.push([]);

    await notifications.lookupNotificationDatabase("abc", ["Invite"], ["usr_vip"]);

    expect(callsTo("LookupNotifications")).toEqual([["abc", ["Invite"], ["usr_vip"], 500]]);
  });
});

describe("notifications v2 reads", () => {
  test("parses JSON cells and fills the version and created_at fields", async () => {
    mocks.rowQueue.push([
      ["v2_1", "2026-01-01T00:00:00Z", "", "", "invite", "", "", "Hello", "Title", "", 1, "usr_a", "Alice", '{"worldId":"wrld_1"}', "", ""],
    ]);

    const result = await notifications.getNotificationsV2();

    expect(callsTo("GetNotificationsV2")).toEqual([[500]]);
    expect(result).toEqual([
      {
        id: "v2_1",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "",
        expiresAt: "",
        type: "invite",
        link: "",
        linkText: "",
        message: "Hello",
        title: "Title",
        imageUrl: "",
        seen: true,
        senderUserId: "usr_a",
        senderUsername: "Alice",
        data: { worldId: "wrld_1" },
        responses: [],
        details: {},
        created_at: "2026-01-01T00:00:00Z",
        version: 2,
      },
    ]);
  });
});

describe("notifications writes", () => {
  test("rejects a notification that is missing its id", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() => {
      notifications.addNotificationToDatabase({ created_at: "2026-01-01T00:00:00Z", type: "Invite" });
    }).toThrow("Notification is missing required field");
    expect(callsTo("AddNotification")).toEqual([]);
  });

  test("uses the details image URL first and falls back to the row image URL", () => {
    notifications.addNotificationToDatabase({
      id: "n1",
      created_at: "2026-01-01T00:00:00Z",
      type: "Invite",
      senderUserId: "usr_s",
      senderUsername: "Sender",
      receiverUserId: "usr_r",
      message: "msg",
      imageUrl: "row_img",
      details: { worldId: "wrld_1", worldName: "World", imageUrl: "details_img" },
      $isExpired: true,
    });
    notifications.addNotificationToDatabase({
      id: "n2",
      created_at: "2026-01-01T00:00:00Z",
      type: "Invite",
      imageUrl: "row_img",
      details: {},
    });

    expect(callsTo("AddNotification")).toEqual([
      ["n1", "2026-01-01T00:00:00Z", "Invite", "usr_s", "Sender", "usr_r", "msg", "wrld_1", "World", "details_img", "", "", "", true],
      ["n2", "2026-01-01T00:00:00Z", "Invite", "", "", "", "", "", "", "row_img", "", "", "", false],
    ]);
  });

  test("sends missing v2 text fields as null and serialises JSON columns", () => {
    notifications.addNotificationV2ToDatabase({ id: "v2_1", data: { worldId: "wrld_1" } });

    expect(callsTo("AddNotificationV2")).toEqual([
      ["v2_1", null, null, null, null, null, null, null, null, null, false, null, null, '{"worldId":"wrld_1"}', "[]", "{}"],
    ]);
  });
});
