import type {
  EquipInventoryItemRequest,
  GetInventory,
  Inventory,
  InventoryConsumptionResults,
  InventoryItem,
  InventoryTemplate,
  RewardRedemptionRequest,
  RewardRedemptionResult,
} from "vrchat";
import type { Json } from "../types/vrcx";
import { queryClient } from "../queries/client";
import { requestJson } from "./request-json";

function refetchActiveInventoryQueries() {
  queryClient
    .invalidateQueries({
      queryKey: ["inventory"],
      refetchType: "active",
    })
    .catch((err: unknown) => {
      console.error("Failed to refresh inventory queries:", err);
    });
}

const inventoryRequest = {
  getUserInventoryItem(params: { inventoryId: string; userId: string }): Promise<{
    json: Json<InventoryItem>;
    params: { inventoryId: string; userId: string };
  }> {
    return requestJson<Json<InventoryItem>>(`user/${params.userId}/inventory/${params.inventoryId}`, {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getInventoryItem(params: { inventoryId: string }): Promise<{ json: Json<InventoryItem>; params: { inventoryId: string } }> {
    return requestJson<Json<InventoryItem>>(`inventory/${params.inventoryId}`, {
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

  getInventoryItems(params: GetInventory["query"]): Promise<{ json: Json<Inventory>; params: GetInventory["query"] }> {
    return requestJson<Json<Inventory>>("inventory", {
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

  consumeInventoryBundle(params: { inventoryId: string }): Promise<{ json: Json<InventoryConsumptionResults>; params: { inventoryId: string } }> {
    return requestJson<Json<InventoryConsumptionResults>>(`inventory/${params.inventoryId}/consume`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveInventoryQueries();
      return args;
    });
  },

  getInventoryTemplate(params: { inventoryTemplateId: string }): Promise<{
    json: Json<InventoryTemplate>;
    params: { inventoryTemplateId: string };
  }> {
    return requestJson<Json<InventoryTemplate>>(`inventory/template/${params.inventoryTemplateId}`, {
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

  redeemReward(params: RewardRedemptionRequest): Promise<{ json: Json<RewardRedemptionResult[]>; params: RewardRedemptionRequest }> {
    return requestJson<Json<RewardRedemptionResult[]>>("reward/redeem", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      refetchActiveInventoryQueries();
      return args;
    });
  },

  getGlobalInventory(): Promise<{ json: Json<InventoryItem>[]; params: Record<string, never> }> {
    return requestJson<Json<InventoryItem>[]>("inventory/global", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
        params: {},
      };
      return args;
    });
  },

  getEquipSlot(params: GetInventory["query"]): Promise<{ json: Json<Inventory>; params: GetInventory["query"] }> {
    return requestJson<Json<Inventory>>("inventory", {
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

  equipItem(
    params: { inventoryId: string } & EquipInventoryItemRequest
  ): Promise<{ json: Json<InventoryItem>; params: { inventoryId: string } & EquipInventoryItemRequest }> {
    return requestJson<Json<InventoryItem>>(`inventory/${params.inventoryId}/equip`, {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  archiveItem(params: { inventoryId: string }): Promise<{ json: Json<InventoryItem>; params: { inventoryId: string } }> {
    return requestJson<Json<InventoryItem>>(`inventory/${params.inventoryId}`, {
      method: "PUT",
      params: {
        isArchived: true,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  unArchiveItem(params: { inventoryId: string }): Promise<{ json: Json<InventoryItem>; params: { inventoryId: string } }> {
    return requestJson<Json<InventoryItem>>(`inventory/${params.inventoryId}`, {
      method: "PUT",
      params: {
        isArchived: false,
      },
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
};

export { inventoryRequest };
