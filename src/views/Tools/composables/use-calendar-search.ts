import { onScopeDispose, ref, watch, type Ref } from "vue";

import { groupRequest } from "../../../api/group";
import { logError } from "../../../stores/vrcx-messages";
import { type CalendarEventEntry, ownerIdOf } from "./use-group-calendar-data";

export type CalendarGroupRow = { groupId: string; groupName: string | undefined; events: CalendarEventEntry[] };

export const CALENDAR_SEARCH_MIN_LENGTH = 3;
export const CALENDAR_SEARCH_MAX_LENGTH = 100;
const SEARCH_DELAY_MS = 500;
const SEARCH_PAGE_SIZE = 50;

export function mergeSearchGroups(
  local: CalendarGroupRow[],
  found: CalendarEventEntry[],
  groupName: (groupId: string) => string | undefined
): CalendarGroupRow[] {
  const rows = local.map((row) => ({ ...row, events: [...row.events] }));
  const known = new Set(rows.flatMap((row) => row.events.map((event) => event.id)));
  for (const event of found) {
    if (known.has(event.id)) {
      continue;
    }
    known.add(event.id);
    const groupId = ownerIdOf(event);
    let row = rows.find((item) => item.groupId === groupId);
    if (!row) {
      row = { groupId, groupName: groupName(groupId), events: [] };
      rows.push(row);
    }
    row.events.push(event);
  }
  return rows;
}

export function useCalendarSearch(searchQuery: Ref<string>, prepareEvent: (event: CalendarEventEntry) => Promise<void>) {
  const searchResults = ref<CalendarEventEntry[]>([]);
  const isSearching = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest = 0;

  async function runSearch(term: string, ticket: number): Promise<void> {
    isSearching.value = true;
    try {
      const page = await groupRequest.searchGroupCalendars({ searchTerm: term, n: SEARCH_PAGE_SIZE, offset: 0 });
      const results = page.results ?? [];
      await Promise.all(results.map((event) => prepareEvent(event)));
      if (ticket === latest) {
        searchResults.value = results;
      }
    } catch (err) {
      if (ticket === latest) {
        searchResults.value = [];
      }
      logError(err);
    } finally {
      if (ticket === latest) {
        isSearching.value = false;
      }
    }
  }

  watch(searchQuery, (query) => {
    clearTimeout(timer);
    latest += 1;
    const ticket = latest;
    const term = query.trim().slice(0, CALENDAR_SEARCH_MAX_LENGTH);
    if (term.length < CALENDAR_SEARCH_MIN_LENGTH) {
      searchResults.value = [];
      isSearching.value = false;
      return;
    }
    timer = setTimeout(() => {
      runSearch(term, ticket).catch(logError);
    }, SEARCH_DELAY_MS);
  });

  onScopeDispose(() => {
    clearTimeout(timer);
  });

  return { searchResults, isSearching };
}
