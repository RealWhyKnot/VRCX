<script setup lang="ts">
import type { ClassValue } from "clsx";
import type { PrimitiveProps, SelectItemProps } from "reka-ui";
import { SelectItem, SelectItemIndicator, SelectItemText } from "reka-ui";
import { Check } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: SelectItemProps["value"];
    disabled?: boolean;
    textValue?: string | undefined;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    textValue: undefined,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps = computed(() => ({
  value: props.value,
  disabled: props.disabled,
  ...(props.textValue === undefined ? {} : { textValue: props.textValue }),
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <SelectItem
    data-slot="select-item"
    v-bind="delegatedProps"
    :value="props.value"
    :class="
      cn(
        'focus:bg-accent focus:text-accent-foreground [&_svg:not([class*=\'text-\'])]:text-muted-foreground relative flex w-full items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2 cursor-pointer',
        props.class
      )
    "
  >
    <span class="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectItemIndicator>
        <slot name="indicator-icon">
          <Check class="size-4" />
        </slot>
      </SelectItemIndicator>
    </span>

    <SelectItemText>
      <slot />
    </SelectItemText>
  </SelectItem>
</template>
