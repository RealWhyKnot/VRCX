import { useEventListener } from "@vueuse/core";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

import { configRepository } from "../services/config";
import { navDefinitions } from "../shared/constants/ui";
import { useDashboardStore } from "../stores/dashboard";
import { createBaseDefaultNavLayout, insertDashboardEntries } from "../components/nav-menu/nav-layout-defaults";
import { collectLayoutKeys } from "../components/nav-menu/nav-layout-helpers";
import {
  buildNavDefinitionsForLayout,
  createNavDefinitionMap,
  generateNavFolderId,
  loadStoredNavConfig,
  NAV_CONFIG_KEY,
} from "../components/nav-menu/nav-config-utils";
import { normalizeHiddenKeys, sanitizeLayout } from "../components/nav-menu/nav-menu-utils";
import { dispatchNavLayoutUpdated, NAV_LAYOUT_UPDATED_EVENT } from "../components/nav-menu/nav-layout-events";

type NavItemEntry = { type: "item"; key: string };

type NavFolderEntry = {
  type: "folder";
  id?: string;
  nameKey?: string;
  name?: string;
  icon?: string;
  items?: string[];
};

type NavLayoutEntry = NavItemEntry | NavFolderEntry;

type NavConfig = {
  layout: NavLayoutEntry[];
  hiddenKeys: string[];
};

type TranslateFn = (key: string) => string;

function logRefreshError(error: unknown): void {
  console.error(error);
}

type PinPlacement = "top-level" | "folder";

function isNavLayoutEntry(value: unknown): value is NavLayoutEntry {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  if (value.type === "item") {
    return "key" in value && typeof value.key === "string";
  }
  if (value.type === "folder") {
    if (!("items" in value) || value.items === undefined) {
      return true;
    }
    return Array.isArray(value.items) && value.items.every((key) => typeof key === "string");
  }
  return false;
}

function toNavConfig(value: unknown): NavConfig {
  if (typeof value !== "object" || value === null || !("layout" in value) || !("hiddenKeys" in value)) {
    throw new Error("Stored nav config has an unexpected shape");
  }
  const { layout, hiddenKeys } = value;
  return {
    layout: Array.isArray(layout) ? layout.filter(isNavLayoutEntry) : [],
    hiddenKeys: Array.isArray(hiddenKeys) ? hiddenKeys.filter((key): key is string => typeof key === "string") : [],
  };
}

function insertToolNavItem(layout: NavLayoutEntry[], navKey: string, t: TranslateFn, placement: PinPlacement = "top-level"): NavLayoutEntry[] {
  const nextLayout = [...layout];
  const isAlreadyInLayout = nextLayout.some((entry) => {
    if (entry.type === "item") {
      return entry.key === navKey;
    }
    return entry.items?.includes(navKey) ?? false;
  });

  if (isAlreadyInLayout) {
    return nextLayout;
  }

  const insertIdx = nextLayout.findIndex((entry) => entry.type === "item" && (entry.key === "tools" || entry.key === "direct-access"));

  if (placement === "top-level") {
    if (insertIdx === -1) {
      nextLayout.push({ type: "item", key: navKey });
    } else {
      nextLayout.splice(insertIdx, 0, { type: "item", key: navKey });
    }

    return nextLayout;
  }

  const folderWithTools = nextLayout.find((entry) => entry.type === "folder" && (entry.items ?? []).some((key) => key.startsWith("tool-")));

  if (folderWithTools) {
    return nextLayout.map((entry) => {
      if (entry !== folderWithTools || entry.type !== "folder") {
        return entry;
      }

      return {
        ...entry,
        items: [...(entry.items ?? []), navKey],
      };
    });
  }

  const toolsFolder: NavFolderEntry = {
    type: "folder",
    id: "default-folder-tools-shortcuts",
    nameKey: "nav_tooltip.tools",
    name: t("nav_tooltip.tools"),
    icon: "ri-tools-line",
    items: [navKey],
  };

  if (insertIdx === -1) {
    nextLayout.push(toolsFolder);
  } else {
    nextLayout.splice(insertIdx, 0, toolsFolder);
  }

  return nextLayout;
}

