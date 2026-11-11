import { Download, RotateCcw, Trash2 } from "lucide-vue-next";

import Button from "@/components/ui/button/Button.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { i18n } from "@/plugins/i18n";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import type { RegistryBackup } from "@/stores/vrcx-messages";

const { t } = i18n.global;

type RegistryBackupCell = { row: { original: RegistryBackup } };

type RegistryBackupColumnHandlers = {
  onRestore?: (row: RegistryBackup) => void;
  onSaveToFile?: (row: RegistryBackup) => void;
  onDelete?: (row: RegistryBackup) => void;
};

type RegistryBackupHeaderColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

export const createColumns = ({ onRestore, onSaveToFile, onDelete }: RegistryBackupColumnHandlers) => [
  {
    id: "name",
    accessorKey: "name",
    header: () => t("dialog.registry_backup.name"),
    meta: {
      stretch: true,
    },
    cell: ({ row }: RegistryBackupCell) => <span>{row.original.name}</span>,
  },
  {
    id: "date",
    accessorFn: (row: RegistryBackup) => {
      const value: unknown = row.date;
      if (typeof value === "number") return value;
      const timestamp = Date.parse(typeof value === "string" ? value : "");
      return Number.isFinite(timestamp) ? timestamp : 0;
    },
    header: ({ column }: { column: RegistryBackupHeaderColumn }) => (
      <button
        class="inline-flex items-center cursor-pointer"
        onClick={() => {
          const sorted = column.getIsSorted();
          column.toggleSorting(sorted === "asc");
        }}
      >
        {t("dialog.registry_backup.date")}
      </button>
    ),
    size: 170,
    cell: ({ row }: RegistryBackupCell) => <span>{formatDateFilter(row.original.date, "long")}</span>,
  },
  {
    id: "action",
    header: () => t("dialog.registry_backup.action"),
    enableSorting: false,
    size: 120,
    meta: {
      tdClass: "text-right",
    },
    cell: ({ row }: RegistryBackupCell) => {
      const original = row.original;
      return (
        <div class="inline-flex items-center justify-end gap-1">
          <TooltipWrapper side="top" content={t("dialog.registry_backup.restore")}>
            <Button
              size="icon-sm"
              variant="ghost"
              class="button-pd-0"
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                onRestore?.(original);
              }}
            >
              <RotateCcw />
            </Button>
          </TooltipWrapper>

          <TooltipWrapper side="top" content={t("dialog.registry_backup.save_to_file")}>
            <Button
              size="icon-sm"
              variant="ghost"
              class="button-pd-0"
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                onSaveToFile?.(original);
              }}
            >
              <Download />
            </Button>
          </TooltipWrapper>

          <TooltipWrapper side="top" content={t("dialog.registry_backup.delete")}>
            <Button
              size="icon-sm"
              variant="ghost"
              class="button-pd-0"
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                onDelete?.(original);
              }}
            >
              <Trash2 />
            </Button>
          </TooltipWrapper>
        </div>
      );
    },
  },
];
