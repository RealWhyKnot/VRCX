<script setup lang="ts">
import type { ClassValue } from "clsx";
import { ErrorMessage } from "vee-validate";
import { cn } from "@/lib/utils";
import { toValue } from "vue";

import { useFormField } from "./use-form-field";

const props = defineProps<{ class?: ClassValue }>();

const { name, formMessageId } = useFormField();
</script>

<template>
  <ErrorMessage :id="formMessageId" data-slot="form-message" as="p" :name="toValue(name)" :class="cn('text-destructive text-sm', props.class)" />
</template>
