<template>
  <div class="x-container flex h-full min-h-0 flex-col gap-3 py-3">
    <DashboardEditToolbar v-if="isEditing" v-model:name="editName" @save="handleSave" @cancel="handleCancelEdit" @delete="handleDelete" />

    <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <template v-if="displayRows.length && !isEditing">
        <ResizablePanelGroup direction="vertical" :auto-save-id="`dashboard-${id}`" class="flex-1 min-h-0">
          <template v-for="(row, rowIndex) in displayRows" :key="rowIndex">
            <ResizablePanel :default-size="100 / displayRows.length" :min-size="10">
              <DashboardRow :row="row" :row-index="rowIndex" :dashboard-id="id" @update-panel="handleLiveUpdatePanel" />
            </ResizablePanel>
            <ResizableHandle v-if="rowIndex < displayRows.length - 1" />
          </template>
        </ResizablePanelGroup>
      </template>

      <template v-else-if="isEditing">
        <DashboardRow
          v-for="(row, rowIndex) in displayRows"
          :key="rowIndex"
          :row="row"
          :row-index="rowIndex"
          :dashboard-id="id"
          :is-editing="true"
          @update-panel="handleUpdatePanel"
          @remove-panel="handleRemovePanel"
        />

        <div
          class="mt-auto flex min-h-[80px] flex-1 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/20 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          :class="showAddRowOptions ? 'items-start p-4' : 'cursor-pointer'"
          @click="handleAddRowAreaClick"
        >
          <div v-if="showAddRowOptions" class="flex flex-wrap items-center gap-3">
            <span class="text-xs text-muted-foreground">{{ t("dashboard.actions.add_row") }}:</span>
            <button
              type="button"
              class="flex h-10 w-16 items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              :title="t('dashboard.actions.add_full_row')"
              @click.stop="handleAddRow(1)"
            >
              <div class="h-6 w-12 rounded bg-muted-foreground/20" />
            </button>
            <button
              type="button"
              class="flex h-10 w-16 items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              :title="t('dashboard.actions.add_split_row')"
              @click.stop="handleAddRow(2)"
            >
              <div class="h-6 w-5 rounded bg-muted-foreground/20" />
              <div class="h-6 w-5 rounded bg-muted-foreground/20" />
            </button>
            <button
              type="button"
              class="flex h-10 w-16 items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              :title="t('dashboard.actions.add_vertical_row')"
              @click.stop="handleAddRow(2, 'vertical')"
            >
              <div class="flex flex-col gap-0.5">
                <div class="h-2.5 w-10 rounded bg-muted-foreground/20" />
                <div class="h-2.5 w-10 rounded bg-muted-foreground/20" />
              </div>
            </button>
          </div>
          <Plus v-else class="size-6 opacity-50" />
        </div>
      </template>

      <div v-else class="flex flex-1 items-center justify-center rounded-md border border-dashed text-muted-foreground">
        <div class="flex flex-col items-center gap-3">
          <p>{{ t("dashboard.empty") }}</p>
          <Button @click="isEditing = true">{{ t("dashboard.actions.start_editing") }}</Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Plus } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import Button from "@/components/ui/button/Button.vue";
import ResizableHandle from "@/components/ui/resizable/ResizableHandle.vue";
import ResizablePanel from "@/components/ui/resizable/ResizablePanel.vue";
import ResizablePanelGroup from "@/components/ui/resizable/ResizablePanelGroup.vue";
import { useDashboardStore } from "@/stores/dashboard";
import { logFailure } from "@/stores/log-failure";
import { useModalStore } from "@/stores/modal";

import DashboardEditToolbar from "./components/DashboardEditToolbar.vue";
import DashboardRow from "./components/DashboardRow.vue";
import { isDashboardRow, type DashboardPanelValue, type DashboardRowValue } from "./types";

defineOptions({ name: "DashboardView" });

const props = defineProps<{
  id: string;
}>();

const router = useRouter();
const { t } = useI18n();
const dashboardStore = useDashboardStore();
const modalStore = useModalStore();

