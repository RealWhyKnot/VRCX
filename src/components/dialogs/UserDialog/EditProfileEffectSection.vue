<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Check, ChevronDown, X } from "lucide-vue-next";

import Button from "@/components/ui/button/Button.vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";

type EffectItem = { id?: string; templateId: string; name: string; imageUrl: string };

defineProps<{
  title: string;
  value: string;
  selectedItem: EffectItem | undefined;
  items: EffectItem[];
  loading: boolean;
}>();

const { t } = useI18n();
const open = defineModel<boolean>("open", { required: true });

const emit = defineEmits<{
  select: [templateId: string];
  clear: [];
}>();
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <Button size="sm" variant="outline" :disabled="loading || !value" @click="emit('clear')">
        <X class="size-4" />
        {{ t("common.actions.clear") }}
      </Button>
    </div>
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button variant="outline" class="h-16 w-full justify-between px-3" :disabled="loading">
          <span v-if="selectedItem" class="flex min-w-0 items-center gap-3">
            <img :src="selectedItem.imageUrl" :alt="selectedItem.name" class="size-12 shrink-0 rounded-sm object-cover" loading="lazy" />
            <span class="truncate">{{ selectedItem.name }}</span>
          </span>
          <span v-else class="text-muted-foreground">{{ t("dialog.edit_profile.select_effect") }}</span>
          <ChevronDown class="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-130 max-w-[calc(100vw-2rem)] p-3" align="start">
        <div v-if="items.length" class="grid max-h-105 grid-cols-2 gap-3 overflow-y-auto">
          <button
            v-for="item in items"
            :key="item.id ?? item.templateId"
            type="button"
            class="relative min-w-0 overflow-hidden rounded-md border bg-background text-left transition-colors hover:bg-accent"
            :class="{
              'border-primary ring-2 ring-inset ring-primary/40': value === item.templateId,
            }"
            :aria-label="item.name"
            :aria-pressed="value === item.templateId"
            @click="emit('select', item.templateId)"
          >
            <img :src="item.imageUrl" :alt="item.name" class="aspect-square w-full object-cover" loading="lazy" />
            <span class="block truncate px-3 py-2 text-sm font-medium">{{ item.name }}</span>
            <span
              v-if="value === item.templateId"
              class="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check class="size-4" />
            </span>
          </button>
        </div>
        <p v-else class="text-sm text-muted-foreground">{{ t("common.no_data") }}</p>
      </PopoverContent>
    </Popover>
  </section>
</template>
