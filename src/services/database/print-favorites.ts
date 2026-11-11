import { cellText } from "./cells.ts";

import { sqliteService } from "../sqlite.ts";

function logDatabaseError(error: unknown): void {
  console.error(error);
}

const printFavorites = {
  addPrintToFavorites(printId: string): void {
    void sqliteService.run(DatabaseApi.AddPrintToFavorites(printId, new Date().toJSON())).catch(logDatabaseError);
  },

  removePrintFromFavorites(printId: string): void {
    void sqliteService.run(DatabaseApi.RemovePrintFromFavorites(printId)).catch(logDatabaseError);
  },

  async getPrintFavorites(): Promise<{ printId: string | null }[]> {
    const rows = await sqliteService.rows(DatabaseApi.GetPrintFavorites());
    return rows.map((row) => ({ printId: cellText(row[1]) }));
  },
};

export { printFavorites };
