<script setup lang="ts">
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon, XIcon } from "lucide-vue-next";
import type { ToasterProps } from "vue-sonner";
import { Toaster as Sonner } from "vue-sonner";
import { cn } from "@/lib/utils";
import { computed } from "vue";

defineOptions({ name: "UiSonner" });

const props = defineProps<{
  id?: ToasterProps["id"];
  invert?: boolean;
  theme?: ToasterProps["theme"];
  position?: ToasterProps["position"];
  closeButtonPosition?: ToasterProps["closeButtonPosition"];
  hotkey?: ToasterProps["hotkey"];
  richColors?: boolean;
  expand?: boolean;
  duration?: ToasterProps["duration"];
  gap?: ToasterProps["gap"];
  visibleToasts?: ToasterProps["visibleToasts"];
  closeButton?: boolean;
  toastOptions?: ToasterProps["toastOptions"];
  class?: ToasterProps["class"];
  style?: ToasterProps["style"];
  offset?: ToasterProps["offset"];
  mobileOffset?: ToasterProps["mobileOffset"];
  dir?: ToasterProps["dir"];
  swipeDirections?: ToasterProps["swipeDirections"];
  icons?: ToasterProps["icons"];
  containerAriaLabel?: ToasterProps["containerAriaLabel"];
}>();

const toasterProps = computed(() => ({
  ...(props.id === undefined ? {} : { id: props.id }),
  invert: props.invert,
  ...(props.theme === undefined ? {} : { theme: props.theme }),
  ...(props.position === undefined ? {} : { position: props.position }),
  ...(props.closeButtonPosition === undefined ? {} : { closeButtonPosition: props.closeButtonPosition }),
  ...(props.hotkey === undefined ? {} : { hotkey: props.hotkey }),
  richColors: props.richColors,
  expand: props.expand,
  ...(props.duration === undefined ? {} : { duration: props.duration }),
  ...(props.gap === undefined ? {} : { gap: props.gap }),
  ...(props.visibleToasts === undefined ? {} : { visibleToasts: props.visibleToasts }),
  closeButton: props.closeButton,
  ...(props.toastOptions === undefined ? {} : { toastOptions: props.toastOptions }),
  ...(props.class === undefined ? {} : { class: props.class }),
  ...(props.style === undefined ? {} : { style: props.style }),
  ...(props.offset === undefined ? {} : { offset: props.offset }),
  ...(props.mobileOffset === undefined ? {} : { mobileOffset: props.mobileOffset }),
  ...(props.dir === undefined ? {} : { dir: props.dir }),
  ...(props.swipeDirections === undefined ? {} : { swipeDirections: props.swipeDirections }),
  ...(props.icons === undefined ? {} : { icons: props.icons }),
  ...(props.containerAriaLabel === undefined ? {} : { containerAriaLabel: props.containerAriaLabel }),
}));
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    }"
    v-bind="toasterProps"
  >
    <template #success-icon>
      <CircleCheckIcon class="size-4" />
    </template>
    <template #info-icon>
      <InfoIcon class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlertIcon class="size-4" />
    </template>
    <template #error-icon>
      <OctagonXIcon class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <Loader2Icon class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <XIcon class="size-4" />
    </template>
  </Sonner>
</template>
