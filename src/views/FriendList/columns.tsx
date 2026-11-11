import { ArrowUpDown, EyeOff, User, UserMinus } from "lucide-vue-next";
import Avatar from "../../components/ui/avatar/Avatar.vue";
import AvatarFallback from "../../components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "../../components/ui/avatar/AvatarImage.vue";

import Button from "../../components/ui/button/Button.vue";
import Checkbox from "../../components/ui/checkbox/Checkbox.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { i18n } from "../../plugins/i18n";
import { formatDateFilter } from "../../coordinators/date-coordinator";
import { getFaviconUrl } from "../../shared/utils/url-utils";
import { languageClass, statusClass } from "../../shared/utils/user";
import { openExternalLink } from "../../shared/utils/app-actions";
import { sortStatus } from "../../shared/utils/friend";
import { timeToText } from "../../shared/utils/base/format";
import type { Ref } from "vue";
import type { VrcxUser } from "../../types/vrcx";
import type { VrcxColumn } from "./vrcx-column";

const { t } = i18n.global;

type FriendProfile = { bioLinks: string[] };

type SortableColumn = {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc?: boolean) => void;
};

type FriendRow = { original: VrcxUser };

type FriendColumnsContext = {
  randomUserColours: Ref<boolean>;
  selectedFriends: Ref<Set<string>>;
  onToggleFriendSelection: (id: string) => void;
  onConfirmDeleteFriend: (id: string) => void;
  userImage: (user: VrcxUser, isIcon: boolean) => string;
  friendProfiles: Ref<Map<string | null, FriendProfile>>;
};

const sortButton = ({ column, label, descFirst = false }: { column: SortableColumn; label: string | (() => string); descFirst?: boolean }) => {
  const resolvedLabel = typeof label === "function" ? label() : label;
  return (
    <Button
      variant="ghost"
      size="sm"
      class="-ml-2 h-8 px-2"
      onClick={() => {
        const sorted = column.getIsSorted();
        if (!sorted && descFirst) {
          column.toggleSorting(true);
          return;
        }
        column.toggleSorting(sorted === "asc");
      }}
    >
      {resolvedLabel}
      <ArrowUpDown class="ml-1 h-4 w-4" />
    </Button>
  );
};

const compareNumbers = (a: number | null | undefined, b: number | null | undefined) => (a ?? 0) - (b ?? 0);
const textOrEmpty = (value: string | undefined) => value ?? "";
const statusOrOffline = (status: VrcxUser["status"] | undefined) => status ?? "offline";

const sortAlphabetically = (a: string | null | undefined, b: string | null | undefined) => {
  if (!a || !b) {
    if (!a && !b) return 0;
    return !a ? -1 : 1;
  }
  return a.toLowerCase().localeCompare(b.toLowerCase());
};

const sortLanguages = (a: { value: string }[] | undefined, b: { value: string }[] | undefined) => {
  const as = Array.isArray(a) ? a.map((i) => i.value).sort() : [];
  const bs = Array.isArray(b) ? b.map((i) => i.value).sort() : [];
  return JSON.stringify(as).localeCompare(JSON.stringify(bs));
};

const withFriendNumber = (rowA: FriendRow, rowB: FriendRow, result: number) => {
  if (result !== 0) {
    return result;
  }
  return compareNumbers(rowA.original.$friendNumber, rowB.original.$friendNumber);
};

const sortByNumber = (selector: (row: VrcxUser) => number | null | undefined) => (rowA: FriendRow, rowB: FriendRow) =>
  withFriendNumber(rowA, rowB, compareNumbers(selector(rowA.original), selector(rowB.original)));

const sortByString = (selector: (row: VrcxUser) => string | null | undefined) => (rowA: FriendRow, rowB: FriendRow) =>
  withFriendNumber(rowA, rowB, sortAlphabetically(selector(rowA.original), selector(rowB.original)));

const sortByStatus = (rowA: FriendRow, rowB: FriendRow) => {
  const a = statusOrOffline(rowA.original.status);
  const b = statusOrOffline(rowB.original.status);
  return withFriendNumber(rowA, rowB, sortStatus(a, b));
};

const sortByLanguages = (rowA: FriendRow, rowB: FriendRow) => withFriendNumber(rowA, rowB, sortLanguages(rowA.original.$languages, rowB.original.$languages));

