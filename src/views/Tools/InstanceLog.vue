<template>
  <div class="x-container x-container-auto-height">
    <DataTableLayout :table="table.table" :loading="isLoading" auto-height :page-sizes="pageSizes" :total-items="rows.length" :on-page-size-change="resize">
      <template #toolbar>
        <div class="mb-2 ml-2 flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
            <ArrowLeft />
            {{ t("nav_tooltip.tools") }}
          </Button>
          <span class="header">{{ t("view.tools.instance_log.title") }}</span>
          <div class="ml-auto flex min-w-0 items-center gap-2">
            <InputGroupField v-model="searchText" :maxlength="100" :placeholder="t('view.tools.instance_log.search_placeholder')" class="w-[220px] min-w-0" />
            <TooltipWrapper side="bottom" :content="t('view.tools.instance_log.refresh')">
              <Button
                class="shrink-0 rounded-full"
                size="icon-sm"
                variant="ghost"
                :aria-label="t('view.tools.instance_log.refresh')"
                :disabled="isLoading"
                data-testid="instance-log-refresh"
                @click="reload"
              >
                <Spinner v-if="isLoading" />
                <RefreshCw v-else />
              </Button>
            </TooltipWrapper>
          </div>
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

import Button from "@/components/ui/button/Button.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { showGroupDialog } from "@/coordinators/group-dialog-coordinator";
import { lookupUser, showUserDialog } from "@/coordinators/user-coordinator";
import { useVrcxVueTable } from "@/lib/table/use-vrcx-vue-table";
import { database } from "@/services/database";
import { filterSightings, type SightingRow } from "@/shared/utils/instance-sightings";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import { logError } from "@/stores/vrcx-messages";
import { createSightingColumns } from "./sighting-columns.tsx";

defineOptions({ name: "InstanceLogView" });

const { t } = useI18n();
const router = useRouter();
const appearanceSettingsStore = useAppearanceSettingsStore();

const searchText = ref("");
const isLoading = ref(false);
const sightings = shallowRef<SightingRow[]>([]);
const rows = computed(() => filterSightings(sightings.value, searchText.value));
const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

async function load() {
  if (isLoading.value) {
    return;
  }
  isLoading.value = true;
  try {
    sightings.value = await database.getInstanceSightings();
  } catch (error) {
    logError(error);
    toast.error(t("view.tools.instance_log.load_failed"));
  } finally {
    isLoading.value = false;
  }
}

function reload() {
  void load().catch(logError);
}

function goBack() {
  void router.push({ name: "tools" }).catch(logError);
}

function lookUpByName(displayName: string) {
  void lookupUser({ displayName }).catch(logError);
}

const table = useVrcxVueTable({
  persistKey: "peopleSeen",
  get data() {
    return rows.value;
  },
  columns: createSightingColumns({ onOpenUser: showUserDialog, onOpenGroup: showGroupDialog, onLookUp: lookUpByName }),
  getRowId: (row) => row.id,
  initialSorting: [{ id: "at", desc: true }],
  initialPagination: { pageIndex: 0, pageSize: appearanceSettingsStore.tablePageSize },
  tableOptions: { autoResetPageIndex: false },
});

function resize(size: number) {
  table.pagination.value = { ...table.pagination.value, pageIndex: 0, pageSize: size };
}

onActivated(reload);
</script>
