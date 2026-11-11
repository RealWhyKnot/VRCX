<template>
  <FieldGroup class="gap-4">
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.access_type") }}</FieldLabel>
      <FieldContent>
        <ToggleGroup
          type="single"
          required
          variant="outline"
          size="sm"
          :model-value="newInstanceDialog.accessType"
          @update:model-value="
            (value) => {
              newInstanceDialog.accessType = String(value);
              buildInstance();
            }
          "
        >
          <ToggleGroupItem value="public">{{ t("dialog.new_instance.access_type_public") }}</ToggleGroupItem>
          <ToggleGroupItem value="group">{{ t("dialog.new_instance.access_type_group") }}</ToggleGroupItem>
          <ToggleGroupItem value="friends+">{{ t("dialog.new_instance.access_type_friend_plus") }}</ToggleGroupItem>
          <ToggleGroupItem value="friends">{{ t("dialog.new_instance.access_type_friend") }}</ToggleGroupItem>
          <ToggleGroupItem value="invite+">{{ t("dialog.new_instance.access_type_invite_plus") }}</ToggleGroupItem>
          <ToggleGroupItem value="invite">{{ t("dialog.new_instance.access_type_invite") }}</ToggleGroupItem>
        </ToggleGroup>
      </FieldContent>
    </Field>
    <Field v-if="newInstanceDialog.accessType === 'group'">
      <FieldLabel>{{ t("dialog.new_instance.group_access_type") }}</FieldLabel>
      <FieldContent>
        <ToggleGroup
          type="single"
          required
          variant="outline"
          size="sm"
          :model-value="newInstanceDialog.groupAccessType"
          @update:model-value="
            (value) => {
              newInstanceDialog.groupAccessType = String(value);
              buildInstance();
            }
          "
        >
          <ToggleGroupItem value="members" :disabled="!hasGroupPermission(newInstanceDialog.groupRef, 'group-instance-open-create')">{{
            t("dialog.new_instance.group_access_type_members")
          }}</ToggleGroupItem>
          <ToggleGroupItem value="plus" :disabled="!hasGroupPermission(newInstanceDialog.groupRef, 'group-instance-plus-create')">{{
            t("dialog.new_instance.group_access_type_plus")
          }}</ToggleGroupItem>
          <ToggleGroupItem
            value="public"
            :disabled="!hasGroupPermission(newInstanceDialog.groupRef, 'group-instance-public-create') || newInstanceDialog.groupRef.privacy === 'private'"
            >{{ t("dialog.new_instance.group_access_type_public") }}</ToggleGroupItem
          >
        </ToggleGroup>
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.region") }}</FieldLabel>
      <FieldContent>
        <ToggleGroup
          type="single"
          required
          variant="outline"
          size="sm"
          :model-value="newInstanceDialog.region"
          @update:model-value="
            (value) => {
              newInstanceDialog.region = String(value);
              buildInstance();
            }
          "
        >
          <ToggleGroupItem value="US West">{{ t("dialog.new_instance.region_usw") }}</ToggleGroupItem>
          <ToggleGroupItem value="US East">{{ t("dialog.new_instance.region_use") }}</ToggleGroupItem>
          <ToggleGroupItem value="Europe">{{ t("dialog.new_instance.region_eu") }}</ToggleGroupItem>
          <ToggleGroupItem value="Japan">{{ t("dialog.new_instance.region_jp") }}</ToggleGroupItem>
        </ToggleGroup>
      </FieldContent>
    </Field>
    <Field v-if="newInstanceDialog.accessType === 'group'">
      <FieldLabel>{{ t("dialog.new_instance.queueEnabled") }}</FieldLabel>
      <FieldContent>
        <Checkbox v-model="newInstanceDialog.queueEnabled" @update:model-value="buildInstance" />
      </FieldContent>
    </Field>
    <Field v-if="canAgeGate">
      <FieldLabel>{{ t("dialog.new_instance.ageGate") }}</FieldLabel>
      <FieldContent>
        <Checkbox v-model="newInstanceDialog.ageGate" @update:model-value="buildInstance" />
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.display_name") }}</FieldLabel>
      <FieldContent>
        <InputGroupField v-model="newInstanceDialog.displayName" size="sm" :maxlength="128" show-count @click="selectInputText" @change="buildInstance" />
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.description") }}</FieldLabel>
      <FieldContent>
        <InputGroupTextareaField v-model="newInstanceDialog.description" :rows="3" :maxlength="256" show-count @change="buildInstance" />
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.category") }}</FieldLabel>
      <FieldContent>
        <Select :model-value="newInstanceDialog.categoryId || 'none'" @update:model-value="handleCategoryIdChange">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue>
              <span class="truncate">
                {{ selectedCategoryName || t("dialog.new_instance.none") }}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">{{ t("dialog.new_instance.none") }}</SelectItem>
              <SelectItem v-for="category in instanceCategories" :key="category.id" :value="category.id">
                <i v-if="categoryIconClass(category.iconUrl)" :class="categoryIconClass(category.iconUrl)" />
                {{ category.name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.vibes") }}</FieldLabel>
      <FieldContent>
        <Select multiple :model-value="newInstanceDialog.vibeIds" @update:model-value="handleVibeIdsChange">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue>
              <span class="truncate">
                {{ selectedVibeSummary || t("dialog.new_instance.none") }}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="vibe in instanceVibes" :key="vibe.id" :value="vibe.id">
                {{ vibe.title }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.languages") }}</FieldLabel>
      <FieldContent>
        <Select multiple :model-value="newInstanceDialog.languages" @update:model-value="handleLanguagesChange">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue>
              <span class="truncate">
                {{ selectedLanguageSummary || t("dialog.group_edit.no_language") }}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="language in languageOptions" :key="language.value" :value="language.value">
                {{ language.label }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.minimum_avatar_performance") }}</FieldLabel>
      <FieldContent>
        <Select v-model="newInstanceDialog.minimumAvatarPerformance" @change="buildInstance">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue>
              <span>
                {{ newInstanceDialog.minimumAvatarPerformance || t("dialog.avatar.tags.performanceRating.None") }}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="None">{{ t("dialog.avatar.tags.performanceRating.None") }}</SelectItem>
              <SelectItem value="Poor">{{ t("dialog.avatar.tags.performanceRating.Poor") }}</SelectItem>
              <SelectItem value="Medium">{{ t("dialog.avatar.tags.performanceRating.Medium") }}</SelectItem>
              <SelectItem value="Good">{{ t("dialog.avatar.tags.performanceRating.Good") }}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
    <Field v-if="newInstanceDialog.accessType === 'group'">
      <FieldLabel>{{ t("dialog.new_instance.group_id") }}</FieldLabel>
      <FieldContent>
        <VirtualCombobox
          v-model="newInstanceDialog.groupId"
          :groups="normalGroupPickerGroups"
          :placeholder="t('dialog.new_instance.group_placeholder')"
          :search-placeholder="t('dialog.new_instance.group_placeholder')"
          :clearable="true"
          :close-on-select="true"
          :deselect-on-reselect="true"
          @change="buildInstance"
        >
          <template #item="{ item, selected }">
            <div class="flex w-full items-center p-1.5 text-[13px]">
              <div class="relative inline-block flex-none size-9 mr-2.5">
                <img class="size-full rounded-full object-cover" :src="groupIconUrl(item)" loading="lazy" />
              </div>
              <div class="flex-1 overflow-hidden">
                <span class="block truncate font-medium leading-[18px]" v-text="item.label"></span>
              </div>
              <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
            </div>
          </template>
        </VirtualCombobox>
      </FieldContent>
    </Field>
    <Field v-if="newInstanceDialog.accessType === 'group' && newInstanceDialog.groupAccessType === 'members'" class="items-start">
      <FieldLabel>{{ t("dialog.new_instance.roles") }}</FieldLabel>
      <FieldContent>
        <Select multiple :model-value="Array.isArray(newInstanceDialog.roleIds) ? newInstanceDialog.roleIds : []" @update:model-value="handleRoleIdsChange">
          <SelectTrigger size="sm" class="w-full">
            <SelectValue>
              <span class="truncate">
                {{ selectedRoleSummary || t("dialog.new_instance.role_placeholder") }}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem v-for="role in newInstanceDialog.selectedGroupRoles" :key="role.id ?? ''" :value="role.id ?? ''">
                {{ role.name }}
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </FieldContent>
    </Field>
    <template v-if="newInstanceDialog.instanceCreated">
      <Field>
        <FieldLabel>{{ t("dialog.new_instance.location") }}</FieldLabel>
        <FieldContent>
          <InputGroupField v-model="newInstanceDialog.location" size="sm" readonly @click="selectInputText" />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>{{ t("dialog.new_instance.url") }}</FieldLabel>
        <FieldContent>
          <InputGroupField v-model="newInstanceDialog.url" size="sm" readonly />
        </FieldContent>
      </Field>
    </template>
  </FieldGroup>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { Check as CheckIcon } from "lucide-vue-next";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Select from "../../ui/select/Select.vue";
import SelectContent from "../../ui/select/SelectContent.vue";
import SelectGroup from "../../ui/select/SelectGroup.vue";
import SelectItem from "../../ui/select/SelectItem.vue";
import SelectTrigger from "../../ui/select/SelectTrigger.vue";
import SelectValue from "../../ui/select/SelectValue.vue";
import ToggleGroup from "../../ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "../../ui/toggle-group/ToggleGroupItem.vue";
import VirtualCombobox from "../../ui/virtual-combobox/VirtualCombobox.vue";
import { hasGroupPermission } from "../../../shared/utils/group";
import { useInstanceStore } from "../../../stores/instance";
import { useUserStore } from "../../../stores/user";
import { categoryIconClass, selectInputText } from "./new-instance-field-display";
import { useNewInstanceGroupPickers } from "./use-new-instance-group-pickers";
import type { NewInstanceDialogState } from "./use-new-instance-builder";

const newInstanceDialog = defineModel<NewInstanceDialogState>({ required: true });

defineProps<{
  buildInstance: () => void;
  handleCategoryIdChange: (value: unknown) => void;
  handleVibeIdsChange: (value: unknown) => void;
  handleLanguagesChange: (value: unknown) => void;
  handleRoleIdsChange: (value: unknown) => void;
}>();

const { t } = useI18n();
const { currentUser, subsetOfLanguages } = storeToRefs(useUserStore());
const { instanceCategories, instanceVibes } = storeToRefs(useInstanceStore());
const { normalGroupPickerGroups, groupIconUrl } = useNewInstanceGroupPickers({ t });

const canAgeGate = computed(() => {
  if (newInstanceDialog.value.accessType === "group") {
    return hasGroupPermission(newInstanceDialog.value.groupRef, "group-instance-age-gated-create");
  }
  return currentUser.value.ageVerificationStatus === "18+";
});

const languageOptions = computed(() =>
  Object.entries(subsetOfLanguages.value).map(([value, label]) => ({
    value,
    label,
  }))
);

const selectedLanguageSummary = computed(() => newInstanceDialog.value.languages.map((language) => subsetOfLanguages.value[language] ?? language).join(", "));

const selectedCategoryName = computed(() => instanceCategories.value.find((category) => category.id === newInstanceDialog.value.categoryId)?.name);

const selectedVibeSummary = computed(() => {
  const vibeById = new Map(instanceVibes.value.map((vibe) => [vibe.id, vibe.title]));
  return newInstanceDialog.value.vibeIds.map((id) => vibeById.get(id) ?? id).join(", ");
});

const selectedRoleSummary = computed(() => {
  const roleIds = newInstanceDialog.value.roleIds;
  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return "";
  }
  const roleById = new Map(newInstanceDialog.value.selectedGroupRoles.map((r) => [r.id, r.name]));
  const names = roleIds.map((id) => roleById.get(id) ?? id);
  return names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
});
</script>
