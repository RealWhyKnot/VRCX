<template>
  <div>
    <div v-if="avatarDialog.ref.description && avatarDialog.ref.name !== avatarDialog.ref.description" class="my-2 text-xs rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground pb-2 border-b border-border">
        {{ t("dialog.world.info.description") }}
      </div>
      <div class="flex items-start">
        <span class="flex-1 break-words py-2">
          {{ avatarDialog.ref.description }}
        </span>
      </div>
    </div>
    <AvatarDialogGallery v-if="avatarDialog.galleryImages.length || isAvatarOwner" />
    <div v-if="avatarDialog.ref.publishedListings?.length" class="my-2 text-xs rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.avatar.info.listings") }}
      </div>
      <div
        v-for="listing in avatarDialog.ref.publishedListings"
        :key="listing.listingId"
        class="box-border flex items-center p-1.5 text-[13px] w-full cursor-default"
      >
        <div class="relative inline-block flex-none size-24 mr-2.5">
          <img
            class="size-full rounded-lg object-cover"
            :src="getImageUrlFromImageId(listing.imageId)"
            loading="lazy"
            @click="listing.imageId && showFullscreenImageDialog(getImageUrlFromImageId(listing.imageId))"
          />
        </div>
        <div class="flex-1 overflow-hidden">
          <span class="block truncate font-medium leading-[18px]">{{ listing.displayName }}</span>
          <span class="block truncate text-xs italic [text-decoration:underline]">${{ commaNumber(listing.priceTokens) }}V</span>
          <span class="block truncate text-xs [text-wrap:auto]" v-text="listing.description"></span>
        </div>
        <Button
          size="sm"
          variant="outline"
          class="flex-none ml-2"
          :disabled="isListingOwned(listing) || !canPurchaseListing(listing)"
          @click="purchaseListing(listing)"
        >
          {{ isListingOwned(listing) ? t("view.tools.marketplace.owned") : t("view.tools.marketplace.buy") }}
        </Button>
      </div>
    </div>
    <div class="my-2 text-xs rounded-xl bg-(--profile-card) p-3">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.world.info.memo") }}
      </div>
      <InputGroupTextareaField
        v-model="memo"
        class="text-xs"
        :rows="1"
        :autosize="true"
        :placeholder="t('dialog.avatar.info.memo_placeholder')"
        input-class="resize-none min-h-0"
        @change="$emit('memoChange')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import Button from "@/components/ui/button/Button.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import AvatarDialogGallery from "./AvatarDialogGallery.vue";
import { marketplaceRequest } from "../../../api/marketplace";
import { useAvatarStore } from "../../../stores/avatar";
import { useGalleryStore } from "../../../stores/gallery";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { logError } from "../../../stores/vrcx-messages";
import { commaNumber } from "../../../shared/utils/base/string";
import { AppDebug } from "@/services/app-config";
import type { Avatar } from "vrchat";
import type { Json } from "../../../types/vrcx";

const memo = defineModel<string>("memo", { required: true });
defineEmits<{ memoChange: [] }>();

const { avatarDialog } = storeToRefs(useAvatarStore());
const userStore = useUserStore();
const { getAllProductPurchases } = userStore;
const { currentUser, currentUserCredits, ownedListingIds, ownedProductIds } = storeToRefs(userStore);
const { showFullscreenImageDialog } = useGalleryStore();
const modalStore = useModalStore();
const { t } = useI18n();

const isAvatarOwner = computed(() => avatarDialog.value.ref.authorId === currentUser.value.id);

function getImageUrlFromImageId(imageId: string | undefined) {
  if (!imageId) {
    return "";
  }
  return `${AppDebug.endpointDomain}/file/${imageId}/1/`;
}

type PublishedListing = NonNullable<Json<Avatar>["publishedListings"]>[number];

function isListingOwned(listing: PublishedListing) {
  return (listing.listingId !== undefined && ownedListingIds.value.has(listing.listingId)) || ownedProductIds.value.has(avatarDialog.value.ref.productId ?? "");
}

function canPurchaseListing(listing: PublishedListing) {
  return (
    currentUserCredits.value !== null && listing.listingId !== undefined && listing.priceTokens !== undefined && currentUserCredits.value >= listing.priceTokens
  );
}

async function purchaseListing(listing: PublishedListing) {
  const { listingId, priceTokens } = listing;
  if (listingId === undefined || priceTokens === undefined) {
    return;
  }
  const { ok } = await modalStore.confirm({
    title: t("confirm.title"),
    description: t("dialog.avatar.info.purchase_confirm", {
      name: listing.displayName,
      price: commaNumber(priceTokens),
    }),
  });
  if (!ok) {
    return;
  }
  try {
    await marketplaceRequest.purchaseListing({
      listingId,
      totalPrice: priceTokens,
      quantity: 1,
    });
    toast.success(t("dialog.avatar.info.purchase_success"));
  } catch (error) {
    console.error("Failed to purchase listing", error);
  } finally {
    void getAllProductPurchases().catch(logError);
  }
}
</script>
