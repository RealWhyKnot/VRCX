<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { Bookmark, History, X } from "lucide-vue-next";

import Button from "@/components/ui/button/Button.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import InputGroupButton from "@/components/ui/input-group/InputGroupButton.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Select from "../../ui/select/Select.vue";
import SelectContent from "../../ui/select/SelectContent.vue";
import SelectGroup from "../../ui/select/SelectGroup.vue";
import SelectItem from "../../ui/select/SelectItem.vue";
import SelectTrigger from "../../ui/select/SelectTrigger.vue";
import SelectValue from "../../ui/select/SelectValue.vue";

import { useUserStore } from "../../../stores/user";
import type { EditProfileDialogState } from "@/stores/user-state";
import { useEditProfileStatus } from "./composables/use-edit-profile-status";

const { t } = useI18n();
const { currentUser } = storeToRefs(useUserStore());
const editProfileDialog = defineModel<EditProfileDialogState>("editProfileDialog", { required: true });
const {
  presets,
  getStatusClass,
  statusOptions,
  selectedStatusOption,
  historyItems,
  getStatusLabel,
  applyPreset,
  handleSavePreset,
  handleDeletePreset,
  handleSocialStatusChange,
  setSocialStatusFromHistory,
} = useEditProfileStatus(editProfileDialog, currentUser, t);
</script>

<template>
  <section class="space-y-3">
    <h3 class="text-sm font-semibold">{{ t("dialog.social_status.header") }}</h3>

    <div class="flex items-center gap-2 min-w-0">
      <Select :model-value="editProfileDialog.status" :disabled="editProfileDialog.loading" @update:model-value="handleSocialStatusChange">
        <SelectTrigger size="sm" class="w-42 shrink-0">
          <SelectValue>
            <template v-if="selectedStatusOption">
              <span class="inline-flex items-center gap-2">
                <i class="x-user-status" :class="selectedStatusOption.statusClass"></i>
                <span>{{ selectedStatusOption.label }}</span>
              </span>
            </template>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value" :text-value="option.label">
              <div class="flex items-center gap-2">
                <i class="x-user-status" :class="option.statusClass"></i>
                <span>{{ option.label }}</span>
              </div>
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <InputGroupField
        v-model="editProfileDialog.statusDescription"
        class="min-w-0 flex-1"
        :placeholder="t('dialog.social_status.status_placeholder')"
        :maxlength="32"
        clearable
      >
      </InputGroupField>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <InputGroupButton variant="outline" size="icon-lg">
            <History class="text-lg" />
          </InputGroupButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem v-if="!historyItems.length" disabled>
            {{ t("dialog.social_status.history") }}
          </DropdownMenuItem>
          <DropdownMenuItem v-for="item in historyItems" :key="item.no ?? item.status" @click="setSocialStatusFromHistory(item)">
            {{ item.status }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div v-if="presets.length" class="space-y-2">
      <span class="text-xs text-muted-foreground block">
        {{ t("dialog.social_status.presets") }}
      </span>
      <div class="flex flex-wrap gap-1.5">
        <div
          v-for="(preset, index) in presets"
          :key="index"
          class="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border bg-background text-xs cursor-pointer hover:bg-accent transition-colors max-w-50"
          @click="applyPreset(preset)"
        >
          <i class="x-user-status flex-none" :class="getStatusClass(preset.status)"></i>
          <span class="truncate">{{ preset.statusDescription || getStatusLabel(preset.status) }}</span>
          <button
            class="flex-none size-4 inline-flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity cursor-pointer"
            @click.stop="handleDeletePreset(index)"
          >
            <X class="size-3" />
          </button>
        </div>
      </div>
    </div>

    <Button variant="outline" :disabled="editProfileDialog.loading" @click="handleSavePreset">
      <Bookmark class="size-4" />
      {{ t("dialog.social_status.save_preset") }}
    </Button>
  </section>
</template>
