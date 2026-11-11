export type DashboardPanelValue = string | { key: string; config: unknown };

export type DashboardRowValue = {
  panels: (DashboardPanelValue | null)[];
  direction: "vertical" | "horizontal";
};

export function isDashboardRow(value: unknown): value is DashboardRowValue {
  if (typeof value !== "object" || value === null || !("panels" in value) || !("direction" in value)) {
    return false;
  }
  return Array.isArray(value.panels) && (value.direction === "vertical" || value.direction === "horizontal");
}
