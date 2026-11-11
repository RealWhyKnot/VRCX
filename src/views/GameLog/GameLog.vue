<template>
  <div ref="gameLogRef" class="x-container x-container-auto-height">
    <template v-if="sessionsViewMode === 'sessions'">
      <GameLogSessions>
        <template #leading>
          <ToggleGroup type="single" variant="outline" size="sm" :model-value="sessionsViewMode" class="shrink-0" @update:model-value="handleViewModeChange">
            <TooltipWrapper side="bottom" :content="t('view.game_log.sessions.switch_to_sessions')">
              <ToggleGroupItem
                value="sessions"
                class="px-2"
                :class="sessionsViewMode === 'sessions' && 'bg-accent text-accent-foreground'"
                :aria-label="t('view.game_log.sessions.switch_to_sessions')"
              >
                <Logs class="size-4" />
              </ToggleGroupItem>
            </TooltipWrapper>
            <TooltipWrapper side="bottom" :content="t('view.game_log.sessions.switch_to_table')">
              <ToggleGroupItem value="table" class="px-2" :aria-label="t('view.game_log.sessions.switch_to_table')">
                <Table2 class="size-4" />
              </ToggleGroupItem>
            </TooltipWrapper>
          </ToggleGroup>
        </template>
      </GameLogSessions>
    </template>

    <template v-else>
      <DataTableLayout
        :table="table"
        :loading="gameLogTable.loading"
        auto-height
        :page-sizes="pageSizes"
        :total-items="totalItems"
        :on-page-size-change="handlePageSizeChange"
      >
        <template #toolbar>
          <div class="mt-0 mx-0 mb-2 flex items-center">
            <div class="mr-2 flex flex-none items-center">
              <ToggleGroup type="single" variant="outline" size="sm" :model-value="sessionsViewMode" class="mr-2" @update:model-value="handleViewModeChange">
                <TooltipWrapper side="bottom" :content="t('view.game_log.sessions.switch_to_sessions')">
                  <ToggleGroupItem value="sessions" class="px-2" :aria-label="t('view.game_log.sessions.switch_to_sessions')">
                    <Logs class="size-4" />
                  </ToggleGroupItem>
                </TooltipWrapper>
                <TooltipWrapper side="bottom" :content="t('view.game_log.sessions.switch_to_table')">
                  <ToggleGroupItem
                    value="table"
                    class="px-2"
                    :class="sessionsViewMode === 'table' && 'bg-accent text-accent-foreground'"
                    :aria-label="t('view.game_log.sessions.switch_to_table')"
                  >
                    <Table2 class="size-4" />
                  </ToggleGroupItem>
                </TooltipWrapper>
              </ToggleGroup>
              <TooltipWrapper side="bottom" :content="t('view.feed.favorites_only_tooltip')">
                <div>
                  <Toggle
                    variant="outline"
                    size="sm"
                    :model-value="gameLogTable.vip"
                    :aria-label="t('view.feed.favorites_only_tooltip')"
                    @update:model-value="
                      (v) => {
                        gameLogTable.vip = v;
                        gameLogTableLookup();
                      }
                    "
                  >
                    <Star v-if="gameLogTable.vip" fill="currentColor" />
                    <Star v-else />
                  </Toggle>
                </div>
              </TooltipWrapper>
            </div>
            <Select multiple :model-value="Array.isArray(gameLogTable.filter) ? gameLogTable.filter : []" @update:model-value="handleGameLogFilterChange">
              <SelectTrigger class="w-full flex-1">
                <SelectValue :placeholder="t('view.game_log.filter_placeholder')" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem
                    v-for="type in ['Location', 'OnPlayerJoined', 'OnPlayerLeft', 'VideoPlay', 'Event', 'External', 'StringLoad', 'ImageLoad']"
                    :key="type"
                    :value="type"
                  >
                    {{ t("view.game_log.filters." + type) }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <InputGroupField
              v-model="gameLogTable.search"
              class="ml-2 flex-[0.4]"
              :placeholder="t('view.game_log.search_placeholder')"
              clearable
              @keyup.enter="gameLogTableLookup"
              @change="gameLogTableLookup"
            />
          </div>
        </template>
      </DataTableLayout>
    </template>
  </div>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { computed } from "vue";
import { Logs, Star, Table2 } from "lucide-vue-next";
import Toggle from "@/components/ui/toggle/Toggle.vue";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useGameLogStore } from "../../stores/gameLog";
import { useModalStore } from "../../stores/modal";
import { useVrcxStore } from "../../stores/vrcx";
import { logFailure } from "../../stores/log-failure";
import type { GameLogEntry } from "../../stores/gameLog/types";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import InputGroupField from "../../components/ui/input-group/InputGroupField.vue";
import TooltipWrapper from "../../components/ui/tooltip/TooltipWrapper.vue";
import { createColumns } from "./columns.tsx";
import { database } from "../../services/database";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";
import GameLogSessions from "./components/GameLogSessions.vue";

