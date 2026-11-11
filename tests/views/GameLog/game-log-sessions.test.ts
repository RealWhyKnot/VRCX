import { beforeEach, describe, expect, test, vi } from "vitest";
import { mount, type DOMWrapper } from "@vue/test-utils";
const mocks = vi.hoisted(() => ({
  makeRef: <T>(value: T) => ({ value, __v_isRef: true }),
  handleSessionsEventFilterChange: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  toggleSessionsVipFilter: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  setSessionsSearch: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  setSessionsDateRange: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  clearSessionsDateRange: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
  loadMoreSessionsSegments: vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve()),
}));

const sessionsSegments = mocks.makeRef<unknown[]>([]);
const sessionsLoading = mocks.makeRef(false);
const sessionsHasMore = mocks.makeRef(false);
const sessionsVipFilter = mocks.makeRef(false);
const sessionsSearch = mocks.makeRef("");
const sessionsDateFrom = mocks.makeRef("");
const sessionsDateTo = mocks.makeRef("");
const sessionsEventFilterSelection = mocks.makeRef(["All"]);
const sessionsEventFilterTypes = mocks.makeRef(["OnPlayerJoined", "OnPlayerLeft", "VideoPlay"]);
const sessionsDateRangeMaxDays = mocks.makeRef(7);
const weekStartsOn = mocks.makeRef(0);

vi.mock("pinia", () => ({
  storeToRefs: <T>(store: T) => store,
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en-US",
  }),
}));

vi.mock("@internationalized/date", () => ({
  getLocalTimeZone: () => "UTC",
  today: () => ({}),
  fromDate: (date: unknown) => date,
  toDate: (date: unknown) => date,
}));

vi.mock("../../../src/stores/gameLog", () => ({
  useGameLogStore: () => ({
    sessionsSegments,
    sessionsLoading,
    sessionsHasMore,
    sessionsVipFilter,
    sessionsSearch,
    sessionsDateFrom,
    sessionsDateTo,
    sessionsEventFilterSelection,
    sessionsEventFilterTypes,
    sessionsDateRangeMaxDays,
    toggleSessionsVipFilter: (...args: unknown[]) => mocks.toggleSessionsVipFilter(...args),
    handleSessionsEventFilterChange: (...args: unknown[]) => mocks.handleSessionsEventFilterChange(...args),
    setSessionsSearch: (...args: unknown[]) => mocks.setSessionsSearch(...args),
    setSessionsDateRange: (...args: unknown[]) => mocks.setSessionsDateRange(...args),
    clearSessionsDateRange: (...args: unknown[]) => mocks.clearSessionsDateRange(...args),
    loadMoreSessionsSegments: (...args: unknown[]) => mocks.loadMoreSessionsSegments(...args),
  }),
}));
vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    weekStartsOn,
  }),
}));

vi.mock("../../../src/components/ui/toggle/Toggle.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<button data-testid="vip-toggle" @click="$emit(\'update:modelValue\', !modelValue)"><slot /></button>',
  },
}));

vi.mock("../../../src/components/ui/toggle-group/ToggleGroup.vue", () => ({
  default: {
    emits: ["update:model-value"],
    template:
      '<div data-testid="toggle-group">' +
      "<button data-testid=\"select-join\" @click=\"$emit('update:model-value', ['OnPlayerJoined'])\">join</button>" +
      "<slot />" +
      "</div>",
  },
}));
vi.mock("../../../src/components/ui/toggle-group/ToggleGroupItem.vue", () => ({
  default: {
    props: ["value"],
    template: '<button :data-value="value"><slot /></button>',
  },
}));

vi.mock("../../../src/components/ui/popover/Popover.vue", () => ({
  default: {
    template: "<div><slot /></div>",
  },
}));
vi.mock("../../../src/components/ui/popover/PopoverTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("../../../src/components/ui/popover/PopoverContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("../../../src/components/ui/range-calendar/RangeCalendar.vue", () => ({
  default: {
    emits: ["update:modelValue"],
    template:
      "<button data-testid=\"set-date-range\" @click=\"$emit('update:modelValue', { start: { toDate: () => new Date('2026-04-01T00:00:00.000Z') }, end: { toDate: () => new Date('2026-04-02T00:00:00.000Z') } })\">range</button>",
  },
}));

vi.mock("../../../src/components/ui/input-group/InputGroupField.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue", "change", "keyup.enter"],
    template:
      '<input data-testid="sessions-search" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" />',
  },
}));

vi.mock("../../../src/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: "<button @click=\"$emit('click')\"><slot /></button>",
  },
}));

vi.mock("../../../src/components/ui/data-table/DataTableEmpty.vue", () => ({
  default: { template: '<div data-testid="data-table-empty" />' },
}));

vi.mock("../../../src/components/ui/badge/Badge.vue", () => ({
  default: { template: "<span><slot /></span>" },
}));

vi.mock("../../../src/components/ui/tooltip/TooltipWrapper.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("../../../src/components/ui/skeleton/Skeleton.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("../../../src/components/ui/spinner/Spinner.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("../../../src/views/GameLog/components/GameLogSessionsSegment.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("lucide-vue-next", () => ({
  CalendarRange: { template: "<span />" },
  Star: { template: "<span />" },
  Inbox: { template: "<span />" },
  SearchAlert: { template: "<span />" },
}));

import GameLogSessions from "../../../src/views/GameLog/components/GameLogSessions.vue";

function clickButtonByText(wrapper: { findAll: (selector: string) => DOMWrapper<Element>[] }, text: string) {
  const button = wrapper.findAll("button").find((node) => node.text().includes(text));
  if (!button) {
    throw new Error(`Cannot find button with text: ${text}`);
  }
  return button.trigger("click");
}

describe("GameLogSessions.vue", () => {
  beforeEach(() => {
    sessionsSearch.value = "";
    sessionsDateFrom.value = "";
    sessionsDateTo.value = "";
    sessionsEventFilterSelection.value = ["All"];
    mocks.handleSessionsEventFilterChange.mockReset();
    mocks.toggleSessionsVipFilter.mockReset();
    mocks.setSessionsSearch.mockReset();
    mocks.setSessionsDateRange.mockReset();
    mocks.clearSessionsDateRange.mockReset();
    mocks.loadMoreSessionsSegments.mockReset();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        disconnect = vi.fn();
        observe = vi.fn();
      }
    );
  });

  test("updates event filters via toggle group", async () => {
    const wrapper = mount(GameLogSessions);

    await wrapper.get('[data-testid="select-join"]').trigger("click");

    expect(mocks.handleSessionsEventFilterChange).toHaveBeenCalledWith(["OnPlayerJoined"]);
  });

  test("applies sessions search on change", async () => {
    const wrapper = mount(GameLogSessions);
    const input = wrapper.get('[data-testid="sessions-search"]');

    await input.setValue("alice");
    await input.trigger("change");

    expect(mocks.setSessionsSearch).toHaveBeenCalledWith("alice");
  });

  test("applies date range from calendar", async () => {
    const wrapper = mount(GameLogSessions);

    await wrapper.get('[data-testid="set-date-range"]').trigger("click");
    await clickButtonByText(wrapper, "common.actions.confirm");

    expect(mocks.setSessionsDateRange).toHaveBeenCalledTimes(1);
    expect(mocks.setSessionsDateRange.mock.calls[0]?.[0]).toContain("T");
    expect(mocks.setSessionsDateRange.mock.calls[0]?.[1]).toContain("T");
  });
});
