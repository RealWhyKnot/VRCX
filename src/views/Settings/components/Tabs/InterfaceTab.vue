<template>
  <div class="flex flex-col gap-10 py-2">
    <SettingsGroup :title="t('view.settings.appearance.appearance.header')">
      <SettingsItem :label="t('view.settings.appearance.appearance.language')">
        <Select :model-value="appLanguage" @update:model-value="changeAppLanguage">
          <SelectTrigger size="sm">
            <SelectValue :placeholder="appLanguageDisplayName" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="language in languageCodes" :key="language" :value="language">
                {{ getLanguageName(language) }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.appearance.appearance.font_family')">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline" size="sm" class="min-w-[180px] justify-between font-normal">
              <span class="truncate">{{ fontDropdownDisplayText }}</span>
              <ChevronDown class="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              v-for="option in westernFontItems"
              :key="option.key"
              :model-value="appFontFamily === option.key"
              @select="handleSelectWesternFont(option.key)"
            >
              {{ option.label }}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              v-for="option in cjkFontItems"
              :key="option.key"
              :model-value="appCjkFontPack === option.key && appFontFamily !== 'custom'"
              @select="handleSelectCjkFont(option.key)"
            >
              {{ option.label }}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem :model-value="appFontFamily === 'custom'" @select="handleSelectCustomFont">
              {{ t("view.settings.appearance.appearance.font_family_custom") }}
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog v-model:open="customFontDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{{ t("view.settings.appearance.appearance.font_family_custom_dialog_title") }}</DialogTitle>
              <DialogDescription>{{ t("view.settings.appearance.appearance.font_family_custom_dialog_description") }}</DialogDescription>
            </DialogHeader>
            <Input v-model="customFontInput" placeholder="'My Font', Arial, sans-serif" />
            <DialogFooter>
              <Button variant="outline" @click="customFontDialogOpen = false">
                {{ t("dialog.alertdialog.cancel") }}
              </Button>
              <Button @click="saveCustomFont">
                {{ t("dialog.alertdialog.ok") }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingsItem>

      <SettingsItem v-if="!isLinux" :label="t('view.settings.appearance.appearance.zoom')">
        <NumberField v-model="zoomLevel" :step="1" :format-options="{ maximumFractionDigits: 0 }" class="w-32" @update:model-value="setZoomLevel">
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.appearance.appearance.show_notification_icon_dot')" toggle>
        <Switch
          :model-value="notificationIconDot"
          :aria-label="t('view.settings.appearance.appearance.show_notification_icon_dot')"
          @update:model-value="
            setNotificationIconDot();
            saveOpenVROption();
          "
        />
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.appearance.user_dialog.header')">
      <SettingsItem :label="t('view.settings.appearance.appearance.vrc_profile_themes')" toggle>
        <Switch
          :model-value="displayVRCProfileThemes"
          :aria-label="t('view.settings.appearance.appearance.vrc_profile_themes')"
          @update:model-value="
            setDisplayVRCProfileThemes();
            saveOpenVROption();
          "
        />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.vrc_profile_backgrounds')"
        :description="t('view.settings.appearance.appearance.vrc_profile_backgrounds_description')"
        toggle
      >
        <Switch
          :model-value="displayVRCProfileBackgrounds"
          :aria-label="t('view.settings.appearance.appearance.vrc_profile_backgrounds')"
          @update:model-value="
            setDisplayVRCProfileBackgrounds();
            saveOpenVROption();
          "
        />
      </SettingsItem>

      <template v-if="displayVRCProfileBackgrounds">
        <SettingsItem
          :label="t('view.settings.appearance.appearance.vrc_profile_backgrounds_opacity')"
          :description="t('view.settings.appearance.appearance.vrc_profile_backgrounds_opacity_description')"
        >
          <NumberField
            v-model="profileBackgroundOpacity"
            :step="0.1"
            :min="0"
            :max="1"
            :format-options="{ maximumFractionDigits: 2 }"
            class="w-32"
            @update:model-value="setProfileBackgroundOpacity"
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </SettingsItem>
      </template>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.vrc_profile_cosmetics')"
        :description="t('view.settings.appearance.appearance.cosmetics_description')"
        toggle
      >
        <Switch
          :model-value="displayVRCProfileCosmetics"
          :aria-label="t('view.settings.appearance.appearance.vrc_profile_cosmetics')"
          @update:model-value="
            setDisplayVRCProfileCosmetics();
            saveOpenVROption();
          "
        />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.user_dialog.vrchat_notes')"
        :description="t('view.settings.appearance.user_dialog.vrchat_notes_description')"
        toggle
      >
        <Switch :model-value="!hideUserNotes" :aria-label="t('view.settings.appearance.user_dialog.vrchat_notes')" @update:model-value="setHideUserNotes" />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.user_dialog.vrcx_memos')"
        :description="t('view.settings.appearance.user_dialog.vrcx_memos_description')"
        toggle
      >
        <Switch :model-value="!hideUserMemos" :aria-label="t('view.settings.appearance.user_dialog.vrcx_memos')" @update:model-value="setHideUserMemos" />
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.appearance.display.header')">
      <SettingsItem :label="t('view.settings.appearance.appearance.show_instance_id')" toggle>
        <Switch
          :model-value="showInstanceIdInLocation"
          :aria-label="t('view.settings.appearance.appearance.show_instance_id')"
          @update:model-value="setShowInstanceIdInLocation"
        />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.nicknames')"
        :description="t('view.settings.appearance.appearance.nicknames_description')"
        toggle
      >
        <Switch
          :model-value="!hideNicknames"
          :aria-label="t('view.settings.appearance.appearance.nicknames')"
          @update:model-value="
            setHideNicknames();
            saveOpenVROption();
          "
        />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.age_gated_instances')"
        :description="t('view.settings.appearance.appearance.age_gated_instances_description')"
        toggle
      >
        <Switch
          :model-value="isAgeGatedInstancesVisible"
          :aria-label="t('view.settings.appearance.appearance.age_gated_instances')"
          @update:model-value="setIsAgeGatedInstancesVisible"
        />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.closed_instances')"
        :description="t('view.settings.appearance.appearance.closed_instances_description')"
        toggle
      >
        <Switch
          :model-value="isClosedInstancesVisible"
          :aria-label="t('view.settings.appearance.appearance.closed_instances')"
          @update:model-value="setIsClosedInstancesVisible"
        />
      </SettingsItem>

      <SettingsItem :label="t('view.settings.appearance.appearance.striped_data_table_mode')" toggle>
        <Switch
          :model-value="isDataTableStriped"
          :aria-label="t('view.settings.appearance.appearance.striped_data_table_mode')"
          @update:model-value="toggleStripedDataTable"
        />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.accessible_status_indicators')"
        :description="t('view.settings.appearance.appearance.accessible_status_indicators_description')"
        toggle
      >
        <Switch
          :model-value="accessibleStatusIndicators"
          :aria-label="t('view.settings.appearance.appearance.accessible_status_indicators')"
          @update:model-value="toggleAccessibleStatusIndicators"
        />
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.interface.navigation.header')">
      <SettingsItem :label="t('view.settings.interface.navigation.show_new_dashboard_button')" toggle>
        <Switch
          :model-value="showNewDashboardButton"
          :aria-label="t('view.settings.interface.navigation.show_new_dashboard_button')"
          @update:model-value="setShowNewDashboardButton"
        />
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.interface.lists_tables.header')">
      <SettingsItem :label="t('view.settings.appearance.appearance.sort_favorite_by')">
        <ToggleGroup
          type="single"
          required
          variant="outline"
          size="sm"
          :model-value="sortFavorites ? 'true' : 'false'"
          @update:model-value="handleSortFavoritesRadio"
        >
          <ToggleGroupItem value="false">{{ t("view.settings.appearance.appearance.sort_favorite_by_name") }}</ToggleGroupItem>
          <ToggleGroupItem value="true">{{ t("view.settings.appearance.appearance.sort_favorite_by_date") }}</ToggleGroupItem>
        </ToggleGroup>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.appearance.appearance.sort_instance_users_by')">
        <ToggleGroup
          type="single"
          required
          variant="outline"
          size="sm"
          :model-value="instanceUsersSortAlphabetical ? 'true' : 'false'"
          @update:model-value="handleInstanceUsersSortAlphabeticalRadio"
        >
          <ToggleGroupItem value="false">{{ t("view.settings.appearance.appearance.sort_instance_users_by_time") }}</ToggleGroupItem>
          <ToggleGroupItem value="true">{{ t("view.settings.appearance.appearance.sort_instance_users_by_alphabet") }}</ToggleGroupItem>
        </ToggleGroup>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.appearance.appearance.table_page_sizes')">
        <Button size="sm" variant="outline" :aria-label="t('view.settings.appearance.appearance.table_page_sizes')" @click="tablePageSizesDialogOpen = true">{{
          t("common.actions.configure")
        }}</Button>

        <Dialog v-model:open="tablePageSizesDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{{ t("view.settings.appearance.appearance.table_page_sizes") }}</DialogTitle>
            </DialogHeader>

            <Popover v-model:open="tablePageSizesOpen">
              <ListboxRoot v-model="tablePageSizesModel" highlight-on-hover multiple>
                <PopoverAnchor class="inline-flex w-full">
                  <TagsInput v-slot="{ modelValue: tags }" v-model="tablePageSizesModel" class="w-full">
                    <TagsInputItem v-for="item in tags" :key="item.toString()" :value="item.toString()">
                      <TagsInputItemText />
                      <TagsInputItemDelete />
                    </TagsInputItem>

                    <ListboxFilter v-model="tablePageSizesSearchTerm" as-child>
                      <TagsInputInput :placeholder="t('view.settings.appearance.appearance.table_page_sizes')" @keydown.down="tablePageSizesOpen = true" />
                    </ListboxFilter>

                    <PopoverTrigger as-child>
                      <Button size="icon-sm" variant="ghost" class="order-last ml-auto self-start">
                        <ChevronDown class="size-3.5" />
                      </Button>
                    </PopoverTrigger>
                  </TagsInput>
                </PopoverAnchor>

                <PopoverContent class="w-[var(--reka-popover-trigger-width)] p-1" @open-auto-focus.prevent>
                  <ListboxContent
                    class="max-h-75 scroll-py-1 overflow-x-hidden overflow-y-auto empty:after:block empty:after:content-['No_options'] empty:p-1"
                    tabindex="0"
                  >
                    <ListboxItem
                      v-for="size in filteredTablePageSizeOptions"
                      :key="size"
                      class="data-highlighted:bg-accent data-highlighted:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                      :value="size"
                      @select="tablePageSizesSearchTerm = ''"
                    >
                      <span>{{ size }}</span>

                      <ListboxItemIndicator class="ml-auto inline-flex items-center justify-center">
                        <CheckIcon />
                      </ListboxItemIndicator>
                    </ListboxItem>
                  </ListboxContent>
                </PopoverContent>
              </ListboxRoot>
            </Popover>

            <DialogFooter>
              <Button variant="outline" @click="tablePageSizesDialogOpen = false">{{ t("dialog.alertdialog.ok") }}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.appearance.table_entries_settings')"
        :description="t('view.settings.appearance.appearance.table_entries_settings_description')"
      >
        <Button size="sm" variant="outline" @click="showTableLimitsDialog">{{ t("common.actions.configure") }}</Button>
      </SettingsItem>
    </SettingsGroup>
    <TableLimitsDialog />

    <SettingsGroup :title="t('view.settings.appearance.timedate.header')">
      <SettingsItem :label="t('view.settings.appearance.timedate.time_format')">
        <ToggleGroup type="single" required variant="outline" size="sm" :model-value="dtHour12 ? 'true' : 'false'" @update:model-value="handleDtHour12Radio">
          <ToggleGroupItem value="true">{{ t("view.settings.appearance.timedate.time_format_12") }}</ToggleGroupItem>
          <ToggleGroupItem value="false">{{ t("view.settings.appearance.timedate.time_format_24") }}</ToggleGroupItem>
        </ToggleGroup>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.appearance.timedate.force_iso_date_format')" toggle>
        <Switch :model-value="dtIsoFormat" :aria-label="t('view.settings.appearance.timedate.force_iso_date_format')" @update:model-value="setDtIsoFormat" />
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.appearance.timedate.week_starts_on')"
        :description="t('view.settings.appearance.timedate.week_starts_on_description')"
      >
        <Select :model-value="String(weekStartsOn)" @update:model-value="handleWeekStartsOnChange">
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{{ t("common.days.monday") }}</SelectItem>
            <SelectItem value="0">{{ t("common.days.sunday") }}</SelectItem>
            <SelectItem value="6">{{ t("common.days.saturday") }}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.appearance.friend_log.header')">
      <SettingsItem :label="t('view.settings.appearance.friend_log.hide_unfriends')" toggle>
        <Switch :model-value="hideUnfriends" :aria-label="t('view.settings.appearance.friend_log.hide_unfriends')" @update:model-value="setHideUnfriends" />
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.appearance.user_colors.header')">
      <SettingsItem
        :label="t('view.settings.appearance.user_colors.random_colors_from_user_id')"
        :description="t('view.settings.appearance.user_colors.random_colors_from_user_id_description')"
        toggle
      >
        <Switch
          :model-value="randomUserColours"
          :aria-label="t('view.settings.appearance.user_colors.random_colors_from_user_id')"
          @update:model-value="updateTrustColor('', '', true)"
        />
      </SettingsItem>
      <div class="settings-item">
        <div class="flex flex-col gap-2 py-2">
          <div v-for="colorEntry in trustColorEntries" :key="colorEntry.key" class="flex items-center gap-3">
            <span :class="colorEntry.tagClass">{{ t(colorEntry.labelKey) }}</span>
            <ColorPickerButton :model-value="trustColor[colorEntry.key]" :presets="colorEntry.presets" @change="updateTrustColor(colorEntry.key, $event)" />
          </div>
        </div>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuCheckboxItem from "@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { ListboxContent, ListboxFilter, ListboxItem, ListboxItemIndicator, ListboxRoot, useFilter } from "reka-ui";
import NumberField from "@/components/ui/number-field/NumberField.vue";
import NumberFieldContent from "@/components/ui/number-field/NumberFieldContent.vue";
import NumberFieldDecrement from "@/components/ui/number-field/NumberFieldDecrement.vue";
import NumberFieldIncrement from "@/components/ui/number-field/NumberFieldIncrement.vue";
import NumberFieldInput from "@/components/ui/number-field/NumberFieldInput.vue";
import TagsInput from "@/components/ui/tags-input/TagsInput.vue";
import TagsInputInput from "@/components/ui/tags-input/TagsInputInput.vue";
import TagsInputItem from "@/components/ui/tags-input/TagsInputItem.vue";
import TagsInputItemDelete from "@/components/ui/tags-input/TagsInputItemDelete.vue";
import TagsInputItemText from "@/components/ui/tags-input/TagsInputItemText.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Input from "@/components/ui/input/Input.vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverAnchor from "@/components/ui/popover/PopoverAnchor.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";

import { computed, onBeforeUnmount, ref, watch } from "vue";
import { CheckIcon, ChevronDown } from "lucide-vue-next";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import { useVrStore } from "@/stores/vr";

import Switch from "@/components/ui/switch/Switch.vue";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import { getLanguageName } from "@/localization";
import { languageCodes } from "@/localization/locales";
import { APP_CJK_FONT_PACKS, APP_FONT_CONFIG, APP_FONT_DEFAULT_KEY, APP_FONT_FAMILIES } from "@/shared/constants/fonts";
import Button from "@/components/ui/button/Button.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import ColorPickerButton from "@/components/ColorPickerButton.vue";
import TableLimitsDialog from "@/components/dialogs/TableLimitsDialog.vue";
import { saveSortFavoritesOption } from "@/coordinators/favorite-coordinator";

import SettingsGroup from "../SettingsGroup.vue";
import SettingsItem from "../SettingsItem.vue";

const { t } = useI18n();

const appearanceSettingsStore = useAppearanceSettingsStore();
const { saveOpenVROption, updateVRConfigVars } = useVrStore();

const {
  appLanguage,
  displayVRCProfileThemes,
  displayVRCProfileBackgrounds,
  profileBackgroundOpacity,
  displayVRCProfileCosmetics,
  appFontFamily,
  customFontFamily,
  appCjkFontPack,
  hideNicknames,
  showInstanceIdInLocation,
  isAgeGatedInstancesVisible,
  isClosedInstancesVisible,
  sortFavorites,
  instanceUsersSortAlphabetical,
  dtHour12,
  dtIsoFormat,
  weekStartsOn,
  hideUserNotes,
  hideUserMemos,
  hideUnfriends,
  randomUserColours,
  trustColor,
  notificationIconDot,
  tablePageSizes,
  isDataTableStriped,
  accessibleStatusIndicators,
  showNewDashboardButton,
} = storeToRefs(appearanceSettingsStore);

const appLanguageDisplayName = computed(() => getLanguageName(String(appLanguage.value)));

const {
  setDisplayVRCProfileThemes,
  setDisplayVRCProfileBackgrounds,
  setProfileBackgroundOpacity,
  setDisplayVRCProfileCosmetics,
  setHideNicknames,
  setShowInstanceIdInLocation,
  setIsAgeGatedInstancesVisible,
  setIsClosedInstancesVisible,
  setInstanceUsersSortAlphabetical,
  setDtHour12,
  setDtIsoFormat,
  setWeekStartsOn,
  setHideUserNotes,
  setHideUserMemos,
  setHideUnfriends,
  updateTrustColor,
  changeAppLanguage,
  showTableLimitsDialog,
  setNotificationIconDot,
  setTablePageSizes,
  toggleStripedDataTable,
  toggleAccessibleStatusIndicators,
  setShowNewDashboardButton,
  setAppFontFamily,
  setCustomFontFamily,
  setAppCjkFontPack,
} = appearanceSettingsStore;

const trustColorEntries = [
  {
    key: "untrusted",
    tagClass: "x-tag-untrusted",
    labelKey: "view.settings.appearance.user_colors.trust_levels.visitor",
    presets: ["#CCCCCC"],
  },
  {
    key: "basic",
    tagClass: "x-tag-basic",
    labelKey: "view.settings.appearance.user_colors.trust_levels.new_user",
    presets: ["#1778ff"],
  },
  {
    key: "known",
    tagClass: "x-tag-known",
    labelKey: "view.settings.appearance.user_colors.trust_levels.user",
    presets: ["#2bcf5c"],
  },
  {
    key: "trusted",
    tagClass: "x-tag-trusted",
    labelKey: "view.settings.appearance.user_colors.trust_levels.known_user",
    presets: ["#ff7b42"],
  },
  {
    key: "veteran",
    tagClass: "x-tag-veteran",
    labelKey: "view.settings.appearance.user_colors.trust_levels.trusted_user",
    presets: ["#b18fff", "#8143e6", "#ff69b4", "#b52626", "#ffd000", "#abcdef"],
  },
  {
    key: "vip",
    tagClass: "x-tag-vip",
    labelKey: "view.settings.appearance.user_colors.trust_levels.vrchat_team",
    presets: ["#ff2626"],
  },
  {
    key: "troll",
    tagClass: "x-tag-troll",
    labelKey: "view.settings.appearance.user_colors.trust_levels.nuisance",
    presets: ["#782f2f"],
  },
];

const fontDropdownDisplayText = computed(() => {
  if (appFontFamily.value === "custom") {
    return t("view.settings.appearance.appearance.font_family_custom");
  }
  const western = t(`view.settings.appearance.appearance.font_family_${appFontFamily.value}`);
  const cjk =
    appCjkFontPack.value === "system"
      ? t("view.settings.appearance.appearance.font_family_system_ui")
      : t(`view.settings.appearance.appearance.cjk_font_pack_${appCjkFontPack.value}`);
  return `${western} / ${cjk}`;
});

const westernFontItems = computed(() => {
  return APP_FONT_FAMILIES.filter((key) => key !== "custom" && key !== "system_ui").map((key) => ({
    key,
    label: t(`view.settings.appearance.appearance.font_family_${key}`),
  }));
});

const cjkFontItems = computed(() => {
  return APP_CJK_FONT_PACKS.map((key) => ({
    key,
    label: key === "system" ? t("view.settings.appearance.appearance.font_family_system_ui") : t(`view.settings.appearance.appearance.cjk_font_pack_${key}`),
  }));
});

const FONT_FAMILY_REGEX = /^\s*(([-_\p{L}][\p{L}\p{N}_\s-]*)|'[^']+'|"[^"]+")\s*(,\s*(([-_\p{L}][\p{L}\p{N}_\s-]*)|'[^']+'|"[^"]+")\s*)*$/u;

const customFontDialogOpen = ref(false);
const customFontInput = ref("");

function handleSelectWesternFont(key) {
  setAppFontFamily(key);
}

function handleSelectCjkFont(key) {
  if (appFontFamily.value === "custom") {
    setAppFontFamily(APP_FONT_DEFAULT_KEY);
  }
  setAppCjkFontPack(key);
}

function handleSelectCustomFont() {
  const cssVarValue = getComputedStyle(document.documentElement).getPropertyValue("--font-western-primary").trim();
  const currentKey = String(appFontFamily.value || APP_FONT_DEFAULT_KEY)
    .trim()
    .toLowerCase();
  const fallbackFont = APP_FONT_CONFIG[currentKey]?.cssName || APP_FONT_CONFIG[APP_FONT_DEFAULT_KEY].cssName;
  customFontInput.value = customFontFamily.value?.trim() || cssVarValue || fallbackFont;
  customFontDialogOpen.value = true;
}

function saveCustomFont() {
  const trimmed = customFontInput.value.trim();
  if (!trimmed || !FONT_FAMILY_REGEX.test(trimmed)) {
    toast.error(t("view.settings.appearance.appearance.font_family_custom_invalid"));
    return;
  }
  setCustomFontFamily(trimmed);
  setAppFontFamily("custom");
  customFontDialogOpen.value = false;
}

const zoomLevel = ref(100);
const isLinux = computed(() => LINUX);
let cleanupWheel = null;

onBeforeUnmount(() => {
  if (cleanupWheel) {
    cleanupWheel();
  }
});

initGetZoomLevel();

function handleSortFavoritesRadio(value) {
  const nextValue = value === "true";
  if (nextValue !== sortFavorites.value) {
    saveSortFavoritesOption();
  }
}

function handleInstanceUsersSortAlphabeticalRadio(value) {
  const nextValue = value === "true";
  if (nextValue !== instanceUsersSortAlphabetical.value) {
    setInstanceUsersSortAlphabetical();
  }
}

function handleDtHour12Radio(value) {
  const nextValue = value === "true";
  if (nextValue !== dtHour12.value) {
    setDtHour12();
    updateVRConfigVars();
  }
}

function handleWeekStartsOnChange(value) {
  setWeekStartsOn(Number(value));
}

const tablePageSizesModel = computed({
  get: () => tablePageSizes.value.map(String),
  set: (values) => {
    const rawLength = Array.isArray(values) ? values.length : 0;
    setTablePageSizes(values);
    if (rawLength && rawLength !== tablePageSizes.value.length) {
      toast.error(t("view.settings.appearance.appearance.table_page_sizes_error"));
    }
  },
});

const TABLE_PAGE_SIZE_SUGGESTIONS = Object.freeze([5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 250, 500, 1000]);

const tablePageSizesDialogOpen = ref(false);
const tablePageSizesOpen = ref(false);
const tablePageSizesSearchTerm = ref("");

const { contains } = useFilter({ sensitivity: "base" });

const tablePageSizeOptions = computed(() => {
  const current = Array.isArray(tablePageSizes.value) ? tablePageSizes.value : [];
  const merged = new Set([...TABLE_PAGE_SIZE_SUGGESTIONS, ...current].map((v) => String(v)));
  return Array.from(merged).sort((a, b) => Number(a) - Number(b));
});

const filteredTablePageSizeOptions = computed(() => {
  if (tablePageSizesSearchTerm.value === "") {
    return tablePageSizeOptions.value;
  }
  return tablePageSizeOptions.value.filter((option) => contains(option, tablePageSizesSearchTerm.value));
});

watch(tablePageSizesSearchTerm, (value) => {
  if (value) {
    tablePageSizesOpen.value = true;
  }
});

async function initGetZoomLevel() {
  const handleWheel = (event) => {
    if (event.ctrlKey) {
      getZoomLevel();
    }
  };
  window.addEventListener("wheel", handleWheel);
  cleanupWheel = () => {
    window.removeEventListener("wheel", handleWheel);
  };
  getZoomLevel();
}

async function getZoomLevel() {
  zoomLevel.value = ((await AppApi.GetZoom()) + 10) * 10;
}

function setZoomLevel() {
  AppApi.SetZoom(zoomLevel.value / 10 - 10);
}
</script>
