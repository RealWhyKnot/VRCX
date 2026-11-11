<template>
  <div class="flex flex-col gap-10 py-2">
    <SettingsGroup :title="t('view.settings.appearance.appearance.header')">
      <SettingsItem :label="t('view.settings.appearance.appearance.language')">
        <Select :model-value="appLanguage" @update:model-value="handleAppLanguageChange">
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

      <InterfaceFontFamilySetting />

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
            @update:model-value="handleProfileBackgroundOpacityChange"
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

      <InterfaceTablePageSizesSetting />

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
            <ColorPickerButton
              :model-value="trustColor[colorEntry.key] ?? ''"
              :presets="colorEntry.presets"
              @change="updateTrustColor(colorEntry.key, $event)"
            />
          </div>
        </div>
      </div>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import { isLinuxHost } from "@/shared/constants/platform";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import NumberField from "@/components/ui/number-field/NumberField.vue";
import NumberFieldContent from "@/components/ui/number-field/NumberFieldContent.vue";
import NumberFieldDecrement from "@/components/ui/number-field/NumberFieldDecrement.vue";
import NumberFieldIncrement from "@/components/ui/number-field/NumberFieldIncrement.vue";
import NumberFieldInput from "@/components/ui/number-field/NumberFieldInput.vue";

import { computed, onBeforeUnmount, ref } from "vue";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import { useVrStore } from "@/stores/vr";
import { logError } from "@/stores/notification/errors";

import Switch from "@/components/ui/switch/Switch.vue";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import { getLanguageName } from "@/localization";
import { languageCodes } from "@/localization/locales";
import Button from "@/components/ui/button/Button.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import ColorPickerButton from "@/components/ColorPickerButton.vue";
import TableLimitsDialog from "@/components/dialogs/TableLimitsDialog.vue";
import { saveSortFavoritesOption } from "@/coordinators/favorite-coordinator";

import SettingsGroup from "../SettingsGroup.vue";
import SettingsItem from "../SettingsItem.vue";
import InterfaceFontFamilySetting from "./InterfaceFontFamilySetting.vue";
import InterfaceTablePageSizesSetting from "./InterfaceTablePageSizesSetting.vue";

const { t } = useI18n();

const appearanceSettingsStore = useAppearanceSettingsStore();
const { saveOpenVROption, updateVRConfigVars } = useVrStore();

const {
  appLanguage,
  displayVRCProfileThemes,
  displayVRCProfileBackgrounds,
  profileBackgroundOpacity,
  displayVRCProfileCosmetics,
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
  isDataTableStriped,
  accessibleStatusIndicators,
  showNewDashboardButton,
} = storeToRefs(appearanceSettingsStore);

const appLanguageDisplayName = computed(() => getLanguageName(appLanguage.value));

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
  toggleStripedDataTable,
  toggleAccessibleStatusIndicators,
  setShowNewDashboardButton,
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

const zoomLevel = ref(100);
const isLinux = computed(() => isLinuxHost());
let cleanupWheel: (() => void) | null = null;

onBeforeUnmount(() => {
  if (cleanupWheel) {
    cleanupWheel();
  }
});

void initGetZoomLevel().catch(logError);

function handleSortFavoritesRadio(value: unknown) {
  const isEnabled = value === "true";
  if (isEnabled !== sortFavorites.value) {
    saveSortFavoritesOption();
  }
}

function handleInstanceUsersSortAlphabeticalRadio(value: unknown) {
  const isEnabled = value === "true";
  if (isEnabled !== instanceUsersSortAlphabetical.value) {
    setInstanceUsersSortAlphabetical();
  }
}

function handleDtHour12Radio(value: unknown) {
  const isEnabled = value === "true";
  if (isEnabled !== dtHour12.value) {
    setDtHour12();
    updateVRConfigVars();
  }
}

function handleWeekStartsOnChange(value: unknown) {
  setWeekStartsOn(Number(value));
}

async function initGetZoomLevel() {
  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey) {
      void getZoomLevel().catch(logError);
    }
  };
  window.addEventListener("wheel", handleWheel);
  cleanupWheel = () => {
    window.removeEventListener("wheel", handleWheel);
  };
  await getZoomLevel();
}

async function getZoomLevel() {
  zoomLevel.value = ((await window.AppApi.GetZoom()) + 10) * 10;
}

function setZoomLevel() {
  void window.AppApi.SetZoom(zoomLevel.value / 10 - 10).catch(logError);
}

function handleAppLanguageChange(value: unknown) {
  if (typeof value === "string") {
    void changeAppLanguage(value).catch(logError);
  }
}

function handleProfileBackgroundOpacityChange(value: unknown) {
  if (typeof value === "number") {
    setProfileBackgroundOpacity(value);
  }
}
</script>
