import { queryClient } from "@/queries/client";

export function fetchOnDemand<T>(key: readonly unknown[], load: () => Promise<T>): Promise<T> {
  return queryClient.fetchQuery({
    queryKey: ["on-demand", ...key],
    queryFn: load,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}