const isEditing = ref(false);
const showAddRowOptions = ref(false);
const editRows = ref<DashboardRowValue[]>([]);
const editName = ref("");

const dashboard = computed(() => {
  const found = dashboardStore.getDashboard(props.id);
  return found && "rows" in found ? found : null;
});
const displayRows = computed(() => (isEditing.value ? editRows.value : (dashboard.value?.rows ?? [])));

const cloneRows = (rows: unknown): DashboardRowValue[] => {
  const parsed: unknown = JSON.parse(JSON.stringify(Array.isArray(rows) ? rows : []));
  return Array.isArray(parsed) ? parsed.filter(isDashboardRow) : [];
};

watch(
  () => props.id,
  () => {
    isEditing.value = false;
    showAddRowOptions.value = false;
  }
);

watch(
  dashboard,
  (value) => {
    if (!value) {
      void router.replace({ name: "feed" }).catch(logFailure("Failed to open feed"));
    }
  },
  { immediate: true }
);

watch(isEditing, (isNowEditing) => {
  if (!isNowEditing || !dashboard.value) {
    showAddRowOptions.value = false;
    return;
  }
  editRows.value = cloneRows(dashboard.value.rows);
  editName.value = dashboard.value.name || "";
});

watch(
  () => dashboardStore.editingDashboardId,
  (editingId) => {
    if (editingId === props.id) {
      isEditing.value = true;
      dashboardStore.clearEditingDashboardId();
    }
  },
  { immediate: true }
);

const handleAddRowAreaClick = () => {
  showAddRowOptions.value = !showAddRowOptions.value;
};

const handleAddRow = (panelCount: number, direction: DashboardRowValue["direction"] = "horizontal") => {
  const panels: null[] = Array.from({ length: panelCount }, () => null);
  editRows.value.push({ panels, direction });
  showAddRowOptions.value = false;
};

const handleRemovePanel = (rowIndex: number, panelIndex: number) => {
  const row = editRows.value[rowIndex];
  if (!row) return;
  if (row.panels.length <= 1) {
    editRows.value.splice(rowIndex, 1);
  } else {
    row.panels.splice(panelIndex, 1);
  }
};

const handleUpdatePanel = (rowIndex: number, panelIndex: number, panelValue: DashboardPanelValue | null) => {
  const row = editRows.value[rowIndex];
  if (!row) {
    return;
  }
  row.panels[panelIndex] = panelValue;
};

const handleLiveUpdatePanel = async (rowIndex: number, panelIndex: number, panelValue: DashboardPanelValue | null) => {
  if (!dashboard.value?.rows[rowIndex]?.panels) return;
  const rows = cloneRows(dashboard.value.rows);
  const row = rows[rowIndex];
  if (!row) return;
  row.panels[panelIndex] = panelValue;
  await dashboardStore.updateDashboard(props.id, { rows });
};

const resolveSavedName = () => {
  const trimmedName = editName.value.trim();
  if (trimmedName !== "") return trimmedName;
  const savedName = dashboard.value?.name;
  if (savedName === undefined || savedName === "") return "Dashboard";
  return savedName;
};

const handleSave = async () => {
  const isFirstSave = dashboardStore.dashboards.length === 1 && (!dashboard.value?.rows || dashboard.value.rows.length === 0);

  await dashboardStore.updateDashboard(props.id, {
    name: resolveSavedName(),
    rows: editRows.value,
  });
  isEditing.value = false;

  if (isFirstSave) {
    toast(t("dashboard.first_save_tip"), { duration: 6000 });
  }
};

const handleCancelEdit = () => {
  isEditing.value = false;
};

const handleDelete = async () => {
  const { ok } = await modalStore.confirm({
    title: t("dashboard.confirmations.delete_title"),
    description: t("dashboard.confirmations.delete_description"),
    destructive: true,
  });
  if (!ok) {
    return;
  }
  await dashboardStore.deleteDashboard(props.id);
  void router.replace({ name: "feed" }).catch(logFailure("Failed to open feed"));
};
</script>
