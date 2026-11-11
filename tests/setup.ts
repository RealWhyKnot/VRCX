import { vi } from "vitest";

import { i18n } from "../src/plugins/i18n";

import en from "../src/localization/en.json";

const noopAsync = () => Promise.resolve("");
const noopBridge = () => new Proxy({}, { get: () => noopAsync });

Object.assign(globalThis, {
  AppApi: noopBridge(),
  WebApi: noopBridge(),
  VRCXStorage: noopBridge(),
  SQLite: noopBridge(),
  LogWatcher: noopBridge(),
  Discord: noopBridge(),
  AssetBundleManager: noopBridge(),
});

if (typeof ResizeObserver === "undefined") {
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  });
}

Object.assign(globalThis, {
  speechSynthesis: {
    getVoices: () => [],
    cancel: vi.fn(),
    speak: vi.fn(),
  },
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.clear !== "function") {
  const store = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: unknown) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
    },
  });
}

Object.assign(globalThis, {
  Notification: class {
    static permission = "denied";
    static requestPermission = vi.fn().mockResolvedValue("denied");
    close() {
      return undefined;
    }
  },
});

vi.mock("worker-timers", () => ({
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
}));

i18n.global.setLocaleMessage("en", en);
