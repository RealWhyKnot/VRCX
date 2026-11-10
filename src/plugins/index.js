import { i18n, loadLocalizedStrings, tForLocale, updateLocalizedStrings } from "./i18n";
import { initDayjs } from "./dayjs";
import { initInteropApi } from "./interop-api";
import { initNoty } from "./noty";
import { initUi, initUiForVrOverlay } from "./ui";

export async function initPlugins(isVrOverlay = false) {
  await initInteropApi(isVrOverlay);
  if (!isVrOverlay) {
    await initUi();
  } else {
    await initUiForVrOverlay();
  }
  initDayjs();
  if (isVrOverlay) {
    initNoty(true);
  }
}

export { i18n, loadLocalizedStrings, tForLocale, updateLocalizedStrings };
export * from "./components";
export * from "./sentry";
export * from "./router";
