export function isNavEntryActionable(entry) {
  return Boolean(entry?.routeName || entry?.action || entry?.path);
}

export function navigateToRoute(router, routeName, routeParams = undefined) {
  if (!routeName) {
    return;
  }

  if (routeParams) {
    router.push({ name: routeName, params: routeParams });
    return;
  }

  router.push({ name: routeName });
}

export function triggerNavEntryAction(entry, { router, directAccessPaste }) {
  if (!entry) {
    return;
  }

  if (entry.action === "direct-access") {
    directAccessPaste();
    return;
  }

  if (entry.action && typeof entry.action === "object") {
    return entry.action;
  }

  if (entry.routeName) {
    navigateToRoute(router, entry.routeName, entry.routeParams);
    return;
  }

  if (entry.path) {
    router.push(entry.path);
  }
}
