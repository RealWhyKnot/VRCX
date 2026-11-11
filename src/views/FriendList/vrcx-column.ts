import type { RowData } from "@tanstack/vue-table";
import type { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

export type VrcxColumn<TData extends RowData> = Extract<Parameters<typeof useVrcxVueTable<TData>>[0]["columns"], unknown[]>[number];
