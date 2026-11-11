import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

const mocks = vi.hoisted(() => {
  function fakeRef<T>(value: T): { __v_isRef: true; value: T } {
    return { __v_isRef: true, value };
  }

  return {
    generalStore: {
      autoStateChangeEnabled: fakeRef(true),
      autoStateChangeAloneStatus: fakeRef("active"),
      autoStateChangeCompanyStatus: fakeRef("busy"),
      autoStateChangeInstanceTypes: fakeRef(["invite"]),
      autoStateChangeNoFriends: fakeRef(false),
      autoStateChangeAloneDescEnabled: fakeRef(false),
      autoStateChangeAloneDesc: fakeRef(""),
      autoStateChangeCompanyDescEnabled: fakeRef(false),
      autoStateChangeCompanyDesc: fakeRef(""),
      autoStateChangeGroups: fakeRef<string[]>([]),
      autoAcceptInviteRequests: fakeRef("Off"),
      autoAcceptInviteGroups: fakeRef<string[]>([]),
      setAutoStateChangeEnabled: vi.fn(),
      setAutoStateChangeAloneStatus: vi.fn(),
      setAutoStateChangeCompanyStatus: vi.fn(),
      setAutoStateChangeInstanceTypes: vi.fn(),
      setAutoStateChangeNoFriends: vi.fn(),
      setAutoStateChangeAloneDescEnabled: vi.fn(),
      setAutoStateChangeAloneDesc: vi.fn(),
      setAutoStateChangeCompanyDescEnabled: vi.fn(),
      setAutoStateChangeCompanyDesc: vi.fn(),
      setAutoStateChangeGroups: vi.fn(),
      setAutoAcceptInviteRequests: vi.fn(),
      setAutoAcceptInviteGroups: vi.fn(),
    },
    favoriteStore: {
      favoriteFriendGroups: fakeRef([{ key: "grp_a", displayName: "Group A" }]),
      localFriendFavoriteGroups: fakeRef(["Local A"]),
    },
  };
});

vi.mock("pinia", async (importOriginal) => ({ ...(await importOriginal<object>()), storeToRefs: (store: unknown) => store }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

vi.mock("../../../../src/stores/settings/general", () => ({
  useGeneralSettingsStore: () => mocks.generalStore,
}));
vi.mock("../../../../src/stores/favorite", () => ({
  useFavoriteStore: () => mocks.favoriteStore,
}));

vi.mock("../../../../src/shared/constants/access-type", () => ({
  accessTypeLocaleKeyMap: {
    invite: "access.invite",
    invitePlus: "access.invite_plus",
    friends: "access.friends",
    friendsPlus: "access.friends_plus",
    public: "access.public",
    groupPublic: "access.group_public",
    groupPlus: "access.group_plus",
    groupMembers: "access.group_members",
    group: "access.group",
  },
}));

vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: {
    emits: ["update:open"],
    template: '<div><button data-testid="dialog-close" @click="$emit(\'update:open\', false)" /><slot /></div>',
  },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<h2><slot /></h2>" },
}));

vi.mock("@/components/ui/field/Field.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldLabel.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldSeparator.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/select/Select.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectItem.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectSeparator.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/select/SelectValue.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/radio-group/RadioGroup.vue", () => ({
  default: {
    emits: ["update:modelValue"],
    template:
      '<div data-testid="radio-group"><button class="emit-false" @click="$emit(\'update:modelValue\', \'false\')" /><button class="emit-true" @click="$emit(\'update:modelValue\', \'true\')" /><button class="emit-all" @click="$emit(\'update:modelValue\', \'All Favorites\')" /><slot /></div>',
  },
}));
vi.mock("@/components/ui/radio-group/RadioGroupItem.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/ui/input/Input.vue", () => ({
  default: { template: "<input />" },
}));

vi.mock("../../../../src/views/Settings/components/SimpleSwitch.vue", () => ({
  default: {
    props: ["label"],
    emits: ["change"],
    template:
      '<div data-testid="simple-switch" :data-label="label"><button class="emit-true" @click="$emit(\'change\', true)" /><button class="emit-false" @click="$emit(\'change\', false)" /></div>',
  },
}));

import AutoChangeStatusDialog from "../../../../src/views/Tools/dialogs/AutoChangeStatusDialog.vue";

function requireNode<T>(node: T | undefined, description: string): T {
  if (node === undefined) {
    throw new Error(`not rendered: ${description}`);
  }
  return node;
}

describe("AutoChangeStatusDialog.vue", () => {
  beforeEach(() => {
    mocks.generalStore.autoStateChangeNoFriends.value = false;
    mocks.generalStore.autoAcceptInviteRequests.value = "Off";
    mocks.generalStore.setAutoStateChangeNoFriends.mockClear();
    mocks.generalStore.setAutoAcceptInviteRequests.mockClear();
  });

  it("emits close when dialog is closed", async () => {
    const wrapper = mount(AutoChangeStatusDialog, {
      props: { isAutoChangeStatusDialogVisible: true },
    });

    await wrapper.get('[data-testid="dialog-close"]').trigger("click");

    expect(wrapper.emitted("close")).toEqual([[]]);
  });

  it("handles auto accept switch and alone-condition radio changes", async () => {
    const wrapper = mount(AutoChangeStatusDialog, {
      props: { isAutoChangeStatusDialogVisible: true },
    });

    const autoAcceptSwitch = requireNode(
      wrapper
        .findAll('[data-testid="simple-switch"]')
        .find((node) => node.attributes("data-label")?.includes("view.settings.general.automation.auto_invite_request_accept")),
      "auto accept switch"
    );

    await autoAcceptSwitch.find(".emit-false").trigger("click");
    expect(mocks.generalStore.setAutoAcceptInviteRequests).toHaveBeenCalledWith("Off");

    await autoAcceptSwitch.find(".emit-true").trigger("click");
    expect(mocks.generalStore.setAutoAcceptInviteRequests).toHaveBeenCalledWith("All Favorites");

    const noFriendsRadio = requireNode(wrapper.findAll('[data-testid="radio-group"]')[0], "alone-condition radio group");
    await noFriendsRadio.find(".emit-false").trigger("click");
    expect(mocks.generalStore.setAutoStateChangeNoFriends).not.toHaveBeenCalled();

    await noFriendsRadio.find(".emit-true").trigger("click");
    expect(mocks.generalStore.setAutoStateChangeNoFriends).toHaveBeenCalledTimes(1);
  });
});
