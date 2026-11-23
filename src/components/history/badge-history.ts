import { queryClient } from "@/queries/client";
import type { HistoryRow } from "@/services/database/retained-events";
import { historyText } from "./history-text";

export function parseBadgeSentence(message: string) {
  const match = /^(Badge earned: |Badge removed: )([\s\S]+)$/.exec(message);
  if (!match?.[2]) return undefined;
  return { prefix: match[1], action: match[1] === "Badge earned: " ? "add" : "remove", name: match[2] };
}

export async function findBadgeHistory(
  account: string,
  badgeId: string,
  message: string,
  at: string,
  isCurrent: () => boolean,
  isRetry = false
): Promise<unknown> {
  const event = parseBadgeSentence(message);
  if (!account || (!badgeId && (!event || !at))) return;
  const { retainedEvents } = await import("@/services/database/retained-events");
  if (!isCurrent()) return;
  if (badgeId) {
    const row: HistoryRow | null = await queryClient.fetchQuery({
      queryKey: ["retained-badge", account, badgeId],
      queryFn: () => retainedEvents.getLatestBadgeById(badgeId),
      staleTime: isRetry ? 0 : 60_000,
      gcTime: 60_000,
      retry: false,
    });
    return isCurrent() ? row?.data : undefined;
  }
  if (!event) return;
  const rows: HistoryRow[] = await queryClient.fetchQuery({
    queryKey: ["retained-badge-at", account, at],
    queryFn: () => retainedEvents.getBadgeHistoryAt(at),
    staleTime: isRetry ? 0 : 1500,
    gcTime: 60_000,
    retry: false,
  });
  if (!isCurrent()) return;
  return rows.find((row) => historyText(row.data, "action") === event.action && (row.detail === event.name || historyText(row.data, "name") === event.name))
    ?.data;
}
