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
              buildLegacyInstance();
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
              buildLegacyInstance();
            }
          "
        >
          <ToggleGroupItem value="members">{{ t("dialog.new_instance.group_access_type_members") }}</ToggleGroupItem>
          <ToggleGroupItem value="plus">{{ t("dialog.new_instance.group_access_type_plus") }}</ToggleGroupItem>
          <ToggleGroupItem value="public">{{ t("dialog.new_instance.group_access_type_public") }}</ToggleGroupItem>
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
              buildLegacyInstance();
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
      <FieldLabel>{{ t("dialog.new_instance.ageGate") }}</FieldLabel>
      <FieldContent>
        <Checkbox v-model="newInstanceDialog.ageGate" @update:model-value="buildInstance" />
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.world_id") }}</FieldLabel>
      <FieldContent>
        <InputGroupField v-model="newInstanceDialog.worldId" size="sm" @click="selectInputText" @change="buildLegacyInstance" />
      </FieldContent>
    </Field>
    <Field>
      <FieldLabel>{{ t("dialog.new_instance.instance_id") }}</FieldLabel>
      <FieldContent>
        <InputGroupField
          v-model="newInstanceDialog.instanceName"
          :placeholder="t('dialog.new_instance.instance_id_placeholder')"
          size="sm"
          @change="buildLegacyInstance"
        />
      </FieldContent>
    </Field>
    <Field
      v-if="newInstanceDialog.selectedTab === 'Legacy' && newInstanceDialog.accessType !== 'public' && newInstanceDialog.accessType !== 'group'"
      class="items-start"
    >
      <FieldLabel>{{ t("dialog.new_instance.instance_creator") }}</FieldLabel>
      <FieldContent>
        <VirtualCombobox
          v-model="newInstanceDialog.legacyUserId"
          :groups="creatorPickerGroups"
          :placeholder="t('dialog.new_instance.instance_creator_placeholder')"
          :search-placeholder="t('dialog.new_instance.instance_creator_placeholder')"
          :clearable="true"
          :close-on-select="true"
          :deselect-on-reselect="true"
          @change="buildLegacyInstance"
        >
          <template #item="{ item, selected }">
            <div class="flex w-full items-center p-1.5 text-[13px]">
              <template v-if="creatorUser(item)">
                <div class="relative inline-block flex-none size-9 mr-2.5" :class="userStatusClass(creatorUser(item))">
                  <img class="size-full rounded-full object-cover" :src="userImage(creatorUser(item))" loading="lazy" />
                </div>
                <div class="flex-1 overflow-hidden">
                  <span
                    class="block truncate font-medium leading-[18px] text-[color:var(--user-colour)]"
                    :style="{ '--user-colour': creatorUser(item)?.$userColour }"
                    v-text="creatorUser(item)?.displayName"
                  ></span>
                </div>
              </template>
              <template v-else>
                <span v-text="item.label"></span>
              </template>

              <CheckIcon :class="['ml-auto size-4', selected ? 'opacity-100' : 'opacity-0']" />
            </div>
          </template>
        </VirtualCombobox>
      </FieldContent>
    </Field>
    <Field v-if="newInstanceDialog.accessType === 'group'">
      <FieldLabel>{{ t("dialog.new_instance.group_id") }}</FieldLabel>
      <FieldContent>
        <VirtualCombobox
          v-model="newInstanceDialog.groupId"
          :groups="legacyGroupPickerGroups"
          :placeholder="t('dialog.new_instance.group_placeholder')"
          :search-placeholder="t('dialog.new_instance.group_placeholder')"
          :clearable="true"
          :close-on-select="true"
          :deselect-on-reselect="true"
          @change="buildLegacyInstance"
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
  </FieldGroup>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Check as CheckIcon } from "lucide-vue-next";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import ToggleGroup from "../../ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "../../ui/toggle-group/ToggleGroupItem.vue";
import VirtualCombobox from "../../ui/virtual-combobox/VirtualCombobox.vue";
import { useUserDisplay } from "../../../composables/use-user-display";
import { selectInputText } from "./new-instance-field-display";
import { useNewInstanceCreatorPickers } from "./use-new-instance-creator-pickers";
import { useNewInstanceGroupPickers } from "./use-new-instance-group-pickers";
import type { NewInstanceDialogState } from "./use-new-instance-builder";

const newInstanceDialog = defineModel<NewInstanceDialogState>({ required: true });

defineProps<{
  buildInstance: () => void;
  buildLegacyInstance: () => void;
}>();

const { t } = useI18n();
const { userImage, userStatusClass } = useUserDisplay();
const { legacyGroupPickerGroups, groupIconUrl } = useNewInstanceGroupPickers({ t });
const { creatorUser, creatorPickerGroups } = useNewInstanceCreatorPickers({ t });
</script>
