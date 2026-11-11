import { ref } from "vue";
import { toast } from "vue-sonner";

import { APP_CJK_FONT_PACK_CONFIG, APP_CJK_FONT_PACK_DEFAULT_KEY, APP_FONT_CONFIG, APP_FONT_DEFAULT_KEY } from "../../constants/fonts";
import { THEME_COLORS, THEME_CONFIG } from "../../constants/themes";
import { i18n } from "../../../plugins/i18n";
import { router } from "../../../plugins/router";
import { textToHex } from "./string";

import { configRepository } from "../../../services/config.ts";

type ThemeMode = keyof typeof THEME_CONFIG;
type ThemeColor = (typeof THEME_COLORS)[number] & { href: string | null };
type AppFontKey = keyof typeof APP_FONT_CONFIG;
type CjkFontPackKey = keyof typeof APP_CJK_FONT_PACK_CONFIG;
type ConfigStore = typeof configRepository;
type HsvColor = { h: number; s: number; v: number };
type ResolvedAppFont = { key: string; cssName: string; cssImport?: string | undefined };
type ResolvedCjkFontPack = { key: string; cssName: { jp: string; kr: string; sc: string; tc: string }; cssImport?: string | undefined };
type CustomAssetBridge = {
  CustomCss: () => Promise<unknown>;
  CustomScript: () => Promise<unknown>;
};

const THEME_COLOR_STORAGE_KEY = "VRCX_themeColor";
const THEME_COLOR_STYLE_ID = "app-theme-color-style";
const THEME_MODE_STYLE_ID = "app-theme-mode-style";
const DEFAULT_THEME_COLOR_KEY = "default";

const APP_FONT_LINK_ATTR = "data-app-font";
const APP_CJK_FONT_PACK_LINK_ATTR = "data-app-cjk-font-pack";

const themeColors: ThemeColor[] = THEME_COLORS.map((theme) => ({
  ...theme,
  href: theme.file ? new URL(`../../../styles/themes/${theme.file}`, import.meta.url).href : null,
}));

const currentThemeColor = ref(DEFAULT_THEME_COLOR_KEY);
const isApplyingThemeColor = ref(false);

function findThemeColor(key: string): ThemeColor | undefined {
  return themeColors.find((theme) => theme.key === key);
}

function resolveThemeColor(themeKey: string): ThemeColor {
  const normalized = themeKey.trim().toLowerCase();
  const resolved = findThemeColor(normalized) ?? findThemeColor(DEFAULT_THEME_COLOR_KEY);
  if (resolved === undefined) {
    throw new Error(`theme color "${DEFAULT_THEME_COLOR_KEY}" is not defined`);
  }
  return resolved;
}

function applyThemeColorStyle(theme: ThemeColor) {
  const root = document.documentElement;
  root.setAttribute("data-theme-color", theme.key);

  let styleEl = document.getElementById(THEME_COLOR_STYLE_ID);
  const href = theme.href;
  if (!href) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("link");
    styleEl.id = THEME_COLOR_STYLE_ID;
    styleEl.setAttribute("rel", "stylesheet");
    document.head.appendChild(styleEl);
  }

  if (styleEl.getAttribute("href") !== href) {
    styleEl.setAttribute("href", href);
  }
}

async function applyThemeColor(themeKey: string, { persist = true }: { persist?: boolean } = {}) {
  const resolved = resolveThemeColor(themeKey);
  isApplyingThemeColor.value = true;
  applyThemeColorStyle(resolved);
  currentThemeColor.value = resolved.key;
  if (persist) {
    try {
      await configRepository.setString(THEME_COLOR_STORAGE_KEY, resolved.key);
    } catch (error) {
      console.warn("Failed to persist theme color", error);
    }
  }
  isApplyingThemeColor.value = false;
  return resolved;
}

async function initThemeColor() {
  const storedKey = await configRepository.getString(THEME_COLOR_STORAGE_KEY);
  const resolved = resolveThemeColor(storedKey ? storedKey : DEFAULT_THEME_COLOR_KEY);
  applyThemeColorStyle(resolved);
  currentThemeColor.value = resolved.key;
}

