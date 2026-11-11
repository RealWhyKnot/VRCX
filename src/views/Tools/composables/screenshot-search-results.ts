import { formatDateFilter } from "@/coordinators/date-coordinator";
import { parseJsonRecord, readScreenshotMetadata, type ScreenshotSearchRow } from "./screenshot-metadata-parse";

export async function loadSearchResultsMetadata(filePaths: string[], query: string, searchType: number) {
  const results: ScreenshotSearchRow[] = [];
  const lowerQuery = query.toLowerCase();
  const promises = filePaths.map(async (filePath) => {
    try {
      const meta = parseJsonRecord(await window.AppApi.GetScreenshotMetadata(filePath));
      const extra = parseJsonRecord(await window.AppApi.GetExtraScreenshotData(filePath, false));
      if (!meta || !extra) {
        throw new Error("Screenshot metadata is not an object");
      }
      const metadata = readScreenshotMetadata(meta);
      const extraData = readScreenshotMetadata(extra);

      let dateTime = 0;
      let dateFormatted = "—";
      if (metadata.timestamp) {
        dateTime = Date.parse(metadata.timestamp);
      } else if (extraData.creationDate) {
        dateTime = Date.parse(extraData.creationDate);
      }
      if (dateTime) {
        dateFormatted = formatDateFilter(new Date(dateTime).toISOString(), "short");
      }

      let match = "";
      if (searchType === 0) {
        const matched = (metadata.players ?? []).filter((p) => p.displayName?.toLowerCase().includes(lowerQuery));
        match = matched.map((p) => p.displayName).join(", ");
      } else if (searchType === 1) {
        const matched = metadata.players?.find((p) => p.id === query);
        match = matched?.displayName ?? "";
      }

      results.push({
        filePath,
        dateTime,
        dateFormatted,
        world: metadata.world?.name ?? "",
        playerCount: metadata.players?.length ?? 0,
        players: metadata.players?.length ?? 0,
        resolution: extraData.fileResolution ?? "",
        match,
        author: metadata.author?.displayName ?? "",
      });
    } catch (e) {
      console.error("Error loading metadata for", filePath, e);
    }
  });
  await Promise.all(promises);
  return results;
}
