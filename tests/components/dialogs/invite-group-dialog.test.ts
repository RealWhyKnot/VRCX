import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn((...args: unknown[]) => Promise.resolve({ ok: true, args })),
  sendGroupInvite: vi.fn((...args: unknown[]) => Promise.resolve({ json: undefined, args })),
  getGroup: vi.fn((...args: unknown[]) => Promise.resolve({ json: { id: "grp_1" }, args })),
  fetch: vi.fn((...args: unknown[]) => Promise.resolve({ ref: { name: "Group One" }, args })),
  setString: vi.fn<(...args: unknown[]) => void>(),
  getString: vi.fn((...args: unknown[]) => Promise.resolve(typeof args[1] === "string" ? args[1] : "")),
  applyGroup: vi.fn((...args: unknown[]) => args[0]),
  inviteDialog: {
    __v_isRef: true,
    value: {
      visible: true,
      loading: false,
      groupId: "grp_1",
      userId: "",
      userIds: ["usr_1"],
      groupName: "",
      userObject: {},
    },
  },
}));

vi.mock("pinia", async (importOriginal) => ({ ...(await importOriginal()), storeToRefs: (s: unknown) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("../../../src/shared/utils/group", () => ({
  hasGroupPermission: () => true,
}));
vi.mock("../../../src/composables/use-user-display", () => ({
  useUserDisplay: () => ({ userImage: () => "", userStatusClass: () => "" }),
}));
vi.mock("../../../src/stores/friend", () => ({
  useFriendStore: () => ({
    vipFriends: ref([]),
    onlineFriends: ref([]),
    activeFriends: ref([]),
    offlineFriends: ref([]),
  }),
}));
vi.mock("../../../src/stores/group", () => ({
  useGroupStore: () => ({
    currentUserGroups: ref(new Map()),
    inviteGroupDialog: mocks.inviteDialog,
    applyGroup: (...args: unknown[]) => mocks.applyGroup(...args),
  }),
}));
vi.mock("../../../src/stores/modal", () => ({
  useModalStore: () => ({ confirm: (...args: unknown[]) => mocks.confirm(...args) }),
}));
vi.mock("../../../src/api/group", () => ({
  groupRequest: {
    sendGroupInvite: (...args: unknown[]) => mocks.sendGroupInvite(...args),
    getGroup: (...args: unknown[]) => mocks.getGroup(...args),
  },
}));
vi.mock("../../../src/api/query-request", () => ({
  queryRequest: { fetch: (...args: unknown[]) => mocks.fetch(...args) },
}));
vi.mock("../../../src/services/config", () => ({
  configRepository: {
    getString: (...args: unknown[]) => mocks.getString(...args),
    setString: (...args: unknown[]) => mocks.setString(...args),
  },
}));
vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("../../../src/components/ui/virtual-combobox/VirtualCombobox.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("lucide-vue-next", () => ({ Check: { template: "<i />" } }));

import InviteGroupDialog from "../../../src/components/dialogs/InviteGroupDialog.vue";

describe("InviteGroupDialog.vue", () => {
  it("renders invite dialog", () => {
    const wrapper = mount(InviteGroupDialog);
    expect(wrapper.text()).toContain("dialog.invite_to_group.header");
  });
});
