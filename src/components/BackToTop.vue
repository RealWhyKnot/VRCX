<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Tooltip from "@/components/ui/tooltip/Tooltip.vue";
import TooltipContent from "@/components/ui/tooltip/TooltipContent.vue";
import TooltipTrigger from "@/components/ui/tooltip/TooltipTrigger.vue";
import { ArrowUp } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import { useI18n } from "vue-i18n";

type ElementSource = string | Element | { readonly value: unknown } | { readonly $el: unknown };

type VirtualizerHandle = {
  scrollToIndex?: (index: number, options: { align: "start"; behavior: "auto" }) => void;
};

type VirtualizerSource = VirtualizerHandle | { readonly value: VirtualizerHandle };

const props = withDefaults(
  defineProps<{
    target?: ElementSource | null | undefined;
    virtualizer?: VirtualizerSource | null | undefined;
    bottom?: number;
    right?: number;
    visibilityHeight?: number;
    behavior?: "auto" | "smooth";
    tooltip?: boolean;
    tooltipText?: string;
    teleport?: boolean;
    teleportTo?: boolean | ElementSource | null | undefined;
  }>(),
  {
    target: null,
    virtualizer: null,
    bottom: 20,
    right: 20,
    visibilityHeight: 400,
    behavior: "smooth",
    tooltip: true,
    tooltipText: "Back to top",
    teleport: true,
    teleportTo: null,
  }
);

const visible = ref(false);
const { t } = useI18n();
let containerEl: Element | null = null;

function resolveElement(target: unknown): Element | null {
  if (!target) return null;
  if (typeof target === "string") return document.querySelector(target);
  if (typeof target === "object") {
    if ("value" in target) return asElement(target.value);
    if ("$el" in target) return asElement(target.$el);
  }
  return asElement(target);
}

function asElement(value: unknown): Element | null {
  return value instanceof Element ? value : null;
}

function getVirtualizer(): VirtualizerHandle | null {
  if (!props.virtualizer) return null;
  return "value" in props.virtualizer ? props.virtualizer.value : props.virtualizer;
}

function getScrollTop() {
  if (!containerEl) {
    return window.scrollY || document.documentElement.scrollTop || 0;
  }
  return containerEl.scrollTop || 0;
}

function handleScroll() {
  visible.value = getScrollTop() >= props.visibilityHeight;
}

function scrollToTop() {
  const behavior = props.behavior === "auto" ? "auto" : "smooth";
  const v = getVirtualizer();
  if (v?.scrollToIndex) {
    v.scrollToIndex(0, { align: "start", behavior: "auto" });
    return;
  }
  const target = containerEl ?? resolveElement(props.target);
  if (target) {
    target.scrollTo({ top: 0, behavior });
    return;
  }
  window.scrollTo({ top: 0, behavior });
}

function bind() {
  containerEl = resolveElement(props.target);

  const target: EventTarget = containerEl ?? window;
  target.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();
}

function unbind() {
  const target: EventTarget = containerEl ?? window;
  target.removeEventListener("scroll", handleScroll);
}

onMounted(() => {
  bind();
});

watch(
  () => props.target,
  () => {
    unbind();
    bind();
  }
);

onBeforeUnmount(() => {
  unbind();
});

const teleportTarget = computed(() => {
  if (props.teleportTo !== null) {
    if (props.teleportTo === true) return "body";
    if (props.teleportTo === false) return null;
    return resolveElement(props.teleportTo);
  }
  return props.teleport ? "body" : null;
});

const isBodyTeleport = computed(() => teleportTarget.value === "body" || teleportTarget.value === document.body);

const wrapperStyle = computed(() => `position:${isBodyTeleport.value ? "fixed" : "absolute"}; right:${props.right}px; bottom:${props.bottom}px; z-index:50;`);
</script>

<template>
  <Teleport v-if="teleportTarget" :to="teleportTarget">
    <Transition name="back-to-top">
      <div v-if="visible" :style="wrapperStyle">
        <Tooltip v-if="tooltip">
          <TooltipTrigger as-child>
            <Button size="icon" variant="secondary" class="rounded-full shadow" :aria-label="t('accessibility.back_to_top')" @click="scrollToTop">
              <ArrowUp class="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {{ tooltipText }}
          </TooltipContent>
        </Tooltip>

        <Button v-else size="icon" variant="secondary" class="rounded-full shadow" :aria-label="t('accessibility.back_to_top')" @click="scrollToTop">
          <ArrowUp class="h-4 w-4" />
        </Button>
      </div>
    </Transition>
  </Teleport>

  <Transition v-else name="back-to-top">
    <div v-if="visible" :style="wrapperStyle">
      <Tooltip v-if="tooltip">
        <TooltipTrigger as-child>
          <Button size="icon" variant="secondary" class="rounded-full shadow" :aria-label="t('accessibility.back_to_top')" @click="scrollToTop">
            <ArrowUp class="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ tooltipText }}
        </TooltipContent>
      </Tooltip>

      <Button v-else size="icon" variant="secondary" class="rounded-full shadow" :aria-label="t('accessibility.back_to_top')" @click="scrollToTop">
        <ArrowUp class="h-4 w-4" />
      </Button>
    </div>
  </Transition>
</template>

<style scoped>
.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.back-to-top-enter-to,
.back-to-top-leave-from {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .back-to-top-enter-active,
  .back-to-top-leave-active {
    transition: none;
  }
}
</style>
