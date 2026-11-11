<template>
  <div class="flex-1 min-h-0 min-w-0 flex flex-row">
    <DialogHeader class="sr-only">
      <DialogTitle>{{ groupDialog.ref?.name || groupDialog.id || t("dialog.group.info.header") }}</DialogTitle>
      <DialogDescription>
        {{ groupDialog.ref?.description || groupDialog.ref?.name || t("dialog.group.info.header") }}
      </DialogDescription>
    </DialogHeader>

    <GroupDialogSidebar :show-previous-instances-list-dialog="showPreviousInstancesListDialog" :group-dialog-command="groupDialogCommand" />

    <div class="flex-1 min-w-0 flex flex-col min-h-0 pl-4">
      <TabsUnderline
        v-model="groupDialog.activeTab"
        :background="true"
        :items="groupDialogTabs"
        :unmount-on-hide="false"
        fill
        @update:model-value="(value) => groupDialogTabClick(String(value))"
      >
        <template #Info>
          <GroupDialogInfoTab :show-group-post-edit-dialog="showGroupPostEditDialog" :confirm-delete-group-post="confirmDeleteGroupPost" />
        </template>
        <template #Posts>
          <GroupDialogPostsTab :show-group-post-edit-dialog="showGroupPostEditDialog" :confirm-delete-group-post="confirmDeleteGroupPost" />
        </template>
        <template #Members>
          <GroupDialogMembersTab ref="membersTabRef" />
        </template>
        <template #Photos>
          <GroupDialogPhotosTab ref="photosTabRef" />
        </template>
        <template #Store>
          <GroupDialogStoreTab ref="storeTabRef" />
        </template>
        <template #JSON>
          <DialogJsonTab
            class="rounded-xl bg-(--profile-card) p-2"
            :tree-data="treeData"
            :tree-data-key="treeData?.group?.id ?? null"
            :dialog-id="groupDialog.id"
            :dialog-ref="groupDialog.ref"
            @refresh="refreshGroupDialogTreeData()"
          />
        </template>
      </TabsUnderline>
    </div>
    <GroupPostEditDialog :dialog-data="groupPostEditDialog" :selected-gallery-file="selectedGalleryFile" />
    <GroupTransferDialog :dialog-data="groupTransferDialog" @close="groupTransferDialog.visible = false" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { removeFromArray } from "../../../shared/utils/base/array";
import { useGroupStore } from "../../../stores/group";
import { useInstanceStore } from "../../../stores/instance";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { showGroupDialog, getGroupDialogCalendar, showGroupMemberModerationDialog, showGroupRolesDialog } from "../../../coordinators/group-dialog-coordinator";
import { leaveGroupPrompt, setGroupVisibility, setGroupSubscription, setGroupEventAnnouncements } from "../../../coordinators/group-membership-coordinator";
import { groupRequest } from "../../../api/group";
import { queryRequest } from "../../../api/query-request";
import { formatJsonVars } from "../../../shared/utils/base/ui";

import DialogJsonTab from "../DialogJsonTab.vue";
import GroupDialogInfoTab from "./GroupDialogInfoTab.vue";
import GroupDialogSidebar from "./GroupDialogSidebar.vue";
import { useGroupDialogCommands } from "./use-group-dialog-commands";
import GroupDialogMembersTab from "./GroupDialogMembersTab.vue";
import GroupDialogPhotosTab from "./GroupDialogPhotosTab.vue";
import GroupDialogPostsTab from "./GroupDialogPostsTab.vue";
import GroupDialogStoreTab from "./GroupDialogStoreTab.vue";
import GroupPostEditDialog from "./GroupPostEditDialog.vue";
import type { GroupPostEditDialogState, GroupPostSelectedImage, GroupTransferDialogState } from "./group-dialog-types";
import type { GroupPostEntry } from "../../../stores/group-types";
import type { VrcxGroup } from "../../../types/vrcx";
import GroupTransferDialog from "./GroupTransferDialog.vue";

const { t } = useI18n();
const groupDialogTabs = computed(() => [
  { value: "Info", label: t("dialog.group.info.header") },
  { value: "Posts", label: t("dialog.group.posts.header") },
  { value: "Members", label: t("dialog.group.members.header") },
  { value: "Photos", label: t("dialog.group.gallery.header") },
  ...(groupDialog.value.ref.storeId ? [{ value: "Store", label: t("dialog.group.store.header") }] : []),
  { value: "JSON", label: t("dialog.group.json.header") },
]);

const modalStore = useModalStore();

const { currentUser } = storeToRefs(useUserStore());
const { groupDialog, inviteGroupDialog } = storeToRefs(useGroupStore());
const { updateGroupPostSearch } = useGroupStore();
const { groupEventRevision } = storeToRefs(useGroupStore());

const instanceStore = useInstanceStore();

function showPreviousInstancesListDialog(groupRef: Partial<VrcxGroup>) {
  instanceStore.showPreviousInstancesListDialog("group", groupRef).catch(console.error);
}

