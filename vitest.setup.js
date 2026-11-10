import { vi } from "vitest";

import { i18n } from "./src/plugins/i18n";

import en from "./src/localization/en.json";

const noopAsync = () => Promise.resolve("");

globalThis.AppApi = new Proxy({}, { get: () => noopAsync });
globalThis.WebApi = new Proxy({}, { get: () => noopAsync });
globalThis.VRCXStorage = new Proxy({}, { get: () => noopAsync });
globalThis.SQLite = new Proxy({}, { get: () => noopAsync });
globalThis.LogWatcher = new Proxy({}, { get: () => noopAsync });
globalThis.Discord = new Proxy({}, { get: () => noopAsync });
globalThis.AssetBundleManager = new Proxy({}, { get: () => noopAsync });

globalThis.ResizeObserver ??= class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

globalThis.speechSynthesis = {
  getVoices: () => [],
  cancel: vi.fn(),
  speak: vi.fn(),
};

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
  };
}

globalThis.Notification = class {
  static permission = "denied";
  static requestPermission = vi.fn().mockResolvedValue("denied");
  close() {
    return undefined;
  }
};

vi.mock("worker-timers", () => ({
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
}));

i18n.global.setLocaleMessage("en", en);
