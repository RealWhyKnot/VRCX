<template>
  <Dialog v-model:open="newInstanceDialog.visible">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.new_instance.header") }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t("dialog.new_instance.header") }}</DialogDescription>
      </DialogHeader>
      <TabsUnderline v-model="newInstanceDialog.selectedTab" :items="newInstanceTabs" :unmount-on-hide="false" @update:model-value="newInstanceTabClick">
        <template #Normal>
          <NewInstanceNormalFields
            v-model="newInstanceDialog"
            :build-instance="buildInstance"
            :handle-category-id-change="handleCategoryIdChange"
            :handle-vibe-ids-change="handleVibeIdsChange"
            :handle-languages-change="handleLanguagesChange"
            :handle-role-ids-change="handleRoleIdsChange"
          />
        </template>
        <template #Legacy>
          <NewInstanceLegacyFields v-model="newInstanceDialog" :build-instance="buildInstance" :build-legacy-instance="buildLegacyInstance" />
        </template>
      </TabsUnderline>
      <DialogFooter v-if="newInstanceDialog.selectedTab === 'Normal'">
        <template v-if="newInstanceDialog.instanceCreated">
          <Button variant="outline" class="mr-2" @click="copyInstanceUrl(newInstanceDialog.location)">{{ t("dialog.new_instance.copy_url") }}</Button>
          <Button variant="outline" class="mr-2" @click="selfInvite(newInstanceDialog.location)">{{ t("dialog.new_instance.self_invite") }}</Button>
          <Button
            variant="outline"
            class="mr-2"
            :disabled="(newInstanceDialog.accessType === 'friends' || newInstanceDialog.accessType === 'invite') && newInstanceDialog.userId !== currentUser.id"
            @click="showInviteDialog(newInstanceDialog.location)"
            >{{ t("dialog.new_instance.invite") }}</Button
          >
          <template v-if="canOpenInstanceInGame">
            <Button variant="secondary" class="mr-2" @click="showLaunchDialog(newInstanceDialog.location, newInstanceDialog.shortName)">{{
              t("dialog.new_instance.launch")
            }}</Button>
            <Button @click="handleAttachGame(newInstanceDialog.location, newInstanceDialog.shortName)">
              {{ t("dialog.new_instance.open_ingame") }}
            </Button>
          </template>
          <template v-else>
            <Button @click="showLaunchDialog(newInstanceDialog.location, newInstanceDialog.shortName)">{{ t("dialog.new_instance.launch") }}</Button>
          </template>
        </template>
        <template v-else>
          <Button @click="handleCreateNewInstance">{{ t("dialog.new_instance.create_instance") }}</Button>
        </template>
      </DialogFooter>
      <DialogFooter v-else-if="newInstanceDialog.selectedTab === 'Legacy'">
        <Button variant="outline" class="mr-2" @click="copyInstanceUrl(newInstanceDialog.location)">{{ t("dialog.new_instance.copy_url") }}</Button>
        <Button variant="outline" class="mr-2" @click="selfInvite(newInstanceDialog.location)">{{ t("dialog.new_instance.self_invite") }}</Button>
        <Button
          variant="outline"
          :disabled="
            (newInstanceDialog.accessType === 'friends' || newInstanceDialog.accessType === 'invite') && newInstanceDialog.legacyUserId !== currentUser.id
          "
          @click="showInviteDialog(newInstanceDialog.location)"
          >{{ t("dialog.new_instance.invite") }}</Button
        >
        <template v-if="canOpenInstanceInGame">
          <Button variant="secondary" class="mr-2" @click="showLaunchDialog(newInstanceDialog.location, newInstanceDialog.shortName)">{{
            t("dialog.new_instance.launch")
          }}</Button>
          <Button @click="handleAttachGame(newInstanceDialog.location, newInstanceDialog.shortName)">
            {{ t("dialog.new_instance.open_ingame") }}
          </Button>
        </template>
        <template v-else>
          <Button @click="showLaunchDialog(newInstanceDialog.location, newInstanceDialog.shortName)">{{ t("dialog.new_instance.launch") }}</Button>
        </template>
      </DialogFooter>
    </DialogContent>

    <InviteDialog :invite-dialog="inviteDialog" @close-invite-dialog="closeInviteDialog" />
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, toRef } from "vue";
import Button from "@/components/ui/button/Button.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { copyToClipboard } from "../../../shared/utils/app-actions";
import { getLaunchURL, isRealInstance } from "../../../shared/utils/instance";
import { parseLocation } from "../../../shared/utils/location-parser";
import { useFriendStore } from "../../../stores/friend";
import { logFailure } from "../../../stores/log-failure";
import { useInviteStore } from "../../../stores/invite";
import { useLaunchStore } from "../../../stores/launch";
import { useLocationStore } from "../../../stores/location";
import { useUserStore } from "../../../stores/user";
import { instanceRequest } from "../../../api/instance";
import { queryRequest } from "../../../api/query-request";
import { useNewInstanceBuilder } from "./use-new-instance-builder";
import NewInstanceNormalFields from "./NewInstanceNormalFields.vue";
import NewInstanceLegacyFields from "./NewInstanceLegacyFields.vue";

