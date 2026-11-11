import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";

import en from "../../src/localization/en.json";

type DialogResult = {
  ok: boolean;
  reason: string;
  checked?: boolean;
  value?: unknown;
};

function isDialogResult(value: unknown): value is DialogResult {
  return typeof value === "object" && value !== null && "ok" in value && "reason" in value;
}

async function settle(pending: Promise<unknown>): Promise<DialogResult> {
  const result = await pending;
  if (!isDialogResult(result)) {
    throw new Error("dialog resolved without a result");
  }
  return result;
}

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
    isReady: vi.fn(() => Promise.resolve(true)),
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
    getString: vi.fn((_key: string, fallback?: string) => fallback ?? "{}"),
    setString: vi.fn(),
    getBool: vi.fn((_key: string, isFallback?: boolean) => isFallback ?? false),
    setBool: vi.fn(),
    getInt: vi.fn((_key: string, fallback?: number) => fallback ?? 0),
    setInt: vi.fn(),
    getFloat: vi.fn((_key: string, fallback?: number) => fallback ?? 0),
    setFloat: vi.fn(),
    getObject: vi.fn(() => null),
    setObject: vi.fn(),
    getArray: vi.fn(() => []),
    setArray: vi.fn(),
    remove: vi.fn(),
  },
}));
vi.mock("../../src/services/json-storage", () => ({ VrcxJsonStorage: vi.fn() }));
vi.mock("../../src/services/watch-state", () => ({
  watchState: { isLoggedIn: false },
}));
vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  const i18n = actual.createI18n({
    locale: "en",
    fallbackLocale: "en",
    legacy: false,
    missingWarn: false,
    fallbackWarn: false,
    messages: { en },
  });
  return {
    ...actual,
    useI18n: () => i18n.global,
  };
});

import { useModalStore } from "../../src/stores/modal";

