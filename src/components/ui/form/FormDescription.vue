<script setup lang="ts">
import { cn } from "@/lib/utils";

import { useFormField } from "./use-form-field";

const props = defineProps<{ class?: unknown }>();

const { formDescriptionId } = useFormField();
</script>

<template>
  <p :id="formDescriptionId" data-slot="form-description" :class="cn('text-muted-foreground text-sm', props.class)">
    <slot />
  </p>
</template>
