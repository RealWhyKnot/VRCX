<template>
  <div class="flex flex-col gap-10 py-2">
    <SettingsGroup :title="t('view.settings.vr.vr_core.header')">
      <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.steamvr_overlay')" toggle>
        <Switch
          :model-value="openVR"
          :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.steamvr_overlay')"
          @update:model-value="
            setOpenVR();
            saveOpenVROption();
          "
        />
      </SettingsItem>

      <SettingsItem :label="t('view.settings.wrist_overlay.steamvr_wrist_overlay.start_overlay_with')">
        <Select
          :model-value="openVRAlways ? 'true' : 'false'"
          :disabled="!openVR"
          :aria-label="t('view.settings.wrist_overlay.steamvr_wrist_overlay.start_overlay_with')"
          @update:model-value="handleOpenVRAlwaysRadio"
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">{{ "VRChat" }}</SelectItem>
            <SelectItem value="true">{{ "SteamVR" }}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>

      <template v-if="!isLinux">
        <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.xsoverlay_notifications')" toggle>
          <Switch
            :model-value="xsNotifications"
            :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.xsoverlay_notifications')"
            @update:model-value="
              setXsNotifications();
              saveOpenVROption();
            "
          />
        </SettingsItem>
      </template>
      <template v-else>
        <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.wayvr_notifications')" toggle>
          <Switch
            :model-value="xsNotifications"
            :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.wayvr_notifications')"
            @update:model-value="
              setXsNotifications();
              saveOpenVROption();
            "
          />
        </SettingsItem>
      </template>

      <template v-if="!isLinux">
        <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.ovrtoolkit_hud_notifications')" toggle>
          <Switch
            :model-value="ovrtHudNotifications"
            :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.ovrtoolkit_hud_notifications')"
            @update:model-value="
              setOvrtHudNotifications();
              saveOpenVROption();
            "
          />
        </SettingsItem>

        <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.ovrtoolkit_wrist_notifications')" toggle>
          <Switch
            :model-value="ovrtWristNotifications"
            :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.ovrtoolkit_wrist_notifications')"
            @update:model-value="
              setOvrtWristNotifications();
              saveOpenVROption();
            "
          />
        </SettingsItem>
      </template>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.vr.vr_notifications.header')">
      <SettingsItem :label="t('view.settings.notifications.notifications.desktop_notifications.when_to_display_vr')">
        <Select
          :model-value="overlayToast"
          :disabled="(!overlayNotifications || !openVR) && !xsNotifications && !ovrtHudNotifications && !ovrtWristNotifications"
          @update:model-value="handleOverlayToastChange"
        >
          <SelectTrigger size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Never">{{ t("view.settings.notifications.notifications.conditions.never") }}</SelectItem>
            <SelectItem value="Game Running">{{ t("view.settings.notifications.notifications.conditions.inside_vrchat") }}</SelectItem>
            <SelectItem value="Game Closed">{{ t("view.settings.notifications.notifications.conditions.outside_vrchat") }}</SelectItem>
            <SelectItem value="Always">{{ t("view.settings.notifications.notifications.conditions.always") }}</SelectItem>
          </SelectContent>
        </Select>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.overlay_notifications')" toggle>
        <Switch
          :model-value="overlayNotifications"
          :disabled="!openVR"
          :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.overlay_notifications')"
          @update:model-value="
            setOverlayNotifications();
            saveOpenVROption();
          "
        />
      </SettingsItem>

      <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.notification_position')">
        <Button size="sm" variant="outline" :disabled="!overlayNotifications || !openVR" @click="showNotificationPositionDialog">{{
          t("view.settings.notifications.notifications.steamvr_notifications.notification_position")
        }}</Button>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.notification_opacity')">
        <div class="w-75 max-w-full pt-1">
          <Slider v-model="notificationOpacityValue" :min="0" :max="100" />
        </div>
      </SettingsItem>

      <SettingsItem :label="t('view.settings.notifications.notifications.steamvr_notifications.notification_timeout')">
        <NumberField
          :model-value="notificationTimeoutSeconds"
          :min="0"
          :step="1"
          :format-options="{ maximumFractionDigits: 0 }"
          :disabled="(!overlayNotifications || !openVR) && !xsNotifications"
          class="w-32"
          @update:model-value="handleNotificationTimeoutChange"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </SettingsItem>

      <SettingsItem
        :label="t('view.settings.notifications.notifications.steamvr_notifications.user_images')"
        :description="t('view.settings.notifications.notifications.steamvr_notifications.user_images_description')"
        toggle
      >
        <Switch
          :model-value="imageNotifications"
          :aria-label="t('view.settings.notifications.notifications.steamvr_notifications.user_images')"
          @update:model-value="
            setImageNotifications();
            saveOpenVROption();
          "
        />
      </SettingsItem>
    </SettingsGroup>

    <WristOverlaySettings @open-feed-filters="showWristFeedFiltersDialog" />

    <SettingsGroup :title="t('view.settings.vr.vr_extras.header')">
      <SettingsItem
        :label="t('view.settings.advanced.advanced.video_progress_pie.header')"
        :description="t('view.settings.advanced.advanced.video_progress_pie.enable_tooltip')"
        toggle
      >
        <Switch
          :model-value="progressPie"
          :disabled="!openVR"
          :aria-label="t('view.settings.advanced.advanced.video_progress_pie.header')"
          @update:model-value="changeYouTubeApi('VRCX_progressPie')"
        />
      </SettingsItem>

      <SettingsItem :label="t('view.settings.advanced.advanced.video_progress_pie.dance_world_only')" toggle>
        <Switch
          :model-value="progressPieFilter"
          :disabled="!openVR"
          :aria-label="t('view.settings.advanced.advanced.video_progress_pie.dance_world_only')"
          @update:model-value="changeYouTubeApi('VRCX_progressPieFilter')"
        />
      </SettingsItem>
    </SettingsGroup>

    <NotificationPositionDialog v-model:is-notification-position-dialog-visible="isNotificationPositionDialogVisible" />
    <FeedFiltersDialog v-model:feed-filters-dialog-mode="feedFiltersDialogMode" />
  </div>
