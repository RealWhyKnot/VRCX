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
  const pageSize = 250;
  let cursor: number | null = null;
  let fallback: unknown;
  while (isCurrent()) {
    const before: number | null = cursor;
    const rows: HistoryRow[] = await queryClient.fetchQuery({
      queryKey: ["retained-badges", account, before],
      queryFn: () => retainedEvents.getBadgeHistory(pageSize, before),
      staleTime: before === null ? (isRetry ? 0 : 1500) : 60_000,
      gcTime: 60_000,
      retry: false,
    });
    const found = rows.find((row) => {
      if (badgeId) return row.detail === badgeId && Boolean(historyText(row.data, "imageUrl"));
      return (
        event &&
        row.createdAt === at &&
        historyText(row.data, "action") === event.action &&
        (row.detail === event.name || historyText(row.data, "name") === event.name)
      );
    });
    if (found) return found.data;
    if (badgeId && !fallback) fallback = rows.find((row) => row.detail === badgeId)?.data;
    const last = rows.at(-1);
    if (!last || rows.length < pageSize || (before !== null && last.id >= before)) return fallback;
    cursor = last.id;
  }
  return undefined;
}