function useThemeColor() {
  return {
    themeColors,
    currentThemeColor,
    isApplyingThemeColor,
    applyThemeColor,
    initThemeColor,
  };
}

let isElectronSystemDark: boolean | null = null;

function systemIsDarkMode() {
  if (isElectronSystemDark !== null) {
    return isElectronSystemDark;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function setSystemIsDarkMode(isDark: boolean) {
  isElectronSystemDark = isDark;
}

function applyThemeFonts() {
  document.querySelectorAll("link[data-theme-font]").forEach((linkEl) => linkEl.remove());
}

function isThemeMode(value: string): value is ThemeMode {
  return Object.hasOwn(THEME_CONFIG, value);
}

function applyThemeModeStyle(themeMode: ThemeMode) {
  const themeConfig = THEME_CONFIG[themeMode];
  const themeFile = "file" in themeConfig ? themeConfig.file : undefined;
  let styleEl = document.getElementById(THEME_MODE_STYLE_ID);

  if (!themeFile) {
    styleEl?.remove();
    return;
  }

  const themeHref = new URL(`../../../styles/themes/${themeFile}`, import.meta.url).href;

  if (!styleEl) {
    styleEl = document.createElement("link");
    styleEl.id = THEME_MODE_STYLE_ID;
    styleEl.setAttribute("rel", "stylesheet");
    document.head.appendChild(styleEl);
  }

  if (styleEl.getAttribute("href") !== themeHref) {
    styleEl.setAttribute("href", themeHref);
  }
}

function isAppFontKey(value: string): value is AppFontKey {
  return Object.hasOwn(APP_FONT_CONFIG, value);
}

function resolveAppFontFamily(fontKey: string | null | undefined): ResolvedAppFont {
  const normalized = (fontKey ?? "").trim().toLowerCase();
  if (isAppFontKey(normalized)) {
    return { key: normalized, ...APP_FONT_CONFIG[normalized] };
  }
  return {
    key: APP_FONT_DEFAULT_KEY,
    ...APP_FONT_CONFIG[APP_FONT_DEFAULT_KEY],
  };
}

function ensureDynamicFontStyle(attrName: string, styleKey: string, cssImport: string | null | undefined) {
  const head = document.head;

  document.querySelectorAll(`style[${attrName}]`).forEach((styleEl) => {
    if (styleEl.getAttribute(attrName) !== styleKey) {
      styleEl.remove();
    }
  });

  if (!cssImport) {
    return;
  }

  const existing = document.querySelector(`style[${attrName}="${styleKey}"]`);
  if (existing) {
    return;
  }

  const styleEl = document.createElement("style");
  styleEl.setAttribute(attrName, styleKey);
  styleEl.textContent = cssImport;
  head.appendChild(styleEl);
}

function isCjkFontPackKey(value: string): value is CjkFontPackKey {
  return Object.hasOwn(APP_CJK_FONT_PACK_CONFIG, value);
}

function resolveAppCjkFontPack(packKey: string | null | undefined): ResolvedCjkFontPack {
  const normalized = (packKey ?? "").trim().toLowerCase();
  if (isCjkFontPackKey(normalized)) {
    return { key: normalized, ...APP_CJK_FONT_PACK_CONFIG[normalized] };
  }
  return {
    key: APP_CJK_FONT_PACK_DEFAULT_KEY,
    ...APP_CJK_FONT_PACK_CONFIG[APP_CJK_FONT_PACK_DEFAULT_KEY],
  };
}

function ensureAppCjkFontPackLinks(packKey: string) {
  const config = isCjkFontPackKey(packKey) ? APP_CJK_FONT_PACK_CONFIG[packKey] : undefined;
  const cssImport = config && "cssImport" in config ? config.cssImport : undefined;
  ensureDynamicFontStyle(APP_CJK_FONT_PACK_LINK_ATTR, packKey, cssImport);
}

function applyAppFontFamily(fontKey: string, customCssName: string | null | undefined): ResolvedAppFont {
  if (fontKey === "custom") {
    const cssName = (customCssName ?? "").trim() || "system-ui";
    const root = document.documentElement;
    root.style.setProperty("--font-western-primary", cssName);
    ensureDynamicFontStyle(APP_FONT_LINK_ATTR, "custom", null);
    return {
      key: "custom",
      ...APP_FONT_CONFIG.custom,
      cssName,
    };
  }

  const resolved = resolveAppFontFamily(fontKey);
  const root = document.documentElement;
  root.style.setProperty("--font-western-primary", resolved.cssName);
  ensureDynamicFontStyle(APP_FONT_LINK_ATTR, resolved.key, resolved.cssImport);

  return resolved;
}

function applyAppCjkFontPack(packKey: string): ResolvedCjkFontPack {
  const resolved = resolveAppCjkFontPack(packKey);
  const root = document.documentElement;
  root.style.setProperty("--font-cjk-jp-primary", resolved.cssName.jp);
  root.style.setProperty("--font-cjk-sc-primary", resolved.cssName.sc);
  root.style.setProperty("--font-cjk-kr-primary", resolved.cssName.kr);
  root.style.setProperty("--font-cjk-tc-primary", resolved.cssName.tc);

  ensureAppCjkFontPackLinks(resolved.key);

  return resolved;
}

function resolveSystemThemeMode(): ThemeMode {
  return systemIsDarkMode() ? "dark" : "light";
}

function changeAppThemeStyle(themeMode: string) {
  let isSystemMode = themeMode === "system";
  let resolvedMode: ThemeMode;
  if (isSystemMode) {
    resolvedMode = resolveSystemThemeMode();
  } else if (isThemeMode(themeMode)) {
    resolvedMode = themeMode;
  } else {
    console.error("Invalid theme mode:", themeMode);
    configRepository.setString("VRCX_ThemeMode", "system").catch((error: unknown) => {
      console.error("Failed to persist theme mode", error);
    });
    isSystemMode = true;
    resolvedMode = resolveSystemThemeMode();
  }

  const themeConfig = THEME_CONFIG[resolvedMode];

  applyThemeFonts();
  applyThemeModeStyle(resolvedMode);

  document.documentElement.setAttribute("data-theme", resolvedMode);

  const isDark = Boolean(themeConfig.isDark);
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
  const themeIndex = themeConfig.name === "Midnight" ? 2 : isDark ? 1 : 0;
  AppApi.ChangeTheme(themeIndex).catch((error: unknown) => {
    console.error("Failed to change theme", error);
  });

  if (isHostLinux) {
    window.electron.setThemeSource(isSystemMode ? "system" : isDark ? "dark" : "light").catch((error: unknown) => {
      console.error("Failed to set theme source", error);
    });
  }

  return { isDark };
}

function updateTrustColorClasses(trustColor: Record<string, string>) {
  const existingTrustColor = document.getElementById("trustColor");
  if (existingTrustColor !== null) {
    existingTrustColor.outerHTML = "";
  }
  const style = document.createElement("style");
  style.id = "trustColor";
  style.setAttribute("type", "text/css");
  let newCSS = "";
  for (const [rank, color] of Object.entries(trustColor)) {
    newCSS += `.x-tag-${rank} { color: ${color} !important; border-color: ${color} !important; } `;
  }
  style.innerHTML = newCSS;
  document.head.appendChild(style);
}

function isCustomAssetBridge(value: unknown): value is CustomAssetBridge {
  return (
    typeof value === "object" &&
    value !== null &&
    "CustomCss" in value &&
    typeof value.CustomCss === "function" &&
    "CustomScript" in value &&
    typeof value.CustomScript === "function"
  );
}

function getCustomAssetBridge(): CustomAssetBridge {
  const bridge: unknown = AppApi;
  if (!isCustomAssetBridge(bridge)) {
    throw new TypeError("AppApi.CustomCss and AppApi.CustomScript are not available");
  }
  return bridge;
}

async function refreshCustomCss() {
  const existingStyle = document.getElementById("app-custom-style");
  if (existingStyle !== null && document.contains(existingStyle)) {
    existingStyle.remove();
  }
  const customCss = await getCustomAssetBridge().CustomCss();
  if (typeof customCss === "string" && customCss !== "") {
    const head = document.head;
    const $appCustomStyle = document.createElement("link");
    $appCustomStyle.setAttribute("id", "app-custom-style");
    $appCustomStyle.rel = "stylesheet";
    $appCustomStyle.type = "text/css";
    $appCustomStyle.href = URL.createObjectURL(new Blob([customCss], { type: "text/css" }));
    head.appendChild($appCustomStyle);
  }
}

async function refreshCustomScript() {
  const existingScript = document.getElementById("app-custom-script");
  if (existingScript !== null && document.contains(existingScript)) {
    existingScript.remove();
  }
  const customScript = await getCustomAssetBridge().CustomScript();
  if (typeof customScript === "string" && customScript !== "") {
    const head = document.head;
    const $appCustomScript = document.createElement("script");
    $appCustomScript.setAttribute("id", "app-custom-script");
    $appCustomScript.type = "text/javascript";
    $appCustomScript.textContent = customScript;
    head.appendChild($appCustomScript);
  }
}

function HueToHex(hue: number, isDarkMode: boolean) {
  if (isDarkMode) {
    return HSVtoRGB(hue / 65535, 0.6, 1);
  }
  return HSVtoRGB(hue / 65535, 1, 0.7);
}

function HSVtoRGB(hue: number, saturation: number, value: number): string;
function HSVtoRGB(color: HsvColor): string;
function HSVtoRGB(hueOrColor: number | HsvColor, saturation = 0, value = 0): string {
  const { h, s, v } = typeof hueOrColor === "number" ? { h: hueOrColor, s: saturation, v: value } : hueOrColor;
  let r = 0;
  let g = 0;
  let b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  const red = Math.round(r * 255);
  const green = Math.round(g * 255);
  const blue = Math.round(b * 255);
  const decColor = 0x1000000 + blue + 0x100 * green + 0x10000 * red;
  return `#${decColor.toString(16).slice(1)}`;
}

function nestedDisplayName(value: unknown): unknown {
  if (typeof value === "object" && value !== null && "displayName" in value) {
    return value.displayName;
  }
  return undefined;
}

function formatJsonVars(ref: Record<string, unknown>) {
  const sortedKeys = Object.keys(ref)
    .filter((key) => !key.startsWith("$"))
    .sort();
  const sortedRef = Object.fromEntries(sortedKeys.map((key) => [key, ref[key]]));
  if ("displayName" in sortedRef) {
    return {
      _hexDisplayName: textToHex(sortedRef["displayName"]),
      ...sortedRef,
    };
  }
  if (nestedDisplayName(sortedRef["user"])) {
    return {
      _hexDisplayName: textToHex(nestedDisplayName(sortedRef["user"])),
      ...sortedRef,
    };
  }
  if ("name" in sortedRef) {
    return {
      _hexName: textToHex(sortedRef["name"]),
      ...sortedRef,
    };
  }
  return sortedRef;
}

function changeHtmlLangAttribute(language: string) {
  const htmlElement = document.documentElement;
  htmlElement.setAttribute("lang", language);
}

async function getThemeMode(store: ConfigStore) {
  const initThemeMode = await store.getString("VRCX_ThemeMode", "system");

  let isDarkMode;
  if (initThemeMode === "light") {
    isDarkMode = false;
  } else if (initThemeMode === "system") {
    isDarkMode = systemIsDarkMode();
  } else {
    isDarkMode = true;
  }

  return { initThemeMode, isDarkMode };
}

function redirectToToolsTab() {
  router.push({ name: "tools" }).catch((error: unknown) => {
    console.error("Failed to open the tools tab", error);
  });
  toast(i18n.global.t("view.tools.redirect_message"), { duration: 3000 });
}

export {
  systemIsDarkMode,
  changeAppThemeStyle,
  useThemeColor,
  applyThemeColor,
  initThemeColor,
  updateTrustColorClasses,
  refreshCustomCss,
  refreshCustomScript,
  applyAppFontFamily,
  applyAppCjkFontPack,
  HueToHex,
  HSVtoRGB,
  formatJsonVars,
  changeHtmlLangAttribute,
  getThemeMode,
  setSystemIsDarkMode,
  redirectToToolsTab,
};
