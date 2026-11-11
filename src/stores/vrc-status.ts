import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import { useVrcxStore } from "./vrcx";

import { openExternalLink } from "../shared/utils/app-actions";

import { webApiService } from "../services/webapi";

import { logError } from "./notification/errors";

import * as workerTimers from "worker-timers";

type StatusPage = {
  updatedAt: string;
  description: string;
  indicator: string;
};

type StatusComponent = {
  name: string;
  status: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function textOf(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseStatusPage(text: string): StatusPage {
  const data: unknown = JSON.parse(text);
  const status = fieldOf(data, "status");
  const updatedAt = textOf(fieldOf(fieldOf(data, "page"), "updated_at"));
  const description = textOf(fieldOf(status, "description"));
  if (updatedAt === undefined || description === undefined) {
    throw new Error("Malformed VRChat status response");
  }
  return {
    updatedAt,
    description,
    indicator: textOf(fieldOf(status, "indicator")) ?? "",
  };
}

function parseStatusComponents(text: string): StatusComponent[] {
  const components: unknown = fieldOf(JSON.parse(text), "components");
  if (!Array.isArray(components)) {
    throw new Error("Malformed VRChat status summary");
  }
  const items: unknown[] = components;
  return items.map((item) => {
    const name = textOf(fieldOf(item, "name"));
    const status = textOf(fieldOf(item, "status"));
    if (name === undefined || status === undefined) {
      throw new Error("Malformed VRChat status component");
    }
    return { name, status };
  });
}

export const useVrcStatusStore = defineStore("VrcStatus", () => {
  const vrcxStore = useVrcxStore();

  const vrcStatusApiUrl = "https://status.vrchat.com/api/v2";
  const fastPollingInterval = ref(2 * 60 * 1000);
  const slowPollingInterval = ref(15 * 60 * 1000);

  const lastStatus = ref("");
  const lastStatusIndicator = ref("");
  const lastStatusTime = ref<Date | null>(null);
  const lastStatusSummary = ref("");
  const lastTimeFetched = ref(0);
  const pollingInterval = ref(0);

  const statusText = computed(() => {
    if (lastStatus.value && lastStatusSummary.value) {
      return `${lastStatus.value}: ${lastStatusSummary.value}`;
    }
    return lastStatus.value;
  });

  const hasIssue = computed(() => !!lastStatus.value);

  const isMajor = computed(() => lastStatusIndicator.value === "major");

  function openStatusPage() {
    openExternalLink("https://status.vrchat.com");
  }

  async function getVrcStatus(): Promise<void> {
    const response = await webApiService.execute({
      url: `${vrcStatusApiUrl}/status.json`,
      method: "GET",
      headers: {
        Referer: "https://vrcx.app",
      },
    });
    lastTimeFetched.value = Date.now();
    if (response.status !== 200) {
      console.error("Failed to fetch VRChat status", response);
      lastStatus.value = "Failed to fetch VRC status";
      pollingInterval.value = fastPollingInterval.value;
      return;
    }
    const data = parseStatusPage(response.data);
    lastStatusTime.value = new Date(data.updatedAt);
    if (data.description === "All Systems Operational") {
      lastStatus.value = "";
      lastStatusIndicator.value = "";
      pollingInterval.value = slowPollingInterval.value;
      return;
    }
    lastStatus.value = data.description;
    lastStatusIndicator.value = data.indicator;
    pollingInterval.value = fastPollingInterval.value;
    getVrcStatusSummary().catch(logError);
  }

  async function getVrcStatusSummary(): Promise<void> {
    const response = await webApiService.execute({
      url: `${vrcStatusApiUrl}/summary.json`,
      method: "GET",
      headers: {
        Referer: "https://vrcx.app",
      },
    });
    if (response.status !== 200) {
      console.error("Failed to fetch VRChat status summary", response);
      return;
    }
    let summary = "";
    for (const component of parseStatusComponents(response.data)) {
      if (component.status !== "operational") {
        summary += `${component.name}, `;
      }
    }
    if (summary.endsWith(", ")) {
      summary = summary.slice(0, -2);
    }
    lastStatusSummary.value = summary;
  }

  watch(
    () => vrcxStore.isBrowserFocused,
    (isFocused) => {
      if (isFocused) {
        if (Date.now() - lastTimeFetched.value > 60 * 1000) {
          getVrcStatus().catch(logError);
        }
      }
    }
  );

  function init() {
    getVrcStatus().catch(logError);
    workerTimers.setInterval(() => {
      const interval = vrcxStore.isBrowserFocused ? pollingInterval.value : slowPollingInterval.value;
      if (Date.now() - lastTimeFetched.value > interval) {
        getVrcStatus().catch(logError);
      }
    }, fastPollingInterval.value);
  }

  init();

  return {
    lastStatus,
    lastStatusIndicator,
    lastStatusTime,
    lastStatusSummary,
    statusText,
    hasIssue,
    isMajor,
    openStatusPage,
    getVrcStatus,
  };
});
