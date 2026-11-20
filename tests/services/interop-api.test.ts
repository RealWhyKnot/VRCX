import { afterEach, describe, expect, test, vi } from "vitest";
import { reactive } from "vue";

import { initInteropApi } from "../../src/plugins/interop-api.ts";
import { unwrapBridgeArguments } from "../../src/shared/utils/bridge-arguments.ts";

vi.mock("../../src/services/config.ts", () => ({ configRepository: { init: vi.fn().mockResolvedValue(undefined) } }));

const originalWindowBridges = new Map<string, PropertyDescriptor | undefined>();

function stubHost(isWindows: boolean) {
  const rows = Promise.resolve("[]");
  const response = Promise.resolve({ Item1: 200, Item2: "ok" });
  const culture = Promise.resolve("en-US");
  const lookupGameLog = vi.fn<(...args: unknown[]) => typeof rows>().mockReturnValue(rows);
  const execute = vi.fn<(...args: unknown[]) => typeof response>().mockReturnValue(response);
  const currentCulture = vi.fn<() => typeof culture>().mockReturnValue(culture);
  const setUserAgent = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const bindObjectAsync = vi.fn<(...names: string[]) => Promise<void>>().mockResolvedValue(undefined);

  const bridges = {
    AppApi: { SetUserAgent: setUserAgent },
    WebApi: { Execute: execute },
    VRCXStorage: {},
    DatabaseApi: { LookupGameLog: lookupGameLog },
    LogWatcher: {},
    Discord: {},
    AssetBundleManager: {},
    AppApiVr: { CurrentCulture: currentCulture },
    AppApiVrElectron: {},
  };
  for (const [name, bridge] of Object.entries(bridges)) {
    originalWindowBridges.set(name, Object.getOwnPropertyDescriptor(window, name));
    vi.stubGlobal(name, bridge);
  }

  const callDotNetMethod = vi.fn((_className: string, methodName: string, args: unknown[]) => {
    switch (methodName) {
      case "LookupGameLog":
        return lookupGameLog(...args);
      case "Execute":
        return execute(...args);
      case "SetUserAgent":
        return setUserAgent();
      case "CurrentCulture":
        return currentCulture();
      default:
        throw new Error(`Unexpected bridge method ${methodName}`);
    }
  });
  vi.stubGlobal("isHostWindows", isWindows);
  vi.stubGlobal("CefSharp", { BindObjectAsync: bindObjectAsync });
  vi.stubGlobal("interopApi", { callDotNetMethod });

  return { rows, response, culture, lookupGameLog, execute, currentCulture, bindObjectAsync, callDotNetMethod };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, descriptor] of originalWindowBridges) {
    if (descriptor) {
      Object.defineProperty(window, name, descriptor);
    } else {
      Reflect.deleteProperty(window, name);
    }
  }
  originalWindowBridges.clear();
});

describe.each([
  { host: "CefSharp", windows: true },
  { host: "Electron", windows: false },
])("$host bridge", ({ windows }) => {
  test("unwraps reactive arguments before calling the host", async () => {
    const { rows, response, lookupGameLog, execute, bindObjectAsync } = stubHost(windows);
    await initInteropApi();

    const filter = reactive(["Location"]);
    const options = { headers: [reactive({ values: filter })] };

    expect(bindObjectAsync).toHaveBeenCalledTimes(windows ? 1 : 0);
    expect(window.DatabaseApi.LookupGameLog(filter, [], 50)).toBe(rows);
    expect(window.WebApi.Execute(options)).toBe(response);
    expect(structuredClone(lookupGameLog.mock.calls)).toEqual([[["Location"], [], 50]]);
    expect(structuredClone(execute.mock.calls)).toEqual([[{ headers: [{ values: ["Location"] }] }]]);
  });

  test("binds AppApiVr in the VR overlay", async () => {
    const { culture, currentCulture, bindObjectAsync, callDotNetMethod } = stubHost(windows);
    await initInteropApi(true);

    expect(window.AppApiVr.CurrentCulture()).toBe(culture);
    expect(currentCulture).toHaveBeenCalledOnce();
    expect(bindObjectAsync.mock.calls).toEqual(windows ? [["AppApiVr"]] : []);
    expect(callDotNetMethod.mock.calls).toEqual(windows ? [] : [["AppApiVrElectron", "CurrentCulture", []]]);
  });
});

test("keeps the same CefSharp wrapper when the bridge is initialized again", async () => {
  const { rows, lookupGameLog, bindObjectAsync } = stubHost(true);
  await initInteropApi();

  const originalWrapper: unknown = Object.getOwnPropertyDescriptor(window.DatabaseApi, "LookupGameLog")?.value;
  expect(window.DatabaseApi.LookupGameLog(reactive(["Location"]), [], 50)).toBe(rows);
  expect(lookupGameLog).toHaveBeenCalledOnce();

  await initInteropApi();

  expect(bindObjectAsync).toHaveBeenCalledTimes(2);
  expect(Object.getOwnPropertyDescriptor(window.DatabaseApi, "LookupGameLog")?.value).toBe(originalWrapper);
  expect(window.DatabaseApi.LookupGameLog(reactive(["VideoPlay"]), [], 25)).toBe(rows);
  expect(structuredClone(lookupGameLog.mock.calls)).toEqual([
    [["Location"], [], 50],
    [["VideoPlay"], [], 25],
  ]);
});

test("returns the same plain argument graph even when it contains a cycle", () => {
  const items: unknown[] = ["Location"];
  const args = [{ items }];
  items.push(args);

  expect(unwrapBridgeArguments(args)).toBe(args);
});

test("copies reactive values from accessors before calling the host", () => {
  const readFilter = vi.fn(() => reactive(["Location"]));
  const args = [
    {
      get filter() {
        return readFilter();
      },
    },
  ];

  expect(structuredClone(unwrapBridgeArguments(args))).toEqual([{ filter: ["Location"] }]);
  expect(readFilter).toHaveBeenCalledOnce();
});

test("snapshots array accessors even when their first value is plain", () => {
  const items: unknown[] = [];
  const readItem = vi.fn<() => unknown>().mockReturnValueOnce("Location").mockReturnValue(reactive(["VideoPlay"]));
  Object.defineProperty(items, 0, { enumerable: true, get: readItem });

  expect(structuredClone(unwrapBridgeArguments([items]))).toEqual([["Location"]]);
  expect(readItem).toHaveBeenCalledOnce();
});

test("preserves sparse array holes, enumerable properties, and cycles when copying", () => {
  const items = new Array<unknown>(5);
  const readHiddenItem = vi.fn(() => "hidden");
  Object.defineProperty(items, 0, { get: readHiddenItem });
  items[2] = reactive(["Location"]);
  items[3] = items;
  Object.defineProperty(items, "filter", { enumerable: true, value: items[2] });

  const [copy] = unwrapBridgeArguments([items]);

  if (!Array.isArray(copy)) {
    throw new Error("Expected an array");
  }
  expect(copy).toHaveLength(5);
  expect(Object.keys(copy)).toEqual(["2", "3", "filter"]);
  expect(Object.getOwnPropertyDescriptor(copy, "3")?.value).toBe(copy);
  expect(structuredClone(Object.getOwnPropertyDescriptor(copy, "filter")?.value)).toEqual(["Location"]);
  expect(readHiddenItem).not.toHaveBeenCalled();
});
