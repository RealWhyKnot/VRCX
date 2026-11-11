<template>
  <Dialog v-model:open="moderationReportDialog.visible">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.moderation_report.header") }}</DialogTitle>
        <DialogDescription>{{ moderationReportDialog.contentName || moderationReportDialog.contentId }}</DialogDescription>
      </DialogHeader>

      <div v-if="!categoryOptions.length" class="text-sm text-muted-foreground">
        {{ t("dialog.moderation_report.no_options") }}
      </div>

      <FieldGroup v-else class="gap-4">
        <Field>
          <FieldLabel>{{ t("dialog.moderation_report.category") }}</FieldLabel>
          <FieldContent>
            <Select :model-value="category" @update:model-value="setCategory">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.moderation_report.category')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in categoryOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription v-if="selectedCategory?.tooltip">
              {{ selectedCategory.tooltip }}
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>{{ t("dialog.moderation_report.reason") }}</FieldLabel>
          <FieldContent>
            <Select v-model="reason" :disabled="!category">
              <SelectTrigger size="sm">
                <SelectValue :placeholder="t('dialog.moderation_report.reason')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in reasonOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription v-if="selectedReason?.tooltip">
              {{ selectedReason.tooltip }}
            </FieldDescription>
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel>{{ t("dialog.moderation_report.description") }}</FieldLabel>
          <FieldContent>
            <Textarea v-model="description" class="resize-none" rows="4" :placeholder="t('dialog.moderation_report.description_placeholder')" />
          </FieldContent>
        </Field>
      </FieldGroup>

      <DialogFooter>
        <Button size="sm" variant="secondary" @click="closeDialog">
          {{ t("dialog.moderation_report.cancel") }}
        </Button>
        <Button size="sm" variant="destructive" :disabled="!canSubmit" @click="submitReport">
          {{ t("dialog.moderation_report.submit") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldDescription from "@/components/ui/field/FieldDescription.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Textarea from "@/components/ui/textarea/Textarea.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useAuthStore } from "../../stores/auth";
import { useModerationStore } from "../../stores/moderation";
import moderationReportRequest from "../../api/moderation-report";

const { t } = useI18n();

const { moderationReportDialog } = storeToRefs(useModerationStore());
const { cachedConfig } = storeToRefs(useAuthStore());

const category = ref("");
const reason = ref("");
const description = ref("");
const isSubmitting = ref(false);

const reportOptions = computed(() => cachedConfig.value?.reportOptions?.[moderationReportDialog.value.type] ?? {});

const categoryOptions = computed(() => {
  const categories = cachedConfig.value?.reportCategories ?? {};
  return Object.keys(reportOptions.value)
    .map((key) => ({
      value: key,
      label: categories[key]?.text ?? key,
      order: categories[key]?.order ?? 0,
    }))
    .sort((a, b) => a.order - b.order);
});

const reasonOptions = computed(() => {
  const reasons = cachedConfig.value?.reportReasons ?? {};
  return (reportOptions.value[category.value] ?? []).map((key) => ({
    value: key,
    label: reasons[key]?.text ?? key,
  }));
});

const selectedCategory = computed(() => cachedConfig.value?.reportCategories?.[category.value]);
const selectedReason = computed(() => cachedConfig.value?.reportReasons?.[reason.value]);

const canSubmit = computed(() => Boolean(moderationReportDialog.value.contentId && category.value && reason.value) && !isSubmitting.value);

watch(
  () => moderationReportDialog.value.visible,
  (visible) => {
    if (visible) {
      category.value = "";
      reason.value = "";
      description.value = "";
    }
  }
);

function setCategory(value) {
  category.value = value;
  reason.value = "";
}

function closeDialog() {
  moderationReportDialog.value.visible = false;
}

async function submitReport() {
  const D = moderationReportDialog.value;
  const params = {
    type: D.type,
    category: category.value,
    reason: reason.value,
    contentId: D.contentId,
  };
  if (description.value.trim()) {
    params.description = description.value.trim();
  }
  if (D.details) {
    params.details = D.details;
  }
  isSubmitting.value = true;
  try {
    await moderationReportRequest.submitModerationReport(params);
    toast.success(t("dialog.moderation_report.success"));
    closeDialog();
  } finally {
    isSubmitting.value = false;
  }
}
</script>
