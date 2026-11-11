<script setup lang="ts">
import type { PrimitiveProps, ToggleGroupItemProps } from "reka-ui";
import type { ClassValue } from "clsx";
import type { VariantProps } from "class-variance-authority";
import { ToggleGroupItem } from "reka-ui";
import { cn } from "@/lib/utils";
import { inject } from "vue";
import { computed } from "vue";
import { toggleVariants } from "@/components/ui/toggle";

const props = withDefaults(
  defineProps<{
    value: ToggleGroupItemProps["value"];
    disabled?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
    variant?: VariantProps<typeof toggleVariants>["variant"] | undefined;
    size?: VariantProps<typeof toggleVariants>["size"] | undefined;
  }>(),
  {
    as: undefined,
    class: undefined,
    variant: undefined,
    size: undefined,
  }
);

const context = inject<
  | {
      variant?: VariantProps<typeof toggleVariants>["variant"] | undefined;
      size?: VariantProps<typeof toggleVariants>["size"] | undefined;
      spacing?: number | undefined;
    }
  | undefined
>("toggleGroup");

const delegatedProps = computed(() => ({
  value: props.value,
  disabled: props.disabled,
  asChild: props.asChild,
  ...(props.as === undefined ? {} : { as: props.as }),
}));
</script>

<template>
  <ToggleGroupItem
    v-slot="slotProps"
    data-slot="toggle-group-item"
    :data-variant="context?.variant || variant"
    :data-size="context?.size || size"
    :data-spacing="context?.spacing"
    v-bind="delegatedProps"
    :value="props.value"
    :class="
      cn(
        toggleVariants({
          variant: context?.variant || variant,
          size: context?.size || size,
        }),
        'w-auto min-w-0 shrink-0 px-3 focus:z-10 focus-visible:z-10',
        'data-[spacing=0]:rounded-none data-[spacing=0]:shadow-none data-[spacing=0]:first:rounded-l-md data-[spacing=0]:last:rounded-r-md data-[spacing=0]:data-[variant=outline]:border-l-0 data-[spacing=0]:data-[variant=outline]:first:border-l cursor-pointer',
        props.class
      )
    "
  >
    <slot v-bind="slotProps" />
  </ToggleGroupItem>
</template>
