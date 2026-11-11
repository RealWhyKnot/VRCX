<script setup lang="ts">
import type { DropdownMenuGroupProps } from "reka-ui";
import { DropdownMenuGroup } from "reka-ui";

const props = defineProps<DropdownMenuGroupProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <DropdownMenuGroup data-slot="dropdown-menu-group" v-bind="delegatedProps">
    <slot />
  </DropdownMenuGroup>
</template>
