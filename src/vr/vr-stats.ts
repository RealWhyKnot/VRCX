import { timeToText } from "../shared/utils/base/format";

import { createVrLoop, logVrError } from "./vr-loop";
import type { VrLoop } from "./vr-loop";
import type { VrDevice, VrState } from "./vr-types";

function toVrDevice(entry: string[]): VrDevice {
  return [entry[0] ?? "", entry[1] ?? "", entry[2] ?? "", Math.trunc(Number(entry[3] ?? Number.NaN)).toString(), entry[4] ?? ""];
}

function deviceOrder(device: VrDevice): number {
  const [name] = device;
  if (name === "headset") {
    return 0;
  }
  if (name === "leftController") {
    return 1;
  }
  if (name === "rightController") {
    return 2;
  }
  if (name.toLowerCase().includes("controller")) {
    return 3;
  }
  if (name === "tracker" || name === "base") {
    return 4;
  }
  return 5;
}

function connectionOrder(a: VrDevice, b: VrDevice): number {
  if (a[1] === b[1]) {
    return 0;
  }
  if (a[1] === "connected") {
    return -1;
  }
  if (a[1] === "disconnected") {
    return 1;
  }
  return 0;
}

export function createStatsLoop(vrState: VrState): VrLoop {
  return createVrLoop(async () => {
    try {
      vrState.currentTime = new Date()
        .toLocaleDateString(vrState.currentCulture, {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hourCycle: vrState.config.dtHour12 ? "h12" : "h23",
        })
        .replace(" AM", " am")
        .replace(" PM", " pm")
        .replace(",", "");

      if (vrState.cpuUsageEnabled) {
        const cpuUsage = await AppApiVr.CpuUsage();
        vrState.cpuUsage = cpuUsage.toFixed(0);
      }
      if (vrState.lastLocation.date) {
        vrState.lastLocationTimer = timeToText(Date.now() - vrState.lastLocation.date);
      } else {
        vrState.lastLocationTimer = "";
      }
      if (vrState.lastLocation.onlineFor) {
        vrState.onlineForTimer = timeToText(Date.now() - vrState.lastLocation.onlineFor);
      } else {
        vrState.onlineForTimer = "";
      }

      if (!vrState.config.hideDevicesFromFeed) {
        AppApiVr.GetVRDevices()
          .then((devices) => {
            const deviceList: VrDevice[] = [];
            let baseStations = 0;
            for (const entry of devices) {
              const device = toVrDevice(entry);
              if (device[0] === "base" && device[1] === "connected") {
                baseStations++;
              } else {
                deviceList.push(device);
              }
            }
            vrState.deviceCount = deviceList.length;
            deviceList.sort((a, b) => deviceOrder(a) - deviceOrder(b));
            deviceList.sort(connectionOrder);
            if (baseStations > 0) {
              deviceList.push(["base", "connected", "", baseStations, ""]);
              vrState.deviceCount += 1;
            }
            vrState.devices = deviceList;
          })
          .catch(logVrError);
      } else {
        vrState.devices = [];
      }
      if (vrState.config.pcUptimeOnFeed) {
        AppApiVr.GetUptime()
          .then((uptime) => {
            if (uptime) {
              vrState.pcUptime = timeToText(uptime);
            }
          })
          .catch(logVrError);
      } else {
        vrState.pcUptime = "";
      }
    } catch (err) {
      console.error(err);
    }
    return true;
  }, 500);
}
