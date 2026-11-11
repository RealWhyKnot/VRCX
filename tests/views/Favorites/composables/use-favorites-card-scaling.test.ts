import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";

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

import { useFavoritesCardScaling } from "../../../../src/views/Favorites/composables/use-favorites-card-scaling";

function mountComposable() {
  const apis: ReturnType<typeof useFavoritesCardScaling>[] = [];
  const Comp = defineComponent({
    setup() {
      apis.push(
        useFavoritesCardScaling({
          configKey: "scale-key",
          spacingConfigKey: "spacing-key",
        })
      );
      return () => h("div");
    },
  });
  mount(Comp);
  const api = apis[0];
  if (!api) {
    throw new Error("useFavoritesCardScaling was not set up");
  }
  return api;
}

describe("useFavoritesCardScaling", () => {
  beforeEach(() => {
    mocks.getString.mockClear();
    mocks.setString.mockClear();
  });

  it("builds grid style css vars from scale/spacing", () => {
    const api = mountComposable();
    api.cardScale.value = 0.8;
    api.cardSpacing.value = 1.2;

    const style = api.gridStyle.value(3, { preferredColumns: 2 });

    expect(style["--favorites-card-scale"]).toBe("0.80");
    expect(style["--favorites-card-spacing-scale"]).toBe("1.20");
    expect(Number(style["--favorites-grid-columns"])).toBeGreaterThanOrEqual(1);
    expect(mocks.setString).toHaveBeenCalledWith("scale-key", "0.8");
    expect(mocks.setString).toHaveBeenCalledWith("spacing-key", "1.2");
  });
});
