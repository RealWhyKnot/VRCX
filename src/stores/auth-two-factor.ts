import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { authRequest } from "../api/auth";
import { getCurrentUser } from "../coordinators/user-coordinator";
import type { useModalStore } from "./modal";
import { logFailure } from "./log-failure";
import { toOtpResult } from "./auth-types";

type Translate = ReturnType<typeof useI18n>["t"];

type TwoFactorPromptDeps = {
  modalStore: ReturnType<typeof useModalStore>;
  twoFactorAuthDialogVisible: Ref<boolean>;
  t: Translate;
  clearCookiesTryLogin: () => Promise<void>;
  resendEmail2fa: () => Promise<void>;
};

export function createTwoFactorPrompts({ modalStore, twoFactorAuthDialogVisible, t, clearCookiesTryLogin, resendEmail2fa }: TwoFactorPromptDeps) {
  function completeVerification(verification: Promise<unknown>, onFailure: () => void) {
    verification
      .catch((err: unknown) => {
        console.error(err);
        onFailure();
      })
      .then(() => {
        getCurrentUser().catch(logFailure("Loading the current user failed:"));
      })
      .catch(logFailure("Verifying the two-factor code failed:"));
  }

  function promptTOTP() {
    if (twoFactorAuthDialogVisible.value) {
      return;
    }
    AppApi.FlashWindow().catch(logFailure("Flashing the window failed:"));
    twoFactorAuthDialogVisible.value = true;
    modalStore
      .otpPrompt({
        title: t("prompt.totp.header"),
        description: t("prompt.totp.description"),
        mode: "totp",
        cancelText: t("prompt.totp.use_otp"),
        confirmText: t("prompt.totp.verify"),
      })
      .then((result: unknown) => {
        const { ok, reason, value } = toOtpResult(result);
        twoFactorAuthDialogVisible.value = false;

        if (reason === "cancel") {
          promptOTP();
          return;
        }
        if (!ok) return;

        completeVerification(
          authRequest.verifyTOTP({
            code: value.trim(),
          }),
          () => {
            clearCookiesTryLogin().catch(logFailure("Clearing cookies failed:"));
          }
        );
      })
      .catch(() => {
        twoFactorAuthDialogVisible.value = false;
      });
  }

  function promptOTP() {
    if (twoFactorAuthDialogVisible.value) {
      return;
    }
    twoFactorAuthDialogVisible.value = true;
    modalStore
      .otpPrompt({
        title: t("prompt.otp.header"),
        description: t("prompt.otp.description"),
        mode: "otp",
        cancelText: t("prompt.otp.use_totp"),
        confirmText: t("prompt.otp.verify"),
      })
      .then((result: unknown) => {
        const { ok, reason, value } = toOtpResult(result);
        twoFactorAuthDialogVisible.value = false;

        if (reason === "cancel") {
          promptTOTP();
          return;
        }
        if (!ok) return;

        completeVerification(
          authRequest.verifyOTP({
            code: `${value.slice(0, 4)}-${value.slice(4)}`,
          }),
          () => {
            clearCookiesTryLogin().catch(logFailure("Clearing cookies failed:"));
          }
        );
      })
      .catch(() => {
        twoFactorAuthDialogVisible.value = false;
      });
  }

  function promptEmailOTP() {
    if (twoFactorAuthDialogVisible.value) {
      return;
    }
    AppApi.FlashWindow().catch(logFailure("Flashing the window failed:"));
    twoFactorAuthDialogVisible.value = true;
    modalStore
      .otpPrompt({
        title: t("prompt.email_otp.header"),
        description: t("prompt.email_otp.description"),
        mode: "emailOtp",
        cancelText: t("prompt.email_otp.resend"),
        confirmText: t("prompt.email_otp.verify"),
      })
      .then((result: unknown) => {
        const { ok, reason, value } = toOtpResult(result);
        twoFactorAuthDialogVisible.value = false;

        if (reason === "cancel") {
          resendEmail2fa().catch(logFailure("Resending the email code failed:"));
          return;
        }
        if (!ok) return;

        completeVerification(
          authRequest.verifyEmailOTP({
            code: value.trim(),
          }),
          promptEmailOTP
        );
      })
      .catch(() => {
        twoFactorAuthDialogVisible.value = false;
      });
  }

  return { promptTOTP, promptEmailOTP };
}
