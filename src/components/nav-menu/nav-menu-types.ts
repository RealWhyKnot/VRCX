import type { Router } from "vue-router";

import type { useDashboardStore } from "../../stores/dashboard";
import type { useThemeColor } from "../../shared/utils/base/ui";

export type NavTranslate = (key: string) => string;

export type NavDashboardStore = ReturnType<typeof useDashboardStore>;

export type NavThemeColor = ReturnType<typeof useThemeColor>["themeColors"][number];

export type NavToolAction = {
  type: string;
  toolKey: string;
};

export type NavEntryTarget = {
  action?: string | NavToolAction | null | undefined;
  routeName?: string | null | undefined;
  routeParams?: { id: string } | undefined;
  path?: string | undefined;
};

export type NavIndexed = {
  index: string;
};

export type NavDefinition = NavEntryTarget & {
  key: string;
  icon?: string | undefined;
  tooltip: string;
  labelKey: string;
  isDashboard?: boolean | undefined;
};

export type NavMenuChild = NavEntryTarget &
  NavIndexed & {
    label: string;
    icon?: string | undefined;
    titleIsCustom: boolean;
  };

export type NavMenuItem = NavEntryTarget &
  NavIndexed & {
    icon?: string | undefined;
    title: string;
    titleIsCustom: boolean;
    children?: NavMenuChild[] | undefined;
  };

export type NavLayoutItemEntry = {
  type: "item";
  key: string;
};

export type NavLayoutFolderEntry = {
  type: "folder";
  id?: string | undefined;
  name?: string | null | undefined;
  nameKey?: string | null | undefined;
  icon?: string | null | undefined;
  items: string[];
};

export type NavLayoutEntry = NavLayoutItemEntry | NavLayoutFolderEntry;

export type NavRouteOptions = {
  router: Router;
  directAccessPaste: () => void;
};
