<script setup lang="ts">
import type { CalendarGridBodyProps } from "reka-ui";
import { CalendarGridBody } from "reka-ui";

const props = defineProps<CalendarGridBodyProps>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <CalendarGridBody data-slot="calendar-grid-body" v-bind="delegatedProps">
    <slot />
  </CalendarGridBody>
</template>
