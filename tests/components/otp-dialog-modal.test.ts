import { beforeEach, describe, expect, test, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { createTestingPinia } from "@pinia/testing";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

import en from "../../src/localization/en.json";

const { otpInputStub } = vi.hoisted(() => ({
  otpInputStub: {
    name: "InputOTP",
    template:
      '<div class="input-otp-stub"><input :data-maxlength="maxlength" :inputmode="inputmode" @input="$emit(\'complete\', $event.target.value)" /><slot /></div>',
    props: ["maxlength", "inputmode", "modelValue", "pasteTransformer"],
    emits: ["update:modelValue", "complete"],
  },
}));

vi.mock("../../src/views/Feed/Feed.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../../src/views/Feed/columns.tsx", () => ({ columns: [] }));
vi.mock("../../src/plugins/router", () => ({
  router: {
    beforeEach: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    currentRoute: ref({ path: "/", name: "", meta: {} }),
    isReady: vi.fn().mockResolvedValue(true),
  },
  initRouter: vi.fn(),
}));
vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();
  return {
    ...actual,
    useRouter: vi.fn(() => ({
      push: vi.fn(),
      replace: vi.fn(),
      currentRoute: ref({ path: "/", name: "", meta: {} }),
    })),
  };
});
vi.mock("../../src/plugins/interop-api", () => ({ initInteropApi: vi.fn() }));
vi.mock("../../src/services/database", () => ({
  database: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return false;
        return vi.fn(() => Promise.resolve(null));
      },
    }
  ),
}));
vi.mock("../../src/services/config", () => ({
  configRepository: {
    init: vi.fn(),
    getString: vi.fn((_key: string, defaultValue?: string) => defaultValue ?? "{}"),
    setString: vi.fn(),
    getBool: vi.fn((_key: string, isDefaultValue?: boolean) => isDefaultValue ?? false),
    setBool: vi.fn(),
    getInt: vi.fn((_key: string, defaultValue?: number) => defaultValue ?? 0),
    setInt: vi.fn(),
    getFloat: vi.fn((_key: string, defaultValue?: number) => defaultValue ?? 0),
    setFloat: vi.fn(),
    getObject: vi.fn().mockReturnValue(null),
    setObject: vi.fn(),
    getArray: vi.fn().mockReturnValue([]),
    setArray: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../../src/services/json-storage", () => ({ VrcxJsonStorage: vi.fn() }));
vi.mock("../../src/services/watch-state", () => ({
  watchState: { isLoggedIn: false },
}));

import OtpDialogModal from "../../src/components/ui/dialog/OtpDialogModal.vue";
import { useModalStore } from "../../src/stores/modal";

const i18n = createI18n({
  locale: "en",
  fallbackLocale: "en",
  legacy: false,
  globalInjection: false,
  missingWarn: false,
  fallbackWarn: false,
  messages: { en },
});

const stubs = {
  Dialog: {
    template: '<div class="dialog-stub" v-if="open"><slot /></div>',
    props: ["open"],
  },
  DialogContent: {
    template: '<div class="dialog-content-stub"><slot /></div>',
  },
  DialogHeader: { template: '<div class="dialog-header"><slot /></div>' },
  DialogTitle: { template: '<span class="dialog-title"><slot /></span>' },
  DialogDescription: {
    template: '<span class="dialog-description"><slot /></span>',
  },
  DialogFooter: { template: '<div class="dialog-footer"><slot /></div>' },
  InputOTP: otpInputStub,
  InputOTPGroup: { template: '<div class="otp-group"><slot /></div>' },
  InputOTPSlot: {
    template: '<div class="otp-slot" :data-index="index"></div>',
    props: ["index"],
  },
  InputOTPSeparator: { template: '<div class="otp-separator">-</div>' },
};

function mountOtpDialog(storeOverrides: Record<string, unknown> = {}) {
  const pinia = createTestingPinia({
    createSpy: vi.fn,
    stubActions: false,
    initialState: {
      Modal: storeOverrides,
    },
  });
  return mount(OtpDialogModal, {
    global: {
      plugins: [i18n, pinia],
      stubs,
    },
  });
}

function findButtonByText(wrapper: ReturnType<typeof mountOtpDialog>, text: string) {
  const button = wrapper.findAll("button").find((candidate) => candidate.text() === text);
  if (!button) throw new Error(`no button labelled ${text}`);
  return button;
}

function isPasteTransformer(value: unknown): value is (text: string) => string {
  return typeof value === "function";
}

describe("OtpDialogModal.vue", () => {
  let store: ReturnType<typeof useModalStore>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility", () => {
    test("does not render when otpOpen is false", () => {
      const wrapper = mountOtpDialog({ otpOpen: false });
      store = useModalStore();
      expect(wrapper.find(".dialog-stub").exists()).toBe(false);
    });

    test("renders dialog when otpOpen is true", () => {
      const wrapper = mountOtpDialog({ otpOpen: true });
      store = useModalStore();
      expect(wrapper.find(".dialog-stub").exists()).toBe(true);
    });
  });

  describe("title and description", () => {
    test("displays title and description from store", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpTitle: "Enter TOTP Code",
        otpDescription: "Check your authenticator app",
      });
      store = useModalStore();
      expect(wrapper.find(".dialog-title").text()).toBe("Enter TOTP Code");
      expect(wrapper.find(".dialog-description").text()).toBe("Check your authenticator app");
    });
  });

  describe("mode rendering", () => {
    test("renders 6 slots for totp mode", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "totp",
      });
      store = useModalStore();
      const otpInput = wrapper.find(".input-otp-stub");
      expect(otpInput.exists()).toBe(true);
      expect(otpInput.find("input").attributes("data-maxlength")).toBe("6");
      expect(otpInput.find("input").attributes("inputmode")).toBe("numeric");
      const slots = wrapper.findAll(".otp-slot");
      expect(slots).toHaveLength(6);
      expect(wrapper.find(".otp-separator").exists()).toBe(false);
    });

    test("renders 6 slots for emailOtp mode", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "emailOtp",
      });
      store = useModalStore();
      const otpInput = wrapper.find(".input-otp-stub");
      expect(otpInput.exists()).toBe(true);
      expect(otpInput.find("input").attributes("data-maxlength")).toBe("6");
      expect(otpInput.find("input").attributes("inputmode")).toBe("numeric");
      const slots = wrapper.findAll(".otp-slot");
      expect(slots).toHaveLength(6);
    });

    test("renders 8 slots with separator for otp (recovery) mode", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "otp",
      });
      store = useModalStore();
      const otpInput = wrapper.find(".input-otp-stub");
      expect(otpInput.exists()).toBe(true);
      expect(otpInput.find("input").attributes("data-maxlength")).toBe("8");
      expect(otpInput.find("input").attributes("inputmode")).toBe("text");
      const slots = wrapper.findAll(".otp-slot");
      expect(slots).toHaveLength(8);
      expect(wrapper.find(".otp-separator").exists()).toBe(true);
    });

    test("does not render otp input when mode is totp", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "totp",
      });
      store = useModalStore();

      const inputs = wrapper.findAll(".input-otp-stub");
      expect(inputs).toHaveLength(1);
      expect(inputs[0]?.find("input").attributes("data-maxlength")).toBe("6");
    });
  });

  describe("button text", () => {
    test("displays ok and cancel text from store", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpOkText: "Verify",
        otpCancelText: "Use Recovery",
      });
      store = useModalStore();
      const buttons = wrapper.findAll("button");
      expect(buttons.find((b) => b.text() === "Use Recovery")).toBeTruthy();
      expect(buttons.find((b) => b.text() === "Verify")).toBeTruthy();
    });
  });

  describe("cancel button", () => {
    test("calls handleOtpCancel when cancel button is clicked", async () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpOkText: "Verify",
        otpCancelText: "Cancel",
      });
      store = useModalStore();
      const spy = vi.spyOn(store, "handleOtpCancel");

      await findButtonByText(wrapper, "Cancel").trigger("click");

      expect(spy).toHaveBeenCalledWith("");
    });
  });

  describe("submit", () => {
    test("does not call handleOtpOk on form submit when value is empty", async () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
      });
      store = useModalStore();
      const spy = vi.spyOn(store, "handleOtpOk");

      await wrapper.find("form").trigger("submit");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("complete event", () => {
    test("calls handleOtpOk when InputOTP emits complete", async () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "totp",
      });
      store = useModalStore();
      const spy = vi.spyOn(store, "handleOtpOk");

      const otpInput = wrapper.findComponent(otpInputStub);
      await otpInput.find("input").setValue("123456");
      await wrapper.vm.$nextTick();

      expect(spy).toHaveBeenCalledWith("123456");
    });
  });

  describe("value reset", () => {
    test("resets otpValue when dialog opens", async () => {
      const wrapper = mountOtpDialog({
        otpOpen: false,
        otpMode: "totp",
      });
      store = useModalStore();

      store.otpOpen = true;
      await wrapper.vm.$nextTick();

      await wrapper.vm.$nextTick();

      const otpInput = wrapper.findComponent(otpInputStub);
      expect(otpInput.exists()).toBe(true);
      expect(otpInput.props("modelValue")).toBe("");
    });
  });

  describe("paste transformer", () => {
    test("recovery code InputOTP has pasteTransformer that strips non-alphanumeric chars", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "otp",
      });
      store = useModalStore();
      const otpInput = wrapper.findComponent(otpInputStub);
      const transformer: unknown = otpInput.props("pasteTransformer");
      expect(transformer).toBeTypeOf("function");
      if (!isPasteTransformer(transformer)) throw new Error("pasteTransformer is not a function");
      expect(transformer("abcd-1234")).toBe("abcd1234");
      expect(transformer("ab-cd-12-34")).toBe("abcd1234");
      expect(transformer("abcd1234")).toBe("abcd1234");
    });

    test("totp InputOTP does not have pasteTransformer", () => {
      const wrapper = mountOtpDialog({
        otpOpen: true,
        otpMode: "totp",
      });
      store = useModalStore();
      const otpInput = wrapper.findComponent(otpInputStub);
      expect(otpInput.props("pasteTransformer")).toBeUndefined();
    });
  });
});
