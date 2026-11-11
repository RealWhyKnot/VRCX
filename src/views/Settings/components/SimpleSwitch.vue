<template>
  <div class="simple-switch">
    <div class="name" :style="{ '--simple-switch-name-width': longLabel ? '300px' : undefined }">
      {{ label }}
      <TooltipWrapper v-if="tooltip" side="top" :content="tooltip">
        <Info class="tooltip" />
      </TooltipWrapper>
    </div>

    <Switch class="switch" :model-value="value" :disabled="disabled" @update:model-value="change" />
  </div>
</template>

<script setup lang="ts">
import { Info } from "lucide-vue-next";

import Switch from "../../../components/ui/switch/Switch.vue";
defineProps<{
  label?: string;
  value?: boolean;
  tooltip?: string;
  disabled?: boolean;
  longLabel?: boolean;
}>();

const emit = defineEmits<{ change: [event: boolean] }>();

function change(isEnabled: boolean) {
  emit("change", isEnabled);
}
</script>

<style scoped>
.simple-switch {
  font-size: 12px;
  display: flex;
  align-items: center;
}

.simple-switch > .name {
  width: var(--simple-switch-name-width, 225px);
  min-width: 225px;
  overflow-wrap: break-word;
  padding-top: 7px;
  display: flex;
  align-items: center;
}

.simple-switch > .switch {
  margin-left: 8px;
}

.simple-switch .tooltip {
  margin-left: 3px;
}
</style>
