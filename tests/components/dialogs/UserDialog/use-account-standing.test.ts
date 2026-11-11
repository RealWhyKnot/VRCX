import { beforeEach, describe, expect, test, vi } from "vitest";
import { effectScope, nextTick, ref } from "vue";

const mocks = vi.hoisted(() => ({
  getAccountStanding: vi.fn<() => Promise<{ json: unknown }>>(),
}));

vi.mock("../../../../src/api/user", () => ({ userRequest: { getAccountStanding: mocks.getAccountStanding } }));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: { count: number }) => (params ? `${key}=${String(params.count)}` : key),
  }),
}));

import { useAccountStanding } from "../../../../src/components/dialogs/UserDialog/composables/use-account-standing";

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

function setup(isOpen: boolean) {
  const isOwnProfileOpen = ref(isOpen);
  const scope = effectScope();
  const standing = scope.run(() => useAccountStanding(() => isOwnProfileOpen.value));
  if (!standing) {
    throw new Error("scope did not run");
  }
  return { isOwnProfileOpen, standing, scope };
}

describe("account standing detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  test("does not ask for the detail while another profile is open", async () => {
    const { standing, scope } = setup(false);
    await settle();

    expect(mocks.getAccountStanding).not.toHaveBeenCalled();
    expect(standing.accountStandingTooltip.value).toBe("dialog.user.tags.account_standing");
    scope.stop();
  });

  test("shows sanctions and the days left once the own profile opens", async () => {
    mocks.getAccountStanding.mockResolvedValue({ json: { standing: "bad", sanctions: [{}, {}], issueClearDays: 12 } });
    const { isOwnProfileOpen, standing, scope } = setup(false);

    isOwnProfileOpen.value = true;
    await settle();

    expect(mocks.getAccountStanding).toHaveBeenCalledTimes(1);
    expect(standing.accountStandingTooltip.value).toBe(
      ["dialog.user.tags.account_standing", "dialog.user.tags.account_standing_sanctions=2", "dialog.user.tags.account_standing_clear_days=12"].join("\n")
    );
    scope.stop();
  });

  test("leaves out the days line when nothing is pending", async () => {
    mocks.getAccountStanding.mockResolvedValue({ json: { standing: "good", sanctions: [], issueClearDays: 0 } });
    const { standing, scope } = setup(true);
    await settle();

    expect(standing.accountStandingTooltip.value).toBe(["dialog.user.tags.account_standing", "dialog.user.tags.account_standing_sanctions=0"].join("\n"));
    scope.stop();
  });

  test("copes with a response that has no sanctions list", async () => {
    mocks.getAccountStanding.mockResolvedValue({ json: { standing: "good" } });
    const { standing, scope } = setup(true);
    await settle();

    expect(standing.accountStandingTooltip.value).toBe(["dialog.user.tags.account_standing", "dialog.user.tags.account_standing_sanctions=0"].join("\n"));
    scope.stop();
  });

  test("falls back to the plain label when the request fails", async () => {
    mocks.getAccountStanding.mockRejectedValue(new Error("offline"));
    const { standing, scope } = setup(true);
    await settle();

    expect(standing.accountStandingTooltip.value).toBe("dialog.user.tags.account_standing");
    scope.stop();
  });
});
