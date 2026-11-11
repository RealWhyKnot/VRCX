import { useEventListener } from "@vueuse/core";
import { computed, ref, watch, type Ref } from "vue";
import type { Router } from "vue-router";

import { configRepository } from "../../../services/config";
import { DASHBOARD_NAV_KEY_PREFIX } from "../../../shared/constants/dashboard";
import { isToolNavKey } from "../../../shared/constants/tools";
import { navDefinitions } from "../../../shared/constants/ui";
import { triggerNavEntryAction } from "../nav-action-utils";
import { buildMenuItems, findFirstNavEntry, findFirstNavKey } from "../nav-layout-helpers";
import { createBaseDefaultNavLayout, insertDashboardEntries } from "../nav-layout-defaults";
import { dispatchNavLayoutUpdated, NAV_LAYOUT_UPDATED_EVENT } from "../nav-layout-events";
import { buildNavDefinitionsForLayout, createNavDefinitionMap, generateNavFolderId, loadStoredNavConfig, NAV_CONFIG_KEY } from "../nav-config-utils";
import { normalizeHiddenKeys, sanitizeLayout } from "../nav-menu-utils";
import type { NavDashboardStore, NavDefinition, NavEntryTarget, NavLayoutEntry, NavTranslate } from "../nav-menu-types";

type UseNavLayoutOptions = {
  t: NavTranslate;
  locale: Ref<string>;
  router: Router;
  dashboardStore: NavDashboardStore;
  dashboards: Ref<unknown[]>;
  directAccessPaste: () => void;
  triggerTool: (toolKey: string) => Promise<unknown>;
};

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function resolveRouteNavKeys(meta: Record<string, unknown>, routeName: string | undefined): string[] {
  const navKeys = meta["navKeys"];
  if (Array.isArray(navKeys)) {
    return navKeys.filter(isString);
  }
  const metaNavKey = meta["navKey"];
  const navKey = isString(metaNavKey) && metaNavKey !== "" ? metaNavKey : routeName;
  return navKey ? [navKey] : [];
}

