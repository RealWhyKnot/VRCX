<script setup lang="ts">
import type { ClassValue } from "clsx";
import { defaultDocument, useEventListener, useMediaQuery, useVModel } from "@vueuse/core";
import { computed, ref } from "vue";
import { TooltipProvider } from "reka-ui";
import { cn } from "@/lib/utils";

import { SIDEBAR_COOKIE_MAX_AGE, SIDEBAR_COOKIE_NAME, SIDEBAR_KEYBOARD_SHORTCUT, SIDEBAR_WIDTH, SIDEBAR_WIDTH_ICON, provideSidebarContext } from "./utils";

const props = withDefaults(
  defineProps<{
    defaultOpen?: boolean;
    open?: boolean | undefined;
    width?: string | number | undefined;
    widthIcon?: string | number | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    defaultOpen: () => !defaultDocument?.cookie.includes(`${SIDEBAR_COOKIE_NAME}=false`),
    open: undefined,
    width: undefined,
    widthIcon: undefined,
    class: undefined,
  }
);

const emits = defineEmits<{ "update:open": [value: boolean] }>();

const isMobile = useMediaQuery("(max-width: 768px)");
const openMobile = ref(false);

const open =
  props.open === undefined
    ? useVModel(props, "open", emits, {
        defaultValue: props.defaultOpen,
        passive: true,
      })
    : useVModel(props, "open", emits, {
        defaultValue: props.defaultOpen,
        passive: false,
      });

function setOpen(isOpen: boolean) {
  open.value = isOpen;

  document.cookie = `${SIDEBAR_COOKIE_NAME}=${open.value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
}

function setOpenMobile(isOpen: boolean) {
  openMobile.value = isOpen;
}

function toggleSidebar() {
  if (isMobile.value) {
    setOpenMobile(!openMobile.value);
  } else {
    setOpen(!open.value);
  }
}

useEventListener("keydown", (event) => {
  if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
    event.preventDefault();
    toggleSidebar();
  }
});

const state = computed(() => (open.value ? "expanded" : "collapsed"));

const normalizeCssSize = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}px`;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
};

const cssSidebarWidth = computed(() => normalizeCssSize(props.width) ?? SIDEBAR_WIDTH);
const cssSidebarWidthIcon = computed(() => normalizeCssSize(props.widthIcon) ?? SIDEBAR_WIDTH_ICON);

provideSidebarContext({
  state,
  open,
  setOpen,
  isMobile,
  openMobile,
  setOpenMobile,
  toggleSidebar,
});
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <div
      data-slot="sidebar-wrapper"
      :style="{
        '--sidebar-width': cssSidebarWidth,
        '--sidebar-width-icon': cssSidebarWidthIcon,
      }"
      :class="cn('group/sidebar-wrapper has-data-[variant=inset]:bg-sidebar flex w-full', props.class)"
      v-bind="$attrs"
    >
      <slot />
    </div>
  </TooltipProvider>
</template>
