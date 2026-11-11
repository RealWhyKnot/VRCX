import { reactive } from "vue";

import dayjs from "dayjs";

import { formatDateFilter } from "../coordinators/date-coordinator";

const utils = Object.assign(
  {},
  ...Object.values(import.meta.glob(["../shared/utils/*.js", "../shared/utils/base/*.js", "!../shared/utils/localization-helper-cli.js"], { eager: true })),
  { formatDateFilter }
);

const AppDebug =
  window.$debug ??
  reactive({
    debug: false,
    debugWebSocket: false,
    debugUserDiff: false,
    debugPhotonLogging: false,
    debugGameLog: false,
    debugWebRequests: false,
    debugFriendState: false,
    debugRecompute: false,
    debugIPC: false,
    debugVrcPlus: false,
    errorNoty: null,
    dontLogMeOut: false,
    endpointDomain: "https://api.vrchat.cloud/api/1",
    endpointDomainVrchat: "https://api.vrchat.cloud/api/1",
    websocketDomain: "wss://pipeline.vrchat.cloud",
    websocketDomainVrchat: "wss://pipeline.vrchat.cloud",
  });

window.$debug = AppDebug;
window.utils = utils;
window.dayjs = dayjs;

export function logWebRequest(tag, target, ...rest) {
  if (!AppDebug.debugWebRequests) return;
  console.log(tag, target, ...rest);
}

let _queryLogDepth = 0;

export async function withQueryLog(fn) {
  _queryLogDepth++;
  try {
    return await fn();
  } finally {
    _queryLogDepth--;
  }
}

export function isApiLogSuppressed() {
  return _queryLogDepth > 0;
}

export { AppDebug };
