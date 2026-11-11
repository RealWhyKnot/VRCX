type BridgeMethods = Record<string, (...args: unknown[]) => Promise<unknown>>;

class InteropApi {
  constructor() {
    return new Proxy(this, {
      get(target, prop: string | symbol): unknown {
        if (isHostWindows) {
          return undefined;
        }

        if (typeof prop === "string" && !(prop in target)) {
          return target.bridge(prop);
        }
        return Reflect.get(target, prop);
      },
    });
  }

  bridge(className: string): BridgeMethods {
    return new Proxy<BridgeMethods>(
      {},
      {
        get:
          (_, methodName) =>
          (...args: unknown[]) =>
            this.callMethod(className, String(methodName), ...args),
      }
    );
  }

  callMethod(className: string, methodName: string, ...args: unknown[]): Promise<unknown> {
    return interopApi.callDotNetMethod(className, methodName, args);
  }
}

export const electronInterop = new InteropApi();
