import { isDotNetMethod, readMember } from "./dotnet-objects.ts";

type DotNetConstructor = new () => unknown;

function isDotNetConstructor(value: unknown): value is DotNetConstructor {
  return typeof value === "function";
}

export class InteropApi {
  private readonly dotnet: unknown;
  private readonly createdObjects = new Map<string, unknown>();

  constructor(dotnet: unknown) {
    this.dotnet = dotnet;
  }

  getDotNetClass(className: string): unknown {
    const vrcx = readMember(this.dotnet, "VRCX");
    return (
      readMember(vrcx, className) ??
      readMember(readMember(vrcx, "Database"), className) ??
      readMember(readMember(readMember(vrcx, "Overlay"), "Electron"), className)
    );
  }

  getDotNetObject(className: string): unknown {
    const existing = this.createdObjects.get(className);
    if (existing !== undefined) {
      return existing;
    }

    console.log(`Creating new instance of ${className}`);

    const DotNetClass = this.getDotNetClass(className);
    if (!isDotNetConstructor(DotNetClass)) {
      throw new Error(`.NET class ${className} was not found`);
    }
    const created: unknown = new DotNetClass();
    this.createdObjects.set(className, created);
    return created;
  }

  callMethod(className: string, methodName: string, args: unknown[]): unknown {
    try {
      const obj = this.getDotNetObject(className);
      const method: unknown = readMember(obj, methodName);
      if (!isDotNetMethod(method)) {
        throw new Error(`Method ${methodName} does not exist on class ${className}`);
      }
      return method.apply(obj, args);
    } catch (e) {
      console.error("Error calling .NET method", `${className}.${methodName}`, e);
      throw e;
    }
  }
}
