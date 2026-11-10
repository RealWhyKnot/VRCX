<script setup lang="ts">
import type { DropdownMenuSubProps } from "reka-ui";
import type { DropdownMenuSubEmits } from "reka-ui";

import { DropdownMenuSub, useForwardPropsEmits } from "reka-ui";

const props = defineProps<{
  defaultOpen?: DropdownMenuSubProps["defaultOpen"];
  open?: DropdownMenuSubProps["open"];
}>();
const emits = defineEmits<Pick<DropdownMenuSubEmits, "update:open">>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuSub v-slot="slotProps" data-slot="dropdown-menu-sub" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </DropdownMenuSub>
</template>
