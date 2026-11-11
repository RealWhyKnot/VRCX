<script setup lang="ts">
import type { CalendarGridHeadProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { CalendarGridHead } from "reka-ui";

const props = defineProps<CalendarGridHeadProps & { class?: ClassValue | undefined }>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <CalendarGridHead data-slot="calendar-grid-head" v-bind="delegatedProps">
    <slot />
  </CalendarGridHead>
</template>
