<template>
  <div class="group/header flex shrink-0 items-center justify-between border-b px-2.5 py-0">
    <div
      class="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      @click="navigateToPage"
    >
      <i :class="icon" class="text-sm"></i>
      <span>{{ title }}</span>
      <ExternalLink class="size-3 opacity-0 transition-opacity group-hover/header:opacity-100" />
    </div>
    <div class="opacity-0 transition-opacity group-hover/header:opacity-100">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ExternalLink } from "lucide-vue-next";
import { useRouter } from "vue-router";

import { logFailure } from "@/stores/log-failure";

const props = withDefaults(
  defineProps<{
    title: string;
    icon?: string;
    routeName?: string;
  }>(),
  {
    icon: "",
    routeName: "",
  }
);

const router = useRouter();

function navigateToPage() {
  if (props.routeName) {
    void router.push({ name: props.routeName }).catch(logFailure("Failed to open widget page"));
  }
}
</script>
