export const DATABASE_VERSION = 18;

type SchemaDatabase = {
  initTables(): Promise<unknown>;
  upgradeDatabaseVersion(): Promise<unknown>;
  vacuum(): Promise<unknown>;
  optimize(): Promise<unknown>;
};

export function isDatabaseUpgradeNeeded(storedVersion: number): boolean {
  return storedVersion < DATABASE_VERSION;
}

export async function prepareSchema(storedVersion: number, schemaDatabase: SchemaDatabase): Promise<void> {
  if (!isDatabaseUpgradeNeeded(storedVersion)) {
    await schemaDatabase.initTables();
    return;
  }
  await schemaDatabase.upgradeDatabaseVersion();
  await schemaDatabase.vacuum();
  await schemaDatabase.optimize();
}
