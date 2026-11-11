import { Ban, BellOff, Check, Link, MessageCircle, Reply, Tag, Trash2, X } from "lucide-vue-next";
import Tooltip from "../../components/ui/tooltip/Tooltip.vue";
import TooltipContent from "../../components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "../../components/ui/tooltip/TooltipTrigger.vue";
import type { NotificationResponse } from "../../stores/notification/types";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { t } from "./notification-column-helpers";
import type { NotificationColumnDeps, NotificationRow } from "./notification-column-types";

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

export const createActionColumn = ({
  currentUser,
  shiftHeld,
  canInvite,
  isNotificationExpired,
  showSendBoopDialog,
  openNotificationLink,
  acceptFriendRequestNotification,
  showSendInviteResponseDialog,
  showSendInviteRequestResponseDialog,
  acceptRequestInvite,
  sendNotificationResponse,
  hideNotification,
  hideNotificationPrompt,
  deleteNotificationLog,
  deleteNotificationLogPrompt,
}: NotificationColumnDeps): VrcxColumn<NotificationRow> => ({
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
});
