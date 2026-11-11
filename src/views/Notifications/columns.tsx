import Location from "../../components/Location.vue";
import Avatar from "../../components/ui/avatar/Avatar.vue";
import AvatarFallback from "../../components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "../../components/ui/avatar/AvatarImage.vue";
import Badge from "../../components/ui/badge/Badge.vue";
import Button from "../../components/ui/button/Button.vue";
import Tooltip from "../../components/ui/tooltip/Tooltip.vue";
import TooltipContent from "../../components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "../../components/ui/tooltip/TooltipTrigger.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { ArrowUpDown, Ban, BellOff, Check, Image, Link, MessageCircle, Reply, Tag, Trash2, X } from "lucide-vue-next";
import { storeToRefs } from "pinia";

import { formatDateFilter } from "../../coordinators/date-coordinator";
import { checkCanInvite } from "../../shared/utils/invite";
import { i18n } from "../../plugins/i18n";
import { useGameStore } from "../../stores/game";
import { useInstanceStore } from "../../stores/instance";
import { useLocationStore } from "../../stores/location";
import { useUiStore } from "../../stores/ui";
import { useUserStore } from "../../stores/user";
import { useNotificationStore } from "../../stores/notification";
import type { NotificationEntry, NotificationResponse } from "../../stores/notification/types";
import { showUserDialog } from "../../coordinators/user-coordinator";
import { showWorldDialog } from "../../coordinators/world-coordinator";
import { showGroupDialog } from "../../coordinators/group-dialog-coordinator";

import Emoji from "../../components/Emoji.vue";
import type { VrcxColumn } from "../FriendList/vrcx-column";

export type NotificationRow = NotificationEntry & {
  link?: string | undefined;
  linkText?: string | undefined;
  groupName?: string | undefined;
  worldName?: string | undefined;
  responses?: NotificationResponse[] | undefined;
};

type NotificationColumnHandlers = {
  getNotificationCreatedAt: (row: NotificationRow) => string;
  getNotificationCreatedAtTs: (row: NotificationRow) => number;
  openNotificationLink: (link: string | null | undefined) => void;
  showFullscreenImageDialog: (imageUrl: string) => void;
  getSmallThumbnailUrl: (url: string) => string;
  acceptFriendRequestNotification: (row: NotificationRow) => void;
  showSendInviteResponseDialog: (row: NotificationRow) => void;
  showSendInviteRequestResponseDialog: (row: NotificationRow) => void;
  acceptRequestInvite: (row: NotificationRow) => void;
  sendNotificationResponse: (notificationId: string, responses: NotificationResponse[], responseType: string) => void;
  hideNotification: (row: NotificationRow) => void;
  hideNotificationPrompt: (row: NotificationRow) => void;
  deleteNotificationLog: (row: NotificationRow) => void;
  deleteNotificationLogPrompt: (row: NotificationRow) => void;
};

const { t } = i18n.global;
const te = (key: string) => i18n.global.te(key);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textOf(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) {
    return undefined;
  }
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return undefined;
}

const isGroupId = (id: string | undefined) => typeof id === "string" && id.startsWith("grp_");

