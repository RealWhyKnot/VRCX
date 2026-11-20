import { Image } from "lucide-vue-next";
import Avatar from "../../components/ui/avatar/Avatar.vue";
import AvatarFallback from "../../components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "../../components/ui/avatar/AvatarImage.vue";
import Emoji from "../../components/Emoji.vue";
import Location from "../../components/Location.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { getNotificationMessage, hasNamedNotification } from "@/shared/utils/notification-message";
import { useUserStore } from "@/stores/user";
import { isInviteReply } from "../../stores/notification/invite-reply-history";
import type { VrcxColumn } from "../FriendList/vrcx-column";
import { firstNonEmpty, t, textOf } from "./notification-column-helpers";
import type { NotificationColumnDeps, NotificationRow } from "./notification-column-types";

export const createPhotoColumn = ({ showFullscreenImageDialog, getSmallThumbnailUrl }: NotificationColumnDeps): VrcxColumn<NotificationRow> => ({
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
});

const messageTooltipClass =
  "max-w-[min(30rem,calc(100vw-1rem))] max-h-[min(20rem,calc(var(--reka-tooltip-content-available-height)-0.5rem))] overflow-auto wrap-anywhere";

export const createMessageColumn = (): VrcxColumn<NotificationRow> => ({
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
    const { title } = original;
    const message =
      original.type !== "group.invite" && hasNamedNotification(original.type)
        ? getNotificationMessage(original, undefined, undefined, (id) => useUserStore().cachedUsers.get(id)?.displayName)?.body
        : original.message;
    const detailsWorldName = textOf(original.details, "worldName");
    const detailsInviteMessage = textOf(original.details, "inviteMessage");
    const detailsRequestMessage = textOf(original.details, "requestMessage");
    const friendRequestOutcome = original.$friendRequestOutcome;
    const responseMessage = textOf(original.details, "responseMessage");
    const inviteReply = original.type === "requestInvite" && isInviteReply(responseMessage) ? responseMessage : undefined;
    const detailsResponseMessage = friendRequestOutcome === undefined && inviteReply === undefined ? responseMessage : undefined;
    return (
      <div class="w-full min-w-0">
        {friendRequestOutcome ? (
          <span class="block w-full min-w-0 truncate text-muted-foreground">{t(`view.notification.friend_request_outcome.${friendRequestOutcome}`)}</span>
        ) : null}
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
          <TooltipWrapper content={`${title}, ${message}`} align="end" contentClass={messageTooltipClass} delayDuration={500}>
            <span class="block w-full min-w-0 truncate">{`${title}, ${message}`}</span>
          </TooltipWrapper>
        ) : null}
        {!message && title ? (
          <TooltipWrapper content={title} align="end" contentClass={messageTooltipClass} delayDuration={500}>
            <span class="block w-full min-w-0 truncate">{title}</span>
          </TooltipWrapper>
        ) : null}
        {message && !title && message !== `This is a generated invite to ${detailsWorldName}` ? (
          <TooltipWrapper content={message} align="end" contentClass={messageTooltipClass} delayDuration={500}>
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
        {inviteReply ? (
          <div class="flex w-full min-w-0 items-center gap-1">
            <span class="shrink-0 text-muted-foreground">{t(`view.notification.invite_reply.${inviteReply}`)}</span>
            <div class="min-w-0">
              <Location location={textOf(original.details, "worldId") ?? ""} hint={detailsWorldName ?? ""} link />
            </div>
          </div>
        ) : null}
        {!message && detailsResponseMessage ? (
          <TooltipWrapper content={detailsResponseMessage} delayDuration={500}>
            <span class="block w-full min-w-0 truncate">{detailsResponseMessage}</span>
          </TooltipWrapper>
        ) : null}
      </div>
    );
  },
});
