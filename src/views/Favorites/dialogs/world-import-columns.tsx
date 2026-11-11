import { Trash2 } from "lucide-vue-next";

import Button from "../../../components/ui/button/Button.vue";
import { i18n } from "../../../plugins/i18n";
import type { WorldRef } from "../../../shared/utils/world-transforms";
import type { VrcxColumn } from "../../FriendList/vrcx-column";

const { t } = i18n.global;

type WorldImportColumnHandlers = {
  onShowWorld: (worldId: string) => void;
  onShowUser: (userId: string) => void;
  onDelete: (world: WorldRef) => void;
  onShowFullscreenImage: (imageUrl: string) => void;
};

export const createColumns = ({ onShowWorld, onShowUser, onDelete, onShowFullscreenImage }: WorldImportColumnHandlers): VrcxColumn<WorldRef>[] => [
  {
    id: "image",
    header: () => t("table.import.image"),
    enableSorting: false,
    size: 70,
    cell: ({ row }) => {
      const original = row.original;
      const thumb = original.thumbnailImageUrl;
      const full = original.imageUrl;

      return (
        <img
          src={thumb}
          class="friends-list-avatar"
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
    accessorKey: "name",
    header: () => t("table.import.name"),
    meta: {
      stretch: true,
    },
    cell: ({ row }) => {
      const original = row.original;
      return (
        <span
          class="cursor-pointer"
          title={original.name}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onShowWorld(original.id);
          }}
        >
          {original.name}
        </span>
      );
    },
  },
  {
    id: "author",
    header: () => t("table.import.author"),
    size: 120,
    enableSorting: false,
    cell: ({ row }) => {
      const original = row.original;
      return (
        <span
          class="cursor-pointer"
          title={original.authorName}
          onClick={(e: MouseEvent) => {
            e.stopPropagation();
            onShowUser(original.authorId);
          }}
        >
          {original.authorName}
        </span>
      );
    },
  },
  {
    id: "status",
    header: () => t("table.import.status"),
    size: 70,
    enableSorting: false,
    cell: ({ row }) => {
      const status = row.original.releaseStatus;
      const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "";
      const colorClass = status === "public" ? "text-status-online" : status === "private" ? "text-destructive" : "";
      return <span class={colorClass}>{label}</span>;
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
          class="w-6 h-6"
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
