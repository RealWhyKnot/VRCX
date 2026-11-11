import type { GetModerationReports, ModerationReport, PaginatedModerationReportList, SubmitModerationReportRequest, SuccessFlag } from "vrchat";
import type { Json } from "../types/vrcx";
import { requestJson, requestAck } from "./request-json";

const moderationReportRequest = {
  getModerationReports(params: GetModerationReports["query"]): Promise<{ json: Json<PaginatedModerationReportList>; params: GetModerationReports["query"] }> {
    return requestJson<Json<PaginatedModerationReportList>>("moderationReports", {
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

  submitModerationReport(params: SubmitModerationReportRequest): Promise<{ json: Json<ModerationReport>; params: SubmitModerationReportRequest }> {
    return requestJson<Json<ModerationReport>>("moderationReports", {
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

  deleteModerationReport(params: { moderationReportId: string }): Promise<{ json: Json<SuccessFlag> | undefined; params: { moderationReportId: string } }> {
    return requestAck<Json<SuccessFlag>>(`moderationReports/${params.moderationReportId}`, {
      method: "DELETE",
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },
};

export { moderationReportRequest };
