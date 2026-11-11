<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        class="rounded-lg"
        :variant="groupDialog.ref.membershipStatus === 'userblocked' ? 'destructive' : 'outline'"
        size="icon"
        :aria-label="t('nav_tooltip.manage')"
      >
        <MoreHorizontal />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem @click="groupDialogCommand('Refresh')">
        <RefreshCw class="size-4" />
        {{ t("dialog.group.actions.refresh") }}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger @click="groupDialogCommand('Share')">
          <Share2 class="size-4 mr-2" />
          <span>{{ t("dialog.group.actions.share") }}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent side="right" class="w-56">
          <DropdownMenuItem @click="groupDialogCommand('Share')">
            <Copy class="size-4" />
            {{ t("dialog.user.info.copy_url") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="groupDialogCommand('Copy Group Name')">
            <Copy class="size-4" />
            {{ t("dialog.world.info.copy_name") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="groupDialogCommand('Copy Group ID')">
            <Copy class="size-4" />
            {{ t("dialog.user.info.copy_id") }}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem v-if="groupDialog.inGroup && !hasGroupPermission(groupDialog.ref, 'group-roles-manage')" @click="groupDialogCommand('Manage Roles')">
        <ShieldCheck class="size-4" />
        {{ t("dialog.group.actions.view_roles") }}
      </DropdownMenuItem>

      <template v-if="hasGroupModerationPermission(groupDialog.ref)">
        <DropdownMenuSeparator />
        <DropdownMenuItem v-if="hasGroupPermission(groupDialog.ref, 'group-data-manage')" @click="showEditGroupDialog(groupDialog.ref)">
          <Pencil class="size-4" />
          {{ t("dialog.group_edit.edit_header") }}
        </DropdownMenuItem>
        <DropdownMenuItem :disabled="!hasGroupModerationPermission(groupDialog.ref)" @click="groupDialogCommand('Moderation Tools')">
          <Settings class="size-4" />
          {{ t("dialog.group.actions.moderation_tools") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="hasGroupPermission(groupDialog.ref, 'group-roles-manage')" @click="groupDialogCommand('Manage Roles')">
          <ShieldCheck class="size-4" />
          {{ t("dialog.group.actions.manage_roles") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="hasGroupPermission(groupDialog.ref, 'group-invites-manage')" @click="groupDialogCommand('Invite To Group')">
          <MessageSquare class="size-4" />
          {{ t("dialog.group.actions.invite_to_group") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="hasGroupPermission(groupDialog.ref, 'group-announcement-manage')" @click="groupDialogCommand('Create Post')">
          <Ticket class="size-4" />
          {{ t("dialog.group.actions.create_post") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="hasGroupPermission(groupDialog.ref, 'group-calendar-manage')" @click="showCreateGroupEventDialog(groupDialog.ref)">
          <CalendarPlus class="size-4" />
          {{ t("dialog.group.actions.create_event") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-if="groupDialog.ref.ownerId === currentUser.id" @click="groupDialogCommand('Transfer Group')">
          <ArrowRightLeft class="size-4" />
          {{ t("dialog.group.actions.transfer") }}
        </DropdownMenuItem>
      </template>

      <template v-if="groupDialog.inGroup">
        <template v-if="groupDialog.ref.myMember">
          <DropdownMenuSeparator />
          <DropdownMenuItem v-if="groupDialog.ref.myMember.isSubscribedToAnnouncements" @click="groupDialogCommand('Unsubscribe To Announcements')">
            <BellOff class="size-4" />
            {{ t("dialog.group.actions.unsubscribe") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else @click="groupDialogCommand('Subscribe To Announcements')">
            <Bell class="size-4" />
            {{ t("dialog.group.actions.subscribe") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="groupDialog.ref.myMember.isSubscribedToEventAnnouncements || typeof groupDialog.ref.myMember.isSubscribedToEventAnnouncements === 'undefined'"
            @click="groupDialogCommand('Unsubscribe To Event Announcements')"
          >
            <MessageCircleOff class="size-4" />
            {{ t("dialog.group.actions.unsubscribe_event") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-else @click="groupDialogCommand('Subscribe To Event Announcements')">
            <MessageCircle class="size-4" />
            {{ t("dialog.group.actions.subscribe_event") }}
          </DropdownMenuItem>
          <template v-if="groupDialog.ref.myMember && groupDialog.ref.privacy === 'default'">
            <DropdownMenuSeparator />
            <DropdownMenuItem @click="groupDialogCommand('Visibility Everyone')">
              <Eye class="size-4" />
              <Check v-if="groupDialog.ref.myMember.visibility === 'visible'" class="size-4" />
              {{ t("dialog.group.actions.visibility_everyone") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="groupDialogCommand('Visibility Friends')">
              <Eye class="size-4" />
              <Check v-if="groupDialog.ref.myMember.visibility === 'friends'" class="size-4" />
              {{ t("dialog.group.actions.visibility_friends") }}
            </DropdownMenuItem>
            <DropdownMenuItem @click="groupDialogCommand('Visibility Hidden')">
              <Eye class="size-4" />
              <Check v-if="groupDialog.ref.myMember.visibility === 'hidden'" class="size-4" />
              {{ t("dialog.group.actions.visibility_hidden") }}
            </DropdownMenuItem>
          </template>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="groupDialogCommand('Previous Instances')">
            <LineChart class="size-4" />
            {{ t("dialog.world.actions.show_previous_instances") }}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @click="groupDialogCommand('Leave Group')">
            <Trash2 class="size-4" />
            {{ isSoleGroupOwner(groupDialog.ref, currentUser.id) ? t("dialog.group.actions.delete") : t("dialog.group.actions.leave") }}
          </DropdownMenuItem>
        </template>
      </template>
      <template v-else>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="groupDialogCommand('Previous Instances')">
          <LineChart class="size-4" />
          {{ t("dialog.world.actions.show_previous_instances") }}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem v-if="groupDialog.ref.membershipStatus === 'userblocked'" variant="destructive" @click="groupDialogCommand('Unblock Group')">
          <CheckCircle class="size-4" />
          {{ t("dialog.group.actions.unblock") }}
        </DropdownMenuItem>
        <DropdownMenuItem v-else @click="groupDialogCommand('Block Group')">
          <XCircle class="size-4" />
          {{ t("dialog.group.actions.block") }}
        </DropdownMenuItem>
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import {
  ArrowRightLeft,
  Bell,
  BellOff,
  CalendarPlus,
  Check,
  CheckCircle,
  Copy,
  Eye,
  LineChart,
  MessageCircle,
  MessageCircleOff,
  MessageSquare,
  Pencil,
  RefreshCw,
  Settings,
  Share2,
  ShieldCheck,
  Ticket,
  Trash2,
  XCircle,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import DropdownMenu from "../../ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "../../ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "../../ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuSeparator from "../../ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuSub from "../../ui/dropdown-menu/DropdownMenuSub.vue";
import DropdownMenuSubContent from "../../ui/dropdown-menu/DropdownMenuSubContent.vue";
import DropdownMenuSubTrigger from "../../ui/dropdown-menu/DropdownMenuSubTrigger.vue";
import DropdownMenuTrigger from "../../ui/dropdown-menu/DropdownMenuTrigger.vue";
import Button from "@/components/ui/button/Button.vue";
import { hasGroupModerationPermission, hasGroupPermission } from "../../../shared/utils/group";
import { isSoleGroupOwner } from "../../../coordinators/group-membership-coordinator";
import { useGroupStore } from "../../../stores/group";
import { useUserStore } from "../../../stores/user";

defineProps<{
  groupDialogCommand: (command: string) => void;
}>();

const { t } = useI18n();
const { groupDialog } = storeToRefs(useGroupStore());
const { currentUser } = storeToRefs(useUserStore());
const { showCreateGroupEventDialog, showEditGroupDialog } = useGroupStore();
</script>
