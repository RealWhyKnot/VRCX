import { Image } from "lucide-vue-next";
import Avatar from "../../components/ui/avatar/Avatar.vue";
import AvatarFallback from "../../components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "../../components/ui/avatar/AvatarImage.vue";
import Emoji from "../../components/Emoji.vue";
import Location from "../../components/Location.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
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
});
