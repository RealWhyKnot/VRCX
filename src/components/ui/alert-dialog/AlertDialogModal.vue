<script setup lang="ts">
import AlertDialog from "@/components/ui/alert-dialog/AlertDialog.vue";
import AlertDialogAction from "@/components/ui/alert-dialog/AlertDialogAction.vue";
import AlertDialogCancel from "@/components/ui/alert-dialog/AlertDialogCancel.vue";
import AlertDialogContent from "@/components/ui/alert-dialog/AlertDialogContent.vue";
import AlertDialogDescription from "@/components/ui/alert-dialog/AlertDialogDescription.vue";
import AlertDialogFooter from "@/components/ui/alert-dialog/AlertDialogFooter.vue";
import AlertDialogHeader from "@/components/ui/alert-dialog/AlertDialogHeader.vue";
import AlertDialogTitle from "@/components/ui/alert-dialog/AlertDialogTitle.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import { storeToRefs } from "pinia";
import { useModalStore } from "@/stores/modal";
import { nextTick, ref, watch } from "vue";

const modalStore = useModalStore();

const {
  alertOpen,
  alertMode,
  alertTitle,
  alertDescription,
  alertOkText,
  alertCancelText,
  alertDismissible,
  alertDestructive,
  alertCheckboxLabel,
  alertChecked,
} = storeToRefs(modalStore);

const actionRef = ref(null);

function onEscapeKeyDown(event) {
  if (!alertDismissible.value) {
    event.preventDefault();
    return;
  }
  modalStore.handleDismiss();
}

function onPointerDownOutside(event) {
  if (!alertDismissible.value) {
    event.preventDefault();
    return;
  }
  modalStore.handleDismiss();
}

function onInteractOutside(event) {
  if (!alertDismissible.value) {
    event.preventDefault();
    return;
  }
  modalStore.handleDismiss();
}

watch(alertOpen, async (newVal) => {
  if (newVal) {
    await nextTick();
    await nextTick();
    actionRef.value?.$el?.focus?.();
  }
});
</script>

<template>
  <AlertDialog :open="alertOpen" @update:open="modalStore.setAlertOpen">
    <AlertDialogContent @escape-key-down="onEscapeKeyDown" @pointer-down-outside="onPointerDownOutside" @interact-outside="onInteractOutside">
      <AlertDialogHeader class="min-w-0">
        <AlertDialogTitle>{{ alertTitle }}</AlertDialogTitle>
        <AlertDialogDescription class="w-full min-w-0 whitespace-normal wrap-anywhere">
          {{ alertDescription }}
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter>
        <label v-if="alertCheckboxLabel" class="inline-flex items-center gap-2 text-sm sm:mr-auto">
          <Checkbox v-model="alertChecked" />
          <span>{{ alertCheckboxLabel }}</span>
        </label>
        <AlertDialogCancel v-if="alertMode === 'confirm'" @click="modalStore.handleCancel">
          {{ alertCancelText }}
        </AlertDialogCancel>

        <AlertDialogAction ref="actionRef" :variant="alertDestructive ? 'destructive' : undefined" @click="modalStore.handleOk">
          {{ alertOkText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
