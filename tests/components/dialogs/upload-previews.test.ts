import { describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";

const LONG_LABEL = "Gruppenbannervorschau ".repeat(40);

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => (key.endsWith("group_banner") ? LONG_LABEL : key) }) }));

import UploadPreviews from "../../../src/components/dialogs/UploadPreviews.vue";
import { UPLOAD_PREVIEW_TILES } from "../../../src/shared/utils/upload-previews";

const SRC = "data:image/jpeg;base64,AAAA";
const BANNER = { width: 2000, height: 1125 };

function percent(imageClass: string, prefix: string): number {
  const match = imageClass.split(" ").find((name) => name.startsWith(`${prefix}-[`));
  return match ? Number(match.slice(prefix.length + 2, -2)) : 0;
}

function pixels(frameClass: string, prefix: string): number {
  const match = frameClass.split(" ").find((name) => name.startsWith(`${prefix}-`));
  if (!match) {
    return 0;
  }
  const value = match.slice(prefix.length + 1);
  return value.startsWith("[") ? Number(value.slice(1, -3)) : Number(value) * 4;
}

function shownRegion(tile: { frameClass: string; imageClass: string }) {
  const frame = { width: pixels(tile.frameClass, "w"), height: pixels(tile.frameClass, "h") };
  const baseWidth = tile.imageClass.includes("w-full") ? frame.width : (frame.width * percent(tile.imageClass, "w")) / 100;
  const scale = BANNER.width / baseWidth;
  return {
    x: ((-percent(tile.imageClass, "left") * frame.width) / 100) * scale,
    y: ((-percent(tile.imageClass, "top") * frame.height) / 100) * scale,
    width: frame.width * scale,
    height: frame.height * scale,
  };
}

function tileById(id: string) {
  const tile = UPLOAD_PREVIEW_TILES.photo.find((entry) => entry.id === id);
  if (!tile) {
    throw new Error(`no tile ${id}`);
  }
  return tile;
}

describe("UploadPreviews.vue", () => {
  test("shows a photo as a profile picture, list icon and the three group banner crops", () => {
    const wrapper = mount(UploadPreviews, { props: { kind: "photo", src: SRC } });
    const ids = wrapper.findAll('[data-testid^="upload-preview-"]').map((tile) => tile.attributes("data-testid"));
    expect(ids).toEqual([
      "upload-preview-profile-picture",
      "upload-preview-list",
      "upload-preview-group-banner",
      "upload-preview-banner-nameplate",
      "upload-preview-banner-group-page",
    ]);
    expect(wrapper.findAll("img").every((img) => img.attributes("src") === SRC && img.classes().includes("object-cover"))).toBe(true);
    expect(wrapper.get('[data-testid="upload-preview-list"] div').classes()).toEqual(expect.arrayContaining(["size-9", "rounded-full", "overflow-hidden"]));
  });

  test("shows an icon as a round profile icon, a round list icon and a group icon", () => {
    const wrapper = mount(UploadPreviews, { props: { kind: "icon", src: SRC } });
    const ids = wrapper.findAll('[data-testid^="upload-preview-"]').map((tile) => tile.attributes("data-testid"));
    expect(ids).toEqual(["upload-preview-profile-icon", "upload-preview-list", "upload-preview-group-icon"]);
    expect(wrapper.get('[data-testid="upload-preview-profile-icon"] div').classes()).toContain("rounded-full");
  });

  test("crops the nameplate banner to the part of a 2000x1125 banner VRChat shows there", () => {
    const region = shownRegion(tileById("banner-nameplate"));
    expect(region.x).toBeCloseTo(324, -1);
    expect(region.y).toBeCloseTo(317, -1);
    expect(region.width).toBeCloseTo(1348, -1);
    expect(region.height).toBeCloseTo(217, -1);
  });

  test("crops the group page banner to the band VRChat shows there", () => {
    const region = shownRegion(tileById("banner-group-page"));
    expect(region.x).toBeCloseTo(0);
    expect(region.y).toBeCloseTo(394, -1);
    expect(region.width).toBeCloseTo(2000);
    expect(region.height).toBeCloseTo(337, -1);
  });

  test("keeps every frame a fixed size and cuts off long labels", () => {
    const wrapper = mount(UploadPreviews, { props: { kind: "photo", src: SRC } });
    expect(wrapper.get('[data-testid="upload-previews"]').classes()).toEqual(expect.arrayContaining(["flex-wrap", "min-w-0"]));
    for (const frame of wrapper.findAll('[data-testid^="upload-preview-"] div')) {
      expect(frame.classes()).toEqual(expect.arrayContaining(["shrink-0", "overflow-hidden"]));
    }
    const label = wrapper.get('[data-testid="upload-preview-group-banner"] span');
    expect(label.classes()).toEqual(expect.arrayContaining(["max-w-28", "truncate"]));
    expect(label.attributes("title")).toBe(LONG_LABEL);
    for (const tile of [...UPLOAD_PREVIEW_TILES.photo, ...UPLOAD_PREVIEW_TILES.icon]) {
      expect(pixels(tile.frameClass, tile.frameClass.includes("size-") ? "size" : "w")).toBeGreaterThan(0);
    }
  });
});
