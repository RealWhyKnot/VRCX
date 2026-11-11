<template>
  <div class="flex flex-col gap-10 py-2">
    <SettingsGroup :title="t('view.settings.social.interaction.header')">
      <SettingsItem
        :label="t('view.settings.appearance.user_dialog.recent_action_cooldown')"
        :description="t('view.settings.appearance.user_dialog.recent_action_cooldown_description')"
        toggle
      >
        <Switch
          :model-value="recentActionCooldownEnabled"
          :aria-label="t('view.settings.appearance.user_dialog.recent_action_cooldown')"
          @update:model-value="setRecentActionCooldownEnabled"
        />
      </SettingsItem>

      <SettingsItem v-if="recentActionCooldownEnabled" :label="t('view.settings.appearance.user_dialog.recent_action_cooldown_minutes')">
        <NumberField
          :model-value="recentActionCooldownMinutes"
          :min="1"
          :max="1440"
          :step="1"
          :format-options="{ maximumFractionDigits: 0 }"
          class="w-32"
          @update:model-value="setRecentActionCooldownMinutes"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.social.friend_requests.header')">
      <SettingsItem :label="t('view.settings.general.friend_requests.header')" :description="t('view.settings.general.friend_requests.header_tooltip')" toggle>
        <Switch
          :model-value="autoDeclineFriendRequests"
          :aria-label="t('view.settings.general.friend_requests.header')"
          @update:model-value="setAutoDeclineFriendRequests"
        />
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup :title="t('view.settings.social.favorites.header')">
      <SettingsItem :label="t('view.settings.general.favorites.header')" :description="t('view.settings.general.favorites.header_tooltip')">
        <Select :model-value="localFavoriteFriendsGroups" multiple @update:model-value="setLocalFavoriteFriendsGroups">
          <SelectTrigger class="w-48">
            <SelectValue :placeholder="t('view.settings.general.favorites.group_placeholder')" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="group in favoriteFriendGroups" :key="group.key" :value="group.key">
                {{ group.displayName }}
              </SelectItem>
            </SelectGroup>
            <template v-if="localFriendFavoriteGroups.length">
              <SelectSeparator />
              <SelectGroup>
                <SelectItem v-for="group in localFriendFavoriteGroups" :key="'local:' + group" :value="'local:' + group">
                  {{ group }}
                </SelectItem>
              </SelectGroup>
            </template>
          </SelectContent>
        </Select>
      </SettingsItem>
    </SettingsGroup>
  </div>
</template>

<script setup lang="ts">
import Switch from "@/components/ui/switch/Switch.vue";

import NumberField from "@/components/ui/number-field/NumberField.vue";
import NumberFieldContent from "@/components/ui/number-field/NumberFieldContent.vue";
import NumberFieldDecrement from "@/components/ui/number-field/NumberFieldDecrement.vue";
import NumberFieldIncrement from "@/components/ui/number-field/NumberFieldIncrement.vue";
import NumberFieldInput from "@/components/ui/number-field/NumberFieldInput.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectSeparator from "@/components/ui/select/SelectSeparator.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useFavoriteStore } from "@/stores/favorite";
import { useGeneralSettingsStore } from "@/stores/settings/general";

import SettingsGroup from "../SettingsGroup.vue";
import SettingsItem from "../SettingsItem.vue";

const { t } = useI18n();

const generalSettingsStore = useGeneralSettingsStore();
const favoriteStore = useFavoriteStore();

const { recentActionCooldownEnabled, recentActionCooldownMinutes, localFavoriteFriendsGroups, autoDeclineFriendRequests } = storeToRefs(generalSettingsStore);

const { setRecentActionCooldownEnabled, setRecentActionCooldownMinutes, setLocalFavoriteFriendsGroups, setAutoDeclineFriendRequests } = generalSettingsStore;

const { favoriteFriendGroups, localFriendFavoriteGroups } = storeToRefs(favoriteStore);
</script>
