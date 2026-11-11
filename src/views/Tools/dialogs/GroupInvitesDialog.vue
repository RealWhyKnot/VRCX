<template>
  <Dialog :open="isGroupInvitesDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.group_invites.header") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-2">
        <Tabs v-model="activeTab">
          <TabsList>
            <TabsTrigger value="invited">{{ t("dialog.group_invites.invited") }}</TabsTrigger>
            <TabsTrigger value="requested">{{ t("dialog.group_invites.requested") }}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" variant="outline" class="ml-auto" :disabled="isLoading" @click="loadGroups">
          <RefreshCw class="size-4" :class="{ 'animate-spin': isLoading }" />
        </Button>
      </div>

      <div class="max-h-[60vh] overflow-y-auto">
        <DataTableEmpty v-if="!groups.length && !isLoading" type="nodata" />
        <div v-for="group in groups" :key="group.id" class="flex items-center gap-3 border-b py-2 last:border-b-0">
          <Avatar class="size-9 flex-none">
            <AvatarImage v-if="group.iconUrl" :src="group.iconUrl" class="object-cover" />
            <AvatarFallback>
              <Users class="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1 text-sm">
            <button
              type="button"
              class="block max-w-full truncate font-medium hover:underline cursor-pointer"
              @click="showGroupDialog(group.id)"
              v-text="group.name"
            ></button>
            <div class="truncate text-xs text-muted-foreground">{{ group.shortCode }}.{{ group.discriminator }} · {{ group.memberCount }}</div>
          </div>
          <TooltipWrapper v-if="activeTab === 'requested'" side="top" :content="t('dialog.group_invites.cancel_request')">
            <Button size="icon-sm" variant="ghost" @click="cancelRequest(group)">
              <X class="size-4" />
            </Button>
          </TooltipWrapper>
          <template v-else>
            <TooltipWrapper side="top" :content="t('dialog.group_invites.accept')">
              <Button size="icon-sm" variant="ghost" @click="acceptInvite(group)">
                <Check class="size-4" />
              </Button>
            </TooltipWrapper>
            <TooltipWrapper side="top" :content="t('dialog.group_invites.decline')">
              <Button size="icon-sm" variant="ghost" @click="declineInvite(group)">
                <X class="size-4" />
              </Button>
            </TooltipWrapper>
            <TooltipWrapper side="top" :content="t('dialog.group_invites.block')">
              <Button size="icon-sm" variant="ghost" class="text-destructive" @click="blockGroup(group)">
                <Ban class="size-4" />
              </Button>
            </TooltipWrapper>
          </template>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import { Ban, Check, RefreshCw, Users, X } from "lucide-vue-next";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import { ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { groupRequest } from "../../../api/group";
import { hasGroupId, type GroupMembershipStatus, type GroupRow } from "./group-rows";
import { showGroupDialog } from "../../../coordinators/group-dialog-coordinator";
import { useModalStore } from "../../../stores/modal";
import { logError } from "../../../stores/vrcx-messages";

const props = withDefaults(
  defineProps<{
    isGroupInvitesDialogVisible?: boolean | undefined;
  }>(),
  {
    isGroupInvitesDialogVisible: false,
  }
);

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const modalStore = useModalStore();

const groups = ref<GroupRow[]>([]);
const isLoading = ref(false);

const activeTab = ref<GroupMembershipStatus>("invited");

watch(
  () => props.isGroupInvitesDialogVisible,
  (isVisible) => {
    if (isVisible) {
      void loadGroups().catch(logError);
    }
  }
);

watch(activeTab, () => {
  void loadGroups().catch(logError);
});

function closeDialog() {
  emit("close");
}

async function loadGroups() {
  groups.value = [];
  isLoading.value = true;
  try {
    const { json } = await groupRequest.getMyGroupsByStatus({ membershipStatus: activeTab.value });
    groups.value = json.filter(hasGroupId);
  } finally {
    isLoading.value = false;
  }
}

function removeGroup(id: GroupRow["id"]) {
  groups.value = groups.value.filter((g) => g.id !== id);
}

async function acceptInvite(group: GroupRow) {
  await groupRequest.joinGroup({ groupId: group.id });
  removeGroup(group.id);
  toast.success(t("dialog.group_invites.accepted"));
}

async function declineInvite(group: GroupRow) {
  await groupRequest.declineGroupInvite({ groupId: group.id });
  removeGroup(group.id);
}

async function cancelRequest(group: GroupRow) {
  await groupRequest.cancelGroupRequest({ groupId: group.id });
  removeGroup(group.id);
}

async function blockGroup(group: GroupRow) {
  const { ok } = await modalStore.confirm({
    title: t("confirm.title"),
    description: t("confirm.block_group"),
    destructive: true,
  });
  if (!ok) {
    return;
  }
  await groupRequest.blockGroup({ groupId: group.id });
  removeGroup(group.id);
}
</script>
