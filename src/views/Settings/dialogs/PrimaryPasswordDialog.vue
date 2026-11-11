<template>
  <Dialog v-model:open="enablePrimaryPasswordDialog.visible">
    <DialogContent @interact-outside.prevent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.primary_password.header") }}</DialogTitle>
      </DialogHeader>
      <InputGroupField
        v-model="enablePrimaryPasswordDialog.password"
        :placeholder="t('dialog.primary_password.password_placeholder')"
        type="password"
        size="sm"
        :maxlength="32"
        autofocus
      />
      <InputGroupField
        v-model="enablePrimaryPasswordDialog.rePassword"
        class="mt-1.5"
        :placeholder="t('dialog.primary_password.re_input_placeholder')"
        type="password"
        size="sm"
        :maxlength="32"
      />
      <DialogFooter>
        <Button
          :disabled="enablePrimaryPasswordDialog.password.length === 0 || enablePrimaryPasswordDialog.password !== enablePrimaryPasswordDialog.rePassword"
          @click="handleSetPrimaryPassword()"
        >
          {{ t("dialog.primary_password.ok") }}
        </Button>
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
import Button from "@/components/ui/button/Button.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAuthStore } from "../../../stores/auth";

const { t } = useI18n();

const authStore = useAuthStore();
const { enablePrimaryPasswordDialog } = storeToRefs(authStore);
const { setPrimaryPassword } = authStore;

function handleSetPrimaryPassword() {
  setPrimaryPassword();
  enablePrimaryPasswordDialog.value.visible = false;
}
</script>
