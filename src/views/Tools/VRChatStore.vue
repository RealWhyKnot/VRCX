<template>
  <div class="x-container flex flex-col overflow-hidden">
    <div class="flex items-center gap-2 ml-2">
      <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
        <ArrowLeft />
        {{ t("nav_tooltip.tools") }}
      </Button>
      <span class="header">{{ t("view.tools.marketplace.vrchat_store") }}</span>
    </div>

    <div class="shrink-0 my-2 flex items-center justify-end gap-2">
      <InputGroupSearch v-model="searchText" :placeholder="t('view.tools.marketplace.search_placeholder')" class="w-[200px]" />
      <span v-if="currentUserCredits !== null" class="text-sm text-muted-foreground">
        {{ t("view.tools.marketplace.credits", { credits: commaNumber(currentUserCredits) }) }}
      </span>
      <TooltipWrapper side="bottom" :content="t('view.tools.marketplace.refresh_tooltip')">
        <Button class="rounded-full" size="icon-sm" variant="ghost" :disabled="isStoreShelvesLoading" @click="getStoreShelves">
          <Spinner v-if="isStoreShelvesLoading" />
          <RefreshCw v-else />
        </Button>
      </TooltipWrapper>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="isStoreShelvesLoading && !filteredStoreShelves.length" class="flex items-center justify-center h-full">
        <Spinner class="text-2xl" />
      </div>
      <template v-else-if="filteredStoreShelves.length > 0">
        <div v-for="shelf in filteredStoreShelves" :key="shelf.id" class="mb-6">
          <div v-if="shelf.bannerImageId" class="relative mb-3 overflow-hidden rounded-lg">
            <img :src="getFileImageUrl(shelf.bannerImageId)" loading="lazy" class="max-h-60 w-full object-cover" />
            <img
              v-if="shelf.logoImageId"
              :src="getFileImageUrl(shelf.logoImageId)"
              loading="lazy"
              class="absolute top-2 left-4 h-[calc(100%-4rem)] max-w-[50%] object-contain object-left drop-shadow-lg"
            />
            <div
              v-if="shelf.shelfTitle"
              class="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-linear-to-t from-black/80 to-transparent p-4 pt-12 text-lg font-semibold text-white"
            >
              <img
                v-if="shelf.shelfIconImageId"
                :src="getFileImageUrl(shelf.shelfIconImageId)"
                loading="lazy"
                class="size-10 rounded object-contain drop-shadow"
              />
              <span class="drop-shadow" v-text="shelf.shelfTitle" />
            </div>
          </div>
          <div v-else-if="shelf.shelfTitle" class="mb-2 flex items-center gap-2 font-medium">
            <img v-if="shelf.shelfIconImageId" :src="getFileImageUrl(shelf.shelfIconImageId)" loading="lazy" class="size-6 rounded object-contain" />
            <span v-text="shelf.shelfTitle" />
          </div>
          <div v-if="shelf.shelfDescription" class="mb-2 text-sm text-muted-foreground" v-text="shelf.shelfDescription" />
          <ItemGroup v-if="shelf.listings.length > 0" class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            <Item v-for="listing in shelf.listings" :key="listing.id" variant="outline" size="sm" class="p-3" as-child>
              <div class="overflow-hidden">
                <ItemHeader class="relative">
                  <Badge
                    v-if="getListingDaysLeft(listing) !== null"
                    variant="outline"
                    class="absolute top-2 right-2 border-transparent bg-black/50 text-white/90 backdrop-blur-sm"
                  >
                    {{ t("view.tools.marketplace.days_left", { days: getListingDaysLeft(listing) }) }}
                  </Badge>
                  <img
                    v-if="listing.imageUrl || listing.imageId"
                    :src="listing.imageUrl || getFileImageUrl(listing.imageId)"
                    :alt="listing.displayName"
                    loading="lazy"
                    class="aspect-square w-full cursor-pointer rounded-lg object-cover"
                    @click="showFullscreenImageDialog(listing.imageUrl || getFileImageUrl(listing.imageId))"
                  />
                </ItemHeader>
                <ItemContent class="min-w-0">
                  <TooltipWrapper side="top" :content="listing.description" content-class="max-w-80">
                    <ItemTitle class="truncate w-auto">{{ listing.displayName }}</ItemTitle>
                  </TooltipWrapper>
                  <ItemDescription class="line-clamp-1 text-xs">
                    {{ listing.subtitle }}
                  </ItemDescription>
                  <ItemDescription class="line-clamp-1 text-xs">
                    {{ formatListingPrice(listing) }}
                  </ItemDescription>
                  <Button
                    size="sm"
                    variant="outline"
                    class="mt-1 w-full"
                    :disabled="isListingOwned(listing) || !canPurchaseListing(listing)"
                    @click="purchaseListing(listing)"
                  >
                    <Spinner v-if="purchasingListingId === listing.id" />
                    {{ isListingOwned(listing) ? t("view.tools.marketplace.owned") : t("view.tools.marketplace.buy") }}
                  </Button>
                </ItemContent>
              </div>
            </Item>
          </ItemGroup>
        </div>
      </template>
      <DataTableEmpty v-else type="nodata" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, RefreshCw } from "lucide-vue-next";
import { onActivated } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupSearch from "@/components/ui/input-group/InputGroupSearch.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { AppDebug } from "@/services/app-config";
import { commaNumber } from "@/shared/utils/base/string";
import { useGalleryStore } from "@/stores/gallery";
import { useUserStore } from "@/stores/user";
import { logError } from "@/stores/vrcx-messages";
import { useStoreShelves, type StoreListing } from "./composables/use-store-shelves";

const { t } = useI18n();
const router = useRouter();
const { showFullscreenImageDialog } = useGalleryStore();
const { currentUserCredits } = storeToRefs(useUserStore());

const { searchText, filteredStoreShelves, isStoreShelvesLoading, purchasingListingId, getStoreShelves, isListingOwned, canPurchaseListing, purchaseListing } =
  useStoreShelves();

onActivated(() => {
  void getStoreShelves().catch(logError);
});

function goBack() {
  void router.push({ name: "tools" }).catch(logError);
}

function getFileImageUrl(fileId: string | null | undefined) {
  return `${AppDebug.endpointDomain}/file/${fileId}/1/`;
}

function getListingDaysLeft(listing: StoreListing) {
  const expireTime = listing.whenToExpire ? Date.parse(listing.whenToExpire) : Number.NaN;
  if (!Number.isFinite(expireTime) || expireTime <= Date.now()) {
    return null;
  }
  return Math.ceil((expireTime - Date.now()) / 86400000);
}

function formatListingPrice(listing: StoreListing) {
  if (!listing.priceTokens) {
    return t("view.tools.marketplace.free");
  }
  const price = `${commaNumber(listing.priceTokens)}V`;
  if (listing.vrcPlusDiscountPrice == null || listing.vrcPlusDiscountPrice === listing.priceTokens) {
    return price;
  }
  const vrcPlusPrice = t("view.tools.marketplace.vrc_plus_price", {
    price: `${commaNumber(listing.vrcPlusDiscountPrice)}V`,
  });
  return `${price} · ${vrcPlusPrice}`;
}
</script>
