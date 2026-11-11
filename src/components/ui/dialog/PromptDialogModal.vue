<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import FormControl from "@/components/ui/form/FormControl.vue";
import { Field as FormField } from "vee-validate";
import FormItem from "@/components/ui/form/FormItem.vue";
import FormLabel from "@/components/ui/form/FormLabel.vue";
import FormMessage from "@/components/ui/form/FormMessage.vue";
import Button from "@/components/ui/button/Button.vue";
import Input from "@/components/ui/input/Input.vue";
import { storeToRefs } from "pinia";
import { useForm } from "vee-validate";
import { useModalStore } from "@/stores/modal";
import { watch } from "vue";

const modalStore = useModalStore();

const {
  promptOpen,
  promptTitle,
  promptDescription,
  promptOkText,
  promptCancelText,
  promptDismissible,
  promptInputValue,
  promptInputType,
  promptPattern,
  promptErrorMessage,
} = storeToRefs(modalStore);

const { handleSubmit, resetForm, values } = useForm<{ value: string }>({
  initialValues: {
    value: "",
  },
});

function fieldBindings(field: object): Record<string, unknown> {
  return { ...field };
}

const validateValue = (value: unknown) => {
  const pattern: RegExp | string | null = promptPattern.value;
  if (!pattern) return true;
  let regex: RegExp | string = pattern;
  if (typeof regex === "string") {
    try {
      regex = new RegExp(regex);
    } catch {
      return promptErrorMessage.value;
    }
  }
  if (!(regex instanceof RegExp)) {
    return true;
  }
  return regex.test(typeof value === "string" ? value : "") || promptErrorMessage.value;
};

const onSubmit = handleSubmit((formValues) => {
  modalStore.handlePromptOk(formValues.value);
});

function onEscapeKeyDown(event: Event) {
  if (!promptDismissible.value) {
    event.preventDefault();
    return;
  }
  modalStore.handlePromptDismiss(values.value);
}

function onPointerDownOutside(event: Event) {
  if (!promptDismissible.value) {
    event.preventDefault();
    return;
  }
  modalStore.handlePromptDismiss(values.value);
}

function onInteractOutside(event: Event) {
  if (!promptDismissible.value) {
    event.preventDefault();
    return;
  }
  modalStore.handlePromptDismiss(values.value);
}

function handleCancel() {
  modalStore.handlePromptCancel(values.value);
}

watch(
  [promptOpen, promptInputValue],
  ([isOpen, inputValue]) => {
    if (isOpen) {
      resetForm({
        values: {
          value: inputValue,
        },
      });
      return;
    }

    resetForm({
      values: {
        value: "",
      },
    });
  },
  { immediate: true }
);
</script>

<template>
  <Dialog :open="promptOpen" @update:open="modalStore.setPromptOpen">
    <DialogContent
      :show-close-button="false"
      @escape-key-down="onEscapeKeyDown"
      @pointer-down-outside="onPointerDownOutside"
      @interact-outside="onInteractOutside"
    >
      <form @submit="onSubmit">
        <DialogHeader class="mb-5">
          <DialogTitle>{{ promptTitle }}</DialogTitle>
          <DialogDescription>{{ promptDescription }}</DialogDescription>
        </DialogHeader>

        <FormField
          v-slot="{ componentField }"
          name="value"
          :rules="validateValue"
          :validate-on-blur="false"
          :validate-on-change="false"
          :validate-on-input="false"
          :validate-on-model-update="false"
        >
          <FormItem>
            <FormLabel class="sr-only">Input</FormLabel>
            <FormControl>
              <Input v-bind="fieldBindings(componentField)" :type="promptInputType" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="mt-5">
          <Button type="button" variant="outline" @click="handleCancel">
            {{ promptCancelText }}
          </Button>
          <Button type="submit">
            {{ promptOkText }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
