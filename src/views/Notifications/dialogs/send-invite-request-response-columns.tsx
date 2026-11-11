import CountdownTimer from "@/components/CountdownTimer.vue";
import Button from "@/components/ui/button/Button.vue";
import { i18n } from "@/plugins/i18n";
import { SquarePen } from "lucide-vue-next";
import type { InviteMessage } from "vrchat";

import type { Json } from "../../../types/vrcx";
import type { VrcxColumn } from "../../FriendList/vrcx-column";

const { t } = i18n.global;

export type InviteMessageRow = Json<InviteMessage>;

export type InviteResponseSelection = {
  invite: { id?: string | undefined };
  messageSlot: Partial<InviteMessageRow>;
};

type InviteMessageColumnHandlers = {
  onEdit: (row: InviteMessageRow) => void;
};

export const createColumns = ({ onEdit }: InviteMessageColumnHandlers): VrcxColumn<InviteMessageRow>[] => [
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
  {
    id: "action",
    header: () => t("table.profile.invite_messages.action"),
    size: 70,
    enableSorting: false,
    meta: {
      tdClass: "text-right",
    },
    cell: ({ row }) => (
      <Button
        size="icon-sm"
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
