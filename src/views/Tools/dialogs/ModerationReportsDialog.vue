<template>
  <Dialog :open="isModerationReportsDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.moderation_reports.header") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-2">
        <Select :model-value="typeFilter" @update:model-value="setTypeFilter">
          <SelectTrigger size="sm" class="w-40">
            <SelectValue :placeholder="t('dialog.moderation_reports.filter_type')" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in typeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" class="ml-auto" :disabled="isLoading" @click="loadReports(true)">
          <RefreshCw class="size-4" :class="{ 'animate-spin': isLoading }" />
        </Button>
      </div>

      <div class="max-h-[60vh] overflow-y-auto">
        <DataTableEmpty v-if="!reports.length && !isLoading" type="nodata" />
        <div v-for="report in reports" :key="report.id" class="flex items-start gap-3 border-b py-3 last:border-b-0">
          <img v-if="report.contentThumbnailImageUrl" :src="report.contentThumbnailImageUrl" class="size-12 flex-none rounded-md object-cover" loading="lazy" />
          <div class="min-w-0 flex-1 text-sm">
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="truncate font-medium hover:underline"
                @click="showContent(report)"
                v-text="report.contentName || report.contentId"
              ></button>
              <Badge variant="outline">{{ report.type }}</Badge>
            </div>
            <div class="text-muted-foreground">{{ categoryLabel(report.category) }} · {{ reasonLabel(report.reason) }}</div>
            <div v-if="report.description" class="mt-1 whitespace-pre-wrap break-words">
              {{ report.description }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">
              {{ formatDateFilter(report.created, "long") }}
            </div>
          </div>
        </div>
      </div>

      <DialogFooter v-if="hasNext">
        <Button size="sm" variant="outline" class="w-full" :disabled="isLoading" @click="loadReports(false)">
          {{ t("dialog.moderation_reports.load_more") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { RefreshCw, Trash2 } from "lucide-vue-next";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { computed, ref, watch } from "vue";
import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAuthStore } from "../../../stores/auth";
import { useModalStore } from "../../../stores/modal";
import { useUserStore } from "../../../stores/user";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import moderationReportRequest from "../../../api/moderation-report";
import { showAvatarDialog } from "../../../coordinators/avatar-coordinator";
import { showGroupDialog } from "../../../coordinators/group-coordinator";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import { showWorldDialog } from "../../../coordinators/world-coordinator";

const PAGE_SIZE = 100;

const props = defineProps({
  isModerationReportsDialogVisible: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);

const { t } = useI18n();
const modalStore = useModalStore();
const { currentUser } = storeToRefs(useUserStore());
const { cachedConfig } = storeToRefs(useAuthStore());

const reports = ref([]);
const hasNext = ref(false);
const isLoading = ref(false);
const typeFilter = ref("all");

const typeOptions = computed(() => [
  { value: "all", label: t("dialog.moderation_reports.all") },
  ...Object.keys(cachedConfig.value?.reportOptions ?? {}).map((type) => ({
    value: type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
  })),
]);

watch(
  () => props.isModerationReportsDialogVisible,
  (visible) => {
    if (visible) {
      loadReports(true);
    }
  }
);

function closeDialog() {
  emit("close");
}

function setTypeFilter(value) {
  typeFilter.value = value;
  loadReports(true);
}

async function loadReports(reset) {
  if (reset) {
    reports.value = [];
    hasNext.value = false;
  }
  const params = {
    reportingUserId: currentUser.value.id,
    n: PAGE_SIZE,
    offset: reports.value.length,
  };
  if (typeFilter.value !== "all") {
    params.type = typeFilter.value;
  }
  isLoading.value = true;
  try {
    const { json } = await moderationReportRequest.getModerationReports(params);
    reports.value.push(...(json.results ?? []));
    hasNext.value = Boolean(json.hasNext);
  } finally {
    isLoading.value = false;
  }
}

function categoryLabel(key) {
  return cachedConfig.value?.reportCategories?.[key]?.text ?? key;
}

function reasonLabel(key) {
  return cachedConfig.value?.reportReasons?.[key]?.text ?? key;
}

function showContent(report) {
  switch (report.type) {
    case "user":
      showUserDialog(report.contentId);
      break;
    case "world":
      showWorldDialog(report.contentId);
      break;
    case "avatar":
      showAvatarDialog(report.contentId);
      break;
    case "group":
      showGroupDialog(report.contentId);
      break;
  }
}
</script>
