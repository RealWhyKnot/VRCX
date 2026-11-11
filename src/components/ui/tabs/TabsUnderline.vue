<script setup lang="ts">
import { TabsContent, TabsIndicator, TabsList, TabsRoot, TabsTrigger } from "reka-ui";
import { computed, nextTick, onMounted, onUpdated, ref, toRefs, watch } from "vue";
import { usePreferredReducedMotion, useResizeObserver } from "@vueuse/core";
import { ChevronLeft, ChevronRight } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import { logFailure } from "@/stores/log-failure";

defineOptions({ name: "UiTabsUnderline" });

type TabsUnderlineItem = {
  value: string | number;
  label: string;
  disabled?: boolean;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string | null | undefined;
    defaultValue?: string | null | undefined;
    items: TabsUnderlineItem[];
    ariaLabel?: string;
    variant?: string;
    unmountOnHide?: boolean;
    fill?: boolean;
    sticky?: boolean;
    activeColor?: string;
    background?: boolean;
  }>(),
  {
    modelValue: undefined,
    defaultValue: undefined,
    ariaLabel: "",
    variant: "fit",
    unmountOnHide: false,
    fill: false,
    sticky: false,
    activeColor: "",
    background: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string | number];
}>();
const { t } = useI18n();
const header = ref<HTMLDivElement | null>(null);
const viewport = ref<HTMLDivElement | null>(null);
const content = ref<HTMLDivElement | null>(null);
const hasOverflow = ref(false);
const canScrollLeft = ref(false);
const canScrollRight = ref(false);
const reducedMotion = usePreferredReducedMotion();
const scrollTolerance = 1;
const { modelValue, defaultValue, items, ariaLabel, variant, unmountOnHide, fill, sticky, activeColor, background } = toRefs(props);

const itemsList = computed(() => (Array.isArray(items.value) ? items.value : []));

const resolvedDefault = computed(() => {
  return defaultValue.value ?? itemsList.value[0]?.value;
});

const isValueValid = (value: string | number | null | undefined) => itemsList.value.some((item) => item.value === value);

const innerValue = ref<string | number | null | undefined>(isValueValid(modelValue.value) ? modelValue.value : resolvedDefault.value);

watch(modelValue, (v) => {
  if (isValueValid(v)) {
    innerValue.value = v;
  }
});

watch([itemsList, defaultValue], () => {
  if (!isValueValid(innerValue.value)) {
    innerValue.value = resolvedDefault.value;
    return;
  }

  if (modelValue.value != null && !isValueValid(modelValue.value)) {
    innerValue.value = resolvedDefault.value;
  }
});

const rootProps = computed(() => ({
  ...(innerValue.value == null ? {} : { modelValue: innerValue.value }),
  ...(resolvedDefault.value == null ? {} : { defaultValue: resolvedDefault.value }),
  unmountOnHide: unmountOnHide.value,
}));

function onValueChange(value: string | number) {
  innerValue.value = value;
  emit("update:modelValue", value);
}

function updateOverflow() {
  if (!header.value || !viewport.value || !content.value) return;

  const removedPadding =
    background.value && hasOverflow.value
      ? Number(getComputedStyle(document.documentElement).fontSize.replace("px", "")) * (variant.value === "pill" ? 0.25 : 0.5)
      : 0;

  hasOverflow.value = header.value.clientWidth > 0 && content.value.scrollWidth + removedPadding > header.value.clientWidth + scrollTolerance;
  const { scrollLeft, scrollWidth, clientWidth } = viewport.value;
  canScrollLeft.value = scrollLeft > scrollTolerance;
  canScrollRight.value = scrollWidth - clientWidth - scrollLeft > scrollTolerance;
}

function scrollTabs(direction: number) {
  const element = viewport.value;
  if (!element) return;

  const distance = element.clientWidth * 0.8;
  element.scrollTo({
    left: Math.max(0, Math.min(element.scrollWidth - element.clientWidth, element.scrollLeft + direction * distance)),
    behavior: reducedMotion.value === "reduce" ? "instant" : "smooth",
  });
}

function revealTab(tab: Element | null | undefined) {
  const element = viewport.value;
  if (!element || !tab || element.clientWidth === 0) return;

  const visible = element.getBoundingClientRect();
  const target = tab.getBoundingClientRect();
  let delta = 0;
  if (target.left < visible.left) {
    delta = target.left - visible.left;
  } else if (target.right > visible.right) {
    delta = Math.min(target.right - visible.right, target.left - visible.left);
  }
  if (Math.abs(delta) > scrollTolerance) {
    element.scrollTo({
      left: Math.max(0, Math.min(element.scrollWidth - element.clientWidth, element.scrollLeft + delta)),
      behavior: "instant",
    });
  }
  updateOverflow();
}

function revealActiveTab() {
  revealTab(content.value?.querySelector<HTMLElement>('[role="tab"][data-state="active"]'));
}

function onTabFocus(event: FocusEvent) {
  if (event.target instanceof HTMLElement && event.target.matches('[role="tab"]')) {
    revealTab(event.target);
  }
}

