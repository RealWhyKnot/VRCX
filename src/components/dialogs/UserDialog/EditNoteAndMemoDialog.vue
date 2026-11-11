<template>
  <Dialog
    :open="props.visible"
    @update:open="
      (open) => {
        if (!open) cancel();
      }
    "
  >
    <DialogContent class="x-dialog sm:max-w-125 translate-y-0" style="top: 10vh" :show-close-button="false">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.user.note_memo.header") }}</DialogTitle>
      </DialogHeader>

      <div>
        <template v-if="!hideUserNotes || (hideUserNotes && hideUserMemos)">
          <span class="name">{{ t("dialog.user.info.note") }}</span>
          <InputGroupTextareaField
            v-model="note"
            :autosize="{ minRows: 6, maxRows: 20 }"
            :maxlength="256"
            :rows="6"
            :placeholder="t('dialog.user.info.note_placeholder')"
            input-class="text-xs resize-none"
            class="my-2"
            show-count
          />
        </template>
        <template v-if="!hideUserMemos || (hideUserNotes && hideUserMemos)">
          <span class="name">{{ t("dialog.user.info.memo") }}</span>
          <InputGroupTextareaField
            v-model="memo"
            class="text-xs mt-2"
            :rows="6"
            :placeholder="t('dialog.user.info.memo_placeholder')"
            input-class="resize-none min-h-0"
          />
        </template>
      </div>

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="cancel">{{ t("dialog.user.note_memo.cancel") }}</Button>
        <Button @click="saveChanges">{{ t("dialog.user.note_memo.confirm") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { miscRequest } from "../../../api/misc";
import { userRequest } from "../../../api/user";
import { replaceBioSymbols } from "../../../shared/utils/base/string";
import { saveUserMemo } from "../../../coordinators/memo-coordinator";
import { useAppearanceSettingsStore } from "../../../stores/settings/appearance";
import { useUserStore } from "../../../stores/user";
import type { VrcxUser } from "../../../types/vrcx";
import type { UpdateUserNoteRequest } from "vrchat";

const { userDialog } = storeToRefs(useUserStore());
const { cachedUsers } = useUserStore();
const { hideUserNotes, hideUserMemos } = storeToRefs(useAppearanceSettingsStore());

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const note = ref("");
const memo = ref("");

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) return;
    note.value = userDialog.value.note;
    memo.value = userDialog.value.memo;
  }
);

function logRejection(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}

function saveChanges() {
  checkNote(userDialog.value.ref, note.value);
  onUserMemoChange();
  emit("update:visible", false);
}

function cancel() {
  emit("update:visible", false);
}

function checkNote(user: Partial<VrcxUser>, noteValue: string) {
  if (user.note !== noteValue) {
    void addNote(user.id ?? "", noteValue).catch(logRejection("Failed to save note:"));
  }
}

async function addNote(userId: string, noteValue: string) {
  const args = await miscRequest.saveNote({
    targetUserId: userId,
    note: noteValue,
  });
  handleNoteChange(args);
}

function handleNoteChange(args: { json: unknown; params: UpdateUserNoteRequest }) {
  const noteText = replaceBioSymbols(typeof args.json === "object" && args.json !== null && "note" in args.json ? args.json.note : undefined);
  const targetUserId = args.params.targetUserId;
  if (targetUserId === userDialog.value.id) {
    if (noteText === args.params.note) {
      userDialog.value.note = noteText;
    } else {
      void userRequest.getUser({ userId: targetUserId }).catch(logRejection("Failed to reload user:"));
    }
  }
  const cachedUser = cachedUsers.get(targetUserId);
  if (typeof cachedUser !== "undefined") {
    cachedUser.note = noteText;
  }
}

function onUserMemoChange() {
  const D = userDialog.value;
  void saveUserMemo(D.id, memo.value).catch(logRejection("Failed to save memo:"));
}
</script>
