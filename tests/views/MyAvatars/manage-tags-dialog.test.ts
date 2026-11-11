import { describe, expect, test, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import type { AvatarTag } from "../../../src/views/MyAvatars/types";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../src/shared/constants/tags", () => ({
  TAG_COLORS: [
    {
      name: "blue",
      label: "Blue",
      bg: "hsl(210 100% 50% / 0.2)",
      text: "hsl(210 100% 40%)",
    },
  ],
  getTagColor: () => ({
    name: "blue",
    bg: "hsl(210 100% 50% / 0.2)",
    text: "hsl(210 100% 40%)",
  }),
}));

vi.mock("@/components/ui/dialog/Dialog.vue", () => ({
  default: {
    props: ["open"],
    emits: ["update:open"],
    template: "<div><slot /></div>",
  },
}));
vi.mock("@/components/ui/dialog/DialogContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogDescription.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogFooter.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogHeader.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/dialog/DialogTitle.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/popover/Popover.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/popover/PopoverContent.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/ui/popover/PopoverTrigger.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));

vi.mock("@/components/ui/button/Button.vue", () => ({
  default: {
    emits: ["click"],
    template: '<button data-testid="button" @click="$emit(\'click\')"><slot /></button>',
  },
}));

vi.mock("@/components/ui/tags-input/TagsInput.vue", () => ({
  default: {
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: "<div><slot /></div>",
  },
}));
vi.mock("@/components/ui/tags-input/TagsInputInput.vue", () => ({
  default: {
    template: '<input data-testid="tags-input" />',
  },
}));
vi.mock("@/components/ui/tags-input/TagsInputItem.vue", () => ({
  default: {
    props: ["value"],
    template: '<span data-testid="tag-item"><slot />{{ value }}</span>',
  },
}));
vi.mock("@/components/ui/tags-input/TagsInputItemDelete.vue", () => ({
  default: { template: "<span>x</span>" },
}));
vi.mock("@/components/ui/tags-input/TagsInputItemText.vue", () => ({
  default: { template: "<span />" },
}));

import ManageTagsDialog from "../../../src/views/MyAvatars/ManageTagsDialog.vue";

function mountDialog(props: { open?: boolean; avatarName?: string; avatarId?: string; initialTags?: AvatarTag[] } = {}) {
  return mount(ManageTagsDialog, {
    props: {
      open: false,
      avatarName: "Test Avatar",
      avatarId: "avtr_1",
      initialTags: [],
      ...props,
    },
  });
}

describe("ManageTagsDialog.vue", () => {
  test("loads initial tags when dialog opens", async () => {
    const wrapper = mountDialog({
      initialTags: [{ tag: "cute", color: null }],
    });

    await wrapper.setProps({ open: true });
    await nextTick();

    const tags = wrapper.findAll('[data-testid="tag-item"]');
    expect(tags).toHaveLength(1);
    expect(tags[0]?.text()).toContain("cute");
  });

  test("emits save payload and closes dialog", async () => {
    const wrapper = mountDialog({
      initialTags: [{ tag: "cute", color: null }],
    });

    await wrapper.setProps({ open: true });
    await nextTick();

    const okButton = wrapper.findAll('[data-testid="button"]').find((node) => node.text().includes("prompt.rename_avatar.ok"));

    expect(okButton).toBeTruthy();
    await okButton?.trigger("click");

    expect(wrapper.emitted("save")).toBeTruthy();
    expect(wrapper.emitted("save")?.[0]?.[0]).toEqual({
      avatarId: "avtr_1",
      tags: [{ tag: "cute", color: null }],
    });
    expect(wrapper.emitted("update:open")).toBeTruthy();
    expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);
  });

  test("cancel button closes dialog without save", async () => {
    const wrapper = mountDialog();

    const cancelButton = wrapper.findAll('[data-testid="button"]').find((node) => node.text().includes("prompt.rename_avatar.cancel"));

    expect(cancelButton).toBeTruthy();
    await cancelButton?.trigger("click");

    expect(wrapper.emitted("save")).toBeFalsy();
    expect(wrapper.emitted("update:open")).toBeTruthy();
    expect(wrapper.emitted("update:open")?.at(-1)).toEqual([false]);
  });
});