useResizeObserver([header, content], () => {
  updateOverflow();
  void nextTick(revealActiveTab).catch(logFailure("Failed to reveal active tab:"));
});
useResizeObserver(viewport, updateOverflow);
onMounted(() => {
  updateOverflow();
  void nextTick(revealActiveTab).catch(logFailure("Failed to reveal active tab:"));
});
onUpdated(updateOverflow);
watch(
  [innerValue, itemsList, hasOverflow],
  () => {
    void nextTick(revealActiveTab).catch(logFailure("Failed to reveal active tab:"));
  },
  { flush: "post" }
);

const triggerStyle = computed(() => {
  if (!activeColor.value) {
    return undefined;
  }
  return { color: activeColor.value };
});

const indicatorStyle = computed(() => {
  if (!activeColor.value) {
    return undefined;
  }
  return { backgroundColor: activeColor.value };
});

const triggerClass = computed(() => {
  return [
    "relative inline-flex min-w-max shrink-0 cursor-pointer h-10 items-center justify-center px-3 text-sm font-medium whitespace-nowrap",
    "text-muted-foreground transition-colors hover:text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    "disabled:pointer-events-none disabled:opacity-50",
    "data-[state=active]:text-primary",
    variant.value === "equal" ? "flex-1" : "",
    variant.value === "pill" ? "rounded-full" : "",
  ].join(" ");
});

const headerClass = computed(() => {
  return [
    "relative flex w-full min-w-0 shrink-0 items-center border-b border-border",
    variant.value === "pill" ? "rounded-full bg-muted" : "",
    sticky.value ? "sticky top-0 z-10 bg-background" : "",
    background.value ? "rounded-xl bg-(--profile-card) overflow-hidden" : "",
  ].join(" ");
});
</script>

<template>
  <TabsRoot v-bind="rootProps" :class="['w-full min-w-0', fill ? 'flex min-h-0 flex-col' : '']" @update:model-value="onValueChange">
    <div ref="header" :class="headerClass">
      <Button
        v-if="hasOverflow"
        type="button"
        variant="ghost"
        size="icon-sm"
        class="mx-0.5 text-muted-foreground disabled:bg-transparent disabled:text-muted-foreground/30 aria-disabled:bg-transparent aria-disabled:text-muted-foreground/30 data-[disabled]:bg-transparent data-[disabled]:text-muted-foreground/30"
        :aria-label="t('common.tabs.scroll_left')"
        :disabled="!canScrollLeft"
        @click="scrollTabs(-1)"
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <div
        ref="viewport"
        class="tabs-underline-viewport min-w-0 flex-1 overflow-x-auto"
        :data-scroll-left="(hasOverflow && canScrollLeft) || undefined"
        :data-scroll-right="(hasOverflow && canScrollRight) || undefined"
        @scroll.passive="updateOverflow"
        @focusin="onTabFocus"
      >
        <div ref="content" class="w-max min-w-full">
          <TabsList
            :class="['relative flex w-full items-center gap-1', variant === 'pill' ? 'p-1' : '', background && !hasOverflow ? 'pl-2' : '']"
            :aria-label="ariaLabel || undefined"
          >
            <TabsIndicator
              class="pointer-events-none absolute left-0 bottom-0 h-0.5 w-(--reka-tabs-indicator-size) translate-x-(--reka-tabs-indicator-position) transition-[width,translate] duration-200 ease-out"
            >
              <div class="h-full w-full rounded-full bg-primary" :style="indicatorStyle" />
            </TabsIndicator>

            <TabsTrigger
              v-for="it in itemsList"
              :key="it.value"
              :value="it.value"
              :disabled="it.disabled ?? false"
              :class="triggerClass"
              :style="innerValue === it.value ? triggerStyle : undefined"
            >
              <slot :name="`label-${it.value}`">{{ it.label }}</slot>
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
      <Button
        v-if="hasOverflow"
        type="button"
        variant="ghost"
        size="icon-sm"
        class="mx-0.5 text-muted-foreground disabled:bg-transparent disabled:text-muted-foreground/30 aria-disabled:bg-transparent aria-disabled:text-muted-foreground/30 data-[disabled]:bg-transparent data-[disabled]:text-muted-foreground/30"
        :aria-label="t('common.tabs.scroll_right')"
        :disabled="!canScrollRight"
        @click="scrollTabs(1)"
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>

    <TabsContent
      v-for="it in itemsList"
      :key="it.value"
      :value="it.value"
      :class="[
        'pt-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        fill ? 'min-h-0 flex-1 overflow-y-auto' : '',
      ]"
    >
      <slot :name="it.value" />
    </TabsContent>
  </TabsRoot>
</template>

<style scoped>
.tabs-underline-viewport {
  --tabs-fade-left: 0px;
  --tabs-fade-right: 0px;

  scrollbar-width: none;
}

.tabs-underline-viewport[data-scroll-left] {
  --tabs-fade-left: 1.5rem;
}

.tabs-underline-viewport[data-scroll-right] {
  --tabs-fade-right: 1.5rem;
}

.tabs-underline-viewport[data-scroll-left],
.tabs-underline-viewport[data-scroll-right] {
  mask-image: linear-gradient(
    to right,
    transparent,
    var(--color-mask-opaque) var(--tabs-fade-left),
    var(--color-mask-opaque) calc(100% - var(--tabs-fade-right)),
    transparent
  );
}

.tabs-underline-viewport::-webkit-scrollbar {
  display: none;
}
</style>
