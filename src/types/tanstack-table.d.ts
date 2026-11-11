import type { Ref } from "vue";
import type { RowData, TableFeatures } from "@tanstack/table-core";

export {};

declare module "@tanstack/table-core" {
  interface TableMeta<in out TFeatures extends TableFeatures, in out TData extends RowData> {
    resetAll?: (() => void) | undefined;
    columnOrderLocked?: Ref<boolean> | undefined;
  }
}
