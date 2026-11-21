import { queryClient } from "@/queries/client";
import type { StaleTimeFunction } from "@tanstack/vue-query";

export function fetchOnDemand<T>(key: readonly unknown[], load: () => Promise<T>, staleTime: StaleTimeFunction<T>): Promise<T> {
  return queryClient.fetchQuery({
    queryKey: ["on-demand", ...key],
    queryFn: load,
    staleTime,
    gcTime: 30 * 60_000,
    retry: false,
  });
}
