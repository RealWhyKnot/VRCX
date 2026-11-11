import type { InviteMessage } from "vrchat";
import CountdownTimer from "@/components/CountdownTimer.vue";
import { i18n } from "@/plugins/i18n";
import type { Json } from "../../../types/vrcx";
import type { ToolsTableColumn } from "./tools-table-types";

const { t } = i18n.global;

export const columns: ToolsTableColumn<Json<InviteMessage>>[] = [
  {
    accessorKey: "slot",
    header: () => t("table.profile.invite_messages.slot"),
    size: 70,
  },
  {
    accessorKey: "message",
    header: () => t("table.profile.invite_messages.message"),
    meta: {
      stretch: true,
    },
  },
  {
    accessorKey: "updatedAt",
    header: () => t("table.profile.invite_messages.cool_down"),
    size: 110,
    meta: {
      tdClass: "text-right",
    },
    cell: ({ row }) => <CountdownTimer datetime={row.original.updatedAt} hours={1} />,
  },
];
