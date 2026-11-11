<template>
  <div class="col-start-2 row-start-1 row-span-2 grid grid-cols-2 flex-none items-center justify-end gap-2 self-start">
    <TooltipWrapper v-if="avatarDialog.isFavorite" side="top" :content="t('dialog.avatar.actions.favorite_tooltip')">
      <Button class="rounded-lg" size="icon" :aria-label="t('dialog.avatar.actions.favorite_tooltip')" @click="$emit('command', 'Add Favorite')"
        ><Star
      /></Button>
    </TooltipWrapper>
    <TooltipWrapper v-else side="top" :content="t('dialog.avatar.actions.favorite_tooltip')">
      <Button
        class="rounded-lg"
        size="icon"
        variant="outline"
        :aria-label="t('dialog.avatar.actions.favorite_tooltip')"
        @click="$emit('command', 'Add Favorite')"
        ><Star
      /></Button>
    </TooltipWrapper>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button class="rounded-lg" :variant="avatarDialog.isBlocked ? 'destructive' : 'outline'" size="icon" :aria-label="t('nav_tooltip.manage')">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem @click="$emit('command', 'Refresh')">
          <RefreshCw class="size-4" />
          {{ t("dialog.avatar.actions.refresh") }}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger @click="$emit('command', 'Share')">
            <Share2 class="size-4 mr-2" />
            <span>{{ t("dialog.avatar.actions.share") }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent side="right" align="start" class="w-56">
            <DropdownMenuItem @click="$emit('command', 'Share')">
              <Copy class="size-4" />
              {{ t("dialog.avatar.info.copy_url") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="$emit('command', 'Copy Avatar Name')">
              <Copy class="size-4" />
              {{ t("dialog.avatar.info.copy_name") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="$emit('command', 'Copy Avatar ID')">
              <Copy class="size-4" />
              {{ t("dialog.avatar.info.copy_id") }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem v-if="avatarDialog.isBlocked" variant="destructive" @click="$emit('command', 'Unblock Avatar')">
          <CheckCircle class="size-4" />
          {{ t("dialog.avatar.actions.unblock") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-else @click="$emit('command', 'Block Avatar')">
          <XCircle class="size-4" />
          {{ t("dialog.avatar.actions.block") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="/quest/.test((avatarDialog.ref.tags ?? []).join(','))" @click="$emit('command', 'Select Fallback Avatar')">
          <Check class="size-4" />
          {{ t("dialog.avatar.actions.select_fallback") }}
        </DropdownMenuItem>
        <template v-if="avatarDialog.ref.authorId === currentUser.id">
          <DropdownMenuSeparator />
          <DropdownMenuItem v-if="avatarDialog.ref.releaseStatus === 'public'" @click="$emit('command', 'Make Private')">
            <User class="size-4" />
            {{ t("dialog.avatar.actions.make_private") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else @click="$emit('command', 'Make Public')">
            <User class="size-4" />
            {{ t("dialog.avatar.actions.make_public") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('command', 'Rename')">
            <Pencil class="size-4" />
            {{ t("dialog.avatar.actions.rename") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('command', 'Change Description')">
            <Pencil class="size-4" />
            {{ t("dialog.avatar.actions.change_description") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('command', 'Change Content Tags')">
            <Pencil class="size-4" />
            {{ t("dialog.avatar.actions.change_content_tags") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('command', 'Change Styles and Author Tags')">
            <Pencil class="size-4" />
            {{ t("dialog.avatar.actions.change_styles_author_tags") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="$emit('command', 'Change Image')">
            <Image class="size-4" />
            {{ t("dialog.avatar.actions.change_image") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="avatarDialog.ref.unityPackageUrl" @click="$emit('command', 'Download Unity Package')">
            <Download class="size-4" />
            {{ t("dialog.avatar.actions.download_package") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem v-if="avatarDialog.hasImposter" variant="destructive" @click="$emit('command', 'Regenerate Imposter')">
            <RefreshCw class="size-4" />
            {{ t("dialog.avatar.actions.regenerate_impostor") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="avatarDialog.hasImposter" variant="destructive" @click="$emit('command', 'Delete Imposter')">
            <Trash2 class="size-4" />
            {{ t("dialog.avatar.actions.delete_impostor") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else @click="$emit('command', 'Create Imposter')">
            <User class="size-4" />
            {{ t("dialog.avatar.actions.create_impostor") }}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @click="$emit('command', 'Delete')">
            <Trash2 class="size-4" />
            {{ t("dialog.avatar.actions.delete") }}
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
    <TooltipWrapper v-if="avatarDialog.inCache" class="col-start-1 row-start-2" side="top" :content="t('dialog.avatar.actions.delete_cache_tooltip')">
      <Button
        class="rounded-lg"
        size="icon"
        variant="outline"
        :disabled="isGameRunning && avatarDialog.cacheLocked"
        :aria-label="t('dialog.avatar.actions.delete_cache_tooltip')"
        @click="deleteVRChatCache({ unityPackages: avatarDialog.ref.unityPackages ?? [] })"
        ><Trash2
      /></Button>
    </TooltipWrapper>
    <TooltipWrapper class="col-start-2 row-start-2" side="top" :content="t('dialog.avatar.actions.select')">
      <Button
        class="rounded-lg"
        size="icon"
        variant="outline"
        :disabled="currentUser.currentAvatar === avatarDialog.id"
        :aria-label="t('dialog.avatar.actions.select')"
        @click="selectAvatarWithoutConfirmation(avatarDialog.id)"
      >
        <CheckCircle
      /></Button>
    </TooltipWrapper>
  </div>
</template>

<script setup lang="ts">
import { Check, CheckCircle, Copy, Download, Ellipsis, Image, Pencil, RefreshCw, Share2, Star, Trash2, User, XCircle } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import DropdownMenu from "../../ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "../../ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "../../ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuSub from "../../ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuTrigger from "../../ui/dropdown-menu/DropdownMenuTrigger.vue";
import { useAvatarStore } from "../../../stores/avatar";
import { useGameStore } from "../../../stores/game";
import { useUserStore } from "../../../stores/user";
import { runDeleteVRChatCacheFlow as deleteVRChatCache } from "../../../coordinators/game-coordinator";
import { selectAvatarWithoutConfirmation } from "../../../coordinators/avatar-coordinator";

defineEmits<{ command: [command: string] }>();

const { avatarDialog } = storeToRefs(useAvatarStore());
const { currentUser } = storeToRefs(useUserStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { t } = useI18n();
</script>
