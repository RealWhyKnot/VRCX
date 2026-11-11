<template>
  <div>
    <div class="flex items-center gap-2 flex-wrap">
      <ButtonGroup>
        <Button variant="outline" size="sm" @click="getInventory">
          <RefreshCw />
          {{ t("dialog.gallery_icons.refresh") }}
        </Button>
        <Button variant="outline" size="sm" @click="redeemReward">
          <Gift />
          {{ t("dialog.gallery_icons.redeem") }}
        </Button>
      </ButtonGroup>
      <Select v-model="inventoryTypeFilter">
        <SelectTrigger size="sm" class="w-44">
          <SelectValue :placeholder="t('dialog.gallery_icons.all_types')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="all">{{ t("dialog.gallery_icons.all_types") }}</SelectItem>
            <SelectItem v-for="type in inventoryTypeOptions" :key="type" :value="type">
              {{ type }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
    <ItemGroup class="grid gap-3 mt-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
      <Item
        v-for="item in filteredInventoryTable"
        :key="item.id"
        variant="outline"
        size="sm"
        class="p-0 pb-4 x-hover-card hover:bg-accent hover:shadow-sm"
        as-child
      >
        <div class="overflow-hidden">
          <ItemHeader class="cursor-pointer" @click="openFullscreen(item.imageUrl)">
            <img :src="item.imageUrl" loading="lazy" class="aspect-square w-full rounded-t-md object-cover" />
          </ItemHeader>
          <ItemContent class="min-w-0 px-2.5 pt-1.5 pb-0">
            <ItemTitle class="truncate text-sm">
              {{ item.name }}
            </ItemTitle>
            <ItemDescription v-if="item.description" class="text-xs truncate">
              {{ item.description }}
            </ItemDescription>
            <ItemDescription class="text-[11px] truncate font-mono">
              {{ formatDateFilter(item.created_at, "long") }}
            </ItemDescription>
            <ItemDescription class="text-xs">{{ item.itemTypeLabel || item.itemType }}</ItemDescription>
          </ItemContent>
          <ItemFooter v-if="item.itemType === 'bundle'" class="p-2">
            <Button size="sm" @click="consumeInventoryBundle(item.id)">
              {{ t("dialog.gallery_icons.consume_bundle") }}
            </Button>
          </ItemFooter>
        </div>
      </Item>
    </ItemGroup>
  </div>
</template>

<script setup lang="ts">
import { Gift, RefreshCw } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemFooter from "@/components/ui/item/ItemFooter.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { openFullscreen } from "../composables/gallery-file-actions";
import { useGalleryInventory } from "../composables/use-gallery-inventory";

const { t } = useI18n();

const { getInventory, inventoryTypeFilter, inventoryTypeOptions, filteredInventoryTable, consumeInventoryBundle, redeemReward } = useGalleryInventory();
</script>
