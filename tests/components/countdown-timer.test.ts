import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  startInterval: vi.fn<(handler: () => void, timeout: number) => number>(() => 42),
  stopInterval: vi.fn<(id: number) => void>(),
  timeToText: vi.fn<(ms: number) => string>((ms) => `${Math.floor(ms / 1000)}s`),
}));

vi.mock("worker-timers", () => ({
  setInterval: (...args: Parameters<typeof mocks.startInterval>) => mocks.startInterval(...args),
  clearInterval: (...args: Parameters<typeof mocks.stopInterval>) => mocks.stopInterval(...args),
}));

vi.mock("../../src/shared/utils/base/format", () => ({
  timeToText: (...args: Parameters<typeof mocks.timeToText>) => mocks.timeToText(...args),
}));

import CountdownTimer from "../../src/components/CountdownTimer.vue";

describe("CountdownTimer.vue", () => {
  beforeEach(() => {
    mocks.startInterval.mockClear();
    mocks.stopInterval.mockClear();
    mocks.timeToText.mockClear();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-01-01T00:00:00.000Z").getTime());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders remaining time on mount", async () => {
    const wrapper = mount(CountdownTimer, {
      props: {
        datetime: "2025-12-31T23:30:00.000Z",
        hours: 1,
      },
    });
    await nextTick();

    expect(mocks.timeToText).toHaveBeenCalled();
    expect(wrapper.text()).toContain("1800s");
  });

  it("renders dash when countdown expired", async () => {
    const wrapper = mount(CountdownTimer, {
      props: {
        datetime: "2025-12-31T22:00:00.000Z",
        hours: 1,
      },
    });
    await nextTick();

    expect(wrapper.text()).toBe("-");

    await wrapper.setProps({
      datetime: "2025-12-31T23:59:30.000Z",
      hours: 0,
    });
    await nextTick();
    expect(wrapper.text()).toBe("-");
  });

  it("clears interval on unmount", () => {
    const wrapper = mount(CountdownTimer, {
      props: {
        datetime: "2025-12-31T23:30:00.000Z",
        hours: 1,
      },
    });

    wrapper.unmount();

    expect(mocks.startInterval).toHaveBeenCalled();
    expect(mocks.stopInterval).toHaveBeenCalledWith(42);
  });
});
