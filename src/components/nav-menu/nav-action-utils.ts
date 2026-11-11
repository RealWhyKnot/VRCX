import type { Router, RouteLocationRaw } from "vue-router";

import type { NavEntryTarget, NavRouteOptions, NavToolAction } from "./nav-menu-types";

export function isNavEntryActionable(entry: NavEntryTarget | null | undefined): boolean {
  return Boolean(entry?.routeName) || Boolean(entry?.action) || Boolean(entry?.path);
}

function pushRoute(router: Router, target: RouteLocationRaw): void {
  void router.push(target).catch((error: unknown) => console.error("Failed to navigate", error));
}

export function navigateToRoute(router: Router, routeName: string | null | undefined, routeParams?: { id: string }): void {
  if (!routeName) {
    return;
  }

  if (routeParams) {
    pushRoute(router, { name: routeName, params: routeParams });
    return;
  }

  pushRoute(router, { name: routeName });
}

export function triggerNavEntryAction(entry: NavEntryTarget | null | undefined, { router, directAccessPaste }: NavRouteOptions): NavToolAction | undefined {
  if (!entry) {
    return undefined;
  }

  if (entry.action === "direct-access") {
    directAccessPaste();
    return undefined;
  }

  if (entry.action && typeof entry.action === "object") {
    return entry.action;
  }

  if (entry.routeName) {
    navigateToRoute(router, entry.routeName, entry.routeParams);
    return undefined;
  }

  if (entry.path) {
    pushRoute(router, entry.path);
  }
  return undefined;
}
