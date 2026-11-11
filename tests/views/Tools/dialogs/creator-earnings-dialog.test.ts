import { beforeEach, describe, expect, test, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => ({
  getEarningsMetrics: vi.fn<(params: { metricDateStart?: string; metricDateEnd?: string }) => Promise<unknown>>(),
  logError: vi.fn<(err: unknown) => void>(),
}));

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../../../src/api/marketplace", () => ({ marketplaceRequest: { getEarningsMetrics: mocks.getEarningsMetrics } }));
vi.mock("../../../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));

import CreatorEarningsDialog from "../../../../src/views/Tools/dialogs/CreatorEarningsDialog.vue";

const stubs = {
  Dialog: { props: ["open"], template: '<div v-if="open"><slot /></div>' },
  DialogContent: { template: "<div><slot /></div>" },
  DialogHeader: { template: "<div><slot /></div>" },
  DialogTitle: { template: "<div><slot /></div>" },
  Select: { template: "<div><slot /></div>" },
  SelectTrigger: { template: "<div><slot /></div>" },
  SelectValue: { template: "<span />" },
  SelectContent: { template: "<div><slot /></div>" },
  SelectItem: { template: "<div><slot /></div>" },
};

async function open() {
  const wrapper = mount(CreatorEarningsDialog, { props: { isVisible: false }, global: { stubs } });
  await wrapper.setProps({ isVisible: true });
  await flushPromises();
  return wrapper;
}

describe("CreatorEarningsDialog.vue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getEarningsMetrics.mockResolvedValue({
      totals: { totalEarnings: 1500, otpEarnings: 1000, otpPurchaseCount: 4, subscriberEarnings: 500, subscriberMonths: 5 },
    });
  });

  test("loads when opened and shows the five totals", async () => {
    const wrapper = await open();
    expect(mocks.getEarningsMetrics).toHaveBeenCalledTimes(1);
    const totals = wrapper.get('[data-testid="earnings-totals"]');
    expect(totals.findAll(".rounded-lg")).toHaveLength(5);
    expect(totals.text()).toContain(new Intl.NumberFormat().format(1500));
    expect(totals.text()).toContain("dialog.creator_earnings.subscriber_months");
  });

  test("stays closed and quiet until opened", () => {
    const wrapper = mount(CreatorEarningsDialog, { props: { isVisible: false }, global: { stubs } });
    expect(mocks.getEarningsMetrics).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="earnings-totals"]').exists()).toBe(false);
  });

  test("reloads from the refresh button", async () => {
    const wrapper = await open();
    await wrapper.get('[data-testid="earnings-refresh"]').trigger("click");
    await flushPromises();
    expect(mocks.getEarningsMetrics).toHaveBeenCalledTimes(2);
  });

  test("shows the failure message when the request is refused", async () => {
    mocks.getEarningsMetrics.mockRejectedValue(new Error("forbidden"));
    const wrapper = await open();
    expect(wrapper.find('[data-testid="earnings-failed"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="earnings-totals"]').exists()).toBe(false);
  });

  test("keeps huge amounts in truncating cells with the full value on hover", async () => {
    mocks.getEarningsMetrics.mockResolvedValue({
      totals: {
        totalEarnings: Number.MAX_SAFE_INTEGER,
        otpEarnings: 1e15,
        otpPurchaseCount: 1e15,
        subscriberEarnings: 1e15,
        subscriberMonths: 1e15,
      },
    });
    const wrapper = await open();
    const values = wrapper.findAll('[data-testid="earnings-totals"] .tabular-nums');
    expect(values).toHaveLength(5);
    for (const value of values) {
      expect(value.classes()).toContain("truncate");
      expect(value.attributes("title")).toBe(value.text());
      expect(value.element.parentElement?.className).toContain("min-w-0");
    }
  });
});
