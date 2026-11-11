import {
  applyAppCjkFontPack,
  applyAppFontFamily,
  changeAppThemeStyle,
  changeHtmlLangAttribute,
  getThemeMode,
  initThemeColor,
  refreshCustomCss,
} from "../shared/utils/base/ui";
import { APP_CJK_FONT_PACK_DEFAULT_KEY, APP_FONT_DEFAULT_KEY } from "../shared/constants/fonts";
import { loadLocalizedStrings } from "./i18n";

import { configRepository } from "../services/config";

function stringOr(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export async function initUi() {
  try {
    const language = stringOr(await configRepository.getString("VRCX_appLanguage", "en"), "en");

    await loadLocalizedStrings(language);
    changeHtmlLangAttribute(language);

    const { initThemeMode } = await getThemeMode(configRepository);
    changeAppThemeStyle(initThemeMode);
    await initThemeColor();
  } catch (error) {
    console.error("Error initializing locale and theme:", error);
  }

  await refreshCustomCss();
}

export async function initUiForVrOverlay() {
  try {
    const [language, fontFamily, customFontFamily, cjkFontPack] = await Promise.all([
      configRepository.getString("VRCX_appLanguage", "en").then((value) => stringOr(value, "en")),
      configRepository.getString("VRCX_fontFamily", APP_FONT_DEFAULT_KEY).then((value) => stringOr(value, APP_FONT_DEFAULT_KEY)),
      configRepository.getString("VRCX_customFontFamily", "").then((value) => stringOr(value, "")),
      configRepository.getString("VRCX_cjkFontPack", APP_CJK_FONT_PACK_DEFAULT_KEY).then((value) => stringOr(value, APP_CJK_FONT_PACK_DEFAULT_KEY)),
    ]);

    await loadLocalizedStrings(language);
    changeHtmlLangAttribute(language);
    applyAppFontFamily(fontFamily, customFontFamily);
    applyAppCjkFontPack(cjkFontPack);
  } catch (error) {
    console.error("Error initializing VR locale and fonts:", error);
  }
}
