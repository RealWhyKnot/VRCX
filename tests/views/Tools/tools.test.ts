import { beforeEach, describe, expect, test, vi } from "vitest";
import { ref } from "vue";
import { flushPromises, mount } from "@vue/test-utils";

const push = vi.fn<(location: { name: string }) => Promise<void>>(() => Promise.resolve());
const showGalleryPage = vi.fn<() => void>();
const showVRChatConfig = vi.fn<() => void>();
const showLaunchOptions = vi.fn<() => void>();
const showRegistryBackupDialog = vi.fn<() => void>();
const getString = vi.fn<(key: string) => Promise<string>>();
const setString = vi.fn<(key: string, value: string) => Promise<void>>(() => Promise.resolve());
const friends = ref<unknown[]>([]);
let routeName = "not-tools";

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    useRouter: () => ({ push }),
    useRoute: () => ({
      get name() {
        return routeName;
      },
    }),
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("pinia", async (importOriginal) => {
  const actual = await importOriginal<object>();
  return {
    ...actual,
    storeToRefs: (store: unknown) => store,
  };
});

vi.mock("../../../src/stores/friend", () => ({
  useFriendStore: () => ({ friends }),
}));
vi.mock("../../../src/stores/gallery", () => ({
  useGalleryStore: () => ({ showGalleryPage }),
}));
vi.mock("../../../src/stores/tools", () => ({
  useToolsStore: () => ({ openDialog: vi.fn() }),
}));
vi.mock("../../../src/stores/settings/advanced", () => ({
  useAdvancedSettingsStore: () => ({ showVRChatConfig }),
}));
vi.mock("../../../src/stores/launch", () => ({
  useLaunchStore: () => ({ showLaunchOptions }),
}));
vi.mock("../../../src/stores/vrcx", () => ({
  useVrcxStore: () => ({ showRegistryBackupDialog }),
}));

vi.mock("../../../src/composables/use-tool-nav-pinning", () => ({
  useToolNavPinning: () => ({
    pinToolToNav: vi.fn(),
    pinnedToolKeys: new Set<string>(),
    refreshPinnedState: () => Promise.resolve(),
    unpinToolFromNav: vi.fn(),
  }),
}));

vi.mock("../../../src/services/config.ts", () => ({
  configRepository: {
    getString: (key: string) => getString(key),
    setString: (key: string, value: string) => setString(key, value),
  },
}));

vi.mock("../../../src/views/Tools/dialogs/AutoChangeStatusDialog.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("../../../src/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: {
    template: "<div><slot /></div>",
    props: ["content", "disabled", "side"],
  },
}));

import Tools from "../../../src/views/Tools/Tools.vue";

function mountTools() {
  return mount(Tools);
}

type ToolsWrapper = ReturnType<typeof mountTools>;

function findToolItemByTitle(wrapper: ToolsWrapper, titleKey: string) {
  const item = wrapper.findAllComponents({ name: "ToolItem" }).find((component) => component.text().includes(titleKey));
  if (!item) {
    throw new Error(`tool item not rendered: ${titleKey}`);
  }
  return item;
}

function findCategoryHeaderByTitle(wrapper: ToolsWrapper, titleKey: string) {
  const header = wrapper.findAll("div.cursor-pointer").find((node) => node.text().includes(titleKey));
  if (!header) {
    throw new Error(`category header not rendered: ${titleKey}`);
  }
  return header;
}

describe("Tools.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeName = "not-tools";
    getString.mockResolvedValue("{}");
  });

  test("clicking screenshot tool navigates to screenshot metadata", async () => {
    const wrapper = mountTools();
    await flushPromises();

    const screenshotItem = findToolItemByTitle(wrapper, "view.tools.pictures.screenshot");

    await screenshotItem.trigger("click");

    expect(push).toHaveBeenCalledWith({ name: "screenshot-metadata" });
  });

  test("clicking gallery tool calls showGalleryPage", async () => {
    const wrapper = mountTools();
    await flushPromises();

    const galleryItem = findToolItemByTitle(wrapper, "view.tools.pictures.gallery");

    await galleryItem.trigger("click");

    expect(push).toHaveBeenCalledWith({ name: "gallery" });
  });

  test("toggle category persists collapsed state", async () => {
    const wrapper = mountTools();
    await flushPromises();

    const imageCategoryHeader = findCategoryHeaderByTitle(wrapper, "view.tools.pictures.header");

    await imageCategoryHeader.trigger("click");

    expect(setString).toHaveBeenCalledWith("VRCX_toolsCategoryCollapsed", expect.stringContaining('"image":true'));
  });

  test("loads stored collapsed state before toggling category", async () => {
    getString.mockResolvedValue('{"image":true}');

    const wrapper = mountTools();
    await flushPromises();

    const imageCategoryHeader = findCategoryHeaderByTitle(wrapper, "view.tools.pictures.header");

    await imageCategoryHeader.trigger("click");

    expect(setString).toHaveBeenCalledWith("VRCX_toolsCategoryCollapsed", expect.stringContaining('"image":false'));
  });
});
