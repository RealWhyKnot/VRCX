import { beforeEach, expect, test, vi } from "vitest";
import { request, failedGetRequests } from "@/services/request";
import { hasVrcApiTrouble, recordVrcApiStatus } from "@/stores/vrc-api-status";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<() => Promise<{ status: number; data: string }>>(),
  toastError: vi.fn(),
}));

vi.mock("@/stores/auth", () => ({ useAuthStore: () => ({}) }));
vi.mock("@/stores/modal", () => ({ useModalStore: () => ({}) }));
vi.mock("@/stores/notification", () => ({ useNotificationStore: () => ({}) }));
vi.mock("@/stores/update-loop", () => ({ useUpdateLoopStore: () => ({}) }));
vi.mock("@/coordinators/user-coordinator", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/services/webapi.ts", () => ({ webApiService: { execute: mocks.execute } }));
vi.mock("vue-sonner", () => ({ toast: { error: mocks.toastError } }));

beforeEach(() => {
  vi.resetAllMocks();
  failedGetRequests.clear();
  recordVrcApiStatus(200);
});

test("keeps an expected next-event 404 out of errors and API trouble", async () => {
  const endpoint = "calendar/grp_a/next";
  mocks.execute.mockResolvedValueOnce({ status: 404, data: '{"error":{"message":"Not found","status_code":404}}' });
  await expect(request(endpoint, { method: "GET", isNotFoundEmpty: true })).resolves.toBeNull();
  expect(failedGetRequests.has(endpoint)).toBe(false);
  expect(mocks.toastError).not.toHaveBeenCalled();
  expect(hasVrcApiTrouble.value).toBe(false);
});

test("tracks transport and 5xx failures and clears from a successful request", async () => {
  mocks.execute
    .mockRejectedValueOnce(new Error("No route"))
    .mockResolvedValueOnce({ status: 503, data: "" })
    .mockResolvedValueOnce({ status: 400, data: "" })
    .mockResolvedValueOnce({ status: 502, data: "" })
    .mockResolvedValueOnce({ status: 200, data: "{}" });
  const options = { method: "GET" } satisfies Parameters<typeof request>[1];
  await expect(request("probe", options)).rejects.toMatchObject({ status: 0 });
  await expect(request("probe", options)).rejects.toMatchObject({ status: 503 });
  await expect(request("probe", options)).rejects.toMatchObject({ status: 400 });
  expect(hasVrcApiTrouble.value).toBe(false);
  await expect(request("probe", options)).rejects.toMatchObject({ status: 502 });
  expect(hasVrcApiTrouble.value).toBe(true);
  await expect(request("probe", options)).resolves.toEqual({});
  expect(hasVrcApiTrouble.value).toBe(false);
});
