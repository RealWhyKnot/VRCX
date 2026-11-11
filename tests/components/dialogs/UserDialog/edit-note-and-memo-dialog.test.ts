import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

const mocks = vi.hoisted(() => ({
  saveUserMemo: vi.fn<(userId: string, memo: string) => Promise<void>>(() => Promise.resolve()),
  saveNote: vi.fn<(params: { targetUserId: string; note: string }) => Promise<{ json: { note: string }; params: { targetUserId: string; note: string } }>>(() =>
    Promise.resolve({
      json: { note: "n1" },
      params: { targetUserId: "usr_1", note: "n1" },
    })
  ),
  getUser: vi.fn<(params: { userId: string }) => Promise<unknown>>(),
}));

vi.mock("pinia", async (i) => ({ ...(await i()), storeToRefs: (s: unknown) => s }));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
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
  miscRequest: { saveNote: (...args: Parameters<typeof mocks.saveNote>) => mocks.saveNote(...args) },
}));
vi.mock("../../../../src/api/user", () => ({
  userRequest: { getUser: (...args: Parameters<typeof mocks.getUser>) => mocks.getUser(...args) },
}));
vi.mock("../../../../src/coordinators/memo-coordinator", () => ({
  saveUserMemo: (...args: Parameters<typeof mocks.saveUserMemo>) => mocks.saveUserMemo(...args),
}));
vi.mock("../../../../src/shared/utils/base/string", () => ({
  replaceBioSymbols: (text: string) => text,
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
    const saveButton = buttons[1];
    if (saveButton === undefined) throw new Error("save button not rendered");
    await saveButton.trigger("click");

    expect(mocks.saveUserMemo).toHaveBeenCalledWith("usr_1", "m1");
    expect(wrapper.emitted("update:visible")).toEqual([[false]]);
  });
});
