<template>
  <Dialog v-model:open="isVisible">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.favorite.header") }}</DialogTitle>
      </DialogHeader>
      <div>
        <span style="display: block; text-align: center">{{ t("dialog.favorite.vrchat_favorites") }}</span>
        <template v-if="favoriteDialog.currentGroup && favoriteDialog.currentGroup.key">
          <Button variant="outline" style="width: 100%; white-space: initial" class="my-1" @click="deleteFavoriteNoConfirm(favoriteDialog.objectId)">
            <Check />{{ favoriteDialog.currentGroup.displayName }} ({{ favoriteDialog.currentGroup.count }} / {{ favoriteDialog.currentGroup.capacity }})
          </Button>
        </template>
        <template v-else>
          <Button v-for="group in groups" :key="group.key" variant="outline" style="width: 100%; white-space: initial" class="my-1" @click="addFavorite(group)">
            {{ group.displayName }} ({{ group.count }} / {{ group.capacity }})
          </Button>
        </template>
      </div>
      <div v-if="favoriteDialog.type === 'friend'" style="margin-top: 20px">
        <span style="display: block; text-align: center">{{ t("dialog.favorite.local_favorites") }}</span>
        <template v-for="group in localFriendFavoriteGroups" :key="group">
          <Button
            v-if="hasLocalFriendFavorite(favoriteDialog.objectId, group)"
            variant="outline"
            style="width: 100%; white-space: initial"
            class="my-1"
            @click="removeLocalFriendFavorite(favoriteDialog.objectId, group)"
          >
            <Check />{{ group }} ({{ localFriendFavGroupLength(group) }})
          </Button>
          <Button
            v-else
            variant="outline"
            style="width: 100%; white-space: initial"
            class="my-1"
            @click="addLocalFriendFavorite(favoriteDialog.objectId, group)"
          >
            {{ group }} ({{ localFriendFavGroupLength(group) }})
          </Button>
        </template>
      </div>
      <div v-if="favoriteDialog.type === 'world'" style="margin-top: 20px">
        <span style="display: block; text-align: center">{{ t("dialog.favorite.local_favorites") }}</span>
        <template v-for="group in localWorldFavoriteGroups" :key="group">
          <Button
            v-if="hasLocalWorldFavorite(favoriteDialog.objectId, group)"
            variant="outline"
            style="width: 100%; white-space: initial"
            class="my-1"
            @click="removeLocalWorldFavorite(favoriteDialog.objectId, group)"
          >
            <Check />{{ group }} ({{ localWorldFavGroupLength(group) }})
          </Button>
          <Button
            v-else
            variant="outline"
            style="width: 100%; white-space: initial"
            class="my-1"
            @click="addLocalWorldFavorite(favoriteDialog.objectId, group)"
          >
            {{ group }} ({{ localWorldFavGroupLength(group) }})
          </Button>
        </template>
      </div>
      <div v-if="favoriteDialog.type === 'avatar'" style="margin-top: 20px">
        <span style="display: block; text-align: center">{{ t("dialog.favorite.local_avatar_favorites") }}</span>
        <template v-for="group in localAvatarFavoriteGroups" :key="group">
          <Button
            v-if="hasLocalAvatarFavorite(favoriteDialog.objectId, group)"
            variant="outline"
            style="width: 100%; white-space: initial"
            class="my-1"
            @click="removeLocalAvatarFavorite(favoriteDialog.objectId, group)"
          >
            <Check />{{ group }} ({{ localAvatarFavGroupLength(group) }})
          </Button>
          <Button
            v-else
            variant="outline"
            style="width: 100%; white-space: initial"
            class="my-1"
            :disabled="!isLocalUserVrcPlusSupporter"
            @click="addLocalAvatarFavorite(favoriteDialog.objectId, group)"
          >
            {{ group }} ({{ localAvatarFavGroupLength(group) }})
          </Button>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import { Check } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "../../stores/favorite";
import { useUserStore } from "../../stores/user";
import {
  addLocalWorldFavorite,
  removeLocalWorldFavorite,
  addLocalAvatarFavorite,
  removeLocalAvatarFavorite,
  addLocalFriendFavorite,
  removeLocalFriendFavorite,
} from "../../coordinators/favorite-coordinator";
import { favoriteRequest } from "../../api/favorite";

const { t } = useI18n();

const favoriteStore = useFavoriteStore();
const {
  favoriteFriendGroups,
  favoriteAvatarGroups,
  favoriteWorldGroups,
  favoriteDialog,
  localWorldFavoriteGroups,
  localAvatarFavoriteGroups,
  localFriendFavoriteGroups,
} = storeToRefs(favoriteStore);
const {
  localWorldFavGroupLength,
  hasLocalWorldFavorite,
  hasLocalAvatarFavorite,
  localAvatarFavGroupLength,
  deleteFavoriteNoConfirm,
  localFriendFavGroupLength,
  hasLocalFriendFavorite,
} = favoriteStore;
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());

const groups = ref([]);
const loading = ref(false);

const isVisible = computed({
  get: () => favoriteDialog.value.visible,
  set: (v) => {
    favoriteDialog.value.visible = v;
  },
});

watch(
  () => favoriteDialog.value.visible,
  (value) => {
    if (value) {
      initFavoriteDialog();
    }
  }
);

function initFavoriteDialog() {
  if (favoriteDialog.value.type === "friend") {
    groups.value = favoriteFriendGroups.value;
  } else if (favoriteDialog.value.type === "world") {
    groups.value = favoriteWorldGroups.value;
  } else if (favoriteDialog.value.type === "avatar") {
    groups.value = favoriteAvatarGroups.value;
  }
}

function addFavorite(group) {
  const D = favoriteDialog.value;
  loading.value = true;
  favoriteRequest
    .addFavorite({
      type: group.type,
      favoriteId: D.objectId,
      tags: group.name,
    })
    .then(() => {
      isVisible.value = false;
      toast.success("Favorite added!");
    })
    .finally(() => {
      loading.value = false;
    });
}
</script>
