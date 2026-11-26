type LiveRoute = { name: string | null; path: string; redirect: boolean; hasChildren: boolean; isPublic: boolean };

type RouteVisit = { name: string; path: string; expectedName: string };

type RoutePlan = { visits: RouteVisit[]; problems: string[] };

const DASHBOARD_ID = "page-check-dashboard";

const PARAMS = new Map([["dashboard", { id: DASHBOARD_ID }]]);

const REDIRECTS = new Map([
  ["/", "feed"],
  ["/charts", "charts-instance"],
]);

function isLiveRoute(value: unknown): value is LiveRoute {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof value.path === "string" &&
    "name" in value &&
    (value.name === null || typeof value.name === "string") &&
    "redirect" in value &&
    typeof value.redirect === "boolean" &&
    "hasChildren" in value &&
    typeof value.hasChildren === "boolean" &&
    "isPublic" in value &&
    typeof value.isPublic === "boolean"
  );
}

function fillParams(path: string, params: Record<string, string> | undefined): string | null {
  const names = [...path.matchAll(/:(\w+)/gu)].map((match) => match[1] ?? "");
  if (names.length === 0) {
    return path;
  }
  if (params === undefined || names.some((name) => !(name in params))) {
    return null;
  }
  return path.replace(/:(\w+)/gu, (_match, name: string) => params[name] ?? "");
}

function planRoutes(routes: LiveRoute[]): RoutePlan {
  const visits: RouteVisit[] = [];
  const problems: string[] = [];
  const known = new Set(routes.map((route) => route.name).filter((name) => name !== null));
  for (const route of routes) {
    if (route.redirect) {
      const target = REDIRECTS.get(route.path === "" ? "/" : route.path);
      if (target === undefined) {
        problems.push(`Redirect ${route.path} has no expected target in build-scripts/page-check/routes.ts`);
        continue;
      }
      visits.push({ name: `${route.path} (redirect)`, path: route.path, expectedName: target });
      continue;
    }
    if (route.hasChildren || route.isPublic) {
      continue;
    }
    if (route.name === null) {
      problems.push(`Route ${route.path} has no name, so the page check cannot confirm it loaded`);
      continue;
    }
    const path = fillParams(route.path, PARAMS.get(route.name));
    if (path === null) {
      problems.push(`Route ${route.name} (${route.path}) needs params; add them to PARAMS in build-scripts/page-check/routes.ts`);
      continue;
    }
    visits.push({ name: route.name, path, expectedName: route.name });
  }
  for (const [name] of PARAMS) {
    if (!known.has(name)) {
      problems.push(`PARAMS lists ${name}, which is no longer a route`);
    }
  }
  for (const [path, target] of REDIRECTS) {
    if (!known.has(target)) {
      problems.push(`Redirect ${path} expects ${target}, which is no longer a route`);
    }
  }
  return { visits, problems };
}

function uncovered(routes: LiveRoute[], visited: Set<string>): string[] {
  return routes
    .filter((route) => !route.redirect && !route.hasChildren && !route.isPublic && route.name !== null && !visited.has(route.name))
    .map((route) => route.name ?? route.path);
}

export { DASHBOARD_ID, isLiveRoute, planRoutes, uncovered };
export type { LiveRoute, RoutePlan, RouteVisit };
