import type { VrStatusClass } from "./vr-types";

export function statusClass(status: string | undefined): VrStatusClass {
  const style: VrStatusClass = {};
  if (typeof status === "undefined") {
    return style;
  }
  if (status === "active") {
    style.online = true;
  } else if (status === "join me") {
    style.joinme = true;
  } else if (status === "ask me") {
    style.askme = true;
  } else if (status === "busy") {
    style.busy = true;
  }
  return style;
}

export function trackingResultToClass(deviceStatus: string | undefined): string {
  switch (deviceStatus) {
    case "Uninitialized":
    case "Calibrating_OutOfRange":
    case "Fallback_RotationOnly":
      return "tracker-error";

    case "Calibrating_InProgress":
    case "Running_OutOfRange":
      return "tracker-warning";

    case "Running_OK":
    case undefined:
    default:
      return "";
  }
}

export function formatVrFeedDate(date: string | undefined, culture: string, isHour12: boolean | undefined): string {
  if (!date) {
    return "";
  }
  const dt = new Date(date);
  return dt
    .toLocaleTimeString(culture, {
      hour: "2-digit",
      minute: "numeric",
      hourCycle: isHour12 ? "h12" : "h23",
    })
    .replace(" am", "")
    .replace(" pm", "");
}
