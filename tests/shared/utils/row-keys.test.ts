import { describe, expect, test } from "vitest";
import { createRowKeys } from "../../../src/shared/utils/row-keys";

describe("createRowKeys", () => {
  test("gives the same row the same key every time", () => {
    const rowKey = createRowKeys();
    const row = { type: "Online" };
    expect(rowKey(row)).toBe(rowKey(row));
  });

  test("gives equal-looking rows different keys", () => {
    const rowKey = createRowKeys();
    expect(rowKey({ type: "Online", created_at: "2026-11-26" })).not.toBe(rowKey({ type: "Online", created_at: "2026-11-26" }));
  });

  test("keeps keys separate between widgets", () => {
    const row = { type: "Online" };
    const firstKeys = createRowKeys();
    const secondKeys = createRowKeys();
    firstKeys({ type: "Other" });
    expect(secondKeys(row)).toBe(1);
    expect(firstKeys(row)).toBe(2);
  });
});
