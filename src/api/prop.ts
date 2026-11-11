import type { Prop } from "vrchat";
import type { Json } from "../types/vrcx";
import { requestJson } from "./request-json";

const propRequest = {
  getProp(params: { propId: string }): Promise<{ json: Json<Prop>; params: { propId: string } }> {
    return requestJson<Json<Prop>>(`props/${params.propId}`, {
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
};

export { propRequest };
