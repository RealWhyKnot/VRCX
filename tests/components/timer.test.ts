import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  timeToText: vi.fn<(ms: number) => string>((ms) => `${ms}ms`),
  nowRef: { value: new Date(0) },
}));

vi.mock("../../src/shared/utils/base/format", () => ({
  timeToText: (...args: Parameters<typeof mocks.timeToText>) => mocks.timeToText(...args),
}));

vi.mock("@vueuse/core", () => ({
  useNow: () => mocks.nowRef,
}));

import Timer from "../../src/components/Timer.vue";

describe("Timer.vue", () => {
  beforeEach(() => {
    mocks.timeToText.mockClear();
    mocks.nowRef.value = new Date(10000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders dash when epoch is falsy", () => {
    const wrapper = mount(Timer, {
      props: {
        epoch: 0,
      },
    });

    expect(wrapper.text()).toBe("-");
  });
});
