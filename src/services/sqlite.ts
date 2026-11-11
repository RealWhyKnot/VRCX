import { i18n } from "../plugins/i18n";
import { openExternalLink } from "../shared/utils/app-actions";
import { useModalStore } from "../stores/modal";

type DatabaseRow = unknown[];

function readErrorMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("message" in error)) {
    return null;
  }
  return typeof error.message === "string" ? error.message : null;
}

function logDialogError(error: unknown): void {
  console.error(error);
}

function isRowList(value: unknown): value is DatabaseRow[] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row));
}

class SQLiteService {
  handleSQLiteError(error: unknown): never {
    const message = readErrorMessage(error);
    if (message !== null && !window.isVrOverlay) {
      const modalStore = useModalStore();
      if (message.includes("database disk image is malformed")) {
        modalStore
          .confirm({
            description: "Please repair or delete your database file by following these instructions.",
            title: "Your database is corrupted",
          })
          .then(({ ok }) => {
            if (!ok) return;
            openExternalLink("https://github.com/vrcx-team/VRCX/wiki#how-to-repair-vrcx-database");
          })
          .catch(logDialogError);
      }
      if (message.includes("database or disk is full")) {
        void modalStore
          .alert({
            description: i18n.global.t("message.database.disk_space"),
            title: "Disk containing database is full",
          })
          .catch(logDialogError);
      }
      if (message.includes("database is locked") || message.includes("attempt to write a readonly database")) {
        void modalStore
          .alert({
            description: "Please close other applications that might be using the database file.",
            title: "Database is locked",
          })
          .catch(logDialogError);
      }
      if (message.includes("disk I/O error")) {
        void modalStore
          .alert({
            description: i18n.global.t("message.database.disk_error"),
            title: "Disk I/O error",
          })
          .catch(logDialogError);
      }
    }
    throw error;
  }

  async run<T>(call: Promise<T>): Promise<T> {
    try {
      return await call;
    } catch (error) {
      return this.handleSQLiteError(error);
    }
  }

  async rows(call: Promise<string>): Promise<DatabaseRow[]> {
    const json = await this.run(call);
    const parsed: unknown = JSON.parse(json);
    if (!isRowList(parsed)) {
      throw new TypeError("The database returned rows in an unexpected shape");
    }
    return parsed;
  }
}

const self = new SQLiteService();
window.sqliteService = self;

export { self as sqliteService, SQLiteService };
export type { DatabaseRow };
