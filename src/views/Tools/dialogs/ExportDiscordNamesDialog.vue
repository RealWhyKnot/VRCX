<template>
  <Dialog :open="discordNamesDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.discord_names.header") }}</DialogTitle>
      </DialogHeader>
      <div class="text-xs">
        {{ t("dialog.discord_names.description") }}
      </div>
      <InputGroupTextareaField v-model="discordNamesContent" :rows="15" readonly input-class="resize-none mt-4" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { ref, watch } from "vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { database } from "../../../services/database";
import { escapeCsvField } from "./csv-field";
import { replaceBioSymbols } from "../../../shared/utils/base/string";
import { useUserStore } from "../../../stores/user";
import { logError } from "../../../stores/vrcx-messages";
import type { FriendContext } from "../../../stores/friend-types";

const { t } = useI18n();
const { currentUser } = storeToRefs(useUserStore());

const props = withDefaults(
  defineProps<{
    discordNamesDialogVisible?: boolean | undefined;
    friends?: Map<string, FriendContext> | undefined;
  }>(),
  {
    discordNamesDialogVisible: false,
    friends: () => new Map<string, FriendContext>(),
  }
);

watch(
  () => props.discordNamesDialogVisible,
  (isVisible) => {
    if (isVisible) {
      void showDiscordNamesContent().catch(logError);
    }
  }
);

const emit = defineEmits<{
  "update:discordNamesDialogVisible": [value: boolean];
}>();

const discordNamesContent = ref("");

async function showDiscordNamesContent() {
  const { friends } = currentUser.value;
  if (!Array.isArray(friends)) {
    return;
  }
  const profiles = await database.getAllUserProfiles();
  const bioByUserId = new Map(profiles.map((profile) => [profile.userId, replaceBioSymbols(profile.bio)]));
  const lines = ["DisplayName,DiscordName"];
  for (const userId of friends) {
    let discord = "";
    const friend = props.friends.get(userId);
    if (typeof friend?.ref === "undefined") {
      continue;
    }
    const ref = friend.ref;
    const name = ref.displayName;
    if (ref.statusDescription) {
      const statusRegex = /(?:discord|dc|dis)(?: |=|:|˸|;)(.*)/gi.exec(ref.statusDescription);
      if (statusRegex) {
        discord = statusRegex[1] ?? "";
      }
    }
    const bio = bioByUserId.get(userId);
    if (!discord && bio) {
      const bioRegex = /(?:discord|dc|dis)(?: |=|:|˸|;)(.*)/gi.exec(bio);
      if (bioRegex) {
        discord = bioRegex[1] ?? "";
      }
    }
    if (!discord) {
      continue;
    }
    discord = discord.trim();
    lines.push(`${escapeCsvField(name)},${escapeCsvField(discord)}`);
  }
  discordNamesContent.value = lines.join("\n");
}

function closeDialog() {
  emit("update:discordNamesDialogVisible", false);
}
</script>