describe("useModalStore", () => {
  let store: ReturnType<typeof useModalStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useModalStore();
  });

  describe("confirm", () => {
    test("opens dialog and resolves ok:true on handleOk", async () => {
      const promise = store.confirm({
        title: "Delete?",
        description: "Are you sure?",
      });

      expect(store.alertOpen).toBe(true);
      expect(store.alertMode).toBe("confirm");
      expect(store.alertTitle).toBe("Delete?");
      expect(store.alertDescription).toBe("Are you sure?");

      store.handleOk();

      const result = await settle(promise);
      expect(result.ok).toBe(true);
      expect(result.reason).toBe("ok");
      expect(store.alertOpen).toBe(false);
    });

    test("resolves ok:false on handleCancel", async () => {
      const promise = store.confirm({
        title: "Test",
        description: "desc",
      });
      store.handleCancel();

      const result = await settle(promise);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("cancel");
      expect(store.alertOpen).toBe(false);
    });

    test("resolves ok:false with reason dismiss on handleDismiss", async () => {
      const promise = store.confirm({
        title: "Test",
        description: "desc",
      });
      store.handleDismiss();

      const result = await settle(promise);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("dismiss");
    });

    test("does not dismiss when dismissible is false", async () => {
      const promise = store.confirm({
        title: "Test",
        description: "desc",
        dismissible: false,
      });

      expect(store.alertDismissible).toBe(false);
      store.handleDismiss();
      expect(store.alertOpen).toBe(true);

      store.handleCancel();
      await settle(promise);
    });

    test("uses custom confirmText and cancelText", async () => {
      const pending = store.confirm({
        title: "T",
        description: "D",
        confirmText: "Yes",
        cancelText: "No",
      });

      expect(store.alertOkText).toBe("Yes");
      expect(store.alertCancelText).toBe("No");

      store.handleCancel();
      await pending;
    });

    test("replaces previous dialog with reason replaced", async () => {
      const first = store.confirm({
        title: "First",
        description: "first desc",
      });
      const second = store.confirm({
        title: "Second",
        description: "second desc",
      });

      const firstResult = await settle(first);
      expect(firstResult.ok).toBe(false);
      expect(firstResult.reason).toBe("replaced");

      expect(store.alertTitle).toBe("Second");
      expect(store.alertOpen).toBe(true);

      store.handleOk();
      const secondResult = await settle(second);
      expect(secondResult.ok).toBe(true);
    });
  });

  describe("alert", () => {
    test("opens in alert mode with only ok button text", async () => {
      const pending = store.alert({
        title: "Notice",
        description: "Something happened",
      });

      expect(store.alertMode).toBe("alert");
      expect(store.alertCancelText).toBe("");
      expect(store.alertOpen).toBe(true);

      store.handleOk();
      await pending;
    });

    test("handleCancel resolves as ok for alert mode", async () => {
      const promise = store.alert({
        title: "Notice",
        description: "desc",
      });
      store.handleCancel();

      const result = await settle(promise);
      expect(result.ok).toBe(true);
      expect(result.reason).toBe("ok");
    });

    test("handleDismiss resolves as ok for alert mode", async () => {
      const promise = store.alert({
        title: "Notice",
        description: "desc",
      });
      store.handleDismiss();

      const result = await settle(promise);
      expect(result.ok).toBe(true);
      expect(result.reason).toBe("ok");
    });
  });

  describe("prompt", () => {
    test("opens prompt dialog with input value", async () => {
      const pending = store.prompt({
        title: "Enter name",
        description: "New name",
        inputValue: "default",
      });

      expect(store.promptOpen).toBe(true);
      expect(store.promptTitle).toBe("Enter name");
      expect(store.promptInputValue).toBe("default");

      store.handlePromptCancel("");
      await pending;
    });

    test("resolves with value on handlePromptOk", async () => {
      const promise = store.prompt({
        title: "T",
        description: "D",
      });

      store.handlePromptOk("myValue");

      const result = await settle(promise);
      expect(result.ok).toBe(true);
      expect(result.reason).toBe("ok");
      expect(result.value).toBe("myValue");
      expect(store.promptOpen).toBe(false);
    });

    test("resolves with value on handlePromptCancel", async () => {
      const promise = store.prompt({
        title: "T",
        description: "D",
        inputValue: "initial",
      });

      store.handlePromptCancel("initial");

      const result = await settle(promise);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("cancel");
      expect(result.value).toBe("initial");
    });

    test("sets pattern and errorMessage", async () => {
      const pending = store.prompt({
        title: "T",
        description: "D",
        pattern: /^\d+$/,
        errorMessage: "Numbers only",
      });

      expect(store.promptPattern).toEqual(/^\d+$/);
      expect(store.promptErrorMessage).toBe("Numbers only");

      store.handlePromptCancel("");
      await pending;
    });

    test("replaces previous prompt with reason replaced", async () => {
      const first = store.prompt({
        title: "First",
        description: "D",
        inputValue: "a",
      });
      const second = store.prompt({
        title: "Second",
        description: "D",
        inputValue: "b",
      });

      const firstResult = await settle(first);
      expect(firstResult.ok).toBe(false);
      expect(firstResult.reason).toBe("replaced");
      expect(firstResult.value).toBe("a");

      store.handlePromptOk("b");
      const secondResult = await settle(second);
      expect(secondResult.ok).toBe(true);
    });
  });

  describe("no-op when no pending", () => {
    test("handleOk does nothing without pending dialog", () => {
      store.handleOk();
      expect(store.alertOpen).toBe(false);
    });

    test("handlePromptOk does nothing without pending prompt", () => {
      store.handlePromptOk("test");
      expect(store.promptOpen).toBe(false);
    });

    test("handleOtpOk does nothing without pending otp", () => {
      store.handleOtpOk("123456");
      expect(store.otpOpen).toBe(false);
    });
  });

  describe("otpPrompt", () => {
    test("opens otp dialog with correct mode and text", async () => {
      const pending = store.otpPrompt({
        title: "TOTP Verification",
        description: "Enter your 6-digit code",
        mode: "totp",
        confirmText: "Verify",
        cancelText: "Use recovery code",
      });

      expect(store.otpOpen).toBe(true);
      expect(store.otpTitle).toBe("TOTP Verification");
      expect(store.otpDescription).toBe("Enter your 6-digit code");
      expect(store.otpMode).toBe("totp");
      expect(store.otpOkText).toBe("Verify");
      expect(store.otpCancelText).toBe("Use recovery code");

      store.handleOtpCancel("");
      await pending;
    });

    test("resolves with value on handleOtpOk", async () => {
      const promise = store.otpPrompt({
        title: "T",
        description: "D",
        mode: "totp",
      });

      store.handleOtpOk("123456");

      const result = await settle(promise);
      expect(result.ok).toBe(true);
      expect(result.reason).toBe("ok");
      expect(result.value).toBe("123456");
      expect(store.otpOpen).toBe(false);
    });

    test("resolves ok:false on handleOtpCancel", async () => {
      const promise = store.otpPrompt({
        title: "T",
        description: "D",
        mode: "emailOtp",
      });

      store.handleOtpCancel("123");

      const result = await settle(promise);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("cancel");
      expect(result.value).toBe("123");
      expect(store.otpOpen).toBe(false);
    });

    test("resolves ok:false on handleOtpDismiss when dismissible", async () => {
      const promise = store.otpPrompt({
        title: "T",
        description: "D",
        mode: "totp",
      });

      store.handleOtpDismiss("");

      const result = await settle(promise);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("dismiss");
    });

    test("does not dismiss when dismissible is false", async () => {
      const promise = store.otpPrompt({
        title: "T",
        description: "D",
        mode: "totp",
        dismissible: false,
      });

      expect(store.otpDismissible).toBe(false);
      store.handleOtpDismiss("");
      expect(store.otpOpen).toBe(true);

      store.handleOtpCancel("");
      await settle(promise);
    });

    test("sets otp mode correctly", async () => {
      const pending = store.otpPrompt({
        title: "T",
        description: "D",
        mode: "otp",
      });

      expect(store.otpMode).toBe("otp");

      store.handleOtpCancel("");
      await pending;
    });

    test("defaults mode to totp when not specified", async () => {
      const pending = store.otpPrompt({
        title: "T",
        description: "D",
      });

      expect(store.otpMode).toBe("totp");

      store.handleOtpCancel("");
      await pending;
    });

    test("replaces previous otp dialog with reason replaced", async () => {
      const first = store.otpPrompt({
        title: "First",
        description: "D",
        mode: "totp",
      });
      const second = store.otpPrompt({
        title: "Second",
        description: "D",
        mode: "emailOtp",
      });

      const firstResult = await settle(first);
      expect(firstResult.ok).toBe(false);
      expect(firstResult.reason).toBe("replaced");
      expect(firstResult.value).toBe("");

      expect(store.otpTitle).toBe("Second");
      expect(store.otpMode).toBe("emailOtp");
      expect(store.otpOpen).toBe(true);

      store.handleOtpOk("654321");
      const secondResult = await settle(second);
      expect(secondResult.ok).toBe(true);
      expect(secondResult.value).toBe("654321");
    });

    test("uses default button text from i18n", async () => {
      const pending = store.otpPrompt({
        title: "T",
        description: "D",
        mode: "totp",
      });

      expect(store.otpOkText).toBe(en.dialog.alertdialog.confirm);
      expect(store.otpCancelText).toBe(en.dialog.alertdialog.cancel);

      store.handleOtpCancel("");
      await pending;
    });
  });
});