</template>

<script setup lang="ts">
import { isLinuxHost } from "@/shared/constants/platform";
import { computed, ref } from "vue";
import NumberField from "@/components/ui/number-field/NumberField.vue";
import NumberFieldContent from "@/components/ui/number-field/NumberFieldContent.vue";
import NumberFieldDecrement from "@/components/ui/number-field/NumberFieldDecrement.vue";
import NumberFieldIncrement from "@/components/ui/number-field/NumberFieldIncrement.vue";
import NumberFieldInput from "@/components/ui/number-field/NumberFieldInput.vue";
import Button from "@/components/ui/button/Button.vue";
import Switch from "@/components/ui/switch/Switch.vue";
import Slider from "@/components/ui/slider/Slider.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAdvancedSettingsStore } from "@/stores/settings/advanced";
import { useNotificationsSettingsStore } from "@/stores/settings/notifications";
import { useVrStore } from "@/stores/vr";
import { useWristOverlaySettingsStore } from "@/stores/settings/wrist-overlay";

import FeedFiltersDialog from "../../dialogs/FeedFiltersDialog.vue";
import NotificationPositionDialog from "../../dialogs/NotificationPositionDialog.vue";
import { logError } from "@/stores/notification/errors";
import WristOverlaySettings from "../WristOverlaySettings.vue";
import SettingsGroup from "../SettingsGroup.vue";
import SettingsItem from "../SettingsItem.vue";

const { t } = useI18n();

const notificationsSettingsStore = useNotificationsSettingsStore();
const advancedSettingsStore = useAdvancedSettingsStore();
const wristOverlaySettingsStore = useWristOverlaySettingsStore();
const { saveOpenVROption } = useVrStore();
const { updateVRLastLocation, updateOpenVR } = useVrStore();

const { overlayToast, openVR, overlayNotifications, xsNotifications, ovrtHudNotifications, ovrtWristNotifications, imageNotifications, notificationTimeout } =
  storeToRefs(notificationsSettingsStore);

const { notificationOpacity } = storeToRefs(advancedSettingsStore);

const { openVRAlways } = storeToRefs(wristOverlaySettingsStore);
const { setOpenVRAlways } = wristOverlaySettingsStore;

const { progressPie, progressPieFilter } = storeToRefs(advancedSettingsStore);

const {
  setOverlayToast,
  setOpenVR,
  setOverlayNotifications,
  setXsNotifications,
  setOvrtHudNotifications,
  setOvrtWristNotifications,
  setImageNotifications,
  setNotificationTimeout,
} = notificationsSettingsStore;

const notificationTimeoutSeconds = computed(() => notificationTimeout.value / 1000);

const { setNotificationOpacity } = advancedSettingsStore;

const isNotificationPositionDialogVisible = ref(false);
const feedFiltersDialogMode = ref("");
const isLinux = computed(() => isLinuxHost());

const notificationOpacityValue = computed({
  get: () => [notificationOpacity.value],
  set: (value) => {
    const next = value[0];
    if (typeof next === "number") {
      void setNotificationOpacity(next).catch(logError);
    }
  },
});

function showNotificationPositionDialog() {
  isNotificationPositionDialogVisible.value = true;
}

function showWristFeedFiltersDialog() {
  feedFiltersDialogMode.value = "wrist";
}

function handleOpenVRAlwaysRadio(value: unknown) {
  const isEnabled = value === "true";
  if (isEnabled !== openVRAlways.value) {
    setOpenVRAlways();
    saveOpenVROption();
  }
}

function handleOverlayToastChange(value: unknown) {
  if (typeof value === "string") {
    setOverlayToast(value);
  }
  saveOpenVROption();
}

function handleNotificationTimeoutChange(value: unknown) {
  if (typeof value === "number") {
    setNotificationTimeout(value);
  }
}

function changeYouTubeApi(configKey = "") {
  if (configKey === "VRCX_progressPie") {
    void advancedSettingsStore.setProgressPie().catch(logError);
  } else if (configKey === "VRCX_progressPieFilter") {
    void advancedSettingsStore.setProgressPieFilter().catch(logError);
  }
  updateVRLastLocation();
  updateOpenVR();
}
</script>
