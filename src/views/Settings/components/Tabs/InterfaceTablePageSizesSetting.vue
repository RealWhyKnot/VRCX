<template>
  <SettingsItem :label="t('view.settings.appearance.appearance.table_page_sizes')">
    <Button size="sm" variant="outline" :aria-label="t('view.settings.appearance.appearance.table_page_sizes')" @click="tablePageSizesDialogOpen = true">{{
      t("common.actions.configure")
    }}</Button>

    <Dialog v-model:open="tablePageSizesDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t("view.settings.appearance.appearance.table_page_sizes") }}</DialogTitle>
        </DialogHeader>

        <Popover v-model:open="tablePageSizesOpen">
          <ListboxRoot v-model="tablePageSizesModel" highlight-on-hover multiple>
            <PopoverAnchor class="inline-flex w-full">
              <TagsInput v-slot="{ modelValue: tags }" v-model="tablePageSizesModel" class="w-full">
                <TagsInputItem v-for="item in tags" :key="item.toString()" :value="item.toString()">
                  <TagsInputItemText />
                  <TagsInputItemDelete />
                </TagsInputItem>

                <ListboxFilter v-model="tablePageSizesSearchTerm" as-child>
                  <TagsInputInput :placeholder="t('view.settings.appearance.appearance.table_page_sizes')" @keydown.down="tablePageSizesOpen = true" />
                </ListboxFilter>

                <PopoverTrigger as-child>
                  <Button size="icon-sm" variant="ghost" class="order-last ml-auto self-start">
                    <ChevronDown class="size-3.5" />
                  </Button>
                </PopoverTrigger>
              </TagsInput>
            </PopoverAnchor>

            <PopoverContent class="w-[var(--reka-popover-trigger-width)] p-1" @open-auto-focus.prevent>
              <ListboxContent
                class="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto empty:after:block empty:after:content-['No_options'] empty:p-1"
                tabindex="0"
              >
                <ListboxItem
                  v-for="size in filteredTablePageSizeOptions"
                  :key="size"
                  class="data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                  :value="size"
                  @select="tablePageSizesSearchTerm = ''"
                >
                  <span>{{ size }}</span>

                  <ListboxItemIndicator class="ml-auto inline-flex items-center justify-center">
                    <CheckIcon />
                  </ListboxItemIndicator>
                </ListboxItem>
              </ListboxContent>
            </PopoverContent>
          </ListboxRoot>
        </Popover>

        <DialogFooter>
          <Button variant="outline" @click="tablePageSizesDialogOpen = false">{{ t("dialog.alertdialog.ok") }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsItem>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { CheckIcon, ChevronDown } from "lucide-vue-next";
import { ListboxContent, ListboxFilter, ListboxItem, ListboxItemIndicator, ListboxRoot, useFilter } from "reka-ui";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import Button from "@/components/ui/button/Button.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverAnchor from "@/components/ui/popover/PopoverAnchor.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import TagsInput from "@/components/ui/tags-input/TagsInput.vue";
import TagsInputInput from "@/components/ui/tags-input/TagsInputInput.vue";
import TagsInputItem from "@/components/ui/tags-input/TagsInputItem.vue";
import TagsInputItemDelete from "@/components/ui/tags-input/TagsInputItemDelete.vue";
import TagsInputItemText from "@/components/ui/tags-input/TagsInputItemText.vue";
import SettingsItem from "../SettingsItem.vue";

const { t } = useI18n();

const appearanceSettingsStore = useAppearanceSettingsStore();
const { tablePageSizes } = storeToRefs(appearanceSettingsStore);
const { setTablePageSizes } = appearanceSettingsStore;

const tablePageSizesModel = computed({
  get: () => tablePageSizes.value.map(String),
  set: (values: unknown) => {
    const rawValues: readonly unknown[] = Array.isArray(values) ? values : [];
    setTablePageSizes(rawValues.map((value) => Number(value)));
    if (rawValues.length > 0 && rawValues.length !== tablePageSizes.value.length) {
      toast.error(t("view.settings.appearance.appearance.table_page_sizes_error"));
    }
  },
});

const TABLE_PAGE_SIZE_SUGGESTIONS = Object.freeze([5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 250, 500, 1000]);

const tablePageSizesDialogOpen = ref(false);
const tablePageSizesOpen = ref(false);
const tablePageSizesSearchTerm = ref("");

const { contains } = useFilter({ sensitivity: "base" });

const tablePageSizeOptions = computed(() => {
  const merged = new Set([...TABLE_PAGE_SIZE_SUGGESTIONS, ...tablePageSizes.value].map((v) => String(v)));
  return Array.from(merged).sort((a, b) => Number(a) - Number(b));
});

const filteredTablePageSizeOptions = computed(() => {
  if (tablePageSizesSearchTerm.value === "") {
    return tablePageSizeOptions.value;
  }
  return tablePageSizeOptions.value.filter((option) => contains(option, tablePageSizesSearchTerm.value));
});

watch(tablePageSizesSearchTerm, (value) => {
  if (value) {
    tablePageSizesOpen.value = true;
  }
});
</script>
