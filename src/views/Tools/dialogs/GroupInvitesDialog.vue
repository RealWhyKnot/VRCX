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
            <AvatarImage :src="group.iconUrl" class="object-cover" />
            <AvatarFallback>
              <Users class="size-4 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div class="min-w-0 flex-1 text-sm">
            <button
              type="button"
              class="block max-w-full truncate font-medium hover:underline cursor-pointer"
              @click="showGroupDialog(group.groupId)"
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
import { showGroupDialog } from "../../../coordinators/group-dialog-coordinator";
import { useModalStore } from "../../../stores/modal";

const props = defineProps({
  isGroupInvitesDialogVisible: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);

const { t } = useI18n();
const modalStore = useModalStore();

const groups = ref([]);
const isLoading = ref(false);

const activeTab = ref("invited");

watch(
  () => props.isGroupInvitesDialogVisible,
  (visible) => {
    if (visible) {
      loadGroups();
    }
  }
);

watch(activeTab, () => loadGroups());

function closeDialog() {
  emit("close");
}

async function loadGroups() {
  groups.value = [];
  isLoading.value = true;
  try {
    const { json } = await groupRequest.getMyGroupsByStatus({ membershipStatus: activeTab.value });
    groups.value = json ?? [];
  } finally {
    isLoading.value = false;
  }
}

function removeGroup(id) {
  groups.value = groups.value.filter((g) => g.id !== id);
}

async function acceptInvite(group) {
  await groupRequest.joinGroup({ groupId: group.groupId });
  removeGroup(group.id);
  toast.success(t("dialog.group_invites.accepted"));
}

async function declineInvite(group) {
  await groupRequest.declineGroupInvite({ groupId: group.groupId });
  removeGroup(group.id);
}

async function cancelRequest(group) {
  await groupRequest.cancelGroupRequest({ groupId: group.groupId });
  removeGroup(group.id);
}

async function blockGroup(group) {
  const { ok } = await modalStore.confirm({
    title: t("confirm.title"),
    description: t("confirm.block_group"),
    destructive: true,
  });
  if (!ok) {
    return;
  }
  await groupRequest.blockGroup({ groupId: group.groupId });
  removeGroup(group.id);
}
</script>
