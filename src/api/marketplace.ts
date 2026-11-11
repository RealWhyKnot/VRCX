import type {
  Avatar,
  Balance,
  GetProductPurchaseHistory,
  GetProductPurchases,
  GetStoreShelves,
  ProductListing,
  ProductPurchase,
  ProductPurchaseHistory,
  StoreShelf,
} from "vrchat";
import type { Json, MarketplaceAvatarSearchParams } from "../types/vrcx";
import { useUserStore } from "../stores/user";
import { requestJson } from "./request-json";

type MarketplaceAvatarSearchResponse = {
  hasNext: boolean;
  totalCount: number;
  results: Json<Avatar>[];
};

const marketplaceRequest = {
  searchAvatars(params: MarketplaceAvatarSearchParams): Promise<{ json: MarketplaceAvatarSearchResponse; params: MarketplaceAvatarSearchParams }> {
    const query = Object.fromEntries(Object.entries<unknown>(params).filter(([, value]) => value !== undefined));
    return requestJson<MarketplaceAvatarSearchResponse>("avatars", {
      method: "GET",
      params: query,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getStoreShelves(params: GetStoreShelves["query"]): Promise<{ json: Json<StoreShelf>[]; params: GetStoreShelves["query"] }> {
    return requestJson<Json<StoreShelf>[]>("economy/store/shelves", {
      method: "GET",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getProductPurchases(params: GetProductPurchases["query"]): Promise<{ json: Json<ProductPurchase>[]; params: GetProductPurchases["query"] }> {
    return requestJson<Json<ProductPurchase>[]>("economy/purchases", {
      method: "GET",
      params,
    }).then((json) => {
      useUserStore().setCachedPurchases(json);
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getProductListing(params: { listingId: string }): Promise<{ json: Json<ProductListing>; params: { listingId: string } }> {
    return requestJson<Json<ProductListing>>(`listing/${params.listingId}`, {
      method: "GET",
      params: { hydrate: true },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  purchaseListing(params: {
    listingId: string;
    totalPrice: number;
    quantity: number;
  }): Promise<{ json: Json<ProductPurchase>; params: { listingId: string; totalPrice: number; quantity: number } }> {
    return requestJson<Json<ProductPurchase>>("economy/purchase/listing", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getEconomySubscriptions(params: { subscriberId: string; n?: number; offset?: number }) {
    return requestJson<unknown>("economy/subscriptions", {
      method: "GET",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getEconomyTransactions(
    params: GetProductPurchaseHistory["query"]
  ): Promise<{ json: Json<ProductPurchaseHistory>; params: GetProductPurchaseHistory["query"] }> {
    return requestJson<Json<ProductPurchaseHistory>>(`user/${useUserStore().currentUser.id}/economy/transactions`, {
      method: "GET",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getVRChatCredits(): Promise<{ json: Json<Balance> }> {
    return requestJson<Json<Balance>>(`user/${useUserStore().currentUser.id}/economy/balance`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },
};

export { marketplaceRequest };
