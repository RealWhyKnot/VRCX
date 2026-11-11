import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../../src/services/app-config", () => ({
  AppDebug: { endpointDomain: "https://api.vrchat.cloud/api/1" },
}));

vi.mock("../../../src/views/Feed/Feed.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../../src/views/Feed/columns.tsx", () => ({ columns: [] }));
vi.mock("../../../src/plugins/router", () => ({
  default: { push: vi.fn(), currentRoute: { value: {} } },
}));

import { convertFileUrlToImageUrl, debounce } from "../../../src/shared/utils/common";

describe("convertFileUrlToImageUrl", () => {
  test("converts standard file URL to image URL", () => {
    const url = "https://api.vrchat.cloud/api/1/file/file_abc123-def456/1/file";
    const result = convertFileUrlToImageUrl(url);
    expect(result).toBe("https://api.vrchat.cloud/api/1/image/file_abc123-def456/1/128");
  });

  test("converts URL without trailing /file", () => {
    const url = "https://api.vrchat.cloud/api/1/file/file_abc123-def456/1";
    const result = convertFileUrlToImageUrl(url);
    expect(result).toBe("https://api.vrchat.cloud/api/1/image/file_abc123-def456/1/128");
  });

  test("converts URL with trailing slash", () => {
    const url = "https://api.vrchat.cloud/api/1/file/file_abc123-def456/2/";
    const result = convertFileUrlToImageUrl(url);
    expect(result).toBe("https://api.vrchat.cloud/api/1/image/file_abc123-def456/2/128");
  });

  test("accepts custom resolution", () => {
    const url = "https://api.vrchat.cloud/api/1/file/file_abc123-def456/1/file";
    const result = convertFileUrlToImageUrl(url, 256);
    expect(result).toBe("https://api.vrchat.cloud/api/1/image/file_abc123-def456/1/256");
  });

  test("returns original URL when pattern does not match", () => {
    const url = "https://example.com/some/other/path";
    expect(convertFileUrlToImageUrl(url)).toBe(url);
  });

  test("returns empty string for empty input", () => {
    expect(convertFileUrlToImageUrl("")).toBe("");
  });

  test("returns empty string for null input", () => {
    expect(convertFileUrlToImageUrl(null)).toBe("");
  });

  test("returns empty string for undefined input", () => {
    expect(convertFileUrlToImageUrl(undefined)).toBe("");
  });

  test("handles URL with /file/file path", () => {
    const url = "https://api.vrchat.cloud/api/1/file/file_aabbccdd-1234-5678-9012-abcdef123456/5/file/";
    const result = convertFileUrlToImageUrl(url, 64);
    expect(result).toBe("https://api.vrchat.cloud/api/1/image/file_aabbccdd-1234-5678-9012-abcdef123456/5/64");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("delays function execution", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();
  });

  test("resets timer on subsequent calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
  });

  test("passes arguments to debounced function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  test("uses latest arguments when called multiple times", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    debounced("third");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("third");
  });

  test("can be called again after execution", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledOnce();

    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
