<script setup lang="ts">
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import { computed, ref } from "vue";
import type { ComponentPublicInstance } from "vue";
import { GripVertical } from "lucide-vue-next";
import { useSortable } from "@dnd-kit/vue/sortable";

const props = defineProps<{
  id: string;
  index: number;
  label: string;
}>();

const element = ref<ComponentPublicInstance | null>(null);

const sortable = useSortable({
  id: computed(() => props.id),
  index: computed(() => props.index),
  element,
});
const isDragSource = computed(() => Boolean(sortable.isDragSource.value));
</script>

<template>
  <Item ref="element" variant="outline" size="sm" class="cursor-grab select-none active:cursor-grabbing" :class="{ 'opacity-50': isDragSource }">
    <ItemMedia>
      <GripVertical class="size-4 text-muted-foreground" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle class="truncate">{{ label }}</ItemTitle>
    </ItemContent>
  </Item>
</template>
