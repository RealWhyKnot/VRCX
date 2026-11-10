class InteropApi {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        if (WINDOWS) {
          return undefined;
        }

        if (typeof prop === "string" && !target[prop]) {
          return new Proxy(
            {},
            {
              get(_, methodName) {
                return async (...args) => {
                  return await target.callMethod(prop, methodName, ...args);
                };
              },
            }
          );
        }
        return target[prop];
      },
    });
  }

  async callMethod(className, methodName, ...args) {
    return window.interopApi.callDotNetMethod(className, methodName, args).then((result) => {
      return result;
    });
  }
}

export default new InteropApi();
