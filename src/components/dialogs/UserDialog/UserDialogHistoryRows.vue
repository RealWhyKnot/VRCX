<template>
  <TooltipWrapper v-if="firstMet" side="right" :content="formatDateFilter(firstMet, 'long')">
    <div class="flex justify-between items-start gap-2 text-xs" data-testid="user-first-met">
      <span class="text-muted-foreground shrink-0">{{ t("dialog.user.info.first_met") }}</span>
      <span class="text-right text-muted-foreground">{{ timeAgo(firstMet) }}</span>
    </div>
  </TooltipWrapper>
  <TooltipWrapper v-if="latest" side="right">
    <template #content>
      <template v-for="change in shown" :key="change.created_at">
        <span>{{ change.from }} → {{ change.to }}: {{ formatDateFilter(change.created_at, "long") }}</span
        ><br />
      </template>
    </template>
    <div class="flex justify-between items-start gap-2 text-xs" data-testid="user-rank-changed">
      <span class="text-muted-foreground shrink-0">{{ t("dialog.user.info.rank_changed") }}</span>
      <span class="text-right text-muted-foreground">{{ timeAgo(latest.created_at) }}</span>
    </div>
  </TooltipWrapper>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import { timeAgo } from "@/shared/utils/base/format";
import type { UserDialogTrustChange } from "@/stores/user-state";

const MAX_CHANGES_SHOWN = 8;

defineOptions({ name: "UserDialogHistoryRows" });

const props = defineProps<{ firstMet: string; trustHistory: UserDialogTrustChange[] }>();

const { t } = useI18n();

const shown = computed(() => props.trustHistory.slice(0, MAX_CHANGES_SHOWN));
const latest = computed(() => shown.value[0]);
</script>
