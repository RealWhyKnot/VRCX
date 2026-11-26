import { describe, expect, test } from "vitest";
import { createRowKeys, createTableRowIds } from "../../../src/shared/utils/row-keys";

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

describe("createTableRowIds", () => {
  test("uses the database row id and type for saved rows", () => {
    const rowId = createTableRowIds();
    expect(rowId({ rowId: 7, type: "GPS" })).toBe("row:7:GPS");
    expect(rowId({ rowId: 7, type: "GPS" })).toBe(rowId({ rowId: 7, type: "GPS" }));
    expect(rowId({ rowId: 7, type: "Online" })).not.toBe(rowId({ rowId: 7, type: "GPS" }));
  });

  test("gives unsaved rows of the same type their own stable ids", () => {
    const rowId = createTableRowIds();
    const first = { type: "OnPlayerJoined" };
    const second = { type: "OnPlayerJoined", rowId: null };
    expect(rowId(first)).not.toBe(rowId(second));
    expect(rowId(first)).toBe(rowId(first));
    expect(rowId(second)).toBe(rowId(second));
  });
});
