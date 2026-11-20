import { isProxy, toRaw } from "vue";

function isBridgeContainer(value: object): boolean {
  if (Array.isArray(value)) {
    return true;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requiresUnwrapping(value: unknown, visited: WeakSet<object>): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (isProxy(value)) {
    return true;
  }
  if (visited.has(value) || !isBridgeContainer(value)) {
    return false;
  }

  visited.add(value);
  const keys = Object.keys(value);
  if (Array.isArray(value) && keys.length === value.length && keys.at(-1) === String(value.length - 1)) {
    const items: Iterable<unknown> = Array.prototype.values.call(value);
    for (const item of items) {
      if (item !== null && typeof item === "object" && requiresUnwrapping(item, visited)) {
        return true;
      }
    }
    return false;
  }

  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor) || requiresUnwrapping(descriptor.value, visited)) {
      return true;
    }
  }
  return false;
}

export function unwrapBridgeArguments(args: unknown[]): unknown[] {
  const visited = new WeakSet<object>();
  if (!args.some((value) => requiresUnwrapping(value, visited))) {
    return args;
  }

  const copies = new WeakMap<object, object>();

  function unwrap(value: unknown): unknown {
    if (value === null || typeof value !== "object") {
      return value;
    }
    const raw = toRaw(value);
    if (!isBridgeContainer(raw)) {
      return raw;
    }

    const existing = copies.get(raw);
    if (existing) {
      return existing;
    }

    const copy = Array.isArray(raw) ? new Array<unknown>(raw.length) : {};
    copies.set(raw, copy);
    const entries: [string, unknown][] = Object.entries(raw);
    for (let index = 0; index < entries.length; index++) {
      const entry = entries[index];
      if (!entry) {
        continue;
      }
      const [key, item] = entry;
      const unwrapped = unwrap(item);
      if (Array.isArray(copy) && key === String(index) && !(index in copy)) {
        copy[index] = unwrapped;
      } else {
        Object.defineProperty(copy, key, { value: unwrapped, enumerable: true, writable: true, configurable: true });
      }
    }
    return copy;
  }

  return args.map(unwrap);
}
