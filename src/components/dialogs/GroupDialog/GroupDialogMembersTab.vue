<template>
  <div v-if="groupDialog.visible" class="flex h-full min-h-0 flex-col p-2 rounded-xl bg-(--profile-card)">
    <div class="sticky top-0 z-10 pb-2">
      <span v-if="hasGroupPermission(groupDialog.ref, 'group-members-viewall')" class="text-base font-bold p-1">{{
        t("dialog.group.members.all_members")
      }}</span>
      <span v-else class="text-base font-bold">{{ t("dialog.group.members.friends_only") }}</span>
      <div class="mt-[8px]">
        <Button class="rounded-full h-6 w-6" variant="ghost" size="icon-sm" :loading="isGroupMembersLoading" circle @click="loadAllGroupMembers">
          <Spinner v-if="isGroupMembersLoading" /><RefreshCcw v-else
        /></Button>
        <Button
          class="rounded-full h-6 w-6 ml-[6px]"
          size="icon-sm"
          variant="ghost"
          @click="downloadAndSaveJson(`${groupDialog.id}_members`, groupDialog.members)"
        >
          <Download class="h-4 w-4" />
        </Button>
        <span v-if="groupDialog.memberSearch.length" class="text-sm mx-1.5"
          >{{ groupDialog.memberSearchResults.length }}/{{ groupDialog.ref.memberCount }}</span
        >
        <span v-else class="text-sm mx-1.5">{{ groupDialog.members.length }}/{{ groupDialog.ref.memberCount }}</span>
        <div v-if="hasGroupPermission(groupDialog.ref, 'group-members-manage')" class="float-right flex items-center">
          <span class="mr-[6px]">{{ t("dialog.group.members.sort_by") }}</span>
          <Select v-model="groupDialogMemberSortValue" :disabled="isGroupMembersLoading || groupDialog.memberSearch.length > 0">
            <SelectTrigger class="h-8 w-45 mr-1">
              <SelectValue :placeholder="t('dialog.group.members.sort_by')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="item in groupDialogSortingOptions" :key="item.value" :value="item.value">
                {{ t(item.name) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="ml-2 mr-1">{{ t("dialog.group.members.filter") }}</span>
          <div class="inline-block w-[220px]">
            <VirtualCombobox
              v-model="groupDialogMemberFilterKey"
              :groups="groupDialogMemberFilterGroups"
              :disabled="isGroupMembersLoading || groupDialog.memberSearch.length > 0"
              :placeholder="t('dialog.group.members.filter')"
              :search-placeholder="t('dialog.group.members.search')"
              :clearable="false"
              :close-on-select="true"
            >
              <template #trigger="{ text }">
                <span class="truncate">
                  {{ text || t("dialog.group.members.filter") }}
                </span>
              </template>
            </VirtualCombobox>
          </div>
        </div>
        <InputGroupField
          v-model="groupDialog.memberSearch"
          :disabled="!hasGroupPermission(groupDialog.ref, 'group-members-manage')"
          clearable
          size="sm"
          :placeholder="t('dialog.group.members.search')"
          class="flex-1"
          @input="groupMembersSearch"
        />
      </div>
    </div>
    <div v-if="groupDialog.memberSearch.length" class="min-h-0 min-w-[130px] flex-1 overflow-y-auto overflow-x-hidden flex flex-wrap items-start pt-2">
      <div
        v-for="user in groupDialog.memberSearchResults"
        :key="user.id"
        class="box-border flex items-center p-1.5 text-[13px] cursor-pointer w-[167px] hover:rounded-[25px_5px_5px_25px]"
        @click="showUserDialog(user.userId)"
      >
        <div class="relative inline-block flex-none size-9 mr-2.5">
          <Avatar class="size-9">
            <AvatarImage :src="userImage(user.user)" class="object-cover" />
            <AvatarFallback>
              <User class="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <IconFrame :icon-frame="user.user?.iconFrame ?? ''" />
        </div>
        <div class="flex-1 overflow-hidden">
          <span
            class="block truncate font-medium leading-[18px] text-[color:var(--user-colour)]"
            :style="{ '--user-colour': user.user?.$userColour }"
            v-text="user.user?.displayName"
          />
          <span class="block truncate text-xs">
            <template v-if="hasGroupPermission(groupDialog.ref, 'group-members-manage')">
              <TooltipWrapper v-if="user.isRepresenting" side="top" :content="t('dialog.group.members.representing')">
                <Tag class="mr-[6px]" />
              </TooltipWrapper>
              <TooltipWrapper v-if="user.visibility !== 'visible'" side="top">
                <template #content>
                  <span>{{ t("dialog.group.members.visibility") }} {{ user.visibility }}</span>
                </template>
                <Eye class="mr-[6px]" />
              </TooltipWrapper>
              <TooltipWrapper v-if="!user.isSubscribedToAnnouncements" side="top" :content="t('dialog.group.members.unsubscribed_announcements')">
                <MessageSquare class="mr-[6px]" />
              </TooltipWrapper>
              <TooltipWrapper v-if="user.managerNotes" side="top">
                <template #content>
                  <span>{{ t("dialog.group.members.manager_notes") }}</span>
                  <br />
                  <span>{{ user.managerNotes }}</span>
                </template>
                <Pencil class="mr-[6px]" />
              </TooltipWrapper>
            </template>
            <span :title="getUserRoleNamesText(user.roleIds)">
              {{ getUserRoleNamesText(user.roleIds) }}
            </span>
          </span>
        </div>
      </div>
    </div>
    <ul
      v-else-if="groupDialog.members.length > 0"
      class="infinite-list min-h-0 min-w-[130px] flex-1 overflow-y-auto overflow-x-hidden flex flex-wrap items-start pt-2"
    >
      <li
        v-for="user in groupDialog.members"
        :key="user.id"
        class="infinite-list-item box-border flex items-center p-1.5 text-[13px] cursor-pointer w-[167px] hover:rounded-[25px_5px_5px_25px]"
        @click="showUserDialog(user.userId)"
      >
        <div class="relative inline-block flex-none size-9 mr-2.5">
          <Avatar class="size-9">
            <AvatarImage :src="userImage(user.user)" class="object-cover" />
            <AvatarFallback>
              <User class="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <IconFrame :icon-frame="user.user?.iconFrame ?? ''" />
        </div>
        <div class="flex-1 overflow-hidden">
          <span
            class="block truncate font-medium leading-[18px] text-[color:var(--user-colour)]"
            :style="{ '--user-colour': user.user?.$userColour }"
            v-text="user.user?.displayName"
          />
          <span class="block truncate text-xs">
            <template v-if="hasGroupPermission(groupDialog.ref, 'group-members-manage')">
              <TooltipWrapper v-if="user.isRepresenting" side="top" :content="t('dialog.group.members.representing')">
                <Tag class="mr-[6px]" />
              </TooltipWrapper>
              <TooltipWrapper v-if="user.visibility !== 'visible'" side="top">
                <template #content>
                  <span>{{ t("dialog.group.members.visibility") }} {{ user.visibility }}</span>
                </template>
                <Eye class="mr-[6px]" />
              </TooltipWrapper>
              <TooltipWrapper v-if="!user.isSubscribedToAnnouncements" side="top" :content="t('dialog.group.members.unsubscribed_announcements')">
                <MessageSquare class="mr-[6px]" />
              </TooltipWrapper>
              <TooltipWrapper v-if="user.managerNotes" side="top">
                <template #content>
                  <span>{{ t("dialog.group.members.manager_notes") }}</span>
                  <br />
                  <span>{{ user.managerNotes }}</span>
                </template>
                <Pencil class="mr-[6px]" />
              </TooltipWrapper>
            </template>
            <span :title="getUserRoleNamesText(user.roleIds)">
              {{ getUserRoleNamesText(user.roleIds) }}
            </span>
          </span>
        </div>
      </li>
      <div
        v-if="!isGroupMembersDone"
        class="box-border flex items-center p-1.5 text-[13px] cursor-pointer w-full h-[45px] text-center"
        @click="loadMoreGroupMembers()"
      >
        <div v-if="!isGroupMembersLoading" class="flex-1 overflow-hidden">
          <span class="block truncate font-medium leading-[18px]">{{ t("dialog.group.members.load_more") }}</span>
        </div>
      </div>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { Download, Eye, MessageSquare, Pencil, RefreshCcw, Tag, User } from "lucide-vue-next";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import IconFrame from "@/components/IconFrame.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import VirtualCombobox from "@/components/ui/virtual-combobox/VirtualCombobox.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { downloadAndSaveJson } from "../../../shared/utils/app-actions";
import { hasGroupPermission } from "../../../shared/utils/group";
import { useUserDisplay } from "../../../composables/use-user-display";
import { useGroupStore } from "../../../stores/group";
import { useUserStore } from "../../../stores/user";
import { applyGroupMember, handleGroupMember } from "../../../coordinators/group-coordinator";
import { groupDialogSortingOptions } from "../../../shared/constants/group";
import { useGroupMembers } from "./use-group-members";
import { showUserDialog } from "../../../coordinators/user-coordinator";

const { userImage } = useUserDisplay();
const { t } = useI18n();

const { currentUser } = storeToRefs(useUserStore());
const { groupDialog } = storeToRefs(useGroupStore());

const {
  isGroupMembersDone,
  isGroupMembersLoading,
  groupDialogMemberSortValue,
  groupDialogMemberFilterKey,
  groupDialogMemberFilterGroups,
  groupMembersSearch,
  getGroupDialogGroupMembers,
  loadMoreGroupMembers,
  loadAllGroupMembers,
} = useGroupMembers(groupDialog, { currentUser, applyGroupMember, handleGroupMember, t });

function getUserRoleNamesText(roleIds: string[] = []) {
  const groupRoles = groupDialog.value.ref.roles ?? [];
  const roleNameById = new Map(groupRoles.map((role) => [role.id, role.name]));

  return roleIds
    .map((roleId) => roleNameById.get(roleId))
    .filter((roleName) => typeof roleName === "string" && roleName.length > 0)
    .join(", ");
}

defineExpose({
  getGroupDialogGroupMembers,
});
</script>
