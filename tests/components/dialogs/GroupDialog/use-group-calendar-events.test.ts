import { describe, expect, test } from "vitest";
import { ref, type Ref } from "vue";
import { useGroupCalendarEvents } from "../../../../src/components/dialogs/GroupDialog/use-group-calendar-events";
import type { GroupDialogState } from "../../../../src/stores/group-types";

type CalendarEvent = GroupDialogState["calendar"][number];

const PAST_DATE = "2020-01-01T00:00:00Z";
const FUTURE_DATE = "2099-12-31T23:59:59Z";

function createEvent(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, "id">): CalendarEvent {
  return {
    accessType: "public",
    category: "other",
    description: "",
    endsAt: FUTURE_DATE,
    startsAt: PAST_DATE,
    title: "",
    ...overrides,
  };
}

function createGroupDialog(calendar: CalendarEvent[] = []): Ref<{ calendar: CalendarEvent[] }> {
  return ref({
    calendar,
  });
}

describe("useGroupCalendarEvents", () => {
  describe("pastCalenderEvents", () => {
    test("returns empty array when calendar is null", () => {
      const groupDialog = ref<{ calendar?: CalendarEvent[] | null }>({ calendar: null });
      const { pastCalenderEvents } = useGroupCalendarEvents(groupDialog);
      expect(pastCalenderEvents.value).toEqual([]);
    });

    test("returns empty array when calendar is undefined", () => {
      const groupDialog = ref<{ calendar?: CalendarEvent[] | null }>({});
      const { pastCalenderEvents } = useGroupCalendarEvents(groupDialog);
      expect(pastCalenderEvents.value).toEqual([]);
    });

    test("returns empty array when no past events exist", () => {
      const groupDialog = createGroupDialog([createEvent({ id: "1", endsAt: FUTURE_DATE })]);
      const { pastCalenderEvents } = useGroupCalendarEvents(groupDialog);
      expect(pastCalenderEvents.value).toEqual([]);
    });

    test("is reactive to calendar changes", () => {
      const groupDialog = createGroupDialog([]);
      const { pastCalenderEvents } = useGroupCalendarEvents(groupDialog);
      expect(pastCalenderEvents.value).toHaveLength(0);

      groupDialog.value.calendar = [createEvent({ id: "1", endsAt: PAST_DATE })];
      expect(pastCalenderEvents.value).toHaveLength(1);
    });
  });

  describe("upcomingCalenderEvents", () => {
    test("returns empty array when calendar is null", () => {
      const groupDialog = ref<{ calendar?: CalendarEvent[] | null }>({ calendar: null });
      const { upcomingCalenderEvents } = useGroupCalendarEvents(groupDialog);
      expect(upcomingCalenderEvents.value).toEqual([]);
    });

    test("returns empty array when no upcoming events exist", () => {
      const groupDialog = createGroupDialog([createEvent({ id: "1", endsAt: PAST_DATE })]);
      const { upcomingCalenderEvents } = useGroupCalendarEvents(groupDialog);
      expect(upcomingCalenderEvents.value).toEqual([]);
    });
  });

  describe("updateFollowingCalendarData", () => {
    test("updates an existing event by id", () => {
      const groupDialog = createGroupDialog([
        createEvent({ id: "1", title: "Old Title", endsAt: FUTURE_DATE }),
        createEvent({ id: "2", title: "Other", endsAt: FUTURE_DATE }),
      ]);
      const { updateFollowingCalendarData } = useGroupCalendarEvents(groupDialog);

      updateFollowingCalendarData({ id: "1", title: "New Title" });

      expect(groupDialog.value.calendar[0]?.title).toBe("New Title");
      expect(groupDialog.value.calendar[0]?.endsAt).toBe(FUTURE_DATE);
    });

    test("does not modify other events", () => {
      const groupDialog = createGroupDialog([
        createEvent({ id: "1", title: "Event 1", endsAt: FUTURE_DATE }),
        createEvent({ id: "2", title: "Event 2", endsAt: FUTURE_DATE }),
      ]);
      const { updateFollowingCalendarData } = useGroupCalendarEvents(groupDialog);

      updateFollowingCalendarData({ id: "1", title: "Updated" });

      expect(groupDialog.value.calendar[1]?.title).toBe("Event 2");
    });

    test("does nothing when event id is not found", () => {
      const events = [createEvent({ id: "1", title: "Event 1", endsAt: FUTURE_DATE })];
      const groupDialog = createGroupDialog([...events]);
      const { updateFollowingCalendarData } = useGroupCalendarEvents(groupDialog);

      updateFollowingCalendarData({
        id: "nonexistent",
        title: "Updated",
      });

      expect(groupDialog.value.calendar[0]?.title).toBe("Event 1");
    });

    test("merges new properties into the event", () => {
      const groupDialog = createGroupDialog([createEvent({ id: "1", title: "Event", endsAt: FUTURE_DATE })]);
      const { updateFollowingCalendarData } = useGroupCalendarEvents(groupDialog);

      updateFollowingCalendarData({
        id: "1",
        userInterest: { isFollowing: true },
      });

      expect(groupDialog.value.calendar[0]?.title).toBe("Event");
      expect(groupDialog.value.calendar[0]?.userInterest?.isFollowing).toBe(true);
    });
  });
});
