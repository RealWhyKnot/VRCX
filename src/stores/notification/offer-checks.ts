import type { Ref } from "vue";
import type { useNotificationsSettingsStore } from "../settings/notifications";
import type { useUserStore } from "../user";
import { inventoryRequest } from "../../api/inventory";
import { marketplaceRequest } from "../../api/marketplace";
import { configRepository } from "../../services/config";
import { VRCHAT_STORE_IDS } from "../../shared/constants/marketplace";
import { replaceBioSymbols } from "../../shared/utils/base/string";
import type { FreeStoreItemDialog, FreeStoreListing, FreeStoreShelf, InventoryBundle, InventoryBundleDialog } from "./types";

type NotificationsSettingsStore = ReturnType<typeof useNotificationsSettingsStore>;
type UserStore = ReturnType<typeof useUserStore>;

const IGNORED_BUNDLE_TEMPLATE_IDS = new Set<string>(["invt_08e50f24-8807-4ec2-a0f9-9e008371280b"]);

export function getEffectiveListingPrice(listing: FreeStoreListing, isVrcPlusSupporter: boolean) {
  if (isVrcPlusSupporter && listing.vrcPlusDiscountPrice != null) {
    return listing.vrcPlusDiscountPrice;
  }
  return listing.priceTokens;
}

function productIdsOf(listing: { productIds?: readonly string[] }): readonly string[] {
  return listing.productIds ?? [];
}

export function isListingOwned(listing: FreeStoreListing, userStore: UserStore) {
  if (userStore.ownedListingIds.has(listing.id)) {
    return true;
  }
  const productIds = productIdsOf(listing);
  return productIds.length > 0 && productIds.every((id) => userStore.ownedProductIds.has(id));
}

export function isListingInBundle(listing: FreeStoreListing, listings: Map<string, FreeStoreListing>) {
  const productIds = productIdsOf(listing);
  if (productIds.length === 0) {
    return false;
  }
  for (const other of listings.values()) {
    const bundleProductIds = productIdsOf(other);
    if (other.id !== listing.id && bundleProductIds.length > productIds.length && productIds.every((id) => bundleProductIds.includes(id))) {
      return true;
    }
  }
  return false;
}

function parseFailedListingIds(data: string): string[] {
  const parsed: unknown = JSON.parse(data);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter((id): id is string => typeof id === "string");
}

function failedListingKey(userId: string) {
  return `VRCX_failedFreeListingIds_${userId}`;
}

export async function getFailedFreeListingIds(userId: string): Promise<Set<string>> {
  const data = await configRepository.getString(failedListingKey(userId), "[]");
  return new Set(parseFailedListingIds(data));
}

export async function addFailedFreeListingIds(userId: string, listingIds: string[]) {
  if (listingIds.length === 0) {
    return;
  }
  const failedIds = await getFailedFreeListingIds(userId);
  for (const id of listingIds) {
    failedIds.add(id);
  }
  await configRepository.setString(failedListingKey(userId), JSON.stringify(Array.from(failedIds)));
}

export async function checkInventoryBundles(
  notificationsSettingsStore: NotificationsSettingsStore,
  shownBundleIds: Set<string>,
  dialogRef: Ref<InventoryBundleDialog>
) {
  if (!notificationsSettingsStore.inventoryBundleNotifications) {
    return;
  }
  let bundles: InventoryBundle[];
  try {
    const args = await inventoryRequest.getInventoryItems({
      n: 100,
      offset: 0,
      types: "bundle",
      order: "newest",
    });
    bundles = args.json.data;
  } catch (err) {
    console.error("Failed to check inventory bundles:", err);
    return;
  }
  const newBundles = bundles.filter((item) => !shownBundleIds.has(item.id) && !IGNORED_BUNDLE_TEMPLATE_IDS.has(item.templateId));
  if (newBundles.length === 0) {
    return;
  }
  for (const item of newBundles) {
    shownBundleIds.add(item.id);
  }
  const dialog = dialogRef.value;
  if (dialog.visible) {
    dialog.bundles.push(...newBundles);
  } else {
    dialog.bundles = newBundles;
  }
  dialog.visible = true;
}

export async function checkFreeStoreItems(
  notificationsSettingsStore: NotificationsSettingsStore,
  userStore: UserStore,
  shownFreeListingIds: Set<string>,
  dialogRef: Ref<FreeStoreItemDialog>
) {
  if (!notificationsSettingsStore.freeStoreItemNotifications) {
    return;
  }
  let shelves: FreeStoreShelf[];
  try {
    const [results] = await Promise.all([
      Promise.all(
        VRCHAT_STORE_IDS.map((storeId) =>
          marketplaceRequest.getStoreShelves({
            storeId,
            fetch: "public",
            hydrateListings: true,
          })
        )
      ),
      userStore.getAllProductPurchases(),
    ]);
    shelves = results.flatMap((args) => args.json);
  } catch (err) {
    console.error("Failed to check free store items:", err);
    return;
  }
  const failedListingIds = await getFailedFreeListingIds(userStore.currentUser.id);
  const isVrcPlusSupporter = userStore.isLocalUserVrcPlusSupporter;
  const freeListings = new Map<string, FreeStoreListing>();
  for (const shelf of shelves) {
    for (const listing of shelf.listings ?? []) {
      if (
        listing.active &&
        !getEffectiveListingPrice(listing, isVrcPlusSupporter) &&
        !isListingOwned(listing, userStore) &&
        !shownFreeListingIds.has(listing.id) &&
        !failedListingIds.has(listing.id)
      ) {
        freeListings.set(listing.id, {
          ...listing,
          displayName: replaceBioSymbols(listing.displayName),
        });
      }
    }
  }
  for (const listing of freeListings.values()) {
    shownFreeListingIds.add(listing.id);
  }
  const newListings = Array.from(freeListings.values()).filter((listing) => !isListingInBundle(listing, freeListings));
  if (newListings.length === 0) {
    return;
  }
  const dialog = dialogRef.value;
  if (dialog.visible) {
    dialog.listings.push(...newListings);
  } else {
    dialog.listings = newListings;
  }
  dialog.visible = true;
}
