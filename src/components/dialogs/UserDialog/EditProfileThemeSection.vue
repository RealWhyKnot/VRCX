<script setup lang="ts">
import { useI18n } from "vue-i18n";

import Button from "@/components/ui/button/Button.vue";
import ColorPickerButton from "@/components/ColorPickerButton.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Select from "../../ui/select/Select.vue";
import SelectContent from "../../ui/select/SelectContent.vue";
import SelectGroup from "../../ui/select/SelectGroup.vue";
import SelectItem from "../../ui/select/SelectItem.vue";
import SelectTrigger from "../../ui/select/SelectTrigger.vue";
import SelectValue from "../../ui/select/SelectValue.vue";

import { useAuthStore } from "../../../stores/auth";
import { useModalStore } from "../../../stores/modal";
import type { EditProfileDialogState } from "@/stores/user-state";
import { getThemeHexColor } from "./edit-profile-colors";
import { useEditProfileTheme } from "./composables/use-edit-profile-theme";

const { t } = useI18n();
const modalStore = useModalStore();
const authStore = useAuthStore();
const editProfileDialog = defineModel<EditProfileDialogState>("editProfileDialog", { required: true });
const {
  themeButtonColorValue,
  themeIconColorValue,
  themeSubtextColorValue,
  handleThemeChange,
  handleThemeButtonColorInput,
  handleThemeIconColorInput,
  handleThemeSubtextColorInput,
  handleThemeInput,
  handleCreateNewTheme,
  deleteTheme,
} = useEditProfileTheme(editProfileDialog, { t, modalStore, authStore });
</script>

<template>
  <section class="space-y-3">
    <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.profile_theme") }}</h3>
    <div class="flex items-center gap-2">
      <Select :model-value="editProfileDialog.themeId" :disabled="editProfileDialog.loading" @update:model-value="handleThemeChange">
        <SelectTrigger size="sm" class="w-42">
          <SelectValue :placeholder="t('dialog.edit_profile.theme_name_placeholder')">
            {{ editProfileDialog.themeName }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="option in editProfileDialog.themes" :key="option.id" :value="option.id" :text-value="option.name">
              <div class="flex w-full items-center justify-between gap-3">
                <span class="inline-flex shrink-0 items-center gap-1">
                  <span
                    class="size-3 rounded-sm border bg-[var(--swatch-button)]"
                    :style="{ '--swatch-button': getThemeHexColor(option.buttonColor) }"
                    title="Button color"
                  ></span>
                  <span
                    class="size-3 rounded-sm border bg-[var(--swatch-icon)]"
                    :style="{ '--swatch-icon': getThemeHexColor(option.iconColor) }"
                    title="Icon color"
                  ></span>
                  <span
                    class="size-3 rounded-sm border bg-[var(--swatch-subtext)]"
                    :style="{ '--swatch-subtext': getThemeHexColor(option.subtextColor) }"
                    title="Subtext color"
                  ></span>
                </span>
                <span class="truncate">{{ option.name }}</span>
              </div>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Button size="sm" variant="outline" :disabled="editProfileDialog.loading" @click="handleCreateNewTheme">
        {{ t("dialog.edit_profile.create_theme") }}
      </Button>

      <Button size="sm" variant="outline" :disabled="editProfileDialog.loading || !editProfileDialog.themeId" @click="deleteTheme">
        {{ t("dialog.edit_profile.delete_theme") }}
      </Button>
    </div>

    <InputGroupField
      v-model="editProfileDialog.themeName"
      class="min-w-0 flex-1 mb-1"
      :maxlength="12"
      :placeholder="t('dialog.edit_profile.theme_name_placeholder')"
      @input="handleThemeInput"
    >
    </InputGroupField>
    <div class="flex gap-2">
      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">{{ t("dialog.edit_profile.button") }}</span>
        <div class="flex items-center gap-2">
          <ColorPickerButton :model-value="themeButtonColorValue" :disabled="editProfileDialog.loading" @update:model-value="handleThemeButtonColorInput" />
        </div>
      </div>

      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">{{ t("dialog.edit_profile.icon") }}</span>
        <div class="flex items-center gap-2">
          <ColorPickerButton :model-value="themeIconColorValue" :disabled="editProfileDialog.loading" @update:model-value="handleThemeIconColorInput" />
        </div>
      </div>

      <div class="space-y-1">
        <span class="text-xs text-muted-foreground">{{ t("dialog.edit_profile.subtext") }}</span>
        <div class="flex items-center gap-2">
          <ColorPickerButton :model-value="themeSubtextColorValue" :disabled="editProfileDialog.loading" @update:model-value="handleThemeSubtextColorInput" />
        </div>
      </div>
    </div>
  </section>
</template>
