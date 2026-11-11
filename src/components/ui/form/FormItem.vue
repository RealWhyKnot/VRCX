<script setup lang="ts">
import type { ClassValue } from "clsx";
import { cn } from "@/lib/utils";
import { provide } from "vue";
import { useId } from "reka-ui";

import { FORM_ITEM_INJECTION_KEY } from "./injection-keys";

const props = defineProps<{ class?: ClassValue }>();

const id = useId();
provide(FORM_ITEM_INJECTION_KEY, id);
</script>

<template>
  <div data-slot="form-item" :class="cn('grid gap-2', props.class)">
    <slot />
  </div>
</template>