export const createColumns = ({
  randomUserColours,
  selectedFriends,
  onToggleFriendSelection,
  onConfirmDeleteFriend,
  userImage,
  friendProfiles,
}: FriendColumnsContext): VrcxColumn<VrcxUser>[] => {
  const cols: VrcxColumn<VrcxUser>[] = [];

  cols.push(
    {
      id: "leftSpacer",
      header: () => null,
      size: 20,
      enableSorting: false,
      enableResizing: false,
      meta: {
        thClass: "p-0",
        tdClass: "p-0",
      },
      cell: () => null,
    },
    {
      id: "bulkSelect",
      header: () => null,
      size: 55,
      enableSorting: false,
      meta: {
        thClass: "p-0",
        tdClass: "p-0",
      },
      cell: ({ row }) => {
        const id = row.original.id;
        const isChecked = selectedFriends.value.has(id);
        return (
          <div class="flex items-center justify-center" onClick={(event: MouseEvent) => event.stopPropagation()}>
            <Checkbox modelValue={isChecked} onUpdate:modelValue={() => onToggleFriendSelection(id)} />
          </div>
        );
      },
    },
    {
      id: "friendNumber",
      accessorFn: (row) => row.$friendNumber,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.no"),
          descFirst: true,
        }),
      size: 100,
      meta: { label: () => t("table.friendList.no") },
      sortFn: sortByNumber((row) => row.$friendNumber),
      cell: ({ row }) => <span>{row.original.$friendNumber || ""}</span>,
    },
    {
      id: "avatar",
      accessorFn: (row) => ("photo" in row ? row.photo : undefined),
      header: () => t("table.friendList.avatar"),
      size: 90,
      enableSorting: false,
      meta: { label: () => t("table.friendList.avatar") },
      cell: ({ row }) => {
        const src = userImage(row.original, true);
        return (
          <div class="flex items-center">
            <Avatar class="size-6 rounded-full">
              <AvatarImage src={src} class="friends-list-avatar object-cover" loading="lazy" />
              <AvatarFallback>
                <User class="size-3 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          </div>
        );
      },
    },
    {
      id: "displayName",
      accessorFn: (row) => row.displayName,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.displayName"),
        }),
      size: 200,
      meta: { label: () => t("table.friendList.displayName") },
      sortFn: sortByString((row) => row.displayName),
      cell: ({ row }) => {
        const style = randomUserColours.value ? { color: row.original.$userColour } : null;
        return (
          <span class="name" style={style}>
            {row.original.displayName}
          </span>
        );
      },
    },
    {
      id: "rank",
      accessorFn: (row) => row.$trustSortNum,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.rank"),
        }),
      size: 140,
      meta: { label: () => t("table.friendList.rank") },
      sortFn: sortByNumber((row) => row.$trustSortNum),
      cell: ({ row }) => {
        if (randomUserColours.value) {
          return <span class={row.original.$trustClass}>{row.original.$trustLevel}</span>;
        }
        return (
          <span class="name" style={{ color: row.original.$userColour }}>
            {row.original.$trustLevel}
          </span>
        );
      },
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.status"),
        }),
      minSize: 200,
      sortFn: sortByStatus,
      meta: {
        stretch: true,
        label: () => t("table.friendList.status"),
      },
      cell: ({ row }) => {
        const status = row.original.status;
        return (
          <span class="flex items-center">
            {status && status !== "offline" ? <i class={["x-user-status", statusClass(status), "mr-1"]}></i> : null}
            <span>{textOrEmpty(row.original.statusDescription)}</span>
          </span>
        );
      },
    },
    {
      id: "language",
      accessorFn: (row) => row.$languages,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.language"),
        }),
      size: 130,
      meta: { label: () => t("table.friendList.language") },
      sortFn: sortByLanguages,
      cell: ({ row }) => (
        <div class="flex items-center">
          {row.original.$languages.map((item) => (
            <TooltipWrapper key={item.key} side="top" content={`${item.value} (${item.key})`}>
              <span class={["flags", "inline-block", "mr-1", languageClass(item.key)]}></span>
            </TooltipWrapper>
          ))}
        </div>
      ),
    },
    {
      id: "bioLink",
      header: () => t("table.friendList.bioLink"),
      size: 130,
      enableSorting: false,
      meta: { label: () => t("table.friendList.bioLink") },
      cell: ({ row }) => (
        <div class="flex items-center">
          {(friendProfiles.value.get(row.original.id)?.bioLinks ?? []).filter(Boolean).map((link, index) => (
            <TooltipWrapper key={index} content={link}>
              <img
                src={getFaviconUrl(link)}
                class="h-4 w-4 mr-1 align-middle cursor-pointer"
                onClick={(event: MouseEvent) => {
                  event.stopPropagation();
                  openExternalLink(link);
                }}
                loading="lazy"
              />
            </TooltipWrapper>
          ))}
        </div>
      ),
    },
    {
      id: "joinCount",
      accessorFn: (row) => row.$joinCount,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.joinCount"),
        }),
      size: 120,
      sortFn: sortByNumber((row) => row.$joinCount),
      meta: {
        class: "text-right",
        label: () => t("table.friendList.joinCount"),
      },
    },
    {
      id: "timeTogether",
      accessorFn: (row) => row.$timeSpent,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.timeTogether"),
        }),
      size: 140,
      sortFn: sortByNumber((row) => row.$timeSpent),
      meta: {
        class: "text-right",
        label: () => t("table.friendList.timeTogether"),
      },
      cell: ({ row }) => {
        const time = row.original.$timeSpent;
        return time ? <span>{timeToText(time)}</span> : null;
      },
    },
    {
      id: "lastSeen",
      accessorFn: (row) => row.$lastSeen,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.lastSeen"),
        }),
      size: 170,
      meta: { label: () => t("table.friendList.lastSeen") },
      sortFn: sortByString((row) => row.$lastSeen),
      cell: ({ row }) => {
        const text = formatDateFilter(row.original.$lastSeen, "long");
        return <span>{text === "-" ? "" : text}</span>;
      },
    },
    {
      id: "mutualFriends",
      accessorFn: (row) => row.$mutualCount,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.mutualFriends"),
        }),
      size: 120,
      sortFn: sortByNumber((row) => row.$mutualCount),
      meta: {
        class: "text-right",
        label: () => t("table.friendList.mutualFriends"),
      },
      cell: ({ row }) => {
        const count = row.original.$mutualCount;
        const isOptedOut = row.original.$mutualOptedOut;
        if (!count && !isOptedOut) return null;
        return (
          <span class="inline-flex items-center gap-1">
            {count || null}
            {isOptedOut ? (
              <TooltipWrapper side="top" content={t("table.friendList.mutualOptedOut")}>
                <EyeOff class="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipWrapper>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "lastActivity",
      accessorFn: (row) => row.last_activity,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.lastActivity"),
        }),
      size: 200,
      meta: { label: () => t("table.friendList.lastActivity") },
      sortFn: sortByString((row) => row.last_activity),
      cell: ({ row }) => <span>{formatDateFilter(row.original.last_activity, "long")}</span>,
    },
    {
      id: "lastLogin",
      accessorFn: (row) => row.last_login,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.lastLogin"),
        }),
      size: 200,
      meta: { label: () => t("table.friendList.lastLogin") },
      sortFn: sortByString((row) => row.last_login),
      cell: ({ row }) => <span>{formatDateFilter(row.original.last_login, "long")}</span>,
    },
    {
      id: "dateJoined",
      accessorFn: (row) => row.date_joined,
      header: ({ column }) =>
        sortButton({
          column,
          label: () => t("table.friendList.dateJoined"),
        }),
      size: 120,
      meta: { label: () => t("table.friendList.dateJoined") },
      sortFn: sortByString((row) => row.date_joined),
      cell: ({ row }) => <span>{textOrEmpty(row.original.date_joined)}</span>,
    },
    {
      id: "unfriend",
      header: () => t("table.friendList.unfriend"),
      size: 100,
      enableSorting: false,
      meta: {
        class: "text-center",
        label: t("table.friendList.unfriend"),
      },
      cell: ({ row }) => (
        <UserMinus
          class="h-4 w-4 text-destructive inline-block"
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            onConfirmDeleteFriend(row.original.id);
          }}
        />
      ),
    }
  );

  return cols;
};
