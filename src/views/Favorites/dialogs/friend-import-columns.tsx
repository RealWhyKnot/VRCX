import { Trash2 } from "lucide-vue-next";

import Button from "../../../components/ui/button/Button.vue";
import { i18n } from "../../../plugins/i18n";
import type { VrcxUser } from "../../../types/vrcx";
import type { VrcxColumn } from "../../FriendList/vrcx-column";

const { t } = i18n.global;

type FriendImportColumnHandlers = {
  userImage: (user: VrcxUser) => string;
  userImageFull: (user: VrcxUser) => string | undefined;
  onShowFullscreenImage: (imageUrl: string) => void;
  onShowUser: (userId: string) => void;
  onDelete: (user: VrcxUser) => void;
};

export const createColumns = ({
  userImage,
  userImageFull,
  onShowFullscreenImage,
  onShowUser,
  onDelete,
}: FriendImportColumnHandlers): VrcxColumn<VrcxUser>[] => [
  {
    id: "image",
    header: () => t("table.import.image"),
    enableSorting: false,
    size: 70,
    cell: ({ row }) => {
      const original = row.original;
      const thumb = userImage(original);
      const full = userImageFull(original);

      return (
        <img
          class="friends-list-avatar"
          src={thumb}
          loading="lazy"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            if (full) {
              onShowFullscreenImage(full);
            }
          }}
        />
      );
    },
  },
  {
    id: "name",
    accessorKey: "displayName",
    header: () => t("table.import.name"),
    meta: {
      stretch: true,
    },
    cell: ({ row }) => {
      const original = row.original;
      return (
        <span
          class="cursor-pointer"
          title={original.displayName}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onShowUser(original.id);
          }}
        >
          {original.displayName}
        </span>
      );
    },
  },
  {
    id: "action",
    header: () => t("table.import.action"),
    size: 90,
    enableSorting: false,
    meta: {
      tdClass: "text-right",
    },
    cell: ({ row }) => {
      const original = row.original;
      return (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onDelete(original);
          }}
        >
          <Trash2 />
        </Button>
      );
    },
  },
];
