<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { MinusIcon } from "lucide-vue-next";
import { useForwardProps } from "reka-ui";

const props = defineProps<{ class?: HTMLAttributes extends { class?: infer Value } ? Value : never }>();

const forwarded = useForwardProps(props);
</script>

<template>
  <div data-slot="input-otp-separator" role="separator" v-bind="forwarded">
    <slot>
      <MinusIcon />
    </slot>
  </div>
</template>
