<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { useForwardPropsEmits } from "reka-ui";

import Command from "./Command.vue";

const props = defineProps({
  open: { type: Boolean, required: false },
  defaultOpen: { type: Boolean, required: false },
  modal: { type: Boolean, required: false },
  title: { type: String, required: false, default: "Command Palette" },
  description: {
    type: String,
    required: false,
    default: "Search for a command to run...",
  },
});
const emits = defineEmits(["update:open"]);

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <Dialog v-slot="slotProps" v-bind="forwarded">
    <DialogContent class="overflow-hidden p-0">
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <Command>
        <slot v-bind="slotProps" />
      </Command>
    </DialogContent>
  </Dialog>
</template>
