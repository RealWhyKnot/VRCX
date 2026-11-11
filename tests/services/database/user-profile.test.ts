import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: vi.fn(),
  run: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../../src/services/sqlite.ts", () => ({
  sqliteService: {
    rows: mocks.rows,
    run: mocks.run,
  },
}));

import { parseBioLinks, userProfile } from "../../../src/services/database/user-profile.ts";

describe("parseBioLinks", () => {
  test("returns the links of a JSON string array", () => {
    expect(parseBioLinks('["https://a.example","https://b.example"]')).toEqual(["https://a.example", "https://b.example"]);
  });

  test("returns an empty list for text that is not JSON", () => {
    expect(parseBioLinks("not json")).toEqual([]);
  });

  test("returns an empty list when the JSON is not an array", () => {
    expect(parseBioLinks('{"link":"https://a.example"}')).toEqual([]);
  });

  test("drops entries that are not strings", () => {
    expect(parseBioLinks('["https://a.example", 3, null]')).toEqual(["https://a.example"]);
  });
});

describe("userProfile", () => {
  const bridge = {
    GetUserProfile: vi.fn(() => Promise.resolve("[]")),
    SetUserProfile: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    mocks.rows.mockReset();
    mocks.run.mockReset();
    bridge.GetUserProfile.mockClear();
    bridge.SetUserProfile.mockClear();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  test("returns null when the user has no profile", async () => {
    mocks.rows.mockResolvedValueOnce([]);

    expect(await userProfile.getUserProfile("usr_a")).toBeNull();
  });

  test("maps a stored profile and parses its bio links", async () => {
    mocks.rows.mockResolvedValueOnce([["usr_a", "Hello", '["https://a.example"]', "2026-01-01T00:00:00.000Z"]]);

    expect(await userProfile.getUserProfile("usr_a")).toEqual({
      userId: "usr_a",
      bio: "Hello",
      bioLinks: ["https://a.example"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  test("saves the links as JSON text", () => {
    userProfile.setUserProfile({ id: "usr_a", bio: "Hello", bioLinks: ["https://a.example"] });

    expect(bridge.SetUserProfile).toHaveBeenCalledWith("usr_a", "Hello", '["https://a.example"]', expect.any(String));
  });
});
