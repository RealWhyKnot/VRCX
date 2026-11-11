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

import { avatarTags } from "../../../src/services/database/avatar-tags.ts";

describe("avatarTags", () => {
  const bridge = {
    GetAvatarTags: vi.fn(() => Promise.resolve("[]")),
    GetAllAvatarTags: vi.fn(() => Promise.resolve("[]")),
    AddAvatarTag: vi.fn(() => Promise.resolve()),
    UpdateAvatarTagColor: vi.fn(() => Promise.resolve()),
  };

  beforeEach(() => {
    mocks.rows.mockReset();
    mocks.run.mockReset();
    bridge.AddAvatarTag.mockClear();
    bridge.UpdateAvatarTagColor.mockClear();
    vi.stubGlobal("DatabaseApi", bridge);
  });

  test("groups tags by avatar and turns an empty color into null", async () => {
    mocks.rows.mockResolvedValueOnce([
      ["avtr_1", "favorite", "#ff0000"],
      ["avtr_1", "dance", ""],
      ["avtr_2", "club", null],
    ]);

    const result = await avatarTags.getAllAvatarTags();

    expect(result).toEqual(
      new Map<string | null, { tag: string | null; color: string | null }[]>([
        [
          "avtr_1",
          [
            { tag: "favorite", color: "#ff0000" },
            { tag: "dance", color: null },
          ],
        ],
        ["avtr_2", [{ tag: "club", color: null }]],
      ])
    );
  });

  test("tags for one avatar keep their order and a missing color is null", async () => {
    mocks.rows.mockResolvedValueOnce([
      ["favorite", null],
      ["dance", "#00ff00"],
    ]);

    const result = await avatarTags.getAvatarTags("avtr_1");

    expect(result).toEqual([
      { tag: "favorite", color: null },
      { tag: "dance", color: "#00ff00" },
    ]);
  });

  test("adding a tag without a color sends null as the color", async () => {
    await avatarTags.addAvatarTag("avtr_1", "favorite");

    expect(bridge.AddAvatarTag).toHaveBeenCalledWith("avtr_1", "favorite", null);
  });

  test("updating a color passes the avatar, tag and color through", async () => {
    await avatarTags.updateAvatarTagColor("avtr_1", "favorite", "#123456");

    expect(bridge.UpdateAvatarTagColor).toHaveBeenCalledWith("avtr_1", "favorite", "#123456");
  });
});
