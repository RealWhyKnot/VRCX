<template>
  <div class="flex-1 min-h-0 overflow-auto">
    <table class="w-full border-collapse text-[13px]">
      <thead class="sticky top-0 z-1 bg-background">
        <tr>
          <th
            class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2 border-b whitespace-nowrap select-none cursor-pointer hover:text-foreground"
            @click="emit('sort', 'dateTime')"
          >
            {{ t("dialog.screenshot_metadata.col_date") }}
            <span v-if="sort.key === 'dateTime'" class="ml-1 text-[10px]">{{ sort.asc ? "↑" : "↓" }}</span>
          </th>
          <th
            class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2 border-b whitespace-nowrap select-none cursor-pointer hover:text-foreground"
            @click="emit('sort', 'world')"
          >
            {{ t("dialog.screenshot_metadata.col_world") }}
            <span v-if="sort.key === 'world'" class="ml-1 text-[10px]">{{ sort.asc ? "↑" : "↓" }}</span>
          </th>
          <th
            v-if="hasMatchColumn"
            class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2 border-b whitespace-nowrap select-none cursor-pointer hover:text-foreground"
            @click="emit('sort', 'match')"
          >
            {{ t("dialog.screenshot_metadata.col_match") }}
            <span v-if="sort.key === 'match'" class="ml-1 text-[10px]">{{ sort.asc ? "↑" : "↓" }}</span>
          </th>
          <th
            class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2 border-b whitespace-nowrap select-none cursor-pointer hover:text-foreground"
            @click="emit('sort', 'author')"
          >
            {{ t("dialog.screenshot_metadata.col_author") }}
            <span v-if="sort.key === 'author'" class="ml-1 text-[10px]">{{ sort.asc ? "↑" : "↓" }}</span>
          </th>
          <th
            class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2 border-b whitespace-nowrap select-none cursor-pointer hover:text-foreground w-20"
            @click="emit('sort', 'players')"
          >
            {{ t("dialog.screenshot_metadata.col_players") }}
            <span v-if="sort.key === 'players'" class="ml-1 text-[10px]">{{ sort.asc ? "↑" : "↓" }}</span>
          </th>
          <th
            class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground text-left px-3 py-2 border-b whitespace-nowrap select-none w-[100px]"
          >
            {{ t("dialog.screenshot_metadata.col_resolution") }}
          </th>
          <th class="w-8 border-b"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, idx) in rows"
          :key="row.filePath"
          class="group/row cursor-pointer transition-colors duration-100 hover:bg-accent"
          :class="row.filePath === selectedFilePath ? 'bg-accent border-l-[3px] border-l-primary' : ''"
          @click="emit('select', idx)"
        >
          <td class="text-sm px-3 py-2 border-b whitespace-nowrap overflow-hidden text-ellipsis" :class="row.filePath === selectedFilePath ? 'pl-[9px]' : ''">
            {{ row.dateFormatted }}
          </td>
          <td class="text-sm px-3 py-2 border-b whitespace-nowrap overflow-hidden text-ellipsis">
            {{ row.world || "—" }}
          </td>
          <td v-if="hasMatchColumn" class="text-sm px-3 py-2 border-b whitespace-nowrap overflow-hidden text-ellipsis text-primary">
            {{ row.match || "—" }}
          </td>
          <td class="text-sm px-3 py-2 border-b whitespace-nowrap overflow-hidden text-ellipsis text-muted-foreground">
            {{ row.author || "—" }}
          </td>
          <td class="text-sm px-3 py-2 border-b whitespace-nowrap overflow-hidden text-ellipsis">
            <span class="inline-flex items-center gap-1">
              <Users class="size-3 text-muted-foreground" />
              {{ row.playerCount }}
            </span>
          </td>
          <td class="text-xs text-muted-foreground px-3 py-2 border-b whitespace-nowrap overflow-hidden text-ellipsis">
            {{ row.resolution }}
          </td>
          <td class="py-2 pr-2 border-b">
            <ChevronRight class="size-4 text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity duration-150" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Users } from "lucide-vue-next";
import { useI18n } from "vue-i18n";
import type { ScreenshotSearchRow, ScreenshotSortKey } from "../composables/screenshot-metadata-parse";

defineProps<{
  rows: ScreenshotSearchRow[];
  sort: { key: ScreenshotSortKey; asc: boolean };
  hasMatchColumn: boolean;
  selectedFilePath: string | null;
}>();

const emit = defineEmits<{
  sort: [key: ScreenshotSortKey];
  select: [index: number];
}>();

const { t } = useI18n();
</script>
