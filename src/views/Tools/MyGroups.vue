<template>
  <div class="x-container x-container-auto-height">
    <DataTableLayout
      :table="table"
      :loading="isLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
    >
      <template #toolbar>
        <div class="mb-2 flex min-w-0 flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" @click="goBack">
            <ArrowLeft />
            {{ t("nav_tooltip.tools") }}
          </Button>
          <span class="header">{{ t("view.tools.group.my_groups") }}</span>
          <TooltipWrapper side="bottom" :content="t('view.tools.my_groups.limit_hint', { limit: GROUP_LIMIT })">
            <Badge :variant="groupCount >= GROUP_LIMIT ? 'destructive' : 'outline'" class="shrink-0 tabular-nums" data-testid="group-count"
              >{{ groupCount }} / {{ GROUP_LIMIT }}</Badge
            >
          </TooltipWrapper>
          <span class="min-w-0 flex-1 truncate text-xs text-muted-foreground" data-testid="history-hint">{{ t("view.tools.my_groups.history_hint") }}</span>
          <InputGroupSearch v-model="searchText" :maxlength="100" :placeholder="t('view.tools.my_groups.search_placeholder')" class="w-[220px] shrink-0" />
          <Button size="sm" variant="outline" class="shrink-0" :disabled="isLoading" data-testid="groups-refresh" @click="reload">
            <Spinner v-if="isLoading" />
            <RefreshCw v-else />
            {{ t("view.tools.my_groups.refresh") }}
          </Button>
        </div>
      </template>
    </DataTableLayout>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, RefreshCw } from "lucide-vue-next";
import { computed, onActivated, ref, shallowRef } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import InputGroupSearch from "@/components/ui/input-group/InputGroupSearch.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { showGroupDialog } from "@/coordinators/group-dialog-coordinator";
import { getCurrentUserGroups, leaveGroupPrompt } from "@/coordinators/group-membership-coordinator";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";
import { database } from "@/services/database";
import { GROUP_LIMIT, buildGroupOverview, filterGroupOverview, type GroupNotificationStats, type GroupVisitStats } from "@/shared/utils/group-overview";
import { useGroupStore } from "@/stores/group";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import { useUserStore } from "@/stores/user";
import { logError } from "@/stores/vrcx-messages";
import { createColumns } from "./my-groups-columns.tsx";

defineOptions({ name: "MyGroupsView" });

const { t } = useI18n();
const router = useRouter();
const groupStore = useGroupStore();
const userStore = useUserStore();
const appearanceSettingsStore = useAppearanceSettingsStore();

const searchText = ref("");
const isLoading = ref(false);
const visits = shallowRef(new Map<string, GroupVisitStats>());
const notifications = shallowRef(new Map<string, GroupNotificationStats>());

const rows = computed(() => buildGroupOverview(groupStore.currentUserGroups.values(), visits.value, notifications.value, userStore.currentUser.id));
const groupCount = computed(() => rows.value.length);
const visibleRows = computed(() => filterGroupOverview(rows.value, searchText.value));

async function loadStats() {
  const [visitStats, notificationStats] = await Promise.all([database.getGroupVisitStats(), database.getGroupNotificationStats()]);
  visits.value = visitStats;
  notifications.value = notificationStats;
}

async function run(work: () => Promise<void>) {
  if (isLoading.value) {
    return;
  }
  isLoading.value = true;
  try {
    await work();
  } catch (error) {
    logError(error);
    toast.error(t("view.tools.my_groups.load_failed"));
  } finally {
    isLoading.value = false;
  }
}

function reload() {
  void run(async () => {
    await getCurrentUserGroups();
    await loadStats();
  }).catch(logError);
}

function goBack() {
  void router.push({ name: "tools" }).catch(logError);
}

const columns = createColumns({
  onOpen: (groupId) => {
    showGroupDialog(groupId);
  },
  onLeave: leaveGroupPrompt,
});

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

const { table, pagination } = useVrcxVueTable({
  persistKey: "myGroups",
  get data() {
    return visibleRows.value;
  },
  columns,
  getRowId: (row) => row.id,
  initialSorting: [{ id: "lastVisitAt", desc: false }],
  initialPagination: {
    pageIndex: 0,
    pageSize: appearanceSettingsStore.tablePageSize,
  },
  tableOptions: {
    autoResetPageIndex: false,
  },
});

const totalItems = computed(() => table.getFilteredRowModel().rows.length);

function handlePageSizeChange(size: number) {
  pagination.value = { ...pagination.value, pageIndex: 0, pageSize: size };
}

onActivated(() => {
  void run(loadStats).catch(logError);
});
</script>
