import CountdownTimer from "@/components/CountdownTimer.vue";
import Button from "@/components/ui/button/Button.vue";
import { i18n } from "@/plugins/i18n";
import type { InviteMessage } from "vrchat";
import { SquarePen } from "lucide-vue-next";
import type { Json } from "../../../types/vrcx";

const { t } = i18n.global;

type InviteMessageRow = { original: Json<InviteMessage> };

export const createColumns = ({ onEdit }: { onEdit: (row: Json<InviteMessage>) => void }) => [
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
    cell: ({ row }: { row: InviteMessageRow }) => <CountdownTimer datetime={row.original.updatedAt} hours={1} />,
  },
  {
    id: "action",
    header: () => t("table.profile.invite_messages.action"),
    size: 70,
    enableSorting: false,
    meta: {
      tdClass: "text-right",
    },
    cell: ({ row }: { row: InviteMessageRow }) => (
      <Button
        size="icon-sm"
        class="w-6 h-6"
        variant="ghost"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          onEdit(row.original);
        }}
      >
        <SquarePen />
      </Button>
    ),
  },
];
