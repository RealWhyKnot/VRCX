<template>
  <div class="flex flex-none items-center">
    <template v-if="(currentUser.id !== userDialog.ref.id && userDialog.isFriend) || userDialog.isFavorite">
      <TooltipWrapper v-if="userDialog.isFavorite" side="top" :content="t('dialog.user.actions.favorites_tooltip')">
        <Button
          class="rounded-lg border-muted-foreground/30! text-[var(--favorite-text,var(--primary-foreground))] bg-[var(--favorite-bg,var(--primary))] hover:bg-[var(--favorite-bg,var(--primary))]"
          :style="{
            '--favorite-text': userDialog.theme.buttonColor === 'var(--primary)' ? 'var(--background)' : invertHexColor(userDialog.theme.buttonColor),
            '--favorite-bg': userDialog.theme.buttonColor,
          }"
          size="icon"
          :aria-label="t('dialog.user.actions.favorites_tooltip')"
          @click="userDialogCommand('Add Favorite')"
          ><Star
        /></Button>
      </TooltipWrapper>
      <TooltipWrapper v-else side="top" :content="t('dialog.user.actions.favorites_tooltip')">
        <Button
          class="rounded-lg border-muted-foreground/30! text-[var(--favorite-icon,inherit)] hover:text-[var(--favorite-icon,var(--accent-foreground))]"
          :style="{
            '--favorite-icon': userDialog.theme.iconColor === 'var(--muted-foreground)' ? 'var(--foreground)' : userDialog.theme.iconColor,
          }"
          size="icon"
          variant="outline"
          :aria-label="t('dialog.user.actions.favorites_tooltip')"
          @click="userDialogCommand('Add Favorite')"
          ><Star
        /></Button>
      </TooltipWrapper>
    </template>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <div class="ml-2">
          <Button
            :variant="hasRisk ? 'destructive' : 'outline'"
            size="icon"
            class="rounded-lg border-muted-foreground/30!"
            :style="{
              '--more-icon': userDialog.theme.iconColor === 'var(--muted-foreground)' ? 'var(--foreground)' : userDialog.theme.iconColor,
            }"
            :class="[
              hasRisk
                ? 'text-[var(--more-icon,white)] hover:text-[var(--more-icon,white)]'
                : 'text-[var(--more-icon,inherit)] hover:text-[var(--more-icon,var(--accent-foreground))]',
              { 'dot-indicator': hasRequest },
            ]"
            :aria-label="t('nav_tooltip.manage')"
          >
            <MoreHorizontal />
          </Button>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem @click="onCommand('Refresh')">
          <RefreshCw class="size-4" />
          {{ t("dialog.user.actions.refresh") }}
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger @click="onCommand('Copy Profile URL')">
            <Share2 class="size-4 mr-2" />
            <span>{{ t("dialog.user.actions.share") }}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent side="right" align="start" class="w-56">
            <DropdownMenuItem @click="onCommand('Copy Profile URL')">
              <Copy class="size-4" />
              {{ t("dialog.user.info.copy_url") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="onCommand('Copy DisplayName')">
              <Copy class="size-4" />
              {{ t("dialog.user.info.copy_display_name") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="onCommand('Copy UserId')">
              <Copy class="size-4" />
              {{ t("dialog.user.info.copy_id") }}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <template v-if="userDialog.ref.id === currentUser.id">
          <DropdownMenuItem @click="onCommand('Edit Profile')">
            <Pencil class="size-4" />
            {{ t("dialog.user.actions.edit_profile") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="onCommand('Show Fallback Avatar Details')">
            <User class="size-4" />
            {{ t("dialog.user.actions.show_fallback_avatar") }}
          </DropdownMenuItem>
        </template>
        <template v-else>
          <template v-if="userDialog.isFriend">
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="onCommand('Request Invite')">
              <Mail class="size-4" />
              {{ t("dialog.user.actions.request_invite") }}
              <DropdownMenuShortcut v-if="isActionRecent(userDialog.id, 'Request Invite')">
                <Clock class="size-3.5 text-muted-foreground" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem @click="onCommand('Request Invite Message')">
              <Mail class="size-4" />
              {{ t("dialog.user.actions.request_invite_with_message") }}
              <DropdownMenuShortcut v-if="isActionRecent(userDialog.id, 'Request Invite Message') || isActionRecent(userDialog.id, 'Request Invite Photo')">
                <Clock class="size-3.5 text-muted-foreground" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <template v-if="isGameRunning">
              <DropdownMenuItem :disabled="!checkCanInvite(lastLocation.location)" @click="onCommand('Invite')">
                <MessageSquare class="size-4" />
                {{ t("dialog.user.actions.invite") }}
                <DropdownMenuShortcut v-if="isActionRecent(userDialog.id, 'Invite')">
                  <Clock class="size-3.5 text-muted-foreground" />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem :disabled="!checkCanInvite(lastLocation.location)" @click="onCommand('Invite Message')">
                <MessageSquare class="size-4" />
                {{ t("dialog.user.actions.invite_with_message") }}
                <DropdownMenuShortcut v-if="isActionRecent(userDialog.id, 'Invite Message') || isActionRecent(userDialog.id, 'Invite Photo')">
                  <Clock class="size-3.5 text-muted-foreground" />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
            </template>
            <DropdownMenuItem :disabled="!currentUser.isBoopingEnabled" @click="onCommand('Send Boop')">
              <Hand class="size-4" />
              {{ t("dialog.user.actions.send_boop") }}
            </DropdownMenuItem>
          </template>
          <template v-else-if="userDialog.incomingRequest">
            <DropdownMenuItem @click="onCommand('Accept Friend Request')">
              <Check class="size-4" />
              {{ t("dialog.user.actions.accept_friend_request") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="onCommand('Decline Friend Request')">
              <X class="size-4" />
              {{ t("dialog.user.actions.decline_friend_request") }}
            </DropdownMenuItem>
          </template>
          <DropdownMenuItem v-else-if="userDialog.outgoingRequest" @click="onCommand('Cancel Friend Request')">
            <X class="size-4" />
            {{ t("dialog.user.actions.cancel_friend_request") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else @click="onCommand('Send Friend Request')">
            <Plus class="size-4" />
            {{ t("dialog.user.actions.send_friend_request") }}
            <DropdownMenuShortcut v-if="isActionRecent(userDialog.id, 'Send Friend Request')">
              <Clock class="size-3.5 text-muted-foreground" />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem @click="onCommand('Edit Note Memo')">
            <Pencil class="size-4" />
            {{ t("dialog.user.actions.edit_note_memo") }}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <XCircle class="size-4 mr-2" />
              <span>{{ t("nav_tooltip.moderation") }}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent side="right" align="start" class="w-56">
              <DropdownMenuItem :disabled="userDialog.ref.$isModerator === true" @click="onCommand('Report User')">
                <Flag class="size-4" />
                {{ t("dialog.user.actions.report_user") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem v-if="userDialog.isBlock" variant="destructive" @click="onCommand('Moderation Unblock')">
                <CheckCircle class="size-4" />
                {{ t("dialog.user.actions.moderation_unblock") }}
              </DropdownMenuItem>
              <DropdownMenuItem v-else :disabled="userDialog.ref.$isModerator === true" @click="onCommand('Moderation Block')">
                <XCircle class="size-4" />
                {{ t("dialog.user.actions.moderation_block") }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="userDialog.isMute" variant="destructive" @click="onCommand('Moderation Unmute')">
                <Mic class="size-4" />
                {{ t("dialog.user.actions.moderation_unmute") }}
              </DropdownMenuItem>
              <DropdownMenuItem v-else :disabled="userDialog.ref.$isModerator === true" @click="onCommand('Moderation Mute')">
                <VolumeX class="size-4" />
                {{ t("dialog.user.actions.moderation_mute") }}
              </DropdownMenuItem>
              <DropdownMenuItem v-if="userDialog.isMuteChat" variant="destructive" @click="onCommand('Moderation Enable Chatbox')">
                <MessageCircle class="size-4" />
                {{ t("dialog.user.actions.moderation_enable_chatbox") }}
              </DropdownMenuItem>
              <DropdownMenuItem v-else @click="onCommand('Moderation Disable Chatbox')">
                <MessageCircle class="size-4" />
                {{ t("dialog.user.actions.moderation_disable_chatbox") }}
              </DropdownMenuItem>
              <DropdownMenuItem @click="onCommand('Show Avatar')">
                <User class="size-4" />
                <Check v-if="userDialog.isShowAvatar" class="size-4" />
                <span>{{ t("dialog.user.actions.moderation_show_avatar") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem @click="onCommand('Hide Avatar')">
                <User class="size-4" />
                <Check v-if="userDialog.isHideAvatar" class="size-4" />
                <span>{{ t("dialog.user.actions.moderation_hide_avatar") }}</span>
              </DropdownMenuItem>
              <DropdownMenuItem v-if="userDialog.isInteractOff" variant="destructive" @click="onCommand('Moderation Enable Avatar Interaction')">
                <Hand class="size-4" />
                {{ t("dialog.user.actions.moderation_enable_avatar_interaction") }}
              </DropdownMenuItem>
              <DropdownMenuItem v-else @click="onCommand('Moderation Disable Avatar Interaction')">
                <XCircle class="size-4" />
                {{ t("dialog.user.actions.moderation_disable_avatar_interaction") }}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="onCommand('Invite To Group')">
            <MessageSquare class="size-4" />
            {{ t("dialog.user.actions.invite_to_group") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="onCommand('Group Moderation')">
            <Settings class="size-4" />
            {{ t("dialog.user.actions.group_moderation") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem v-if="userDialog.ref.currentAvatarThumbnailImageUrl" @click="onCommand('Show Avatar Author')">
            <User class="size-4" />
            {{ t("dialog.user.actions.show_avatar_author") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="userDialog.ref.fallbackAvatar" @click="onCommand('Show Fallback Avatar Details')">
            <User class="size-4" />
            {{ t("dialog.user.actions.show_fallback_avatar") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="onCommand('Previous Instances')">
            <LineChart class="size-4" />
            {{ t("dialog.user.actions.show_previous_instances") }}
          </DropdownMenuItem>
          <template v-if="userDialog.isFriend">
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @click="onCommand('Unfriend')">
              <Trash2 class="size-4" />
              {{ t("dialog.user.actions.unfriend") }}
            </DropdownMenuItem>
          </template>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import {
  Check,
  CheckCircle,
  Clock,
  Copy,
  Flag,
  LineChart,
  Mail,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Hand,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  Star,
  Trash2,
  User,
  VolumeX,
  X,
  XCircle,
} from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import DropdownMenu from "../../ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "../../ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "../../ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuSub from "../../ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuShortcut from "../../ui/dropdown-menu/DropdownMenuShortcut.vue";
import DropdownMenuTrigger from "../../ui/dropdown-menu/DropdownMenuTrigger.vue";
import { useGameStore } from "../../../stores/game";
import { useLocationStore } from "../../../stores/location";
import { useUserStore } from "../../../stores/user";
import { useInviteChecks } from "../../../composables/use-invite-checks";
import { isActionRecent } from "../../../composables/use-recent-actions";
import { invertHexColor } from "@/shared/utils/user";

const props = defineProps<{
  userDialogCommand: (command: string) => void;
}>();

const { t } = useI18n();

const { userDialog, currentUser } = storeToRefs(useUserStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { lastLocation } = storeToRefs(useLocationStore());
const { checkCanInvite } = useInviteChecks();

const hasRequest = computed(() => userDialog.value.incomingRequest || userDialog.value.outgoingRequest);
const hasRisk = computed(
  () => userDialog.value.isBlock || userDialog.value.isMute || userDialog.value.isMuteChat || userDialog.value.isInteractOff || userDialog.value.isHideAvatar
);

function onCommand(command: string) {
  props.userDialogCommand(command);
}
</script>
<style scoped>
.dot-indicator::after {
  margin-left: 30px;
  margin-bottom: 30px;
  content: "";
  width: 10px;
  height: 10px;
  background-color: var(--color-emerald-500);
  border-radius: 50%;
  position: absolute;
}
</style>
