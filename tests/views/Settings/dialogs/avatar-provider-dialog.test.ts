import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = await vi.hoisted(async () => {
  const { ref: hoistedRef } = await import("vue");
  return {
    avatarRemoteDatabaseProviderList: hoistedRef<string[]>([]),
    saveAvatarProviderList: vi.fn<(...args: unknown[]) => void>(),
    removeAvatarProvider: vi.fn<(provider: string) => void>(),
  };
});

vi.mock("pinia", async (importOriginal: () => Promise<Record<string, unknown>>) => {
  const actual = await importOriginal();
  return {
    ...actual,
    storeToRefs: (store: unknown) => store,
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref("en"),
  }),
}));

vi.mock("../../../../src/stores/avatar-provider", () => ({
  useAvatarProviderStore: () => ({
    avatarRemoteDatabaseProviderList: mocks.avatarRemoteDatabaseProviderList,
    saveAvatarProviderList: (...args: unknown[]) => mocks.saveAvatarProviderList(...args),
    removeAvatarProvider: (provider: string) => mocks.removeAvatarProvider(provider),
  }),
}));

vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: {
    props: ["open"],
    emits: ["update:open"],
    template:
      '<div data-testid="dialog" v-if="open">' +
      '<button data-testid="close-dialog" @click="$emit(\'update:open\', false)">close</button>' +
      "<slot />" +
      "</div>",
  },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<h2><slot /></h2>" },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="add-provider" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("@/components/ui/input-group/InputGroupAction.vue", () => ({
  default: {
    props: ["modelValue", "size"],
    emits: ["update:modelValue", "change"],
    template:
      '<div class="provider-row">' +
      '<input data-testid="provider-input" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" />' +
      '<slot name="actions" />' +
      "</div>",
  },
}));

vi.mock("lucide-vue-next", () => ({
  Trash2: {
    emits: ["click"],
    template: '<button data-testid="trash" @click="$emit(\'click\')">trash</button>',
  },
}));

import AvatarProviderDialog from "../../../../src/views/Settings/dialogs/AvatarProviderDialog.vue";

function mountComponent(props: { isAvatarProviderDialogVisible?: boolean } = {}) {
  return mount(AvatarProviderDialog, {
    props: {
      isAvatarProviderDialogVisible: true,
      ...props,
    },
  });
}

describe("AvatarProviderDialog.vue", () => {
  beforeEach(() => {
    mocks.avatarRemoteDatabaseProviderList.value = ["https://a.example", "https://b.example"];
    mocks.saveAvatarProviderList.mockReset();
    mocks.removeAvatarProvider.mockReset();
  });

  test("renders provider rows when dialog is visible", () => {
    const wrapper = mountComponent();

    expect(wrapper.find('[data-testid="dialog"]').exists()).toBe(true);
    expect(wrapper.findAll(".provider-row")).toHaveLength(2);
  });

  test("emits close when dialog open updates to false", async () => {
    const wrapper = mountComponent();

    await wrapper.get('[data-testid="close-dialog"]').trigger("click");

    expect(wrapper.emitted("update:isAvatarProviderDialogVisible")).toEqual([[false]]);
  });

  test("adds empty provider entry when add button clicked", async () => {
    const wrapper = mountComponent();

    await wrapper.get('[data-testid="add-provider"]').trigger("click");

    expect(mocks.avatarRemoteDatabaseProviderList.value).toEqual(["https://a.example", "https://b.example", ""]);
  });

  test("calls saveAvatarProviderList on provider input change", async () => {
    const wrapper = mountComponent();

    const input = wrapper.findAll('[data-testid="provider-input"]')[0];
    if (!input) {
      throw new Error("provider input not found");
    }
    await input.setValue("https://updated.example");

    expect(mocks.avatarRemoteDatabaseProviderList.value[0]).toBe("https://updated.example");
    expect(mocks.saveAvatarProviderList).toHaveBeenCalledTimes(1);
  });

  test("calls removeAvatarProvider with row provider when trash clicked", async () => {
    const wrapper = mountComponent();

    const trash = wrapper.findAll('[data-testid="trash"]')[1];
    if (!trash) {
      throw new Error("trash button not found");
    }
    await trash.trigger("click");

    expect(mocks.removeAvatarProvider).toHaveBeenCalledWith("https://b.example");
  });
});
