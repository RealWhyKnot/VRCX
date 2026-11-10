import { defineStore } from "pinia";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

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
  const promptPattern = ref(null);
  const promptErrorMessage = ref("");

  const otpOpen = ref(false);
  const otpTitle = ref("");
  const otpDescription = ref("");
  const otpOkText = ref("");
  const otpCancelText = ref("");
  const otpDismissible = ref(true);
  const otpMode = ref("totp");

  let pending = null;

  let pendingPrompt = null;

  let pendingOtp = null;

  function closeDialog() {
    alertOpen.value = false;
  }

  function closePromptDialog() {
    promptOpen.value = false;
  }

  function finish(reason) {
    const resolve = pending?.resolve;
    pending = null;
    closeDialog();
    if (resolve) resolve({ ok: reason === "ok", reason, checked: alertChecked.value });
  }

  function finishWithoutClosing(reason) {
    const resolve = pending?.resolve;
    pending = null;
    if (resolve) resolve({ ok: reason === "ok", reason, checked: alertChecked.value });
  }

  function finishPrompt(reason, value) {
    const resolve = pendingPrompt?.resolve;
    pendingPrompt = null;
    closePromptDialog();
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function finishPromptWithoutClosing(reason, value) {
    const resolve = pendingPrompt?.resolve;
    pendingPrompt = null;
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function openBase(mode, options) {
    if (pending) {
      finishWithoutClosing("replaced");
    }

    alertMode.value = mode;
    alertTitle.value = options.title;
    alertDescription.value = options.description;
    alertDismissible.value = options.dismissible !== false;
    alertDestructive.value = options.destructive === true;
    alertCheckboxLabel.value = options.checkboxLabel || "";
    alertChecked.value = false;

    if (mode === "alert") {
      alertOkText.value = options.confirmText || t("dialog.alertdialog.ok");
      alertCancelText.value = "";
    } else {
      alertOkText.value = options.confirmText || t("dialog.alertdialog.confirm");
      alertCancelText.value = options.cancelText || t("dialog.alertdialog.cancel");
    }

    alertOpen.value = true;

    return new Promise((resolve) => {
      pending = { resolve };
    });
  }

  function openPrompt(options) {
    if (pendingPrompt) {
      finishPromptWithoutClosing("replaced", promptInputValue.value);
    }

    const inputValue = options.inputValue ?? "";
    const inputValueCopy = typeof inputValue === "string" ? inputValue.slice() : String(inputValue);

    promptTitle.value = options.title;
    promptDescription.value = options.description;
    promptDismissible.value = options.dismissible !== false;
    promptInputValue.value = inputValueCopy;
    promptInputType.value = options.inputType || "text";
    promptPattern.value = options.pattern ?? null;
    promptErrorMessage.value = options.errorMessage || t("dialog.prompt.input_invalid");

    promptOkText.value = options.confirmText || t("dialog.alertdialog.confirm");
    promptCancelText.value = options.cancelText || t("dialog.alertdialog.cancel");

    promptOpen.value = true;

    return new Promise((resolve) => {
      pendingPrompt = { resolve };
    });
  }

  function confirm(options) {
    return openBase("confirm", options);
  }

  function alert(options) {
    return openBase("alert", options);
  }

  function prompt(options) {
    return openPrompt(options);
  }

  function handleOk() {
    if (!pending) return;
    finish("ok");
  }

  function handlePromptOk(value) {
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

  function handlePromptCancel(value) {
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

  function handlePromptDismiss(value) {
    if (!pendingPrompt) return;
    if (!promptDismissible.value) return;
    finishPrompt("dismiss", value ?? "");
  }

  function setAlertOpen(open) {
    alertOpen.value = !!open;
  }

  function setPromptOpen(open) {
    promptOpen.value = !!open;
  }

  function closeOtpDialog() {
    otpOpen.value = false;
  }

  function finishOtp(reason, value) {
    const resolve = pendingOtp?.resolve;
    pendingOtp = null;
    closeOtpDialog();
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function finishOtpWithoutClosing(reason, value) {
    const resolve = pendingOtp?.resolve;
    pendingOtp = null;
    if (resolve) resolve({ ok: reason === "ok", reason, value });
  }

  function openOtp(options) {
    if (pendingOtp) {
      finishOtpWithoutClosing("replaced", "");
    }

    otpTitle.value = options.title;
    otpDescription.value = options.description;
    otpDismissible.value = options.dismissible !== false;
    otpMode.value = options.mode || "totp";

    otpOkText.value = options.confirmText || t("dialog.alertdialog.confirm");
    otpCancelText.value = options.cancelText || t("dialog.alertdialog.cancel");

    otpOpen.value = true;

    return new Promise((resolve) => {
      pendingOtp = { resolve };
    });
  }

  function otpPrompt(options) {
    return openOtp(options);
  }

  function handleOtpOk(value) {
    if (!pendingOtp) return;
    finishOtp("ok", value ?? "");
  }

  function handleOtpCancel(value) {
    if (!pendingOtp) return;
    finishOtp("cancel", value ?? "");
  }

  function handleOtpDismiss(value) {
    if (!pendingOtp) return;
    if (!otpDismissible.value) return;
    finishOtp("dismiss", value ?? "");
  }

  function setOtpOpen(open) {
    otpOpen.value = !!open;
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
