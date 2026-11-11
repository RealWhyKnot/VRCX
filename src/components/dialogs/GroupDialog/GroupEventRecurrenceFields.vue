<template>
  <div class="rounded-md border p-4 space-y-4">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel>{{ t("dialog.group_event_edit.repeat") }}</FieldLabel>
        <FieldContent>
          <Select :model-value="repeatFrequencySelection" :disabled="groupEventEditDialog.loading" @update:model-value="handleRepeatFrequencyChange">
            <SelectTrigger size="sm" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" :disabled="!canReturnToNever">
                {{ t("dialog.group_event_edit.repeat_values.none") }}
              </SelectItem>
              <SelectItem value="weekly">
                {{ t("dialog.group_event_edit.repeat_values.weekly") }}
              </SelectItem>
              <SelectItem value="monthly">
                {{ t("dialog.group_event_edit.repeat_values.monthly") }}
              </SelectItem>
              <SelectItem value="yearly">
                {{ t("dialog.group_event_edit.repeat_values.yearly") }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>
      <Field v-if="groupEventEditDialog.recurrence">
        <FieldLabel>{{ t("dialog.group_event_edit.repeat_every") }}</FieldLabel>
        <FieldContent>
          <InputGroupField
            v-model.number="groupEventEditDialog.recurrence.interval"
            type="number"
            min="1"
            step="1"
            size="sm"
            :disabled="groupEventEditDialog.loading"
          />
        </FieldContent>
      </Field>
    </div>

    <template v-if="groupEventEditDialog.recurrence">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field v-if="groupEventEditDialog.recurrence.frequency === 'weekly'">
          <FieldLabel>{{ t("dialog.group_event_edit.weekly_pattern") }}</FieldLabel>
          <FieldContent>
            <Select :model-value="weeklyPatternSelection" :disabled="groupEventEditDialog.loading" @update:model-value="handleWeeklyPatternChange">
              <SelectTrigger size="sm" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyWeek">
                  {{ t("dialog.group_event_edit.weekly_pattern_values.every_week") }}
                </SelectItem>
                <SelectItem value="weekdays">
                  {{ t("dialog.group_event_edit.weekly_pattern_values.weekdays") }}
                </SelectItem>
                <SelectItem value="weekend">
                  {{ t("dialog.group_event_edit.weekly_pattern_values.weekend") }}
                </SelectItem>
                <SelectItem value="custom">
                  {{ t("dialog.group_event_edit.weekly_pattern_values.custom") }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
        <Field v-if="groupEventEditDialog.recurrence.frequency === 'weekly' && weeklyPatternSelection === 'custom'">
          <FieldLabel>{{ t("dialog.group_event_edit.custom_days") }}</FieldLabel>
          <FieldContent>
            <Select
              multiple
              :model-value="groupEventEditDialog.recurrence.daysOfWeek"
              :disabled="groupEventEditDialog.loading"
              @update:model-value="handleCustomDaysChange"
            >
              <SelectTrigger size="sm" class="w-full">
                <SelectValue>
                  <span class="truncate">
                    {{ selectedCustomDaysSummary || t("dialog.group_event_edit.none_selected") }}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="day in weekDayOptions" :key="day.value" :value="day.value">
                  {{ day.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel>{{ t("dialog.group_event_edit.ends") }}</FieldLabel>
          <FieldContent>
            <Select v-model="recurrenceEndType" :disabled="groupEventEditDialog.loading">
              <SelectTrigger size="sm" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">
                  {{ t("dialog.group_event_edit.ends_values.never") }}
                </SelectItem>
                <SelectItem value="afterOccurrences">
                  {{ t("dialog.group_event_edit.ends_values.after_occurrences") }}
                </SelectItem>
                <SelectItem value="afterDate">
                  {{ t("dialog.group_event_edit.ends_values.after_date") }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FieldContent>
        </Field>
        <Field v-if="recurrenceEndType === 'afterOccurrences'">
          <FieldLabel>{{ t("dialog.group_event_edit.occurrence_count") }}</FieldLabel>
          <FieldContent>
            <InputGroupField v-model.number="recurrenceEndCount" type="number" min="1" step="1" size="sm" :disabled="groupEventEditDialog.loading" />
          </FieldContent>
        </Field>

        <Field v-if="recurrenceEndType === 'afterDate'">
          <FieldLabel>{{ t("dialog.group_event_edit.end_date") }}</FieldLabel>
          <FieldContent>
            <InputGroupField v-model="recurrenceEndDate" type="datetime-local" size="sm" :disabled="groupEventEditDialog.loading" />
          </FieldContent>
        </Field>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { toRef } from "vue";
import { useGroupStore } from "../../../stores/group";
import { useGroupEventRecurrence } from "./use-group-event-recurrence";

const { t } = useI18n();
const { groupEventEditDialog } = storeToRefs(useGroupStore());
const props = defineProps<{ canReturnToNever: boolean }>();
const {
  repeatFrequencySelection,
  recurrenceEndType,
  recurrenceEndCount,
  recurrenceEndDate,
  weeklyPatternSelection,
  selectedCustomDaysSummary,
  weekDayOptions,
  handleRepeatFrequencyChange,
  handleWeeklyPatternChange,
  handleCustomDaysChange,
} = useGroupEventRecurrence({ t, groupEventEditDialog, canReturnToNever: toRef(props, "canReturnToNever") });
</script>
