import { describe, expect, test } from "vitest";
import { DASHBOARD_ID, planRoutes, uncovered, type LiveRoute } from "../../build-scripts/page-check/routes";

function page(name: string | null, path: string, extra: Partial<LiveRoute> = {}): LiveRoute {
  return { name, path, redirect: false, hasChildren: false, isPublic: false, ...extra };
}

const APP_ROUTES = [
  page(null, "/", { redirect: true }),
  page(null, "/charts", { redirect: true }),
  page("main", "/", { hasChildren: true }),
  page("login", "/login", { isPublic: true }),
  page("feed", "/feed"),
  page("charts-instance", "/charts/instance"),
  page("dashboard", "/dashboard/:id"),
];

describe("planRoutes", () => {
  test("visits every page and redirect, filling dashboard params", () => {
    const plan = planRoutes(APP_ROUTES);
    expect(plan.problems).toEqual([]);
    expect(plan.visits).toEqual([
      { name: "/ (redirect)", path: "/", expectedName: "feed" },
      { name: "/charts (redirect)", path: "/charts", expectedName: "charts-instance" },
      { name: "feed", path: "/feed", expectedName: "feed" },
      { name: "charts-instance", path: "/charts/instance", expectedName: "charts-instance" },
      { name: "dashboard", path: `/dashboard/${DASHBOARD_ID}`, expectedName: "dashboard" },
    ]);
  });

  test("reports routes the page check cannot visit", () => {
    const plan = planRoutes([...APP_ROUTES, page("user", "/user/:userId"), page(null, "/unnamed"), page(null, "/old", { redirect: true })]);
    expect(plan.problems).toEqual([
      "Route user (/user/:userId) needs params; add them to PARAMS in build-scripts/page-check/routes.ts",
      "Route /unnamed has no name, so the page check cannot confirm it loaded",
      "Redirect /old has no expected target in build-scripts/page-check/routes.ts",
    ]);
  });

  test("reports params and redirects that point at removed routes", () => {
    const plan = planRoutes(APP_ROUTES.filter((route) => route.name !== "dashboard" && route.name !== "feed"));
    expect(plan.problems).toEqual(["PARAMS lists dashboard, which is no longer a route", "Redirect / expects feed, which is no longer a route"]);
  });
});

describe("uncovered", () => {
  test("lists pages that were never visited", () => {
    expect(uncovered(APP_ROUTES, new Set(["feed", "dashboard"]))).toEqual(["charts-instance"]);
  });
});
