import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { configRepository } from "../services/config";
import { DASHBOARD_NAV_KEY_PREFIX, DASHBOARD_STORAGE_KEY, DEFAULT_DASHBOARD_ICON } from "../shared/constants/dashboard";

type DashboardPanel = string | { key: string; config: unknown };

type DashboardRow = {
  panels: (DashboardPanel | null)[];
  direction: "vertical" | "horizontal";
};

type Dashboard = {
  id: string;
  name: string;
  icon: string;
  rows: DashboardRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneConfig(config: unknown): unknown {
  if (!config || typeof config !== "object") {
    return {};
  }
  const cloned: unknown = JSON.parse(JSON.stringify(config));
  return cloned;
}

function clonePanel(panel: unknown): DashboardPanel | null {
  if (typeof panel === "string" && panel) {
    return panel;
  }
  if (isRecord(panel) && typeof panel["key"] === "string" && panel["key"]) {
    return {
      key: panel["key"],
      config: cloneConfig(panel["config"]),
    };
  }
  return null;
}

function cloneRow(row: unknown): DashboardRow | null {
  if (!isRecord(row) || !Array.isArray(row["panels"])) {
    return null;
  }
  const panels = row["panels"].slice(0, 2).map(clonePanel);
  if (!panels.length) {
    return null;
  }
  const direction = row["direction"] === "vertical" ? "vertical" : "horizontal";
  return { panels, direction };
}

function cloneRows(rows: unknown): DashboardRow[] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map(cloneRow).filter((row): row is DashboardRow => row !== null);
}

function sanitizeDashboard(dashboard: unknown): Dashboard | null {
  if (!isRecord(dashboard)) {
    return null;
  }

  const rawId = dashboard["id"];
  const id = typeof rawId === "string" && rawId ? rawId : null;
  if (!id) {
    return null;
  }

  const rawName = dashboard["name"];
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : "Dashboard";

  const rawIcon = dashboard["icon"];
  const icon = typeof rawIcon === "string" && rawIcon.trim() ? rawIcon.trim() : DEFAULT_DASHBOARD_ICON;

  return {
    id,
    name,
    icon,
    rows: cloneRows(dashboard["rows"]),
  };
}

export const useDashboardStore = defineStore("dashboard", () => {
  const dashboards = ref<Dashboard[]>([]);
  const loaded = ref(false);
  const editingDashboardId = ref<string | null>(null);

  const dashboardNavKeys = computed(() => new Set(dashboards.value.map((dashboard) => `${DASHBOARD_NAV_KEY_PREFIX}${dashboard.id}`)));

  async function loadDashboards() {
    try {
      const stored = await configRepository.getString(DASHBOARD_STORAGE_KEY, null);
      if (!stored) {
        dashboards.value = [];
        loaded.value = true;
        return;
      }

      const parsed: unknown = JSON.parse(stored);
      const source: unknown = isRecord(parsed) ? parsed["dashboards"] : undefined;
      const entries = Array.isArray(source) ? source : [];
      dashboards.value = entries.map(sanitizeDashboard).filter((dashboard): dashboard is Dashboard => dashboard !== null);
    } catch {
      dashboards.value = [];
    } finally {
      loaded.value = true;
    }
  }

  async function saveDashboards() {
    await configRepository.setString(DASHBOARD_STORAGE_KEY, JSON.stringify({ dashboards: dashboards.value }));
  }

  async function ensureLoaded() {
    if (!loaded.value) {
      await loadDashboards();
    }
  }

  function getDashboard(id: string, panel: DashboardPanel | null = null) {
    const dashboard = dashboards.value.find((dashboard) => dashboard.id === id) ?? null;
    if (panel) {
      return dashboard?.rows.find((row) => row.panels.includes(panel));
    }
    return dashboard;
  }

  function generateDashboardId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `dashboard-${Date.now()}-${Math.random().toString().slice(2, 8)}`;
  }

  function generateNextDashboardName(baseName = "Dashboard") {
    const existingNames = new Set(dashboards.value.map((d) => d.name));
    if (!existingNames.has(baseName)) {
      return baseName;
    }
    let n = 1;
    while (existingNames.has(`${baseName} ${n}`)) {
      n++;
    }
    return `${baseName} ${n}`;
  }

  async function createDashboard(baseName = "Dashboard") {
    const id = generateDashboardId();
    const name = generateNextDashboardName(baseName);
    const dashboard: Dashboard = {
      id,
      name,
      icon: DEFAULT_DASHBOARD_ICON,
      rows: [],
    };
    dashboards.value.push(dashboard);
    await saveDashboards();
    return dashboard;
  }

  async function updateDashboard(id: string, updates: Partial<Dashboard>) {
    const index = dashboards.value.findIndex((dashboard) => dashboard.id === id);
    if (index < 0) {
      return;
    }

    const next = sanitizeDashboard({
      ...dashboards.value[index],
      ...updates,
      id,
    });

    if (!next) {
      return;
    }

    dashboards.value[index] = next;
    await saveDashboards();
  }

  async function deleteDashboard(id: string) {
    dashboards.value = dashboards.value.filter((dashboard) => dashboard.id !== id);
    if (editingDashboardId.value === id) {
      editingDashboardId.value = null;
    }
    await saveDashboards();
  }

  function setEditingDashboardId(id: string | null) {
    editingDashboardId.value = id === "" ? null : id;
  }

  function clearEditingDashboardId() {
    editingDashboardId.value = null;
  }

  function getDashboardNavDefinitions() {
    return dashboards.value.map((dashboard) => ({
      key: `${DASHBOARD_NAV_KEY_PREFIX}${dashboard.id}`,
      icon: dashboard.icon || DEFAULT_DASHBOARD_ICON,
      tooltip: dashboard.name,
      labelKey: dashboard.name,
      routeName: "dashboard",
      routeParams: { id: dashboard.id },
      isDashboard: true,
    }));
  }

  return {
    dashboards,
    loaded,
    editingDashboardId,
    dashboardNavKeys,
    ensureLoaded,
    loadDashboards,
    saveDashboards,
    createDashboard,
    getDashboard,
    updateDashboard,
    deleteDashboard,
    getDashboardNavDefinitions,
    setEditingDashboardId,
    clearEditingDashboardId,
  };
});
