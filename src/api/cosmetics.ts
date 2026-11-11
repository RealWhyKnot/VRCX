import type { InventoryTemplate } from "vrchat";
import type { Json } from "../types/vrcx";
import { requestJson } from "./request-json";

const cosmeticsRequest = {
  getProfileEffects(): Promise<{ json: Json<InventoryTemplate[]> }> {
    return requestJson<Json<InventoryTemplate[]>>("cosmetics/index/profileEffect", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  getIconFrames(): Promise<{ json: Json<InventoryTemplate[]> }> {
    return requestJson<Json<InventoryTemplate[]>>("cosmetics/index/iconFrame", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  getNameplateEffects(): Promise<{ json: Json<InventoryTemplate[]> }> {
    return requestJson<Json<InventoryTemplate[]>>("cosmetics/index/nameplateEffect", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },
};

export { cosmeticsRequest };
