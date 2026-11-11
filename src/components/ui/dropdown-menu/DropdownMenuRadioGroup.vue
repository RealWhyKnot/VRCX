<script setup lang="ts">
import type { DropdownMenuRadioGroupProps } from "reka-ui";
import { DropdownMenuRadioGroup, useForwardPropsEmits } from "reka-ui";
import type { DropdownMenuRadioGroupEmits } from "reka-ui";

const props = defineProps<DropdownMenuRadioGroupProps>();
const delegatedProps: Record<string, unknown> = props;
const emits = defineEmits<DropdownMenuRadioGroupEmits>();

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <DropdownMenuRadioGroup data-slot="dropdown-menu-radio-group" v-bind="forwarded">
    <slot />
  </DropdownMenuRadioGroup>
</template>
