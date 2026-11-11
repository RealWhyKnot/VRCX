import { sqliteService } from "./sqlite.ts";

type ConfigObject = Record<string, unknown> | unknown[];

function transformKey(key: string): string {
  return `config:${key.toLowerCase()}`;
}

function isConfigObject(value: unknown): value is ConfigObject {
  return typeof value === "object" && value !== null;
}

function parseNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

class ConfigRepository {
  async init(): Promise<void> {
    await sqliteService.executeNonQuery("CREATE TABLE IF NOT EXISTS configs (`key` TEXT PRIMARY KEY, `value` TEXT)");
  }

  async remove(key: string): Promise<void> {
    await sqliteService.executeNonQuery(`DELETE FROM configs WHERE key = @key`, {
      "@key": transformKey(key),
    });
  }

  async getString(key: string): Promise<string | null>;
  async getString<TDefault extends string | null>(key: string, defaultValue: TDefault): Promise<string | TDefault>;
  async getString(key: string, defaultValue: string | null = null): Promise<string | null> {
    let value: unknown = undefined;
    await sqliteService.execute(
      (row: unknown) => {
        if (Array.isArray(row)) {
          value = row[0];
        }
      },
      `SELECT value FROM configs WHERE key = @key`,
      {
        "@key": transformKey(key),
      }
    );

    if (typeof value !== "string" || value === "undefined") {
      return defaultValue;
    }
    return value;
  }

  async setString(key: string, value: string | number | boolean): Promise<void> {
    await sqliteService.executeNonQuery(`INSERT OR REPLACE INTO configs (key, value) VALUES (@key, @value)`, {
      "@key": transformKey(key),
      "@value": String(value),
    });
  }

  async getBool(key: string): Promise<boolean | null>;
  async getBool<TDefault extends boolean | null>(key: string, isEnabledByDefault: TDefault): Promise<boolean | TDefault>;
  async getBool(key: string, isEnabledByDefault: boolean | null = null): Promise<boolean | null> {
    const value = await this.getString(key);
    if (value === null) {
      return isEnabledByDefault;
    }
    return value === "true";
  }

  async setBool(key: string, isEnabled: boolean): Promise<void> {
    await this.setString(key, isEnabled ? "true" : "false");
  }

  async getInt(key: string): Promise<number | null>;
  async getInt<TDefault extends number | null>(key: string, defaultValue: TDefault): Promise<number | TDefault>;
  async getInt(key: string, defaultValue: number | null = null): Promise<number | null> {
    const value = await this.getString(key);
    const parsed = value === null ? null : parseNumber(value);
    return parsed === null ? defaultValue : Math.trunc(parsed);
  }

  async setInt(key: string, value: number): Promise<void> {
    await this.setString(key, value);
  }

  async getFloat(key: string): Promise<number | null>;
  async getFloat<TDefault extends number | null>(key: string, defaultValue: TDefault): Promise<number | TDefault>;
  async getFloat(key: string, defaultValue: number | null = null): Promise<number | null> {
    const value = await this.getString(key);
    const parsed = value === null ? null : parseNumber(value);
    return parsed ?? defaultValue;
  }

  async setFloat(key: string, value: number): Promise<void> {
    await this.setString(key, value);
  }

  async getObject(key: string): Promise<ConfigObject | null>;
  async getObject<TDefault>(key: string, defaultValue: TDefault): Promise<ConfigObject | TDefault>;
  async getObject(key: string, defaultValue: unknown = null): Promise<unknown> {
    const value = await this.getString(key);
    if (value === null) {
      return defaultValue;
    }
    let parsed: unknown = value;
    try {
      parsed = JSON.parse(value);
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
    }
    return isConfigObject(parsed) ? parsed : defaultValue;
  }

  async setObject(key: string, value: unknown): Promise<void> {
    await this.setString(key, JSON.stringify(value));
  }

  async getArray(key: string): Promise<unknown[] | null>;
  async getArray<TDefault>(key: string, defaultValue: TDefault): Promise<unknown[] | TDefault>;
  async getArray(key: string, defaultValue: unknown = null): Promise<unknown> {
    const value = await this.getObject(key);
    return Array.isArray(value) ? value : defaultValue;
  }

  async setArray(key: string, value: unknown[]): Promise<void> {
    await this.setObject(key, value);
  }
}

const self = new ConfigRepository();
window.configRepository = self;

export { self as configRepository, ConfigRepository, transformKey };