const { gameLogTableLookup, setSessionsViewMode } = useGameLogStore();
const { gameLogTable, gameLogTableData, sessionsViewMode } = storeToRefs(useGameLogStore());
const appearanceSettingsStore = useAppearanceSettingsStore();
const vrcxStore = useVrcxStore();
const modalStore = useModalStore();

function readNonEmptyText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getGameLogCreatedAt(row: GameLogEntry): string {
  return (
    readNonEmptyText(row.created_at) ??
    readNonEmptyText("createdAt" in row ? row.createdAt : undefined) ??
    readNonEmptyText("dt" in row ? row.dt : undefined) ??
    ""
  );
}

const { t } = useI18n();

function deleteGameLogEntryPrompt(row: GameLogEntry) {
  void modalStore
    .confirm({
      description: t("confirm.delete_log"),
      title: t("common.actions.confirm"),
    })
    .then(({ ok }) => {
      if (ok) {
        deleteGameLogEntry(row);
      }
    })
    .catch(logFailure("Failed to confirm game log deletion:"));
}

function deleteGameLogEntry(row: GameLogEntry) {
  const index = gameLogTableData.value.findIndex((entry) => entry === row);
  if (index !== -1) {
    gameLogTableData.value = [...gameLogTableData.value.slice(0, index), ...gameLogTableData.value.slice(index + 1)];
  }
  database.deleteGameLogEntry({
    type: row.type,
    created_at: row.created_at,
    videoUrl: row.videoUrl ?? null,
    location: row.location ?? null,
    data: row.data ?? null,
    message: row.message ?? null,
    resourceUrl: row.resourceUrl ?? null,
  });
}

const columns = createColumns({
  getCreatedAt: getGameLogCreatedAt,
  onDelete: deleteGameLogEntry,
  onDeletePrompt: deleteGameLogEntryPrompt,
});

function handleGameLogFilterChange(value: unknown) {
  gameLogTable.value.filter = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  void gameLogTableLookup().catch(logFailure("Failed to look up game log table:"));
}

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

function getGameLogRowId(row: GameLogEntry) {
  return `row:${row.rowId}:${row.type}`;
}

const { table, pagination } = useVrcxVueTable({
  persistKey: "gameLog",
  get data() {
    return gameLogTableData.value;
  },
  columns,
  getRowId: getGameLogRowId,
  initialSorting: [],
  initialPagination: {
    pageIndex: 0,
    pageSize: appearanceSettingsStore.tablePageSize,
  },
  tableOptions: {
    autoResetPageIndex: false,
  },
});

const totalItems = computed(() => {
  const length = table.getFilteredRowModel().rows.length;
  const max = vrcxStore.maxTableSize;
  return length > max && length < max + 51 ? max : length;
});

const handlePageSizeChange = (size: number) => {
  pagination.value = {
    ...pagination.value,
    pageIndex: 0,
    pageSize: size,
  };
};

function handleViewModeChange(mode: unknown) {
  if (mode === "sessions" || mode === "table") {
    void setSessionsViewMode(mode).catch(logFailure("Failed to change sessions view mode:"));
  }
}
</script>
