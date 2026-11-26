import type { Router } from "vue-router";

function isRouter(value: unknown): value is Router {
  return (
    typeof value === "object" &&
    value !== null &&
    "getRoutes" in value &&
    typeof value.getRoutes === "function" &&
    "push" in value &&
    typeof value.push === "function"
  );
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function findRouter(): Router | null {
  const root = document.querySelector("#root");
  const app: unknown = root === null ? undefined : Reflect.get(root, "__vue_app__");
  const config: unknown = isObject(app) ? Reflect.get(app, "config") : undefined;
  const properties: unknown = isObject(config) ? Reflect.get(config, "globalProperties") : undefined;
  const router: unknown = isObject(properties) ? Reflect.get(properties, "$router") : undefined;
  return isRouter(router) ? router : null;
}

function requireRouter(): Router {
  const router = findRouter();
  if (router === null) {
    throw new Error("The app router is not mounted yet");
  }
  return router;
}

function listRoutes() {
  return requireRouter()
    .getRoutes()
    .map((route) => ({
      name: typeof route.name === "string" ? route.name : null,
      path: route.path,
      redirect: route.redirect !== undefined,
      hasChildren: route.children.length > 0,
      isPublic: route.meta["public"] === true,
    }));
}

function navigate(path: string): void {
  requireRouter()
    .push(path)
    .catch((error: unknown) => {
      console.error("page-check navigation failed", error);
    });
}

function currentRoute(): { name: string | null; fullPath: string } | null {
  const router = findRouter();
  if (router === null) {
    return null;
  }
  const route = router.currentRoute.value;
  return { name: typeof route.name === "string" ? route.name : null, fullPath: route.fullPath };
}

export { currentRoute, listRoutes, navigate };
