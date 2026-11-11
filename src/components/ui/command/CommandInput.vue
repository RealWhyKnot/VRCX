<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui";
import type { ClassValue } from "clsx";
import { ListboxFilter, useForwardProps } from "reka-ui";
import { Search } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import { reactiveOmit } from "@vueuse/core";

import { useCommand } from ".";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    modelValue?: string | undefined;
    autoFocus?: boolean;
    disabled?: boolean;
    asChild?: boolean;
    as?: PrimitiveProps["as"] | undefined;
    class?: ClassValue | undefined;
  }>(),
  {
    modelValue: undefined,
    as: undefined,
    class: undefined,
  }
);

const delegatedProps: Record<string, unknown> = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps);

const { filterState } = useCommand();
</script>

<template>
  <div data-slot="command-input-wrapper" class="flex h-9 items-center gap-2 border-b px-3">
    <Search class="size-4 shrink-0 opacity-50" />
    <ListboxFilter
      v-bind="{ ...forwardedProps, ...$attrs }"
      v-model="filterState.search"
      data-slot="command-input"
      auto-focus
      :class="
        cn(
          'placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
          props.class
        )
      "
    />
  </div>
</template>
