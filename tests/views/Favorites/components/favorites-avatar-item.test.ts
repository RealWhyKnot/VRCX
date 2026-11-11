import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  showFavoriteDialog: vi.fn(),
  showAvatarDialog: vi.fn(),
  selectAvatarWithConfirmation: vi.fn(),
  deleteFavorite: vi.fn(),
  removeLocalAvatarFavorite: vi.fn(),
  currentUser: { currentAvatar: "" },
}));

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storeToRefs: (store) => store,
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

vi.mock("../../../../src/stores/favorite", () => ({
  useFavoriteStore: () => ({
    showFavoriteDialog: (...args) => mocks.showFavoriteDialog(...args),
  }),
}));
vi.mock("../../../../src/stores/user", () => ({
  useUserStore: () => ({
    currentUser: mocks.currentUser,
  }),
}));

vi.mock("../../../../src/coordinators/avatar-coordinator", () => ({
  showAvatarDialog: (...args) => mocks.showAvatarDialog(...args),
  selectAvatarWithConfirmation: (...args) => mocks.selectAvatarWithConfirmation(...args),
}));

vi.mock("../../../../src/coordinators/favorite-coordinator", () => ({
  removeLocalAvatarFavorite: (...args) => mocks.removeLocalAvatarFavorite(...args),
}));

vi.mock("../../../../src/api/favorite", () => ({
  favoriteRequest: {
    deleteFavorite: (...args) => mocks.deleteFavorite(...args),
  },
}));

vi.mock("@/components/ui/item/Item.vue", () => ({
  default: {
    emits: ["click"],
    template: '<div data-testid="item" @click="$emit(\'click\', $event)"><slot /></div>',
  },
}));
vi.mock("@/components/ui/item/ItemActions.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/item/ItemMedia.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/item/ItemContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/item/ItemTitle.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/item/ItemDescription.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/avatar/Avatar.vue", () => ({
  default: { template: '<div data-testid="avatar"><slot /></div>' },
}));
vi.mock("@/components/ui/avatar/AvatarImage.vue", () => ({
  default: {
    props: ["src"],
    template: '<img data-testid="avatar-image" :src="src" :class="$attrs.class" />',
  },
}));
vi.mock("@/components/ui/avatar/AvatarFallback.vue", () => ({
  default: {
    template: '<span data-testid="avatar-fallback" :class="$attrs.class"><slot /></span>',
  },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="button" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}));

vi.mock("@/components/ui/checkbox/Checkbox.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<input data-testid="checkbox" type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
  },
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
    emits: ["click"],
    template: '<button data-testid="ctx-item" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("@/components/ui/dropdown-menu/DropdownMenu.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuSeparator.vue", () => ({
  default: { template: "<hr />" },
}));
vi.mock("@/components/ui/dropdown-menu/DropdownMenuItem.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="dd-item" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("lucide-vue-next", () => ({
  AlertTriangle: { template: "<i />" },
  Image: { template: "<i />" },
  Lock: { template: "<i />" },
  MoreHorizontal: { template: "<i />" },
  Trash2: { template: "<i />" },
}));

import FavoritesAvatarItem from "../../../../src/views/Favorites/components/FavoritesAvatarItem.vue";

function mountItem(props = {}) {
  return mount(FavoritesAvatarItem, {
    props: {
      favorite: {
        id: "avtr_1",
        ref: {
          name: "Avatar One",
          authorName: "Author",
          thumbnailImageUrl: "https://example.com/avatar_256.png",
          releaseStatus: "public",
        },
      },
      group: "FavGroup",
      isLocalFavorite: false,
      editMode: false,
      selected: false,
      ...props,
    },
  });
}

async function clickMenuItem(wrapper, text) {
  const buttons = wrapper.findAll("button");
  const target = buttons.find((btn) => btn.text().includes(text));
  expect(target, `menu item not found: ${text}`).toBeTruthy();
  await target.trigger("click");
}

describe("FavoritesAvatarItem.vue", () => {
  beforeEach(() => {
    mocks.showFavoriteDialog.mockReset();
    mocks.showAvatarDialog.mockReset();
    mocks.selectAvatarWithConfirmation.mockReset();
    mocks.deleteFavorite.mockReset();
    mocks.removeLocalAvatarFavorite.mockReset();
    mocks.currentUser.currentAvatar = "";
  });

  it("opens avatar details when item is clicked", async () => {
    const wrapper = mountItem();

    await wrapper.get('[data-testid="item"]').trigger("click");

    expect(mocks.showAvatarDialog).toHaveBeenCalledWith("avtr_1");
  });

  it("adds the unified hover classes on item", () => {
    const wrapper = mountItem();

    expect(wrapper.get('[data-testid="item"]').classes()).toEqual(expect.arrayContaining(["favorites-item", "hover:bg-muted", "x-hover-list"]));
  });

  it("uses rounded avatar shell and 128 thumbnail image", () => {
    const wrapper = mountItem();

    expect(wrapper.get('[data-testid="avatar"]').classes()).toEqual(expect.arrayContaining(["rounded-sm", "size-full"]));
    expect(wrapper.get('[data-testid="avatar-image"]').attributes("src")).toContain("avatar_128.png");
    expect(wrapper.get('[data-testid="avatar-fallback"]').classes()).toContain("rounded-sm");
  });

  it("shows fallback icon when thumbnail is missing", () => {
    const wrapper = mountItem({
      favorite: {
        id: "avtr_no_thumb",
        ref: {
          name: "Bravo",
          authorName: "Author",
          thumbnailImageUrl: "",
          releaseStatus: "public",
        },
      },
    });

    expect(wrapper.find('[data-testid="avatar-image"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="avatar-fallback"]').find("i").exists()).toBe(true);
  });

  it("uses local delete flow for local favorites", async () => {
    const wrapper = mountItem({
      isLocalFavorite: true,
      group: { name: "LocalGroup" },
      favorite: {
        id: "avtr_local",
        name: "Local Avatar",
        thumbnailImageUrl: "",
      },
    });

    await clickMenuItem(wrapper, "view.favorite.delete_tooltip");

    expect(mocks.removeLocalAvatarFavorite).toHaveBeenCalledWith("avtr_local", "LocalGroup");
    expect(mocks.deleteFavorite).not.toHaveBeenCalled();
  });

  it("uses remote delete flow for remote favorites", async () => {
    const wrapper = mountItem();

    await clickMenuItem(wrapper, "view.favorite.unfavorite_tooltip");

    expect(mocks.deleteFavorite).toHaveBeenCalledWith({
      objectId: "avtr_1",
    });
    expect(mocks.removeLocalAvatarFavorite).not.toHaveBeenCalled();
  });
});
