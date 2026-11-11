<template>
  <GroupCalendarDialog :visible="groupCalendar" @close="closeDialog('groupCalendar')" />
  <BlockedGroupsDialog :is-blocked-groups-dialog-visible="blockedGroups" @close="closeDialog('blockedGroups')" />
  <GroupInvitesDialog :is-group-invites-dialog-visible="groupInvites" @close="closeDialog('groupInvites')" />
  <NoteExportDialog :is-note-export-dialog-visible="noteExport" @close="closeDialog('noteExport')" />
  <ExportDiscordNamesDialog v-model:discord-names-dialog-visible="exportDiscordNames" :friends="friends" />
  <ExportFriendsListDialog v-model:is-export-friends-list-dialog-visible="exportFriendsList" :friends="friends" />
  <ExportAvatarsListDialog v-model:is-export-avatars-list-dialog-visible="exportAvatarsList" />
  <EditInviteMessageDialog v-model:is-edit-invite-messages-dialog-visible="editInviteMessages" @close="closeDialog('editInviteMessages')" />
  <RegistryBackupDialog />
  <AutoChangeStatusDialog :is-auto-change-status-dialog-visible="autoChangeStatus" @close="closeDialog('autoChangeStatus')" />
  <ModerationReportsDialog :is-moderation-reports-dialog-visible="moderationReports" @close="closeDialog('moderationReports')" />
  <PurchaseHistoryDialog :is-purchase-history-dialog-visible="purchaseHistory" @close="closeDialog('purchaseHistory')" />
  <CreatorEarningsDialog :is-visible="creatorEarnings" @close="closeDialog('creatorEarnings')" />
  <InfoPushDialog :is-info-push-dialog-visible="infoPush" @close="closeDialog('infoPush')" />
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useFriendStore } from "../../../stores/friend";
import { useToolsStore } from "../../../stores/tools";

import AutoChangeStatusDialog from "../dialogs/AutoChangeStatusDialog.vue";
import RegistryBackupDialog from "../dialogs/RegistryBackupDialog.vue";

import BlockedGroupsDialog from "../dialogs/BlockedGroupsDialog.vue";
import CreatorEarningsDialog from "../dialogs/CreatorEarningsDialog.vue";
import EditInviteMessageDialog from "../dialogs/EditInviteMessagesDialog.vue";
import ExportAvatarsListDialog from "../dialogs/ExportAvatarsListDialog.vue";
import ExportDiscordNamesDialog from "../dialogs/ExportDiscordNamesDialog.vue";
import ExportFriendsListDialog from "../dialogs/ExportFriendsListDialog.vue";
import GroupCalendarDialog from "../dialogs/GroupCalendarDialog.vue";
import GroupInvitesDialog from "../dialogs/GroupInvitesDialog.vue";
import InfoPushDialog from "../dialogs/InfoPushDialog.vue";
import ModerationReportsDialog from "../dialogs/ModerationReportsDialog.vue";
import PurchaseHistoryDialog from "../dialogs/PurchaseHistoryDialog.vue";
import NoteExportDialog from "../dialogs/NoteExportDialog.vue";

const { friends } = storeToRefs(useFriendStore());
const toolsStore = useToolsStore();
const {
  autoChangeStatus,
  blockedGroups,
  creatorEarnings,
  editInviteMessages,
  exportAvatarsList,
  exportDiscordNames,
  exportFriendsList,
  groupCalendar,
  groupInvites,
  infoPush,
  moderationReports,
  purchaseHistory,
  noteExport,
} = storeToRefs(toolsStore);

const { closeDialog } = toolsStore;
</script>
