<script setup lang="ts">
import type { ClassValue } from "clsx";
import { AvatarRoot } from "reka-ui";
import { cn } from "@/lib/utils";

defineOptions({ name: "UiAvatar" });

const props = defineProps<{ class?: ClassValue }>();
</script>

<template>
  <AvatarRoot data-slot="avatar" :class="cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', props.class)">
    <slot />
  </AvatarRoot>
</template>
