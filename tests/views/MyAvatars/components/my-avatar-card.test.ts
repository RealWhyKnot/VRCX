import { describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { MyAvatar } from "../../../../src/views/MyAvatars/types";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../src/coordinators/date-coordinator", () => ({
  formatDateFilter: () => "formatted-date",
}));
vi.mock("../../../../src/shared/utils/platform-utils", () => ({
  getAvailablePlatforms: () => ({ isPC: true, isQuest: true, isIos: false }),
}));
vi.mock("../../../../src/shared/utils/avatar", () => ({
  getPlatformInfo: () => ({
    pc: { performanceRating: "Good" },
    android: { performanceRating: "Medium" },
    ios: { performanceRating: "" },
  }),
}));
vi.mock("../../../../src/shared/utils/base/format", () => ({
  timeToText: () => "1h",
}));

vi.mock("../../../../src/shared/constants/tags", () => ({
  getTagColor: () => ({
    name: "blue",
    bg: "hsl(210 100% 50% / 0.2)",
    text: "hsl(210 100% 40%)",
  }),
}));

vi.mock("@/components/ui/context-menu/ContextMenu.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuSeparator.vue", () => ({
  default: { template: "<hr />" },
}));
vi.mock("@/components/ui/context-menu/ContextMenuItem.vue", () => ({
  default: {
    props: ["disabled"],
    emits: ["click"],
    template: '<button data-testid="ctx-item" :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("@/components/ui/hover-card/HoverCard.vue", () => ({
  default: {
    props: ["open"],
    emits: ["update:open"],
    template: "<div><slot /></div>",
  },
}));
vi.mock("@/components/ui/hover-card/HoverCardTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/hover-card/HoverCardContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/badge/Badge.vue", () => ({
  default: { template: '<span data-testid="badge"><slot /></span>' },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="button" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("@/components/ui/card/Card.vue", () => ({
  default: { template: '<div data-testid="card"><slot /></div>' },
}));

vi.mock("@/components/ui/separator/Separator.vue", () => ({
  default: { template: "<hr />" },
}));

vi.mock("lucide-vue-next", () => ({
  Apple: { template: "<i />" },
  Check: { template: "<i />" },
  ExternalLink: { template: "<i />" },
  Eye: { template: "<i />" },
  Image: { template: "<i />" },
  Monitor: { template: "<i />" },
  Pencil: { template: "<i />" },
  RefreshCw: { template: "<i />" },
  Smartphone: { template: "<i />" },
  Tag: { template: "<i />" },
  User: { template: "<i />" },
}));

import MyAvatarCard from "../../../../src/views/MyAvatars/components/MyAvatarCard.vue";
import { createDefaultAvatarRef } from "../../../../src/shared/utils/avatar-transforms";

function mountCard(props: { avatar?: Partial<MyAvatar>; currentAvatarId?: string } = {}) {
  const defaultAvatar: MyAvatar = {
    ...createDefaultAvatarRef({
      id: "avtr_1",
      name: "Avatar One",
      thumbnailImageUrl: "https://example.com/a.jpg",
      releaseStatus: "public",
      unityPackages: [],
      updated_at: "2025-01-01T00:00:00.000Z",
      created_at: "2024-01-01T00:00:00.000Z",
      version: 1,
    }),
    $tags: [{ tag: "fun", color: null }],
  };
  return mount(MyAvatarCard, {
    props: {
      avatar: Object.assign(defaultAvatar, props.avatar),
      currentAvatarId: props.currentAvatarId ?? "",
      cardScale: 0.6,
    },
  });
}

describe("MyAvatarCard.vue", () => {
  test("renders avatar name and tags", () => {
    const wrapper = mountCard();

    expect(wrapper.text()).toContain("Avatar One");
    expect(wrapper.text()).toContain("fun");
  });

  test("emits click when card wrapper is clicked", async () => {
    const wrapper = mountCard();

    await wrapper.find(".avatar-card-wrapper").trigger("click");

    expect(wrapper.emitted("click")).toBeTruthy();
    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  test("emits context action from menu item", async () => {
    const wrapper = mountCard();
    const detailsItem = wrapper.findAll('[data-testid="ctx-item"]').find((node) => node.text().includes("dialog.avatar.actions.view_details"));

    expect(detailsItem).toBeTruthy();
    await detailsItem?.trigger("click");

    expect(wrapper.emitted("context-action")).toBeTruthy();
    expect(wrapper.emitted("context-action")?.[0]).toEqual(["details", expect.objectContaining({ id: "avtr_1" })]);
  });

  test("disables wear action when avatar is active", () => {
    const wrapper = mountCard({ currentAvatarId: "avtr_1" });
    const wearItem = wrapper.findAll('[data-testid="ctx-item"]').find((node) => node.text().includes("view.favorite.select_avatar_tooltip"));

    expect(wearItem?.attributes("disabled")).toBeDefined();
  });
});
