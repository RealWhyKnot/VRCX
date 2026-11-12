import { ArrowUpDown } from "lucide-vue-next";

import Button from "../../components/ui/button/Button.vue";
import Tooltip from "../../components/ui/tooltip/Tooltip.vue";
import TooltipContent from "../../components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "../../components/ui/tooltip/TooltipTrigger.vue";
import { formatDateFilter } from "../../coordinators/date-coordinator";

type SortableColumn = {
  toggleSorting: (isDescending?: boolean) => void;
  getIsSorted: () => false | "asc" | "desc";
};

function sortButton(column: SortableColumn, label: string) {
  return (
    <Button variant="ghost" class="has-[>svg]:px-2" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      {label}
      <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
  );
}

function dateCell(value: string, emptyLabel: string) {
  if (!value) {
    return <span class="pl-2 text-muted-foreground">{emptyLabel}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span class="pl-2">{formatDateFilter(value, "short")}</span>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span>{formatDateFilter(value, "long")}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function countCell(count: number, detail: string) {
  const value = <span class="pl-2 tabular-nums">{count.toLocaleString()}</span>;
  if (!detail) {
    return value;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{value}</TooltipTrigger>
      <TooltipContent side="right">
        <span>{detail}</span>
      </TooltipContent>
    </Tooltip>
  );
}

export { countCell, dateCell, sortButton };
