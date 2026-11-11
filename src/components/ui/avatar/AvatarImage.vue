<script setup lang="ts">
import type { AvatarImageProps } from "reka-ui";
import { AvatarImage } from "reka-ui";

const props = defineProps<AvatarImageProps & { src: string; loading?: "lazy" | "eager" }>();
const delegatedProps: Record<string, unknown> = props;
</script>

<template>
  <AvatarImage data-slot="avatar-image" :src="props.src" v-bind="delegatedProps" class="aspect-square size-full">
    <slot />
  </AvatarImage>
</template>
