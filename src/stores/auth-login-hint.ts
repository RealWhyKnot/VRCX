import { reactive, ref } from "vue";
import { toast } from "vue-sonner";
import type { useI18n } from "vue-i18n";
import { links } from "../shared/constants/link";
import { logFailure } from "./log-failure";
import { errorMessageIncludes, isRecord, type LoginNetworkIssueHintState, type LoginParams } from "./auth-types";

type Translate = ReturnType<typeof useI18n>["t"];

export function shouldCountLoginFailureForNetworkHint(err: unknown): boolean {
  if (!isRecord(err) || err["endpoint"] !== "auth/user") {
    return false;
  }
  if (errorMessageIncludes(err, "Invalid Username/Email or Password")) {
    return false;
  }
  return typeof err["status"] === "number" && [401].includes(err["status"]);
}

export function createLoginNetworkHint(t: Translate) {
  const state = reactive<LoginNetworkIssueHintState>({
    hinted: false,
    timestamps: [],
    lastAttemptFingerprint: "",
  });
  const toastId = ref<string | number | null>(null);
  const windowMs = 90000;
  const threshold = 3;

  function reset() {
    if (toastId.value) {
      toast.dismiss(toastId.value);
      toastId.value = null;
    }
    state.hinted = false;
    state.timestamps = [];
    state.lastAttemptFingerprint = "";
  }

  function buildAttemptFingerprint(params: Partial<LoginParams>) {
    return [params.username ?? "", params.password ?? "", params.endpoint ?? "", params.websocket ?? ""].join("\u0000");
  }

  function resetIfCredentialsChanged(params: Partial<LoginParams>) {
    const fingerprint = buildAttemptFingerprint(params);
    if (state.lastAttemptFingerprint && state.lastAttemptFingerprint !== fingerprint) {
      reset();
    }
    state.lastAttemptFingerprint = fingerprint;
  }

  function maybeShow() {
    const now = Date.now();
    state.timestamps = state.timestamps.filter((timestamp) => timestamp > now - windowMs);
    state.timestamps.push(now);
    if (state.hinted || state.timestamps.length < threshold) {
      return;
    }
    state.hinted = true;
    toastId.value = toast.warning(t("message.auth.login_network_issue_hint_title"), {
      description: t("message.auth.login_network_issue_hint_description"),
      duration: Infinity,
      action: {
        label: t("common.actions.open"),
        onClick: () => {
          Promise.resolve(AppApi.OpenLink(links.troubleshootingAuthUserConnectionIssues)).catch(logFailure("Opening the troubleshooting link failed:"));
        },
      },
    });
  }

  return { reset, resetIfCredentialsChanged, maybeShow };
}
