import { queryClient } from "../queries/client";
import { useUserStore } from "../stores/user";

export function getCurrentUserId(): string {
  return useUserStore().currentUser.id;
}

export function refetchActiveGroupScope(groupId: string) {
  if (!groupId) {
    return;
  }
  queryClient
    .invalidateQueries({
      queryKey: ["group", groupId],
      refetchType: "active",
    })
    .catch((err: unknown) => {
      console.error("Failed to refresh scoped group queries:", err);
    });
}
