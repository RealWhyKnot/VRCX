import { request } from "../services/request";
import type { RequestOptions } from "../types/vrcx";

export function requestJson<T>(endpoint: string, options: RequestOptions): Promise<T> {
  const isResponseObject = (value: unknown): value is T => typeof value === "object" && value !== null;
  return request(endpoint, options).then((response) => {
    if (!isResponseObject(response)) {
      throw new Error(`API response is not an object: ${endpoint}`);
    }
    return response;
  });
}
