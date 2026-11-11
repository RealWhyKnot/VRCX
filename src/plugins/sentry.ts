import type { App } from "vue";

import { router } from "./router";
import { startRendererMemoryThresholdReport } from "./renderer-memory-report";

import { configRepository } from "../services/config";

function hasStringMessage(value: unknown): value is { message: string } {
  return (typeof value === "object" || typeof value === "function") && value !== null && "message" in value && typeof value.message === "string";
}

const ignoredErrorMessages = [
  "401",
  "403",
  "404",
  "500",
  "503",
  "No such host is known",
  "The SSL connection could not be established",
  "A connection attempt failed",
  "no data of the requested type was found",
  "An error occurred while sending the request",
  "database or disk is full",
  "disk I/O error",
  "There is not enough space on the disk.",
  "The requested address is not valid in its context.",
];

function isIgnoredError(error: unknown) {
  if (!hasStringMessage(error)) {
    return false;
  }
  const { message } = error;
  return ignoredErrorMessages.some((text) => message.includes(text));
}

export async function isSentryOptedIn() {
  return isBuildNightly && configRepository.getBool("VRCX_SentryEnabled", false);
}

export function getSentry() {
  return isBuildNightly ? import("@sentry/vue") : null;
}

export async function initSentry(app: App) {
  if (!isBuildNightly) return;

  try {
    if (!(await isSentryOptedIn())) return;

    const vrcxId = await configRepository.getString("VRCX_id", "");
    const response = await webApiService.execute({
      url: "https://api0.vrcx.app/errorreporting/getdsn",
      method: "GET",
      headers: {
        Referer: "https://vrcx.app",
        "VRCX-ID": vrcxId,
      },
    });
    if (response.status !== 200) {
      console.error("Failed to get Sentry DSN:", response.status, response.data);
      return;
    }
    const dsn = atob(response.data);
    const Sentry = await getSentry();
    if (Sentry === null) {
      return;
    }
    Sentry.init({
      app,
      dsn,
      environment: "nightly",
      release: VERSION,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      tracesSampleRate: 0.0001,
      beforeSend(event, hint) {
        return isIgnoredError(hint.originalException) ? null : event;
      },

      integrations: [
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
        Sentry.browserTracingIntegration({ router }),
        Sentry.vueIntegration({
          tracingOptions: {
            trackComponents: true,
          },
        }),
      ],
    });
    console.log("Sentry initialized");

    startRendererMemoryThresholdReport(Sentry, {
      thresholdRatio: 0.8,
      intervalMs: 10_000,
      cooldownMs: 5 * 60_000,
    });
  } catch (e) {
    console.error("Failed to initialize Sentry:", e);
    return;
  }
}