import InviteDialog from "../InviteDialog/InviteDialog.vue";
import type { InviteDialogState } from "../InviteDialog/invite-dialog-types";

const props = defineProps<{
  newInstanceDialogLocationTag: string;
}>();
const newInstanceTabs = computed(() => [
  { value: "Normal", label: t("dialog.new_instance.normal") },
  { value: "Legacy", label: t("dialog.new_instance.legacy") },
]);

const { t } = useI18n();

const { friends } = storeToRefs(useFriendStore());
const { lastLocation } = storeToRefs(useLocationStore());
const { showLaunchDialog, tryOpenInstanceInVrc } = useLaunchStore();
const { currentUser } = storeToRefs(useUserStore());
const { canOpenInstanceInGame } = useInviteStore();

const {
  newInstanceDialog,
  buildInstance,
  buildLegacyInstance,
  updateNewInstanceDialog,
  handleCreateNewInstance,
  newInstanceTabClick,
  handleRoleIdsChange,
  handleLanguagesChange,
  handleVibeIdsChange,
  handleCategoryIdChange,
} = useNewInstanceBuilder(toRef(props, "newInstanceDialogLocationTag"));

const inviteDialog = ref<InviteDialogState>({
  visible: false,
  loading: false,
  worldId: "",
  worldName: "",
  userIds: [],
  friendsInInstance: [],
});

function closeInviteDialog() {
  inviteDialog.value.visible = false;
}

function showInviteDialog(tag: string) {
  if (!isRealInstance(tag)) {
    return;
  }
  const L = parseLocation(tag);
  void queryRequest
    .fetch("world", {
      worldId: L.worldId,
    })
    .then((args) => {
      const D = inviteDialog.value;
      D.userIds = [];
      D.worldId = L.tag;
      D.worldName = args.ref.name;
      D.friendsInInstance = [];
      const friendsInCurrentInstance = lastLocation.value.friendList;
      for (const friend of friendsInCurrentInstance.values()) {
        const ctx = friends.value.get(friend.userId);
        if (typeof ctx?.ref === "undefined") {
          continue;
        }
        D.friendsInInstance.push(ctx);
      }
      D.visible = true;
    })
    .catch(logFailure("Loading the world for the invite dialog failed:"));
}

function handleAttachGame(location: string, shortName: string) {
  void tryOpenInstanceInVrc(location, shortName).catch(logFailure("Opening the instance in VRChat failed:"));
  closeInviteDialog();
}

function selfInvite(location: string) {
  const L = parseLocation(location);
  if (!L.isRealInstance) {
    return;
  }
  void instanceRequest
    .selfInvite({
      instanceId: L.instanceId,
      worldId: L.worldId,
    })
    .then((args) => {
      toast.success(t("message.invite.self_sent"));
      return args;
    })
    .catch(logFailure("Sending the self invite failed:"));
}

async function copyInstanceUrl(location: string) {
  const L = parseLocation(location);
  const args = await instanceRequest.getInstanceShortName({
    worldId: L.worldId,
    instanceId: L.instanceId,
  });
  if (args.json.shortName) {
    L.shortName = args.json.shortName;
  }
  const resLocation = `${args.instance.worldId}:${args.instance.instanceId}`;
  if (resLocation === newInstanceDialog.value.location) {
    const shortName = args.json.shortName ?? "";
    let secureOrShortName = args.json.secureName;
    if (args.json.shortName) {
      secureOrShortName = args.json.shortName;
    }
    newInstanceDialog.value.shortName = shortName;
    newInstanceDialog.value.secureOrShortName = secureOrShortName;
    updateNewInstanceDialog(true);
  }
  const newUrl = getLaunchURL(L);
  copyToClipboard(newUrl);
}
</script>
