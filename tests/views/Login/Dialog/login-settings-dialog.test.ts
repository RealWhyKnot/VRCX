import { beforeEach, describe, expect, test, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mocks = await vi.hoisted(async () => {
  const { ref } = await import("vue");
  const toggleCustomEndpoint = vi.fn();
  const restartVRCX = vi.fn<(...args: unknown[]) => void>();
  const setProxyServer = vi.fn((value: string) => {
    vrcxStore.proxyServer = value;
  });
  const vrcxStore = { proxyServer: "", setProxyServer };
  const loginForm = ref({ endpoint: "", websocket: "" });
  const enableCustomEndpoint = ref(false);
  const authStore = { loginForm, enableCustomEndpoint, toggleCustomEndpoint };
  return { toggleCustomEndpoint, restartVRCX, setProxyServer, vrcxStore, loginForm, enableCustomEndpoint, authStore };
});

vi.mock("pinia", () => ({
  storeToRefs: (store: unknown) => store,
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../../src/stores/auth", () => ({
  useAuthStore: () => mocks.authStore,
}));
vi.mock("../../../../src/stores/vrcx-updater", () => ({
  useVRCXUpdaterStore: () => ({
    restartVRCX: (...args: unknown[]) => mocks.restartVRCX(...args),
  }),
}));
vi.mock("../../../../src/stores/vrcx", () => ({
  useVrcxStore: () => mocks.vrcxStore,
}));

vi.mock("../../../../src/services/app-config", () => ({
  AppDebug: {
    endpointDomainVrchat: "api.vrchat.cloud",
    websocketDomainVrchat: "pipeline.vrchat.cloud",
  },
}));

vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: {
    props: ["open"],
    emits: ["update:open"],
    template:
      '<div data-testid="dialog-root">' + '<button data-testid="open-dialog" @click="$emit(\'update:open\', true)">open</button>' + "<slot />" + "</div>",
  },
}));
vi.mock("@/components/ui/dialog/DialogTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/field/Field.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldLabel.vue", () => ({
  default: { template: "<label><slot /></label>" },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>",
  },
}));

vi.mock("@/components/ui/checkbox/Checkbox.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<button data-testid="toggle-custom-endpoint" @click="$emit(\'update:modelValue\', !modelValue)">toggle</button>',
  },
}));

vi.mock("@/components/ui/input-group/InputGroupField.vue", () => ({
  default: {
    props: ["id", "modelValue"],
    emits: ["update:modelValue"],
    template: '<input :id="id" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}));

vi.mock("lucide-vue-next", () => ({
  Settings: { template: "<span />" },
}));

import LoginSettingsDialog from "../../../../src/views/Login/Dialog/LoginSettingsDialog.vue";

function mountDialog() {
  return mount(LoginSettingsDialog, {
    global: {
      stubs: {
        TooltipWrapper: { template: "<div><slot /></div>" },
      },
    },
  });
}

function clickButtonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll("button").find((node) => node.text().trim() === text);
  if (!button) {
    throw new Error(`Cannot find button with text: ${text}`);
  }
  return button.trigger("click");
}

describe("LoginSettingsDialog.vue", () => {
  let storage: { Set: ReturnType<typeof vi.fn>; Save: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mocks.loginForm.value = { endpoint: "", websocket: "" };
    mocks.enableCustomEndpoint.value = false;
    mocks.toggleCustomEndpoint.mockReset();
    mocks.restartVRCX.mockReset();
    mocks.setProxyServer.mockClear();
    mocks.vrcxStore.proxyServer = "http://proxy.local:7890";

    storage = {
      Set: vi.fn().mockResolvedValue(undefined),
      Save: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal("VRCXStorage", storage);
  });

  test("loads proxy value when dialog opens", async () => {
    const wrapper = mountDialog();

    await wrapper.get('[data-testid="open-dialog"]').trigger("click");
    await nextTick();

    expect(wrapper.get("#login-settings-proxy").element).toHaveProperty("value", "http://proxy.local:7890");
  });

  test("toggles custom endpoint and shows endpoint inputs", async () => {
    const wrapper = mountDialog();

    await wrapper.get('[data-testid="toggle-custom-endpoint"]').trigger("click");
    await nextTick();

    expect(mocks.toggleCustomEndpoint).toHaveBeenCalledTimes(1);
  });

  test("saves proxy and closes", async () => {
    const wrapper = mountDialog();

    await wrapper.get('[data-testid="open-dialog"]').trigger("click");
    await wrapper.get("#login-settings-proxy").setValue("http://127.0.0.1:8080");
    await clickButtonByText(wrapper, "prompt.proxy_settings.close");

    expect(mocks.setProxyServer).toHaveBeenCalledWith("http://127.0.0.1:8080");
    expect(storage.Set).toHaveBeenCalledWith("VRCX_ProxyServer", "http://127.0.0.1:8080");
    expect(storage.Save).toHaveBeenCalledTimes(1);
    expect(mocks.restartVRCX).not.toHaveBeenCalled();
  });

  test("saves proxy and restarts app", async () => {
    const wrapper = mountDialog();

    await wrapper.get('[data-testid="open-dialog"]').trigger("click");
    await wrapper.get("#login-settings-proxy").setValue("http://192.168.0.2:3128");
    await clickButtonByText(wrapper, "prompt.proxy_settings.restart");

    expect(mocks.setProxyServer).toHaveBeenCalledWith("http://192.168.0.2:3128");
    expect(storage.Save).toHaveBeenCalledTimes(1);
    expect(mocks.restartVRCX).toHaveBeenCalledWith(false);
  });
});
