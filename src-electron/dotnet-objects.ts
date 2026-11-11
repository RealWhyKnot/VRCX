export type DotNetMethod = (...args: unknown[]) => unknown;

export type VrcxStorage = {
  load: () => void;
  save: () => void;
  get: (key: string) => string;
  set: (key: string, value: string) => void;
};

export type ProgramElectron = {
  preInit: (version: string, args: string[]) => void;
  init: () => void;
};

export type Initializable = {
  init: () => void;
};

export type UpdateClass = {
  init: (appImagePath: string) => void;
};

export function readMember(target: unknown, name: string): unknown {
  if ((typeof target !== "object" && typeof target !== "function") || target === null) {
    return undefined;
  }
  const member: unknown = Reflect.get(target, name);
  return member;
}

export function isDotNetMethod(value: unknown): value is DotNetMethod {
  return typeof value === "function";
}

function hasMethods<K extends string>(value: unknown, names: readonly K[]): value is Record<K, DotNetMethod> {
  return names.every((name) => isDotNetMethod(readMember(value, name)));
}

export function toVrcxStorage(value: unknown): VrcxStorage {
  if (!hasMethods(value, ["Load", "Save", "Get", "Set"])) {
    throw new Error("VRCXStorage does not expose Load, Save, Get and Set");
  }
  return {
    load: () => {
      value.Load();
    },
    save: () => {
      value.Save();
    },
    get: (key) => {
      const stored: unknown = value.Get(key);
      return typeof stored === "string" ? stored : "";
    },
    set: (key, stored) => {
      value.Set(key, stored);
    },
  };
}

export function toProgramElectron(value: unknown): ProgramElectron {
  if (!hasMethods(value, ["PreInit", "Init"])) {
    throw new Error("ProgramElectron does not expose PreInit and Init");
  }
  return {
    preInit: (version, args) => {
      value.PreInit(version, args);
    },
    init: () => {
      value.Init();
    },
  };
}

export function toInitializable(value: unknown, className: string): Initializable {
  if (!hasMethods(value, ["Init"])) {
    throw new Error(`${className} does not expose Init`);
  }
  return {
    init: () => {
      value.Init();
    },
  };
}

export function toUpdateClass(value: unknown): UpdateClass {
  if (!hasMethods(value, ["Init"])) {
    throw new Error("Update does not expose Init");
  }
  return {
    init: (appImagePath) => {
      value.Init(appImagePath);
    },
  };
}