function removeToolNavItem(layout: NavLayoutEntry[], navKey: string): NavLayoutEntry[] {
  return layout
    .map((entry): NavLayoutEntry | null => {
      if (entry.type === "item") {
        return entry.key === navKey ? null : entry;
      }

      const nextItems = (entry.items ?? []).filter((key) => key !== navKey);
      if (!nextItems.length) {
        return null;
      }
      return {
        ...entry,
        items: nextItems,
      };
    })
    .filter((entry): entry is NavLayoutEntry => entry !== null);
}

export function useToolNavPinning() {
  const { t } = useI18n();
  const dashboardStore = useDashboardStore();
  const pinnedToolKeysRef = ref(new Set<string>());

  const buildDefinitions = (): unknown[] => [navDefinitions, dashboardStore.getDashboardNavDefinitions()].flat();

  const buildDefaultLayout = (): unknown => insertDashboardEntries(createBaseDefaultNavLayout(t), dashboardStore.getDashboardNavDefinitions());

  const buildSanitizeDefinitions = (layout: NavLayoutEntry[] = [], hiddenKeys: string[] = []): unknown => {
    return buildNavDefinitionsForLayout(navDefinitions, dashboardStore.getDashboardNavDefinitions(), layout, hiddenKeys);
  };

  const loadConfig = async (): Promise<NavConfig> => {
    const stored: unknown = await loadStoredNavConfig(configRepository, buildDefaultLayout(), {
      configKey: NAV_CONFIG_KEY,
      filterHiddenKey: (key: unknown) => typeof key !== "string" || !key.startsWith("tool-"),
    });
    return toNavConfig(stored);
  };

  const refreshPinnedState = async () => {
    const { layout } = await loadConfig();
    const nextPinned = new Set<string>();

    for (const key of collectLayoutKeys(layout)) {
      if (typeof key === "string" && key.startsWith("tool-")) {
        nextPinned.add(key.replace(/^tool-/, ""));
      }
    }

    pinnedToolKeysRef.value = nextPinned;
  };

  const pinToolToNav = async (toolKey: string, options: { placement?: PinPlacement } = {}) => {
    const navKey = `tool-${toolKey}`;
    const { layout, hiddenKeys } = await loadConfig();
    const nextLayout = insertToolNavItem(layout, navKey, t, options.placement);
    const nextHiddenKeys = hiddenKeys.filter((key) => key !== navKey);
    const definitions = buildSanitizeDefinitions(nextLayout, nextHiddenKeys);
    const definitionMap: unknown = createNavDefinitionMap(buildDefinitions());
    const normalizedHiddenKeys: unknown = normalizeHiddenKeys(nextHiddenKeys, definitionMap);
    const sanitizedLayout: unknown = sanitizeLayout(nextLayout, normalizedHiddenKeys, definitionMap, definitions, t, generateNavFolderId);

    await configRepository.setString(
      NAV_CONFIG_KEY,
      JSON.stringify({
        layout: sanitizedLayout,
        hiddenKeys: normalizedHiddenKeys,
      })
    );

    await refreshPinnedState();
    toast.success(t("nav_menu.custom_nav.pinned"));
    dispatchNavLayoutUpdated();
  };

  const unpinToolFromNav = async (toolKey: string) => {
    const navKey = `tool-${toolKey}`;
    const { layout, hiddenKeys } = await loadConfig();
    const nextLayout = removeToolNavItem(layout, navKey);
    const nextHiddenKeys = hiddenKeys.filter((key) => key !== navKey);
    const definitions = buildSanitizeDefinitions(nextLayout, nextHiddenKeys);
    const definitionMap: unknown = createNavDefinitionMap(buildDefinitions());
    const normalizedHiddenKeys: unknown = normalizeHiddenKeys(nextHiddenKeys, definitionMap);
    const sanitizedLayout: unknown = sanitizeLayout(nextLayout, normalizedHiddenKeys, definitionMap, definitions, t, generateNavFolderId);

    await configRepository.setString(
      NAV_CONFIG_KEY,
      JSON.stringify({
        layout: sanitizedLayout,
        hiddenKeys: normalizedHiddenKeys,
      })
    );

    await refreshPinnedState();
    toast.success(t("nav_menu.custom_nav.unpinned"));
    dispatchNavLayoutUpdated();
  };

  useEventListener(typeof window !== "undefined" ? window : undefined, NAV_LAYOUT_UPDATED_EVENT, () => void refreshPinnedState().catch(logRefreshError));

  return {
    pinnedToolKeys: computed(() => pinnedToolKeysRef.value),
    pinToolToNav,
    unpinToolFromNav,
    refreshPinnedState,
  };
}
