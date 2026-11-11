import { defineStore } from "pinia";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

type ModalReason = "ok" | "cancel" | "dismiss" | "replaced";

type OtpMode = "totp" | "otp" | "emailOtp";

type ConfirmOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  dismissible?: boolean;
  destructive?: boolean;
  checkboxLabel?: string;
};

type PromptOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  dismissible?: boolean;
  inputValue?: string;
  inputType?: string;
  pattern?: RegExp;
  errorMessage?: string;
};

type OtpOptions = {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  dismissible?: boolean;
  mode?: OtpMode;
};

type ConfirmResult = {
  ok: boolean;
  reason: ModalReason;
  checked: boolean;
};

type ValueResult = {
  ok: boolean;
  reason: ModalReason;
  value: string;
};

type PendingResolver<TResult> = {
  resolve: (result: TResult) => void;
};

function textOrFallback(value: string | undefined, fallback: string): string {
  if (value === undefined || value === "") {
    return fallback;
  }
  return value;
}

export const useModalStore = defineStore("Modal", () => {
  const { t } = useI18n();

  const alertOpen = ref(false);
  const alertMode = ref("confirm");
  const alertTitle = ref("");
  const alertDescription = ref("");
  const alertOkText = ref("");
  const alertCancelText = ref("");
  const alertDismissible = ref(true);
  const alertDestructive = ref(false);
  const alertCheckboxLabel = ref("");
  const alertChecked = ref(false);

  const promptOpen = ref(false);
  const promptTitle = ref("");
  const promptDescription = ref("");
  const promptOkText = ref("");
  const promptCancelText = ref("");
  const promptDismissible = ref(true);
  const promptInputValue = ref("");
  const promptInputType = ref("text");
  const promptPattern = ref<RegExp | null>(null);
  const promptErrorMessage = ref("");

  const otpOpen = ref(false);
  const otpTitle = ref("");
  const otpDescription = ref("");
  const otpOkText = ref("");
  const otpCancelText = ref("");
  const otpDismissible = ref(true);
  const otpMode = ref<OtpMode>("totp");

  let pending: PendingResolver<ConfirmResult> | null = null;

  let pendingPrompt: PendingResolver<ValueResult> | null = null;

  let pendingOtp: PendingResolver<ValueResult> | null = null;

  function closeDialog() {
    alertOpen.value = false;
  }

  function closePromptDialog() {
    promptOpen.value = false;
  }

  function finish(reason: ModalReason) {
    const resolve = pending?.resolve;
    pending = null;
    closeDialog();
    if (resolve) resolve({ ok: reason === "ok", reason, checked: alertChecked.value });
  }

  function finishWithoutClosing(reason: ModalReason) {
    const resolve = pending?.resolve;
    pending = null;
    if (resolve) resolve({ ok: reason === "ok", reason, checked: alertChecked.value });
  }

  function finishPrompt(reason: ModalReason, value: string) {
    const resolve = pendingPrompt?.resolve;
    pendingPrompt = null;
    closePromptDialog();
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function finishPromptWithoutClosing(reason: ModalReason, value: string) {
    const resolve = pendingPrompt?.resolve;
    pendingPrompt = null;
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function openBase(mode: string, options: ConfirmOptions) {
    if (pending) {
      finishWithoutClosing("replaced");
    }

    alertMode.value = mode;
    alertTitle.value = options.title;
    alertDescription.value = options.description;
    alertDismissible.value = options.dismissible !== false;
    alertDestructive.value = options.destructive === true;
    alertCheckboxLabel.value = options.checkboxLabel ?? "";
    alertChecked.value = false;

    if (mode === "alert") {
      alertOkText.value = textOrFallback(options.confirmText, t("dialog.alertdialog.ok"));
      alertCancelText.value = "";
    } else {
      alertOkText.value = textOrFallback(options.confirmText, t("dialog.alertdialog.confirm"));
      alertCancelText.value = textOrFallback(options.cancelText, t("dialog.alertdialog.cancel"));
    }

    alertOpen.value = true;

    return new Promise<ConfirmResult>((resolve) => {
      pending = { resolve };
    });
  }

  function openPrompt(options: PromptOptions) {
    if (pendingPrompt) {
      finishPromptWithoutClosing("replaced", promptInputValue.value);
    }

    promptTitle.value = options.title;
    promptDescription.value = options.description;
    promptDismissible.value = options.dismissible !== false;
    promptInputValue.value = options.inputValue ?? "";
    promptInputType.value = textOrFallback(options.inputType, "text");
    promptPattern.value = options.pattern ?? null;
    promptErrorMessage.value = textOrFallback(options.errorMessage, t("dialog.prompt.input_invalid"));

    promptOkText.value = textOrFallback(options.confirmText, t("dialog.alertdialog.confirm"));
    promptCancelText.value = textOrFallback(options.cancelText, t("dialog.alertdialog.cancel"));

    promptOpen.value = true;

    return new Promise<ValueResult>((resolve) => {
      pendingPrompt = { resolve };
    });
  }

  function confirm(options: ConfirmOptions) {
    return openBase("confirm", options);
  }

  function alert(options: ConfirmOptions) {
    return openBase("alert", options);
  }

  function prompt(options: PromptOptions) {
    return openPrompt(options);
  }

  function handleOk() {
    if (!pending) return;
    finish("ok");
  }

  function handlePromptOk(value?: string) {
    if (!pendingPrompt) return;
    finishPrompt("ok", value ?? "");
  }

  function handleCancel() {
    if (!pending) return;

    if (alertMode.value === "alert") {
      finish("ok");
      return;
    }

    finish("cancel");
  }

  function handlePromptCancel(value?: string) {
    if (!pendingPrompt) return;
    finishPrompt("cancel", value ?? "");
  }

  function handleDismiss() {
    if (!pending) return;
    if (!alertDismissible.value) return;

    if (alertMode.value === "alert") {
      finish("ok");
      return;
    }

    finish("dismiss");
  }

  function handlePromptDismiss(value?: string) {
    if (!pendingPrompt) return;
    if (!promptDismissible.value) return;
    finishPrompt("dismiss", value ?? "");
  }

  function setAlertOpen(isOpen: boolean) {
    alertOpen.value = isOpen;
  }

  function setPromptOpen(isOpen: boolean) {
    promptOpen.value = isOpen;
  }

  function closeOtpDialog() {
    otpOpen.value = false;
  }

  function finishOtp(reason: ModalReason, value: string) {
    const resolve = pendingOtp?.resolve;
    pendingOtp = null;
    closeOtpDialog();
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function finishOtpWithoutClosing(reason: ModalReason, value: string) {
    const resolve = pendingOtp?.resolve;
    pendingOtp = null;
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function openOtp(options: OtpOptions) {
    if (pendingOtp) {
      finishOtpWithoutClosing("replaced", "");
    }

    otpTitle.value = options.title;
    otpDescription.value = options.description;
    otpDismissible.value = options.dismissible !== false;
    otpMode.value = options.mode ?? "totp";

    otpOkText.value = textOrFallback(options.confirmText, t("dialog.alertdialog.confirm"));
    otpCancelText.value = textOrFallback(options.cancelText, t("dialog.alertdialog.cancel"));

    otpOpen.value = true;

    return new Promise<ValueResult>((resolve) => {
      pendingOtp = { resolve };
    });
  }

  function otpPrompt(options: OtpOptions) {
    return openOtp(options);
  }

  function handleOtpOk(value?: string) {
    if (!pendingOtp) return;
    finishOtp("ok", value ?? "");
  }

  function handleOtpCancel(value?: string) {
    if (!pendingOtp) return;
    finishOtp("cancel", value ?? "");
  }

  function handleOtpDismiss(value?: string) {
    if (!pendingOtp) return;
    if (!otpDismissible.value) return;
    finishOtp("dismiss", value ?? "");
  }

  function setOtpOpen(isOpen: boolean) {
    otpOpen.value = isOpen;
  }

  return {
    alertOpen,
    alertMode,
    alertTitle,
    alertDescription,
    alertOkText,
    alertCancelText,
    alertDismissible,
    alertDestructive,
    alertCheckboxLabel,
    alertChecked,
    promptOpen,
    promptTitle,
    promptDescription,
    promptOkText,
    promptCancelText,
    promptDismissible,
    promptInputValue,
    promptInputType,
    promptPattern,
    promptErrorMessage,
    otpOpen,
    otpTitle,
    otpDescription,
    otpOkText,
    otpCancelText,
    otpDismissible,
    otpMode,

    confirm,
    alert,
    prompt,
    otpPrompt,

    handleOk,
    handleCancel,
    handleDismiss,
    handlePromptOk,
    handlePromptCancel,
    handlePromptDismiss,
    setAlertOpen,
    setPromptOpen,
    handleOtpOk,
    handleOtpCancel,
    handleOtpDismiss,
    setOtpOpen,
  };
});
