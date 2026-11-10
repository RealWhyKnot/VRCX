<script setup lang="ts">
import { computed, ref } from "vue";
import { GripVertical } from "lucide-vue-next";
import { useSortable } from "@dnd-kit/vue/sortable";

const props = withDefaults(
  defineProps<{
    id: string;
    index: number;
    group?: string | undefined;
    draggable?: boolean;
    disabled?: boolean;
  }>(),
  { group: undefined, draggable: true, disabled: false }
);

const element = ref<HTMLDivElement | null>(null);
const handle = ref<HTMLDivElement | null>(null);

const { isDragSource } = useSortable({
  id: computed(() => props.id),
  index: computed(() => props.index),
  group: computed(() => props.group),
  type: computed(() => props.group),
  accept: computed(() => props.group),
  disabled: computed(() => !props.draggable || props.disabled),
  element,
  handle,
});
</script>

<template>
  <div ref="element" class="group flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer hover:bg-accent" :class="{ 'opacity-50': isDragSource }">
    <div ref="handle" class="shrink-0 select-none" :class="draggable ? 'cursor-grab active:cursor-grabbing' : 'invisible'" @click.stop>
      <GripVertical class="size-4 text-muted-foreground" />
    </div>
    <slot />
  </div>
</template>
