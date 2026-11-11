import { describe, expect, test } from "vitest";
import { buildEmojiKeyframes, ensureEmojiKeyframes } from "../../../src/shared/utils/emoji-keyframes";

describe("buildEmojiKeyframes", () => {
  test("lays two frames out on a 512px grid", () => {
    expect(buildEmojiKeyframes(2)).toBe(
      "@keyframes animated-emoji-2 {\n  0% {\n    background-position: -0 -0;\n  }\n\n  50% {\n    background-position: -512px -0;\n  }\n}\n"
    );
  });

  test("wraps to the next row after four frames once there are more than four", () => {
    const css = buildEmojiKeyframes(5);
    expect(css).toContain("  80% {\n    background-position: -0 -256px;\n  }");
  });

  test("uses eight frames per row above sixteen frames", () => {
    const css = buildEmojiKeyframes(64);
    expect(css).toContain("  98.4375% {\n    background-position: -896px -896px;\n  }");
    expect(css.match(/background-position/g)).toHaveLength(64);
  });
});

describe("ensureEmojiKeyframes", () => {
  test("adds one style element per frame count", () => {
    ensureEmojiKeyframes(7);
    ensureEmojiKeyframes(7);
    const sheets = document.head.querySelectorAll('style[data-emoji-keyframes="7"]');
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.textContent).toBe(buildEmojiKeyframes(7));
  });

  test("ignores frame counts outside 1 to 64", () => {
    ensureEmojiKeyframes(0);
    ensureEmojiKeyframes(65);
    ensureEmojiKeyframes(2.5);
    expect(document.head.querySelector('style[data-emoji-keyframes="0"]')).toBeNull();
    expect(document.head.querySelector('style[data-emoji-keyframes="65"]')).toBeNull();
    expect(document.head.querySelector('style[data-emoji-keyframes="2.5"]')).toBeNull();
  });
});
