<template>
  <Dialog v-model:open="isVisible">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.export_own_avatars.header") }}</DialogTitle>
      </DialogHeader>
      <div class="mt-4 flex items-center justify-between text-xs">
        <span class="name mr-6">{{ t("dialog.export_own_avatars.public_only") }}</span>
        <Switch v-model="publicOnly" />
      </div>
      <InputGroupTextareaField :model-value="exportAvatarsListCsv" :rows="15" readonly input-class="resize-none mt-2" @click="selectTextareaOnClick" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAvatarStore } from "../../../stores/avatar";
import { useUserStore } from "../../../stores/user";
import { applyAvatar, removeAvatarFromCache } from "../../../coordinators/avatar-coordinator";
import { avatarRequest } from "../../../api/avatar";
import { escapeCsvField } from "./csv-field";
import { processBulk } from "../../../services/request";
import { logError } from "../../../stores/vrcx-messages";
import Switch from "../../../components/ui/switch/Switch.vue";

const { t } = useI18n();

const { cachedAvatars } = useAvatarStore();
const { currentUser } = storeToRefs(useUserStore());

const props = defineProps<{
  isExportAvatarsListDialogVisible: boolean;
}>();

type AvatarRow = ReturnType<typeof applyAvatar>;

const avatars = ref<AvatarRow[]>([]);
const publicOnly = ref(false);
const loading = ref(false);

function selectTextareaOnClick(event: MouseEvent) {
  const target = event.target;
  if (target instanceof HTMLTextAreaElement) {
    target.select();
  }
}

const exportAvatarsListCsv = computed(() => {
  const lines = ["AvatarID,AvatarName"];
  for (const avatar of avatars.value) {
    if (publicOnly.value && avatar.releaseStatus !== "public") {
      continue;
    }
    lines.push(`${escapeCsvField(avatar.id)},${escapeCsvField(avatar.name)}`);
  }
  return lines.join("\n");
});

const isVisible = computed({
  get() {
    return props.isExportAvatarsListDialogVisible;
  },
  set(isOpen: boolean) {
    emit("update:isExportAvatarsListDialogVisible", isOpen);
  },
});

const emit = defineEmits<{
  "update:isExportAvatarsListDialogVisible": [value: boolean];
}>();

watch(
  () => props.isExportAvatarsListDialogVisible,
  (isOpen) => {
    if (isOpen) {
      initExportAvatarsListDialog();
    }
  }
);

function initExportAvatarsListDialog() {
  loading.value = true;
  for (const ref of cachedAvatars.values()) {
    if (ref.authorId === currentUser.value.id) {
      removeAvatarFromCache(ref.id);
    }
  }
  const params = {
    n: 50,
    offset: 0,
    sort: "updated",
    order: "descending",
    releaseStatus: "all",
    user: "me",
  } satisfies Parameters<typeof avatarRequest.getAvatars>[0];
  const map = new Map<string, AvatarRow>();
  void processBulk({
    fn: (bulkParams) => avatarRequest.getAvatars(bulkParams),
    N: -1,
    params,
    handle: (args) => {
      for (const json of args.json) {
        const ref = applyAvatar(json);
        map.set(ref.id, ref);
      }
    },
    done: () => {
      avatars.value = Array.from(map.values());
      loading.value = false;
    },
  }).catch(logError);
}
</script>
