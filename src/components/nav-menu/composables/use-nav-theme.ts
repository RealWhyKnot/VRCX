import { computed } from "vue";

import type { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { THEME_CONFIG } from "../../../shared/constants/themes";
import { useThemeColor } from "../../../shared/utils/base/ui";
import type { NavThemeColor, NavTranslate } from "../nav-menu-types";

type ThemeKey = keyof typeof THEME_CONFIG;

type UseNavThemeOptions = {
  t: NavTranslate;
  appearanceSettingsStore: Pick<ReturnType<typeof useAppearanceSettingsStore>, "setThemeMode" | "setTableDensity" | "toggleThemeMode">;
};

function isThemeKey(value: string): value is ThemeKey {
  return Object.hasOwn(THEME_CONFIG, value);
}

export function useNavTheme({ t, appearanceSettingsStore }: UseNavThemeOptions) {
  const themes = computed(() => Object.keys(THEME_CONFIG));
  const { themeColors, currentThemeColor, isApplyingThemeColor, applyThemeColor, initThemeColor } = useThemeColor();

  const themeDisplayName = (themeKey: string): string => {
    const i18nKey = `view.settings.appearance.appearance.theme_mode_${themeKey}`;
    const translated = t(i18nKey);
    if (translated !== i18nKey) {
      return translated;
    }
    return isThemeKey(themeKey) ? THEME_CONFIG[themeKey].name : themeKey;
  };

  const themeColorDisplayName = (theme: NavThemeColor): string => {
    const i18nKey = `view.settings.appearance.theme_color.${theme.key}`;
    const translated = t(i18nKey);
    if (translated !== i18nKey) {
      return translated;
    }
    return theme.label || theme.key;
  };

  const handleThemeSelect = (theme: string) => {
    appearanceSettingsStore.setThemeMode(theme);
  };

  const handleThemeToggle = () => {
    appearanceSettingsStore.toggleThemeMode();
  };

  const handleTableDensitySelect = (density: string) => {
    appearanceSettingsStore.setTableDensity(density);
  };

  const handleThemeColorSelect = async (theme: Pick<NavThemeColor, "key">) => {
    await applyThemeColor(theme.key);
  };

  return {
    themes,
    themeColors,
    currentThemeColor,
    isApplyingThemeColor,
    initThemeColor,
    themeDisplayName,
    themeColorDisplayName,
    handleThemeSelect,
    handleThemeToggle,
    handleTableDensitySelect,
    handleThemeColorSelect,
  };
}
