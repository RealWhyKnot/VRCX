<template>
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="x-dialog sm:max-w-110">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.avatar.actions.manage_tags") }}</DialogTitle>
        <DialogDescription>{{ avatarName }}</DialogDescription>
      </DialogHeader>

      <p class="text-xs text-muted-foreground">{{ t("dialog.avatar.actions.manage_tags_hint") }}</p>
      <TagsInput v-model="tagNames" :delimiter="','" add-on-blur class="mt-1">
        <template v-for="entry in tagEntries" :key="entry.tag">
          <Popover>
            <PopoverTrigger as-child>
              <TagsInputItem
                :value="entry.tag"
                class="cursor-pointer"
                :style="{
                  backgroundColor: resolveColor(entry).bg,
                  color: resolveColor(entry).text,
                }"
              >
                <TagsInputItemText />
                <TagsInputItemDelete />
              </TagsInputItem>
            </PopoverTrigger>
            <PopoverContent class="w-auto p-2" side="top" :side-offset="8">
              <div class="flex items-center gap-1.5">
                <button
                  v-for="color in TAG_COLORS"
                  :key="color.name"
                  type="button"
                  class="h-4 w-4 shrink-0 rounded-sm transition-transform hover:scale-125 cursor-pointer"
                  :class="isColorSelected(entry, color) ? 'ring-1 ring-ring ring-offset-1 ring-offset-background' : ''"
                  :style="{ backgroundColor: color.bg.replace('/ 0.2)', '/ 1)') }"
                  :title="color.label"
                  @click="setEntryColor(entry, color)"
                />
              </div>
            </PopoverContent>
          </Popover>
        </template>

        <TagsInputInput :placeholder="t('dialog.avatar.actions.manage_tags_placeholder')" />
      </TagsInput>

      <DialogFooter>
        <Button variant="secondary" class="mr-2" @click="dialogOpen = false">
          {{ t("prompt.rename_avatar.cancel") }}
        </Button>
        <Button @click="save">
          {{ t("prompt.rename_avatar.ok") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import TagsInput from "@/components/ui/tags-input/TagsInput.vue";
import TagsInputInput from "@/components/ui/tags-input/TagsInputInput.vue";
import TagsInputItem from "@/components/ui/tags-input/TagsInputItem.vue";
import TagsInputItemDelete from "@/components/ui/tags-input/TagsInputItemDelete.vue";
import TagsInputItemText from "@/components/ui/tags-input/TagsInputItemText.vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import { computed, ref, watch } from "vue";
import { TAG_COLORS } from "@/shared/constants/tags";
import Button from "@/components/ui/button/Button.vue";
import { useI18n } from "vue-i18n";
import { getAvatarTagColor, type AvatarTag, type AvatarTagSavePayload } from "./types";

type TagColor = (typeof TAG_COLORS)[number];

const props = withDefaults(
  defineProps<{
    open?: boolean;
    avatarName?: string;
    avatarId?: string;
    initialTags?: AvatarTag[];
  }>(),
  {
    open: false,
    avatarName: "",
    avatarId: "",
    initialTags: () => [],
  }
);

const emit = defineEmits<{
  "update:open": [value: boolean];
  save: [payload: AvatarTagSavePayload];
}>();

const { t } = useI18n();

const dialogOpen = computed({
  get: () => props.open,
  set: (isOpen: boolean) => emit("update:open", isOpen),
});

const tagEntries = ref<AvatarTag[]>([]);

const tagNames = computed({
  get: () => tagEntries.value.map((e) => e.tag),
  set: (names: string[]) => {
    const existingMap = Object.fromEntries(tagEntries.value.map((e): [string, AvatarTag] => [e.tag, e]));
    tagEntries.value = names.map((name) => existingMap[name] ?? { tag: name, color: null });
  },
});

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      tagEntries.value = props.initialTags.map((entry) => ({ ...entry }));
    }
  }
);

function resolveColor(entry: AvatarTag) {
  if (entry.color) {
    return {
      bg: entry.color,
      text: entry.color.replace(/\/ [\d.]+\)$/, ")"),
    };
  }
  return getAvatarTagColor(entry.tag);
}

function isColorSelected(entry: AvatarTag, color: TagColor) {
  if (entry.color) {
    return entry.color === color.bg;
  }
  const hashColor = getAvatarTagColor(entry.tag);
  return hashColor.name === color.name;
}

function setEntryColor(entry: AvatarTag, color: TagColor) {
  const hashColor = getAvatarTagColor(entry.tag);
  entry.color = hashColor.name === color.name ? null : color.bg;
}

function save() {
  emit("save", {
    avatarId: props.avatarId,
    tags: tagEntries.value.map((e) => ({ tag: e.tag, color: e.color })),
  });
  dialogOpen.value = false;
}
</script>
