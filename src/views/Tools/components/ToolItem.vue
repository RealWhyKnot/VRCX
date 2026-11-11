<script setup lang="ts">
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemMedia from "@/components/ui/item/ItemMedia.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";

defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
});
</script>

<template>
  <Item variant="outline" class="group cursor-pointer hover:bg-accent/50">
    <ItemMedia variant="icon" class="bg-transparent border-0">
      <i :class="[icon, 'inline-flex items-center justify-center text-2xl']" />
    </ItemMedia>
    <ItemContent>
      <div class="flex items-start gap-2">
        <ItemTitle class="flex-1">{{ title }}</ItemTitle>
        <slot name="actions" />
      </div>
      <ItemDescription>{{ description }}</ItemDescription>
    </ItemContent>
  </Item>
</template>
