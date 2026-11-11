function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isObjectValue(value: unknown): value is object {
  return value === Object(value);
}

export class VrcxJsonStorage {
  constructor(storage: typeof VRCXStorage) {
    this.init(storage);
  }

  init(storage: typeof VRCXStorage) {
    storage.GetArray = async (key: string) => {
      try {
        const array: unknown = JSON.parse(await storage.Get(key));
        if (isUnknownArray(array)) {
          return array;
        }
      } catch (err) {
        console.error(err);
      }
      return [];
    };

    storage.SetArray = (key: string, value: unknown[]) => storage.Set(key, JSON.stringify(value));

    storage.GetObject = async (key: string) => {
      try {
        const object: unknown = JSON.parse(await storage.Get(key));
        if (isObjectValue(object)) {
          return object;
        }
      } catch (err) {
        console.error(err);
      }
      return {};
    };

    storage.SetObject = (key: string, value: object) => storage.Set(key, JSON.stringify(value));
  }
}
