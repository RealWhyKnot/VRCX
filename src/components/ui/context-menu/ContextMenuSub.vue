<script setup lang="ts">
import type { ContextMenuSubProps } from "reka-ui";
import type { ContextMenuSubEmits } from "reka-ui";

import { ContextMenuSub, useForwardPropsEmits } from "reka-ui";

const props = defineProps<{
  defaultOpen?: ContextMenuSubProps["defaultOpen"];
  open?: ContextMenuSubProps["open"];
}>();
const emits = defineEmits<Pick<ContextMenuSubEmits, "update:open">>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <ContextMenuSub data-slot="context-menu-sub" v-bind="forwarded">
    <slot />
  </ContextMenuSub>
</template>
