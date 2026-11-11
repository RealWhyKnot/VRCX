<template>
  <Dialog :open="isVisible" @update:open="(open) => !open && emit('close')">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.creator_earnings.header") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-2">
        <Select :model-value="range" @update:model-value="changeRange">
          <SelectTrigger size="sm" class="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in EARNINGS_RANGES" :key="option" :value="option">
              {{ t(`dialog.creator_earnings.range_${option}`) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" class="ml-auto" :disabled="state.status === 'loading'" data-testid="earnings-refresh" @click="reload">
          <RefreshCw class="size-4" :class="{ 'animate-spin': state.status === 'loading' }" />
        </Button>
      </div>

      <div v-if="state.status === 'ready'" class="grid grid-cols-2 gap-3" data-testid="earnings-totals">
        <div v-for="cell in cells(state.totals)" :key="cell.key" class="min-w-0 rounded-lg border p-3" :class="{ 'col-span-2': cell.key === 'total' }">
          <div class="truncate text-xs text-muted-foreground">{{ t(`dialog.creator_earnings.${cell.key}`) }}</div>
          <div class="truncate text-lg font-semibold tabular-nums" :title="cell.value">{{ cell.value }}</div>
        </div>
      </div>
      <div v-else-if="state.status === 'failed'" class="py-6 text-center text-sm text-muted-foreground" data-testid="earnings-failed">
        {{ t("dialog.creator_earnings.load_failed") }}
      </div>
      <div v-else class="flex justify-center py-6">
        <Spinner class="text-2xl" />
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import { watch } from "vue";

import Button from "@/components/ui/button/Button.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { logError } from "@/stores/vrcx-messages";
import { EARNINGS_RANGES, useCreatorEarnings, type EarningsTotals } from "../composables/use-creator-earnings";

const props = withDefaults(defineProps<{ isVisible?: boolean | undefined }>(), { isVisible: false });

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { range, state, load, setRange } = useCreatorEarnings();
const numberFormat = new Intl.NumberFormat();

watch(
  () => props.isVisible,
  (isVisible) => {
    if (isVisible) {
      reload();
    }
  }
);

function reload() {
  void load().catch(logError);
}

function changeRange(value: unknown) {
  void setRange(value).catch(logError);
}

function cells(totals: EarningsTotals): { key: string; value: string }[] {
  return [
    { key: "total", value: numberFormat.format(totals.totalEarnings) },
    { key: "otp_earnings", value: numberFormat.format(totals.otpEarnings) },
    { key: "otp_count", value: numberFormat.format(totals.otpPurchaseCount) },
    { key: "subscriber_earnings", value: numberFormat.format(totals.subscriberEarnings) },
    { key: "subscriber_months", value: numberFormat.format(totals.subscriberMonths) },
  ];
}
</script>
