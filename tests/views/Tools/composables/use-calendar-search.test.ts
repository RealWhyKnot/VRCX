import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";

const mocks = vi.hoisted(() => ({
  searchGroupCalendars: vi.fn<(params: { searchTerm: string; n: number; offset: number }) => Promise<{ results?: unknown[] }>>(),
}));

vi.mock("../../../../src/api/group", () => ({ groupRequest: { searchGroupCalendars: mocks.searchGroupCalendars } }));
vi.mock("../../../../src/views/Tools/composables/use-group-calendar-data", () => ({
  ownerIdOf: (event: { ownerId?: string }) => event.ownerId ?? "",
}));

import {
  CALENDAR_SEARCH_MAX_LENGTH,
  mergeSearchGroups,
  useCalendarSearch,
  type CalendarGroupRow,
} from "../../../../src/views/Tools/composables/use-calendar-search";

type EventStub = CalendarGroupRow["events"][number];

function isEventStub(value: unknown): value is EventStub {
  return typeof value === "object" && value !== null && "id" in value;
}

function event(id: string, ownerId: string): EventStub {
  const stub: unknown = { id, ownerId, title: id, description: "" };
  if (!isEventStub(stub)) {
    throw new Error("bad stub");
  }
  return stub;
}

function setup() {
  const searchQuery = ref("");
  const prepareEvent = vi.fn<(item: EventStub) => Promise<void>>().mockResolvedValue(undefined);
  const scope = effectScope();
  const search = scope.run(() => useCalendarSearch(searchQuery, prepareEvent));
  if (!search) {
    throw new Error("scope did not run");
  }
  return { searchQuery, prepareEvent, scope, search };
}

describe("merging search results into the group list", () => {
  test("adds found events under their group and skips ones already listed", () => {
    const local: CalendarGroupRow[] = [{ groupId: "grp_a", groupName: "Alpha", events: [event("evt_1", "grp_a")] }];

    const rows = mergeSearchGroups(local, [event("evt_1", "grp_a"), event("evt_2", "grp_a"), event("evt_3", "grp_b"), event("evt_3", "grp_b")], (id) =>
      id === "grp_b" ? "Beta" : undefined
    );

    expect(rows.map((row) => [row.groupId, row.groupName, row.events.map((item) => item.id)])).toEqual([
      ["grp_a", "Alpha", ["evt_1", "evt_2"]],
      ["grp_b", "Beta", ["evt_3"]],
    ]);
    expect(local[0]?.events).toHaveLength(1);
  });
});

describe("calendar search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.searchGroupCalendars.mockResolvedValue({ results: [event("evt_1", "grp_a")] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("waits for three characters and a pause in typing", async () => {
    const { searchQuery, search, prepareEvent, scope } = setup();

    searchQuery.value = "ja";
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.searchGroupCalendars).not.toHaveBeenCalled();

    searchQuery.value = "jaz";
    await nextTick();
    searchQuery.value = "jazz";
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.searchGroupCalendars).toHaveBeenCalledTimes(1);
    expect(mocks.searchGroupCalendars).toHaveBeenCalledWith({ searchTerm: "jazz", n: 50, offset: 0 });
    expect(prepareEvent).toHaveBeenCalledTimes(1);
    expect(search.searchResults.value.map((item) => item.id)).toEqual(["evt_1"]);
    scope.stop();
  });

  test("cuts an oversized search term down to the limit", async () => {
    const { searchQuery, scope } = setup();

    searchQuery.value = `  ${"x".repeat(5000)}  `;
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);

    expect(mocks.searchGroupCalendars.mock.calls[0]?.[0].searchTerm).toHaveLength(CALENDAR_SEARCH_MAX_LENGTH);
    scope.stop();
  });

  test("drops the results when the box is cleared", async () => {
    const { searchQuery, search, scope } = setup();

    searchQuery.value = "jazz";
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);
    searchQuery.value = "";
    await nextTick();

    expect(search.searchResults.value).toEqual([]);
    expect(search.isSearching.value).toBe(false);
    scope.stop();
  });

  test("ignores an older answer that arrives after a newer search", async () => {
    const { searchQuery, search, scope } = setup();
    let finishFirst: (page: { results: unknown[] }) => void = () => undefined;
    mocks.searchGroupCalendars
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = resolve;
          })
      )
      .mockResolvedValueOnce({ results: [event("evt_new", "grp_a")] });

    searchQuery.value = "old term";
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);
    searchQuery.value = "new term";
    await nextTick();
    await vi.advanceTimersByTimeAsync(600);
    finishFirst({ results: [event("evt_old", "grp_a")] });
    await vi.advanceTimersByTimeAsync(10);

    expect(search.searchResults.value.map((item) => item.id)).toEqual(["evt_new"]);
    scope.stop();
  });

  test("shows nothing when the search fails", async () => {
    const { searchQuery, search, scope } = setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.searchGroupCalendars.mockRejectedValue(new Error("offline"));

    searchQuery.value = "jazz";
    await nextTick();
    await vi.advanceTimersByTimeAsync(1000);

    expect(search.searchResults.value).toEqual([]);
    expect(search.isSearching.value).toBe(false);
    scope.stop();
  });
});
