<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <fieldset
    data-slot="field-set"
    :class="cn('flex flex-col gap-6', 'has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3', props.class)"
  >
    <slot />
  </fieldset>
</template>