export function useNavLayout({ t, locale, router, dashboardStore, dashboards, directAccessPaste, triggerTool }: UseNavLayoutOptions) {
  const navLayout = ref<NavLayoutEntry[]>([]);
  const navLayoutReady = ref(false);
  const navHiddenKeys = ref<string[]>([]);

  const allNavDefinitions = computed<NavDefinition[]>(() => [...navDefinitions, ...dashboardStore.getDashboardNavDefinitions()]);

  const navDefinitionMap = computed(() => {
    const map = createNavDefinitionMap(allNavDefinitions.value);
    return map;
  });

  const getDefaultHiddenKeys = (_layout: NavLayoutEntry[]): string[] => [];

  const createDefaultNavLayout = () => createBaseDefaultNavLayout(t);

  const menuItems = computed(() => {
    return buildMenuItems(navLayout.value, navDefinitionMap.value, t);
  });

  const getFirstNavEntryLocal = (layout: NavLayoutEntry[]) => {
    return findFirstNavEntry(layout, navDefinitionMap.value);
  };

  const getFirstNavKeyLocal = (layout: NavLayoutEntry[]) => {
    return findFirstNavKey(layout, navDefinitionMap.value);
  };

  const getFallbackNavKey = (): string => {
    const firstKey = getFirstNavKeyLocal(navLayout.value) ?? "";
    return firstKey === "" ? "feed" : firstKey;
  };

  const activeMenuIndex = computed(() => {
    const currentRoute = router.currentRoute.value;
    if (currentRoute.name === "dashboard" && currentRoute.params["id"]) {
      return `${DASHBOARD_NAV_KEY_PREFIX}${String(currentRoute.params["id"])}`;
    }
    const routeMeta: Record<string, unknown> = currentRoute.meta;
    const currentRouteName = isString(currentRoute.name) ? currentRoute.name : undefined;
    const navKeys = resolveRouteNavKeys(routeMeta, currentRouteName);

    if (routeMeta["hidesActiveMenuItem"]) {
      return "";
    }

    if (!navKeys.length) {
      return getFallbackNavKey();
    }

    for (const entry of navLayout.value) {
      if (entry.type === "item" && navKeys.includes(entry.key)) {
        return entry.key;
      }
      if (entry.type === "folder") {
        const matchedKey = navKeys.find((key) => entry.items.includes(key));
        if (matchedKey) {
          return matchedKey;
        }
      }
    }
    return getFallbackNavKey();
  });

  const getAppendDefinitions = (layout: NavLayoutEntry[], hiddenKeys: string[] = []) => {
    return buildNavDefinitionsForLayout(navDefinitions, dashboardStore.getDashboardNavDefinitions(), layout, hiddenKeys);
  };

  const sanitizeLayoutLocal = (layout: NavLayoutEntry[], hiddenKeys: string[] = []) => {
    return sanitizeLayout(layout, hiddenKeys, navDefinitionMap.value, getAppendDefinitions(layout, hiddenKeys), t, generateNavFolderId);
  };

  const defaultNavLayout = computed(() => {
    const base = insertDashboardEntries(createDefaultNavLayout(), dashboardStore.getDashboardNavDefinitions());
    return sanitizeLayoutLocal(base, getDefaultHiddenKeys(base));
  });

  const triggerNavAction = (entry: NavEntryTarget) => {
    const action = triggerNavEntryAction(entry, {
      router,
      directAccessPaste,
    });
    if (action?.type === "tool" && action.toolKey) {
      void triggerTool(action.toolKey).catch((error: unknown) => console.error("Failed to trigger tool", error));
    }
  };

  const saveNavLayout = async (layout: NavLayoutEntry[], hiddenKeys: string[] = []) => {
    const normalizedHiddenKeys = normalizeHiddenKeys([...hiddenKeys, ...getDefaultHiddenKeys(layout)], navDefinitionMap.value);
    try {
      await configRepository.setString(
        NAV_CONFIG_KEY,
        JSON.stringify({
          layout,
          hiddenKeys: normalizedHiddenKeys,
        })
      );
    } catch (error) {
      console.error("Failed to save custom nav", error);
      return;
    }

    dispatchNavLayoutUpdated();
  };

  const applyCustomNavLayout = async (layout: NavLayoutEntry[], hiddenKeys: string[] = []) => {
    const normalizedHiddenKeys = normalizeHiddenKeys([...hiddenKeys, ...getDefaultHiddenKeys(layout)], navDefinitionMap.value);
    const sanitized = sanitizeLayoutLocal(layout, normalizedHiddenKeys);
    navLayout.value = sanitized;
    navHiddenKeys.value = normalizedHiddenKeys;
    await saveNavLayout(sanitized, normalizedHiddenKeys);
  };

  let hasNavigatedToInitialRoute = false;
  const navigateToFirstNavEntry = () => {
    if (hasNavigatedToInitialRoute) {
      return;
    }
    const firstEntry = getFirstNavEntryLocal(navLayout.value);
    if (!firstEntry) {
      return;
    }
    hasNavigatedToInitialRoute = true;
    if (
      router.currentRoute.value.name !== firstEntry.routeName ||
      (firstEntry.routeParams?.id && router.currentRoute.value.params["id"] !== firstEntry.routeParams.id)
    ) {
      triggerNavAction(firstEntry);
    }
  };

  const loadNavMenuConfig = async () => {
    let layoutData: NavLayoutEntry[] | null = null;
    let hiddenKeysData: string[] = [];
    try {
      const loaded = await loadStoredNavConfig(configRepository, createDefaultNavLayout(), {
        configKey: NAV_CONFIG_KEY,
        filterHiddenKey: (key) => !isToolNavKey(key),
      });
      layoutData = loaded.layout;
      hiddenKeysData = loaded.hiddenKeys;
    } catch (error) {
      console.error("Failed to load custom nav", error);
    } finally {
      const fallbackLayout = layoutData?.length ? layoutData : createDefaultNavLayout();
      const normalizedHiddenKeys = normalizeHiddenKeys(hiddenKeysData, navDefinitionMap.value);
      const sanitized = sanitizeLayoutLocal(fallbackLayout, normalizedHiddenKeys);
      navLayout.value = sanitized;
      navHiddenKeys.value = normalizedHiddenKeys;
      if (
        layoutData?.length &&
        (JSON.stringify(sanitized) !== JSON.stringify(fallbackLayout) || JSON.stringify(normalizedHiddenKeys) !== JSON.stringify(hiddenKeysData))
      ) {
        await saveNavLayout(sanitized, normalizedHiddenKeys);
      }
      navLayoutReady.value = true;
      navigateToFirstNavEntry();
    }
  };

  const cleanDashboardEntries = (layout: NavLayoutEntry[], dashboardKeys: Set<string>): NavLayoutEntry[] => {
    const normalized: NavLayoutEntry[] = [];
    layout.forEach((entry) => {
      if (entry.type === "item") {
        if (entry.key.startsWith(DASHBOARD_NAV_KEY_PREFIX) && !dashboardKeys.has(entry.key)) {
          return;
        }
        normalized.push(entry);
        return;
      }

      const nextItems = entry.items.filter((key) => {
        if (!key.startsWith(DASHBOARD_NAV_KEY_PREFIX)) {
          return true;
        }
        return dashboardKeys.has(key);
      });
      if (nextItems.length === 0) {
        return;
      }
      normalized.push({ ...entry, items: nextItems });
    });
    return normalized;
  };

  watch(
    () => locale.value,
    () => {
      if (!navLayoutReady.value) {
        return;
      }
      navLayout.value = navLayout.value.map((entry) => {
        if (entry.type === "folder" && entry.nameKey) {
          return {
            ...entry,
            name: t(entry.nameKey),
          };
        }
        return entry;
      });
    }
  );

  watch(
    () => dashboards.value,
    async () => {
      if (!navLayoutReady.value) {
        return;
      }
      const cleanedLayout = cleanDashboardEntries(navLayout.value, dashboardStore.dashboardNavKeys);
      const cleanedHidden = navHiddenKeys.value.filter((key) => !key.startsWith(DASHBOARD_NAV_KEY_PREFIX) || dashboardStore.dashboardNavKeys.has(key));
      if (JSON.stringify(cleanedLayout) !== JSON.stringify(navLayout.value) || JSON.stringify(cleanedHidden) !== JSON.stringify(navHiddenKeys.value)) {
        await applyCustomNavLayout(cleanedLayout, cleanedHidden);
      }
    },
    { deep: true }
  );

  const handleExternalNavLayoutUpdate = () => {
    void loadNavMenuConfig().catch((error: unknown) => console.error("Failed to reload custom nav", error));
  };

  useEventListener(typeof window !== "undefined" ? window : undefined, NAV_LAYOUT_UPDATED_EVENT, handleExternalNavLayoutUpdate);

  return {
    navLayout,
    navLayoutReady,
    navHiddenKeys,
    defaultHiddenKeys: computed(() => getDefaultHiddenKeys(defaultNavLayout.value)),
    menuItems,
    activeMenuIndex,
    allNavDefinitions,
    navDefinitionMap,
    defaultNavLayout,
    sanitizeLayoutLocal,
    saveNavLayout,
    applyCustomNavLayout,
    loadNavMenuConfig,
    triggerNavAction,
  };
}
