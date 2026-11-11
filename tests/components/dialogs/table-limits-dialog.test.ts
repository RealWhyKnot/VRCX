import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type * as Pinia from "pinia";

const mocks = vi.hoisted(() => ({
  close: vi.fn<(...args: unknown[]) => void>(),
  save: vi.fn<(...args: unknown[]) => void>(),
  dialog: {
    value: { visible: true, maxTableSize: "1000", searchLimit: "100" },
  },
}));

vi.mock("pinia", async (importOriginal) => ({
  ...(await importOriginal<typeof Pinia>()),
  storeToRefs: <T>(store: T) => store,
}));
vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../../../src/stores/settings/appearance", () => ({
  useAppearanceSettingsStore: () => ({
    tableLimitsDialog: mocks.dialog,
    closeTableLimitsDialog: (...args: unknown[]) => mocks.close(...args),
    saveTableLimitsDialog: (...args: unknown[]) => mocks.save(...args),
    TABLE_MAX_SIZE_MIN: 100,
    TABLE_MAX_SIZE_MAX: 5000,
    SEARCH_LIMIT_MIN: 10,
    SEARCH_LIMIT_MAX: 1000,
  }),
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
vi.mock("@/components/ui/dialog/DialogDescription.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/Field.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldGroup.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldLabel.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/field/FieldContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="btn" :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>',
  },
}));
vi.mock("@/components/ui/input-group/InputGroupField.vue", () => ({
  default: { template: "<input />" },
}));

import TableLimitsDialog from "../../../src/components/dialogs/TableLimitsDialog.vue";

describe("TableLimitsDialog.vue", () => {
  it("disables save when limits are invalid and calls close", async () => {
    mocks.dialog.value.maxTableSize = "1";
    const wrapper = mount(TableLimitsDialog);
    const buttons = wrapper.findAll('[data-testid="btn"]');

    expect(buttons[1]?.attributes("disabled")).toBeDefined();
    await buttons[0]?.trigger("click");
    expect(mocks.close).toHaveBeenCalled();
  });
});
