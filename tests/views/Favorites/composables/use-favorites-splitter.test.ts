import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  getString: vi.fn<(key: string, fallback: string) => Promise<string>>((_key, fallback) => Promise.resolve(fallback)),
  setString: vi.fn<(key: string, value: string) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock("../../../../src/services/config.ts", () => ({
  configRepository: {
    getString: (...args: Parameters<typeof mocks.getString>) => mocks.getString(...args),
    setString: (...args: Parameters<typeof mocks.setString>) => mocks.setString(...args),
  },
}));

import { useFavoritesSplitter } from "../../../../src/views/Favorites/composables/use-favorites-splitter";

function mountComposable() {
  const apis: ReturnType<typeof useFavoritesSplitter>[] = [];
  const Comp = defineComponent({
    setup() {
      apis.push(
        useFavoritesSplitter({
          configKey: "split-key",
          defaultSize: 240,
          minPx: 120,
          maxPx: 360,
        })
      );
      return () => h("div");
    },
  });
  mount(Comp);
  const api = apis[0];
  if (!api) {
    throw new Error("useFavoritesSplitter was not set up");
  }
  return api;
}

describe("useFavoritesSplitter", () => {
  beforeEach(() => {
    mocks.setString.mockClear();
  });

  it("persists layout size while dragging", () => {
    const api = mountComposable();
    api.splitterGroupRef.value = {
      getBoundingClientRect: () => ({ width: 1200 }),
    };

    api.setDragging(true);
    api.handleLayout([25, 75]);
    api.setDragging(false);

    expect(mocks.setString).toHaveBeenCalledWith("split-key", "300");
  });

  it("ignores layout updates when not dragging", () => {
    const api = mountComposable();
    api.splitterGroupRef.value = {
      getBoundingClientRect: () => ({ width: 1200 }),
    };

    api.handleLayout([20, 80]);

    expect(mocks.setString).not.toHaveBeenCalled();
  });
});
