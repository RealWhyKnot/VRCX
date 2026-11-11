<script setup lang="ts">
import type { ClassValue } from "clsx";
import { OTPInput } from "vue-input-otp";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";
import { useForwardPropsEmits } from "reka-ui";

const props = withDefaults(
  defineProps<{
    maxlength: number;
    textAlign?: "left" | "center" | "right" | undefined;
    inputmode?: "numeric" | "text" | undefined;
    containerClass?: string | undefined;
    pushPasswordManagerStrategy?: "increase-width" | "none" | undefined;
    noScriptCssFallback?: string | null | undefined;
    defaultValue?: string | undefined;
    pasteTransformer?: ((pasted: string | undefined) => string) | null | undefined;
    accept?: string | undefined;
    alt?: string | undefined;
    autocomplete?: string | undefined;
    autofocus?: boolean;
    capture?: boolean | string;
    checked?: boolean | unknown[] | Set<unknown>;
    crossorigin?: string | undefined;
    disabled?: boolean;
    enterKeyHint?: string | undefined;
    form?: string | undefined;
    formaction?: string | undefined;
    formenctype?: string | undefined;
    formmethod?: string | undefined;
    formnovalidate?: boolean;
    formtarget?: string | undefined;
    height?: number | undefined;
    indeterminate?: boolean;
    list?: string | undefined;
    max?: number | undefined;
    min?: number | undefined;
    minlength?: number | undefined;
    multiple?: boolean;
    name?: string | undefined;
    pattern?: string | undefined;
    placeholder?: string | undefined;
    readonly?: boolean;
    required?: boolean;
    size?: number | undefined;
    src?: string | undefined;
    step?: number | undefined;
    type?: string | undefined;
    value?: string | undefined;
    width?: number | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    textAlign: undefined,
    inputmode: undefined,
    containerClass: undefined,
    pushPasswordManagerStrategy: undefined,
    noScriptCssFallback: undefined,
    defaultValue: undefined,
    accept: undefined,
    alt: undefined,
    autocomplete: undefined,
    pasteTransformer: null,
    capture: false,
    checked: false,
    crossorigin: undefined,
    enterKeyHint: undefined,
    form: undefined,
    formaction: undefined,
    formenctype: undefined,
    formmethod: undefined,
    formtarget: undefined,
    height: undefined,
    list: undefined,
    max: undefined,
    min: undefined,
    minlength: undefined,
    name: undefined,
    pattern: undefined,
    placeholder: undefined,
    size: undefined,
    src: undefined,
    step: undefined,
    type: undefined,
    value: undefined,
    width: undefined,
    class: undefined,
  }
);

const emits = defineEmits<{
  complete: [value: string];
  change: [e: Event];
  select: [e: Event];
  input: [value: string];
  focus: [e: FocusEvent];
  blur: [e: FocusEvent];
  mouseover: [e: MouseEvent];
  mouseleave: [e: MouseEvent];
  paste: [e: ClipboardEvent];
}>();

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <OTPInput
    v-slot="slotProps"
    v-bind="forwarded"
    :maxlength="props.maxlength"
    :container-class="cn('flex items-center gap-2 has-disabled:opacity-50', props.class)"
    data-slot="input-otp"
    class="disabled:cursor-not-allowed"
  >
    <slot v-bind="slotProps" />
  </OTPInput>
</template>
