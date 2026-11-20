import { describe, expect, test } from "vitest";

import { regionName } from "../../../src/shared/utils/region";

const t = (key: string) => `t:${key}`;

describe("regionName", () => {
  test("names each VRChat region", () => {
    expect(regionName("us", t)).toBe("t:dialog.new_instance.region_usw");
    expect(regionName("usw", t)).toBe("t:dialog.new_instance.region_usw");
    expect(regionName("use", t)).toBe("t:dialog.new_instance.region_use");
    expect(regionName("eu", t)).toBe("t:dialog.new_instance.region_eu");
    expect(regionName("jp", t)).toBe("t:dialog.new_instance.region_jp");
  });

  test("shows the code for a region it doesn't know", () => {
    expect(regionName("kr", t)).toBe("KR");
  });
});
