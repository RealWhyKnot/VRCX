import type { Jam, JamSubmission } from "vrchat";
import type { Json } from "@/types/vrcx";
import { fetchOnDemand } from "./on-demand";
import { requestJson } from "./request-json";

export type JamType = "avatar" | "world";

export const jamRequest = {
  getJams(type: JamType): Promise<Json<Jam>[]> {
    return fetchOnDemand(["jams", type], () => requestJson<Json<Jam>[]>("jams", { method: "GET", params: { type } }));
  },

  getSubmissions(jamId: string): Promise<Json<JamSubmission>[]> {
    return fetchOnDemand(["jam-submissions", jamId], () =>
      requestJson<Json<JamSubmission>[]>(`jams/${encodeURIComponent(jamId)}/submissions`, { method: "GET" })
    );
  },
};
