<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import Button from "@/components/ui/button/Button.vue";
import { ColorPicker } from "vue3-colorpicker";
import "vue3-colorpicker/style.css";
import "./color-picker-button.user.css";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    modelValue: string;
    label?: string | null;
    disableAlpha?: boolean;
    presets?: string[];
    clearable?: boolean;
    emptyValue?: string;
    cols?: number;
    disabled?: boolean;
  }>(),
  {
    label: null,
    disableAlpha: true,
    presets: () => [],
    clearable: false,
    emptyValue: (props) => (Array.isArray(props.presets) && props.presets.length ? String(props.presets[0]) : "#000000"),
    cols: 6,
    disabled: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

function normalizeHex(v: string | null | undefined) {
  const s = (v ?? "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  return "#ffffff";
}

const safeValue = computed(() => normalizeHex(props.modelValue));
const displayLabel = computed(() => {
  if (props.label !== null) return props.label;
  return props.modelValue ? props.modelValue : props.emptyValue;
});
const hasPresets = computed(() => Array.isArray(props.presets) && props.presets.length > 0);
const gridStyle = computed(() => ({
  "--preset-columns": `repeat(${Math.max(1, props.cols)}, minmax(0, 1fr))`,
}));

function setColor(color: string) {
  if (props.disabled) return;
  emit("update:modelValue", color);
  emit("change", color);
}

function onInput(val: unknown) {
  setColor(typeof val === "string" ? val : "");
}

function clear() {
  if (props.disabled || !props.clearable) return;
  setColor(props.emptyValue);
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <slot name="trigger" :color="safeValue" :label="displayLabel">
        <Button variant="outline" class="flex items-center gap-2 px-2 size-sm" :disabled="disabled">
          <span class="h-4 w-4 rounded shrink-0 [background-color:var(--swatch,transparent)]" :style="{ '--swatch': safeValue }" />
          <span class="text-xs opacity-80 uppercase">{{ displayLabel }}</span>
          <span
            v-if="clearable && modelValue"
            role="button"
            tabindex="0"
            :aria-label="t('view.favorite.clear')"
            class="opacity-60 hover:opacity-100"
            :class="disabled ? 'pointer-events-none cursor-not-allowed' : 'cursor-pointer'"
            @click.stop="clear"
          >
            ✕
          </span>
          <slot name="trigger-suffix" />
        </Button>
      </slot>
    </PopoverTrigger>

    <PopoverContent class="w-auto p-0 z-10000" align="start">
      <div class="color-picker-popover" :class="[{ 'disable-alpha': disableAlpha }]">
        <div v-if="hasPresets" class="mt-3 pl-3 pb-3 grid gap-2 border-b grid-cols-(--preset-columns)" :style="gridStyle">
          <button
            v-for="color in presets"
            :key="color"
            type="button"
            class="h-6 w-6 rounded border [background-color:var(--preset-colour,transparent)]"
            :style="{ '--preset-colour': color }"
            :disabled="disabled"
            :aria-disabled="disabled ? 'true' : 'false'"
            :class="[
              disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              safeValue === String(color).toLowerCase() ? 'ring-[1.5px] ring-offset-[1.5px]' : '',
            ]"
            @click="setColor(color)"
          />
        </div>

        <ColorPicker
          :is-widget="true"
          :disable-alpha="disableAlpha"
          :pure-color="safeValue"
          :format="props.disableAlpha ? 'hex' : 'hex8'"
          :disabled="disabled"
          @update:pure-color="onInput"
        />

        <slot name="footer" />
      </div>
    </PopoverContent>
  </Popover>
</template>
