<template>
  <div class="x-container x-container-auto-height">
    <div class="mb-4 flex items-center">
      <Select multiple :model-value="playerModerationTypeFilter" @update:model-value="handleModerationFilterChange">
        <SelectTrigger class="w-full flex-1">
          <SelectValue :placeholder="t('view.moderation.filter_placeholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="item in moderationTypes" :key="item" :value="item">
              {{ t("view.moderation.filters." + item) }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <InputGroupField v-model="playerModerationSearch" :placeholder="t('view.moderation.search_placeholder')" class="w-[150px] mx-2.5 flex-[0.4]" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button class="rounded-full mr-2.5" variant="ghost" size="icon-sm" :disabled="playerModerationTable.loading">
            <Trash2 class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-[220px]">
          <DropdownMenuLabel>
            {{ t("view.moderation.clear_type_placeholder") }}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem v-for="item in moderationTypes" :key="item" @click="clearPlayerModerationsByType(item)">
            {{ t("view.moderation.filters." + item) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <TooltipWrapper side="bottom" :content="t('view.moderation.refresh_tooltip')">
        <Button class="rounded-full" variant="ghost" size="icon-sm" :disabled="playerModerationTable.loading" @click="refreshPlayerModerations()">
          <Spinner v-if="playerModerationTable.loading" />
          <RefreshCw v-else />
        </Button>
      </TooltipWrapper>
    </div>

    <DataTableLayout
      :table="table"
      :loading="playerModerationTable.loading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuLabel from "@/components/ui/dropdown-menu/DropdownMenuLabel.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import { computed } from "vue";
import type { PlayerModerationType } from "vrchat";
import Button from "@/components/ui/button/Button.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import { RefreshCw, Trash2 } from "lucide-vue-next";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useModalStore } from "../../stores/modal";
import { useModerationStore } from "../../stores/moderation";
import type { PlayerModerationEntry } from "../../stores/moderation";
import { runRefreshPlayerModerationsFlow as refreshPlayerModerations } from "../../coordinators/moderation-coordinator";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import { createColumns } from "./columns.tsx";
import { moderationTypes } from "../../shared/constants/moderation";
import { playerModerationRequest } from "../../api/player-moderation";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

import { configRepository } from "../../services/config.ts";

defineOptions({ name: "ModerationView" });

const { t } = useI18n();
const { playerModerationTable } = storeToRefs(useModerationStore());
const { handlePlayerModerationDelete } = useModerationStore();
const appearanceSettingsStore = useAppearanceSettingsStore();
const modalStore = useModalStore();

const playerModerationTypes = [
  "block",
  "hideAvatar",
  "interactOff",
  "interactOn",
  "mute",
  "muteChat",
  "showAvatar",
  "unmute",
  "unmuteChat",
] satisfies PlayerModerationType[];

function isPlayerModerationType(value: string): value is PlayerModerationType {
  return playerModerationTypes.some((item) => item === value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function logModerationError(error: unknown) {
  console.error(error);
}

async function init() {
  const saved: unknown = JSON.parse(await configRepository.getString("VRCX_playerModerationTableFilters", "[]"));
  const filter = playerModerationTable.value.filters[0];
  if (filter) filter.value = isStringArray(saved) ? saved : [];
}

init().catch(logModerationError);

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

const playerModerationTypeFilter = computed(() => toStringArray(playerModerationTable.value.filters[0]?.value));

const playerModerationSearch = computed({
  get: () => {
    const value = playerModerationTable.value.filters[1]?.value;
    return typeof value === "string" ? value : "";
  },
  set: (value: string) => {
    const filter = playerModerationTable.value.filters[1];
    if (filter) filter.value = value;
  },
});

function saveTableFilters() {
  configRepository
    .setString("VRCX_playerModerationTableFilters", JSON.stringify(toStringArray(playerModerationTable.value.filters[0]?.value)))
    .catch(logModerationError);
}

function handleModerationFilterChange(value: unknown) {
  const filter = playerModerationTable.value.filters[0];
  if (filter) {
    filter.value = toStringArray(value);
  }
  saveTableFilters();
}

function deletePlayerModeration(row: PlayerModerationEntry) {
  if (!isPlayerModerationType(row.type)) return;
  playerModerationRequest
    .deletePlayerModeration({
      moderated: row.targetUserId,
      type: row.type,
    })
    .then((args) => handlePlayerModerationDelete(args))
    .catch(logModerationError);
}

async function clearPlayerModerationsByType(type: string) {
  if (!isPlayerModerationType(type)) return;
  const { ok } = await modalStore.confirm({
    title: t("view.moderation.clear_confirm_title"),
    description: t("view.moderation.clear_confirm_description", {
      type,
    }),
    confirmText: t("view.moderation.clear_all"),
    destructive: true,
  });
  if (!ok) {
    return;
  }
  await playerModerationRequest.deletePlayerModerations({
    type,
  });
  await refreshPlayerModerations();
}

function deletePlayerModerationPrompt(row: PlayerModerationEntry) {
  modalStore
    .confirm({
      description: `Continue? Moderation ${row.type}`,
      title: "Confirm",
    })
    .then(({ ok }) => (ok ? deletePlayerModeration(row) : undefined))
    .catch(logModerationError);
}

const moderationDisplayData = computed(() => {
  const data = playerModerationTable.value.data;
  const typeSet = new Set(playerModerationTypeFilter.value.map((value) => value.toLowerCase()));
  const searchValue = playerModerationSearch.value.trim().toLowerCase();

  return data.filter((row) => {
    if (typeSet.size > 0 && !typeSet.has(row.type.toLowerCase())) {
      return false;
    }
    if (searchValue) {
      const source = row.sourceDisplayName.toLowerCase();
      const target = row.targetDisplayName.toLowerCase();
      if (!source.includes(searchValue) && !target.includes(searchValue)) {
        return false;
      }
    }
    return true;
  });
});

const columns = createColumns({
  onDelete: deletePlayerModeration,
  onDeletePrompt: deletePlayerModerationPrompt,
});

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

const { table, pagination } = useVrcxVueTable({
  persistKey: "moderation",
  get data() {
    return moderationDisplayData.value;
  },
  columns,
  getRowId: (row) => row.id,
  initialSorting: [{ id: "created", desc: true }],
  initialPagination: {
    pageIndex: 0,
    pageSize: appearanceSettingsStore.tablePageSize,
  },
});

const totalItems = computed(() => {
  return table.getFilteredRowModel().rows.length;
});

const handlePageSizeChange = (size: number) => {
  pagination.value = {
    ...pagination.value,
    pageIndex: 0,
    pageSize: size,
  };
};
</script>