export const createColumns = ({
  getNotificationCreatedAt,
  getNotificationCreatedAtTs,
  openNotificationLink,
  showFullscreenImageDialog,
  getSmallThumbnailUrl,
  acceptFriendRequestNotification,
  showSendInviteResponseDialog,
  showSendInviteRequestResponseDialog,
  acceptRequestInvite,
  sendNotificationResponse,
  hideNotification,
  hideNotificationPrompt,
  deleteNotificationLog,
  deleteNotificationLogPrompt,
}: NotificationColumnHandlers): VrcxColumn<NotificationRow>[] => {
  const { showSendBoopDialog } = useUserStore();

  const { shiftHeld } = storeToRefs(useUiStore());
  const { currentUser } = storeToRefs(useUserStore());
  const { lastLocation } = storeToRefs(useLocationStore());
  const { isGameRunning } = storeToRefs(useGameStore());
  const { isNotificationExpired } = useNotificationStore();

  const { cachedInstances } = useInstanceStore();

  const canInvite = () => {
    const location = lastLocation.value.location;
    return (
      Boolean(location) &&
      isGameRunning.value &&
      checkCanInvite(location, {
        currentUserId: currentUser.value.id,
        lastLocationStr: lastLocation.value.location,
        cachedInstances: cachedInstances,
      })
    );
  };

  const getResponseIcon = (response: NotificationResponse, notificationType: string) => {
    if (response.type === "link") {
      return Link;
    }
    switch (response.icon ?? "") {
      case "check":
        return Check;
      case "cancel":
        return X;
      case "ban":
        return Ban;
      case "bell-slash":
        return BellOff;
      case "reply":
        return notificationType === "boop" ? MessageCircle : Reply;
      default:
        return Tag;
    }
  };

  return [
    {
      id: "spacer",
      header: () => null,
      enableSorting: false,
      size: 20,
      minSize: 0,
      maxSize: 20,
      cell: () => null,
    },
    {
      accessorFn: (row: NotificationRow) => getNotificationCreatedAtTs(row),
      id: "created_at",
      size: 120,
      meta: { label: () => t("table.notification.date") },
      header: ({ column }) => (
        <Button variant="ghost" class="pl-0!" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          {t("table.notification.date")}
          <ArrowUpDown class="ml-1 h-4 w-4" />
        </Button>
      ),
      sortFn: (rowA, rowB, columnId) => {
        const a = rowA.getValue<number | undefined>(columnId) ?? 0;
        const b = rowB.getValue<number | undefined>(columnId) ?? 0;
        if (a !== b) {
          return a - b;
        }

        const aId = typeof rowA.original.id === "string" ? rowA.original.id : "";
        const bId = typeof rowB.original.id === "string" ? rowB.original.id : "";
        return aId.localeCompare(bId);
      },
      cell: ({ row }) => {
        const createdAt = getNotificationCreatedAt(row.original);
        const shortText = formatDateFilter(createdAt, "short");
        const longText = formatDateFilter(createdAt, "long");

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{shortText}</span>
            </TooltipTrigger>
            <TooltipContent side="right">
              <span>{longText}</span>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "type",
      size: 180,
      header: () => t("table.notification.type"),
      meta: { label: () => t("table.notification.type") },
      cell: ({ row }) => {
        const original = row.original;
        const typeKey = `view.notification.filters.${original.type}`;
        const label = te(typeKey) ? t(typeKey) : original.type;

        if (original.type === "invite") {
          return (
            <Badge variant="outline" class="text-muted-foreground">
              {label}
            </Badge>
          );
        }

        if (original.type === "group.queueReady" || original.type === "instance.closed") {
          return (
            <Badge variant="outline" class="text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span class="cursor-pointer" onClick={() => showWorldDialog(original.location ?? "")}>
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {original.location ? (
                    <Location location={original.location} hint={original.worldName ?? ""} grouphint={original.groupName ?? ""} link={true} />
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </Badge>
          );
        }

        if (original.link) {
          return (
            <Badge variant="outline" class="text-muted-foreground">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span class="cursor-pointer" onClick={() => openNotificationLink(original.link)}>
                    {label}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span>{original.linkText}</span>
                </TooltipContent>
              </Tooltip>
            </Badge>
          );
        }

        return (
          <Badge variant="outline" class="text-muted-foreground">
            {label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "senderUsername",
      meta: {
        class: "overflow-hidden",
        label: () => t("table.notification.user"),
      },
      size: 150,
      header: () => t("table.notification.user"),
      cell: ({ row }) => {
        const original = row.original;
        if (original.senderUserId && !isGroupId(original.senderUserId)) {
          return (
            <span class="table-user-text block w-full min-w-0 truncate">
              <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => showUserDialog(original.senderUserId)}>
                {original.senderUsername}
              </span>
            </span>
          );
        }

        if (original.link?.startsWith("user:")) {
          return (
            <span class="table-user-text block w-full min-w-0 truncate">
              <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => openNotificationLink(original.link)}>
                {firstNonEmpty(original.linkText, original.senderUsername)}
              </span>
            </span>
          );
        }

        if (original.senderUsername && !isGroupId(original.senderUserId)) {
          return <span class="table-user-text block w-full min-w-0 truncate">{original.senderUsername}</span>;
        }

        return null;
      },
    },
    {
      accessorKey: "groupName",
      meta: {
        class: "overflow-hidden",
        label: () => t("table.notification.group"),
      },
      size: 150,
      header: () => t("table.notification.group"),
      cell: ({ row }) => {
        const original = row.original;
        const dataGroupName = textOf(original.data, "groupName");
        const detailsGroupName = textOf(original.details, "groupName");
        const label = firstNonEmpty(original.senderUsername, original.groupName, dataGroupName, detailsGroupName, original.linkText);

        if (original.senderUserId && (original.type === "groupChange" || isGroupId(original.senderUserId))) {
          return (
            <span class="table-user-text block w-full min-w-0 truncate">
              <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => showGroupDialog(original.senderUserId ?? "")}>
                {label}
              </span>
            </span>
          );
        }

        if (original.type === "groupChange" && original.senderUsername) {
          return <span class="table-user-text block w-full min-w-0 truncate">{original.senderUsername}</span>;
        }

        if (original.link?.startsWith("group:")) {
          return (
            <span class="table-user-text block w-full min-w-0 truncate">
              <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => openNotificationLink(original.link)}>
                {firstNonEmpty(dataGroupName, label)}
              </span>
            </span>
          );
        }

        if (original.link?.startsWith("event:")) {
          return (
            <span class="table-user-text block w-full min-w-0 truncate">
              <span class="cursor-pointer block w-full min-w-0 truncate" onClick={() => openNotificationLink(original.link)}>
                {firstNonEmpty(dataGroupName, original.groupName, label)}
              </span>
            </span>
          );
        }

        if (dataGroupName) {
          return <span class="table-user-text block w-full min-w-0 truncate">{dataGroupName}</span>;
        }

        if (detailsGroupName) {
          return <span class="table-user-text block w-full min-w-0 truncate">{detailsGroupName}</span>;
        }

        if (original.groupName) {
          return <span class="table-user-text block w-full min-w-0 truncate">{original.groupName}</span>;
        }

        return null;
      },
    },
    {
      accessorKey: "photo",
      size: 80,
      header: () => t("table.notification.photo"),
      meta: { label: () => t("table.notification.photo") },
      cell: ({ row }) => {
        const original = row.original;
        const detailsImageUrl = textOf(original.details, "imageUrl");
        if (original.type === "boop") {
          const imageUrl = firstNonEmpty(detailsImageUrl, original.imageUrl);
          if (!imageUrl || imageUrl.startsWith("default_")) {
            return null;
          }
          return (
            <Emoji class="cursor-pointer h-7.5 w-7.5 rounded object-cover" onClick={() => showFullscreenImageDialog(imageUrl)} imageUrl={imageUrl} size={30} />
          );
        }

        if (detailsImageUrl) {
          const detailsUrl = getSmallThumbnailUrl(detailsImageUrl);
          return (
            <Avatar class="cursor-pointer size-7.5 rounded" onClick={() => showFullscreenImageDialog(detailsImageUrl)}>
              <AvatarImage src={detailsUrl} class="object-cover" />
              <AvatarFallback class="rounded">
                <Image class="size-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          );
        }

        if (original.imageUrl) {
          const imgUrl = getSmallThumbnailUrl(original.imageUrl);
          return (
            <Avatar class="cursor-pointer size-7.5 rounded" onClick={() => showFullscreenImageDialog(original.imageUrl ?? "")}>
              <AvatarImage src={imgUrl} class="object-cover" />
              <AvatarFallback class="rounded">
                <Image class="size-4 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
          );
        }

        return null;
      },
    },
    {
      id: "message",
      header: () => t("table.notification.message"),
      enableSorting: false,
      meta: {
        class: "min-w-0 overflow-hidden",
        stretch: true,
        label: () => t("table.notification.message"),
      },
      minSize: 100,
      cell: ({ row }) => {
        const original = row.original;
        const { message, title } = original;
        const detailsWorldName = textOf(original.details, "worldName");
        const detailsInviteMessage = textOf(original.details, "inviteMessage");
        const detailsRequestMessage = textOf(original.details, "requestMessage");
        const detailsResponseMessage = textOf(original.details, "responseMessage");
        return (
          <div class="w-full min-w-0">
            {original.type === "invite" && original.details ? (
              <div class="w-full min-w-0">
                <Location
                  location={textOf(original.details, "worldId") ?? ""}
                  hint={detailsWorldName ?? ""}
                  grouphint={textOf(original.details, "groupName") ?? ""}
                  link
                />
              </div>
            ) : null}
            {message && title ? (
              <TooltipWrapper content={`${title}, ${message}`} delayDuration={500}>
                <span class="block w-full min-w-0 truncate">{`${title}, ${message}`}</span>
              </TooltipWrapper>
            ) : null}
            {!message && title ? (
              <TooltipWrapper content={title} delayDuration={500}>
                <span class="block w-full min-w-0 truncate">{title}</span>
              </TooltipWrapper>
            ) : null}
            {message && !title && message !== `This is a generated invite to ${detailsWorldName}` ? (
              <TooltipWrapper content={message} delayDuration={500}>
                <span class="block w-full min-w-0 truncate">{message}</span>
              </TooltipWrapper>
            ) : null}
            {!message && detailsInviteMessage ? (
              <TooltipWrapper content={detailsInviteMessage} delayDuration={500}>
                <span class="block w-full min-w-0 truncate">{detailsInviteMessage}</span>
              </TooltipWrapper>
            ) : null}
            {!message && detailsRequestMessage ? (
              <TooltipWrapper content={detailsRequestMessage} delayDuration={500}>
                <span class="block w-full min-w-0 truncate">{detailsRequestMessage}</span>
              </TooltipWrapper>
            ) : null}
            {!message && detailsResponseMessage ? (
              <TooltipWrapper content={detailsResponseMessage} delayDuration={500}>
                <span class="block w-full min-w-0 truncate">{detailsResponseMessage}</span>
              </TooltipWrapper>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "action",
      meta: {
        class: "text-right",
        label: () => t("table.notification.action"),
      },
      size: 120,
      minSize: 120,
      maxSize: 120,
      header: () => t("table.notification.action"),
      enableSorting: false,
      cell: ({ row }) => {
        const original = row.original;
        const notificationId = original.id;
        const responses: NotificationResponse[] = Array.isArray(original.responses) && notificationId !== undefined ? original.responses : [];
        const canShowDecline =
          original.type !== "requestInviteResponse" &&
          original.type !== "inviteResponse" &&
          original.type !== "message" &&
          original.type !== "boop" &&
          original.type !== "groupChange" &&
          !original.type.includes("group.") &&
          !original.type.includes("moderation.") &&
          !original.type.includes("instance.") &&
          !original.link?.startsWith("economy.");
        const canShowDeleteLog = original.type !== "friendRequest" && original.type !== "ignoredFriendRequest";

        return (
          <div class="flex items-center justify-end gap-2">
            {original.senderUserId !== currentUser.value.id && !isNotificationExpired(original) ? (
              <span class="inline-flex items-center gap-2">
                {original.type === "friendRequest" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={t("view.notification.actions.accept")}
                        onClick={() => acceptFriendRequestNotification(original)}
                      >
                        <Check class="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>{t("view.notification.actions.accept")}</span>
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {original.type === "invite" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={t("view.notification.actions.decline_with_message")}
                        onClick={() => showSendInviteResponseDialog(original)}
                      >
                        <MessageCircle class="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>{t("view.notification.actions.decline_with_message")}</span>
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {original.type === "requestInvite" ? (
                  <span class="inline-flex items-center">
                    {canInvite() ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                            aria-label={t("view.notification.actions.invite")}
                            onClick={() => acceptRequestInvite(original)}
                          >
                            <Check class="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <span>{t("view.notification.actions.invite")}</span>
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={t("view.notification.actions.decline_with_message")}
                          onClick={() => showSendInviteRequestResponseDialog(original)}
                        >
                          <MessageCircle class="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span>{t("view.notification.actions.decline_with_message")}</span>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                ) : null}

                {responses.map((response) => {
                  const onClick = () => {
                    if (response.type === "link") {
                      openNotificationLink(response.data);
                      return;
                    }
                    if (response.icon === "reply" && original.type === "boop") {
                      showSendBoopDialog(original.senderUserId ?? "");
                      return;
                    }
                    if (notificationId === undefined) return;
                    sendNotificationResponse(notificationId, responses, response.type);
                  };

                  const ResponseIcon = getResponseIcon(response, original.type);

                  return (
                    <Tooltip key={`${response.text ?? ""}:${response.type}`}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label={response.text}
                          onClick={onClick}
                        >
                          <ResponseIcon class="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <span>{response.text}</span>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}

                {canShowDecline ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={t("view.notification.actions.decline")}
                        onClick={() => (shiftHeld.value ? hideNotification(original) : hideNotificationPrompt(original))}
                      >
                        <X class={shiftHeld.value ? "h-4 w-4 text-red-600" : "h-4 w-4"} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <span>{t("view.notification.actions.decline")}</span>
                    </TooltipContent>
                  </Tooltip>
                ) : null}

                {original.type === "group.queueReady" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label={t("view.notification.actions.delete_log")}
                        onClick={() => (shiftHeld.value ? deleteNotificationLog(original) : deleteNotificationLogPrompt(original))}
                      >
                        {shiftHeld.value ? <X class="h-4 w-4 text-red-600" /> : <Trash2 class="h-4 w-4" />}
                      </button>
                    </TooltipTrigger>
                  </Tooltip>
                ) : null}
              </span>
            ) : null}
            {canShowDeleteLog ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    class="inline-flex h-6 ml-1 items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={t("view.notification.actions.delete_log")}
                    onClick={() => (shiftHeld.value ? deleteNotificationLog(original) : deleteNotificationLogPrompt(original))}
                  >
                    {shiftHeld.value ? <X class="h-4 w-4 text-red-600" /> : <Trash2 class="h-4 w-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <span>{t("view.notification.actions.delete_log")}</span>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "trailing",
      header: () => null,
      enableSorting: false,
      enableResizing: false,
      size: 5,
      cell: () => null,
    },
  ];
};
