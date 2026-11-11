import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  saveUserMemo: vi.fn(),
  saveNote: vi.fn(async () => ({
    json: { note: "n1" },
    params: { targetUserId: "usr_1", note: "n1" },
  })),
  getUser: vi.fn(),
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (k) => k }) }));
vi.mock("../../../../src/stores/user", () => ({
  useUserStore: () => ({
    userDialog: ref({
      id: "usr_1",
      note: "n1",
      memo: "m1",
      ref: { id: "usr_1", note: "n1" },
    }),
    cachedUsers: new Map([["usr_1", { note: "n1" }]]),
  }),
}));
vi.mock("../../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    hideUserNotes: ref(false),
    hideUserMemos: ref(false),
  }),
}));
vi.mock("../../../../src/api/misc", () => ({
  default: { saveNote: (...a) => mocks.saveNote(...a) },
}));
vi.mock("../../../../src/api/user", () => ({
  default: { getUser: (...a) => mocks.getUser(...a) },
}));
vi.mock("../../../../src/coordinators/memo-coordinator", () => ({
  saveUserMemo: (...a) => mocks.saveUserMemo(...a),
}));
vi.mock("../../../../src/shared/utils/base/string", () => ({
  replaceBioSymbols: (s) => s,
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
vi.mock("@/components/ui/input-group/InputGroupTextareaField.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: "<textarea />",
  },
}));

import EditNoteAndMemoDialog from "../../../../src/components/dialogs/UserDialog/EditNoteAndMemoDialog.vue";

describe("EditNoteAndMemoDialog.vue", () => {
  beforeEach(() => {
    mocks.saveUserMemo.mockClear();
  });

  it("emits close and saves memo on confirm", async () => {
    const wrapper = mount(EditNoteAndMemoDialog, {
      props: { visible: false },
    });
    await wrapper.setProps({ visible: true });
    const buttons = wrapper.findAll('[data-testid="btn"]');
    await buttons[1].trigger("click");

    expect(mocks.saveUserMemo).toHaveBeenCalledWith("usr_1", "m1");
    expect(wrapper.emitted("update:visible")).toEqual([[false]]);
  });
});
