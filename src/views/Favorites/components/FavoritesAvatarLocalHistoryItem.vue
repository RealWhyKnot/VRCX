<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <Item variant="outline" class="favorites-item cursor-pointer hover:bg-muted x-hover-list" :style="itemStyle" @click="handleViewDetails">
        <ItemMedia variant="image">
          <Avatar class="rounded-sm size-full">
            <AvatarImage v-if="smallThumbnail" :src="smallThumbnail" loading="lazy" decoding="async" fetchpriority="low" class="rounded-sm object-cover" />
            <AvatarFallback class="rounded-sm">
              <Image class="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle class="truncate max-w-full">{{ favorite.name }}</ItemTitle>
          <ItemDescription class="truncate line-clamp-1 text-xs">
            {{ favorite.authorName }}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button size="icon-sm" variant="ghost" class="rounded-full" @click.stop>
                <MoreHorizontal class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="handleViewDetails">
                {{ t("common.actions.view_details") }}
              </DropdownMenuItem>
              <DropdownMenuItem :disabled="currentUser.currentAvatar === favorite.id" @click="selectAvatarWithConfirmation(favorite.id)">
                {{ t("view.favorite.select_avatar_tooltip") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="showFavoriteDialog('avatar', favorite.id)">
                {{ t("view.favorite.edit_favorite_tooltip") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <ContextMenuItem @click="handleViewDetails">{{ t("common.actions.view_details") }}</ContextMenuItem>
      <ContextMenuItem :disabled="currentUser.currentAvatar === favorite.id" @click="selectAvatarWithConfirmation(favorite.id)">
        {{ t("view.favorite.select_avatar_tooltip") }}
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem @click="showFavoriteDialog('avatar', favorite.id)">
        {{ t("view.favorite.edit_favorite_tooltip") }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { Image, MoreHorizontal } from "lucide-vue-next";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import Button from "@/components/ui/button/Button.vue";
import ContextMenu from "@/components/ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "@/components/ui/context-menu/ContextMenuContent.vue";
import ContextMenuItem from "@/components/ui/context-menu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/components/ui/context-menu/ContextMenuSeparator.vue";
import ContextMenuTrigger from "@/components/ui/context-menu/ContextMenuTrigger.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemActions from "@/components/ui/item/ItemActions.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../../stores/favorite";
import { useUserStore } from "../../../stores/user";
import { selectAvatarWithConfirmation, showAvatarDialog } from "../../../coordinators/avatar-coordinator";

const { t } = useI18n();

const { showFavoriteDialog } = useFavoriteStore();
const { currentUser } = storeToRefs(useUserStore());

const props = defineProps({
  favorite: {
    type: Object,
    required: true,
  },
});

const itemStyle = computed(() => ({
  padding: "var(--favorites-card-padding-y, 8px) var(--favorites-card-padding-x, 10px)",
  gap: "var(--favorites-card-content-gap, 10px)",
  minWidth: "var(--favorites-card-min-width, 220px)",
  maxWidth: "var(--favorites-card-target-width, 220px)",
  width: "100%",
  fontSize: "calc(0.875rem * var(--favorites-card-scale, 1))",
}));

const smallThumbnail = computed(() => {
  if (!props.favorite.thumbnailImageUrl) {
    return "";
  }
  return props.favorite.thumbnailImageUrl.replace("256", "128");
});

function handleViewDetails() {
  showAvatarDialog(props.favorite.id);
}
</script>

<style scoped>
.favorites-item :deep(img) {
  filter: saturate(0.8) contrast(0.8);
  transition: filter 0.2s ease;
}

.favorites-item:hover :deep(img) {
  filter: saturate(1) contrast(1);
}
</style>
