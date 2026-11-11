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
          <ItemTitle class="truncate max-w-full">
            {{ displayName }}
            <AlertTriangle v-if="showUnavailable" :title="t('view.favorite.unavailable_tooltip')" class="h-4 w-4" />
            <Lock v-if="isPrivateWorld" :title="t('view.favorite.private')" class="h-4 w-4" />
          </ItemTitle>
          <ItemDescription class="truncate line-clamp-1 text-xs">
            {{ authorText }}
          </ItemDescription>
        </ItemContent>
        <ItemActions v-if="editMode && !isLocalFavorite" @click.stop>
          <Checkbox v-model="isSelected" />
        </ItemActions>
        <DropdownMenu v-else-if="!editMode">
          <DropdownMenuTrigger as-child>
            <Button size="icon-sm" variant="ghost" class="rounded-full" :aria-label="t('nav_tooltip.manage')" @click.stop>
              <MoreHorizontal class="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <WorldActionMenuItems
              variant="dropdown"
              :can-open-instance-in-game="canOpenInstanceInGame"
              @view-details="handleViewDetails"
              @new-instance="handleNewInstance"
              @self-invite="handleSelfInvite"
            >
              <template #append>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click="showFavoriteDialog('world', favorite.id)">
                  {{ t("view.favorite.edit_favorite_tooltip") }}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" @click="handleDeleteFavorite">
                  {{ deleteMenuLabel }}
                </DropdownMenuItem>
              </template>
            </WorldActionMenuItems>
          </DropdownMenuContent>
        </DropdownMenu>
      </Item>
    </ContextMenuTrigger>
    <ContextMenuContent>
      <WorldActionMenuItems
        :can-open-instance-in-game="canOpenInstanceInGame"
        @view-details="handleViewDetails"
        @new-instance="handleNewInstance"
        @self-invite="handleSelfInvite"
      >
        <template #append>
          <ContextMenuSeparator />
          <ContextMenuItem @click="showFavoriteDialog('world', favorite.id)">
            {{ t("view.favorite.edit_favorite_tooltip") }}
          </ContextMenuItem>
          <ContextMenuItem variant="destructive" @click="handleDeleteFavorite">
            {{ deleteMenuLabel }}
          </ContextMenuItem>
        </template>
      </WorldActionMenuItems>
    </ContextMenuContent>
  </ContextMenu>
  <NewInstanceDialog :new-instance-dialog-location-tag="newInstanceDialogLocationTag" :last-location="lastLocation" />
</template>

<script setup>
import { AlertTriangle, Image, Lock, MoreHorizontal } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
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
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemActions from "@/components/ui/item/ItemActions.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";

import { favoriteRequest } from "../../../api/favorite";
import WorldActionMenuItems from "../../../components/WorldActionMenuItems.vue";
import { removeLocalWorldFavorite } from "../../../coordinators/favorite-coordinator";
import { runNewInstanceSelfInviteFlow as newInstanceSelfInvite } from "../../../coordinators/invite-coordinator";
import { showWorldDialog } from "../../../coordinators/world-coordinator";
import { useFavoriteStore } from "../../../stores/favorite";
import { useInviteStore } from "../../../stores/invite";
import { useLocationStore } from "../../../stores/location";
import NewInstanceDialog from "../../../components/dialogs/NewInstanceDialog/NewInstanceDialog.vue";

const props = defineProps({
  group: [Object, String],
  favorite: Object,
  isLocalFavorite: { type: Boolean, default: false },
  editMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
});

const emit = defineEmits(["toggle-select"]);
const { showFavoriteDialog } = useFavoriteStore();
const { lastLocation } = storeToRefs(useLocationStore());

const { t } = useI18n();
const { canOpenInstanceInGame } = useInviteStore();

const newInstanceDialogLocationTag = ref("");

const isSelected = computed({
  get: () => props.selected,
  set: (value) => emit("toggle-select", value),
});

const localFavRef = computed(() => (props.isLocalFavorite ? props.favorite : props.favorite?.ref));

const displayName = computed(() => localFavRef.value?.name || props.favorite?.name || props.favorite?.id);

const showUnavailable = computed(() => !props.isLocalFavorite && props.favorite?.deleted);

const isPrivateWorld = computed(() => localFavRef.value?.releaseStatus === "private");

const authorText = computed(() => {
  const author = localFavRef.value?.authorName || "";
  const occupants = localFavRef.value?.occupants;
  return occupants ? `${author} (${occupants})` : author;
});

const smallThumbnail = computed(() => {
  const url = localFavRef.value?.thumbnailImageUrl?.replace("256", "128");
  return url || localFavRef.value?.thumbnailImageUrl;
});

const deleteMenuLabel = computed(() => (props.isLocalFavorite ? t("view.favorite.delete_tooltip") : t("view.favorite.unfavorite_tooltip")));

const itemStyle = computed(() => ({
  padding: "var(--favorites-card-padding-y, 8px) var(--favorites-card-padding-x, 10px)",
  gap: "var(--favorites-card-content-gap, 10px)",
  minWidth: "var(--favorites-card-min-width, 220px)",
  maxWidth: "var(--favorites-card-target-width, 220px)",
  width: "100%",
  fontSize: "calc(0.875rem * var(--favorites-card-scale, 1))",
}));

function handleViewDetails() {
  showWorldDialog(props.favorite.id);
}

function handleNewInstance() {
  newInstanceDialogLocationTag.value = "";
  nextTick(() => (newInstanceDialogLocationTag.value = props.favorite.id));
}

function handleSelfInvite() {
  newInstanceSelfInvite(props.favorite.id);
}

function handleDeleteFavorite() {
  if (props.isLocalFavorite) {
    removeLocalWorldFavorite(props.favorite.id, props.group);
    return;
  }
  favoriteRequest.deleteFavorite({ objectId: props.favorite.id });
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
