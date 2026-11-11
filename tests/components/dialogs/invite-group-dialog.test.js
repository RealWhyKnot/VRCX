import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  confirm: vi.fn(async () => ({ ok: true })),
  sendGroupInvite: vi.fn(async () => ({})),
  getGroup: vi.fn(async () => ({ json: { id: "grp_1" } })),
  fetch: vi.fn(async () => ({ ref: { name: "Group One" } })),
  setString: vi.fn(),
  getString: vi.fn(async () => ""),
  applyGroup: vi.fn((g) => g),
  inviteDialog: {
    __v_isRef: true,
    value: {
      visible: true,
      loading: false,
      groupId: "grp_1",
      userId: "",
      userIds: ["usr_1"],
      groupName: "",
      userObject: null,
    },
  },
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k) => k }) }));
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
    applyGroup: (...a) => mocks.applyGroup(...a),
  }),
}));
vi.mock("../../../src/stores/modal", () => ({
  useModalStore: () => ({ confirm: (...a) => mocks.confirm(...a) }),
}));
vi.mock("../../../src/api/group", () => ({
  default: {
    sendGroupInvite: (...a) => mocks.sendGroupInvite(...a),
    getGroup: (...a) => mocks.getGroup(...a),
  },
}));
vi.mock("../../../src/api/query-request", () => ({
  default: { fetch: (...a) => mocks.fetch(...a) },
}));
vi.mock("../../../src/services/config", () => ({
  default: {
    getString: (...a) => mocks.getString(...a),
    setString: (...a) => mocks.setString(...a),
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
  it("renders invite dialog", async () => {
    const wrapper = mount(InviteGroupDialog);
    expect(wrapper.text()).toContain("dialog.invite_to_group.header");
  });
});
