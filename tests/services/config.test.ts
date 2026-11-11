import { describe, expect, test, vi } from "vitest";
vi.mock("../../src/plugins/router.ts", () => ({
  router: { beforeEach: vi.fn(), push: vi.fn() },
  initRouter: vi.fn(),
}));

import { transformKey } from "../../src/services/config.ts";

describe("transformKey", () => {
  test("lowercases and prefixes with config:", () => {
    expect(transformKey("Foo")).toBe("config:foo");
  });

  test("handles already lowercase key", () => {
    expect(transformKey("bar")).toBe("config:bar");
  });

  test("handles key with mixed case and numbers", () => {
    expect(transformKey("MyKey123")).toBe("config:mykey123");
  });

  test("handles empty string", () => {
    expect(transformKey("")).toBe("config:");
  });
});