const { groupDialogCommand } = useGroupDialogCommands(groupDialog, {
  t,
  modalStore,
  currentUser,
  showGroupDialog,
  leaveGroupPrompt,
  setGroupVisibility,
  setGroupSubscription,
  setGroupEventAnnouncements,
  showPreviousInstancesListDialog,
  showGroupMemberModerationDialog,
  showGroupRolesDialog,
  showInviteGroupDialog: (groupId, userId) => {
    if (groupId) {
      inviteGroupDialog.value.groupId = groupId;
    }
    if (userId) {
      inviteGroupDialog.value.userId = userId;
    }
    inviteGroupDialog.value.visible = true;
  },
  showGroupTransferDialog,
  showGroupPostEditDialog,
  groupRequest,
});
const groupTransferDialog = reactive<GroupTransferDialogState>({
  visible: false,
  groupId: "",
  groupName: "",
  ownerId: "",
});

const groupDialogTabCurrentName = ref("0");

const treeData = ref<{ group?: { id?: string }; [key: string]: unknown }>({});
const membersTabRef = ref<InstanceType<typeof GroupDialogMembersTab> | null>(null);
const photosTabRef = ref<InstanceType<typeof GroupDialogPhotosTab> | null>(null);
const storeTabRef = ref<InstanceType<typeof GroupDialogStoreTab> | null>(null);

const selectedGalleryFile = ref<GroupPostSelectedImage>({
  selectedFileId: "",
  selectedImageUrl: "",
});
const groupPostEditDialog = reactive<GroupPostEditDialogState>({
  visible: false,
  groupRef: {},
  title: "",
  text: "",
  sendNotification: true,
  visibility: "group",
  roleIds: [],
  postId: "",
  groupId: "",
});

watch(
  () => groupDialog.value.isGetGroupDialogGroupLoading,
  (isLoading) => {
    if (isLoading) {
      loadLastActiveTab();
    }
  }
);

watch(groupEventRevision, () => {
  if (groupDialog.value.visible) {
    getGroupDialogCalendar(groupDialog.value.id);
  }
});

function confirmDeleteGroupPost(post: GroupPostEntry) {
  modalStore
    .confirm({
      description: t("confirm.delete_post"),
      title: t("confirm.title"),
      destructive: true,
    })
    .then(({ ok }) => {
      if (!ok || !post.groupId || !post.id) return;
      groupRequest
        .deleteGroupPost({
          groupId: post.groupId,
          postId: post.id,
        })
        .then((args) => {
          const D = groupDialog.value;
          if (D.id !== args.params.groupId) {
            return;
          }

          const postId = args.params.postId;
          for (const item of D.posts) {
            if (item.id === postId) {
              removeFromArray(D.posts, item);
              break;
            }
          }
          if (postId === D.announcement.id) {
            const [firstPost] = D.posts;
            D.announcement = firstPost ?? {};
          }
          updateGroupPostSearch();
        })
        .catch(console.error);
    })
    .catch(console.error);
}

function handleGroupDialogTab(tabName: string) {
  groupDialog.value.lastActiveTab = tabName;
  if (tabName === "Members") {
    membersTabRef.value?.getGroupDialogGroupMembers();
  } else if (tabName === "Photos") {
    photosTabRef.value?.getGroupGalleries();
  } else if (tabName === "Store") {
    storeTabRef.value?.getGroupListings();
  } else if (tabName === "JSON") {
    refreshGroupDialogTreeData();
  }
}

function loadLastActiveTab() {
  if (groupDialog.value.lastActiveTab === "Store" && !groupDialog.value.ref.storeId) {
    groupDialog.value.activeTab = "Info";
    groupDialogTabCurrentName.value = "Info";
    groupDialog.value.lastActiveTab = "Info";
  }
  handleGroupDialogTab(groupDialog.value.lastActiveTab);
}

function groupDialogTabClick(tabName: string) {
  if (tabName === groupDialogTabCurrentName.value) {
    if (tabName === "JSON") {
      refreshGroupDialogTreeData();
    }
    return;
  }
  handleGroupDialogTab(tabName);
  groupDialogTabCurrentName.value = tabName;
}

function showGroupPostEditDialog(groupId: string, post: GroupPostEntry | null) {
  const D = groupPostEditDialog;
  D.sendNotification = true;
  D.groupRef = {};
  D.title = "";
  D.text = "";
  D.visibility = "group";
  D.roleIds = [];
  D.postId = "";
  D.groupId = groupId;
  selectedGalleryFile.value = {
    selectedFileId: "",
    selectedImageUrl: "",
  };

  if (post) {
    D.title = post.title ?? "";
    D.text = post.text ?? "";
    D.visibility = post.visibility ?? "group";
    D.roleIds = post.roleIds ?? [];
    D.postId = post.id ?? "";
    selectedGalleryFile.value = {
      selectedFileId: post.imageId ?? "",
      selectedImageUrl: post.imageUrl ?? "",
    };
  }
  queryRequest
    .fetch("group.dialog", { groupId })
    .then((args) => {
      D.groupRef = args.ref;
    })
    .catch(console.error);
  D.visible = true;
}

function showGroupTransferDialog(groupId: string, groupName: string | undefined, ownerId: string | undefined) {
  groupTransferDialog.groupId = groupId;
  groupTransferDialog.groupName = groupName ?? "";
  groupTransferDialog.ownerId = ownerId ?? "";
  groupTransferDialog.visible = true;
}

function refreshGroupDialogTreeData() {
  const D = groupDialog.value;
  treeData.value = {
    group: formatJsonVars(D.ref),
    posts: D.posts,
    instances: D.instances,
    members: D.members,
    galleries: D.galleries,
    calendar: D.calendar,
  };
}
</script>
