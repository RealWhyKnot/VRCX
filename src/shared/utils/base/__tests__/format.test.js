import { convertYoutubeTime, formatSeconds, timeToText } from "../format";

describe("Format Utils", () => {
  describe("timeToText", () => {
    test("formats basic durations", () => {
      expect(timeToText(1000)).toBe("0s");
      expect(timeToText(60000)).toBe("1m");
      expect(timeToText(3600000)).toBe("1h");
    });

    test("formats with seconds flag", () => {
      expect(timeToText(60000, true)).toBe("1m 0s");
      expect(timeToText(90000, true)).toBe("1m 30s");
    });

    test("handles zero and negative", () => {
      expect(timeToText(0)).toBe("0s");
      expect(timeToText(-1000)).toBe("0s");
    });

    test("handles complex time", () => {
      const result = timeToText(90061000);
      expect(result).toContain("1d");
      expect(result).toContain("1h");
    });
  });

  describe("formatSeconds", () => {
    test("formats seconds only", () => {
      expect(formatSeconds(5)).toBe("00:05");
      expect(formatSeconds(0)).toBe("00:00");
      expect(formatSeconds(59)).toBe("00:59");
    });

    test("formats minutes and seconds", () => {
      expect(formatSeconds(60)).toBe("01:00");
      expect(formatSeconds(125)).toBe("02:05");
      expect(formatSeconds(3599)).toBe("59:59");
    });

    test("formats hours, minutes and seconds", () => {
      expect(formatSeconds(3600)).toBe("01:00:00");
      expect(formatSeconds(3661)).toBe("01:01:01");
      expect(formatSeconds(7200)).toBe("02:00:00");
    });

    test("handles decimal input", () => {
      expect(formatSeconds(5.7)).toBe("00:05");
    });
  });

  describe("convertYoutubeTime", () => {
    test("converts minutes and seconds (PT3M45S)", () => {
      expect(convertYoutubeTime("PT3M45S")).toBe(225);
    });

    test("converts hours, minutes, seconds (PT1H30M15S)", () => {
      expect(convertYoutubeTime("PT1H30M15S")).toBe(5415);
    });

    test("converts minutes only (PT5M)", () => {
      expect(convertYoutubeTime("PT5M")).toBe(300);
    });

    test("converts seconds only (PT30S)", () => {
      expect(convertYoutubeTime("PT30S")).toBe(30);
    });

    test("converts hours only (PT2H)", () => {
      expect(convertYoutubeTime("PT2H")).toBe(7200);
    });

    test("converts hours and seconds, no minutes (PT1H30S)", () => {
      expect(convertYoutubeTime("PT1H30S")).toBe(3630);
    });

    test("converts hours and minutes, no seconds (PT1H30M)", () => {
      expect(convertYoutubeTime("PT1H30M")).toBe(90);
    });
  });
});
