<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div ref="scrollViewportRef" class="flex-1 overflow-y-auto">
      <div v-if="allRows.length" class="relative w-full px-1.5 py-2 h-[var(--virtual-height)]" :style="virtualContainerStyle">
        <template v-for="item in virtualItems" :key="String(item.virtualItem.key)">
          <div
            :ref="measureRowElement"
            class="absolute left-0 top-0 w-full px-0.5 box-border [transform:translateY(var(--row-start))]"
            :data-index="item.virtualItem.index"
            :style="{ '--row-start': `${item.virtualItem.start}px` }"
          >
            <div v-if="item.row.type === 'section-header'" class="flex items-center gap-2 px-2.5 py-2">
              <Separator class="flex-1" />
              <span class="shrink-0 text-[10px] text-muted-foreground uppercase tracking-wider">
                {{ item.row.label }}
              </span>
              <Separator class="flex-1" />
            </div>

            <NotificationItem
              v-else-if="item.row.type === 'notification'"
              :notification="item.row.notification"
              :is-unseen="item.row.isUnseen"
              @show-invite-response="$emit('show-invite-response', $event)"
              @show-invite-request-response="$emit('show-invite-request-response', $event)"
            />
          </div>
        </template>
      </div>

      <div v-if="!allRows.length" class="flex items-center justify-center p-8 text-sm text-muted-foreground">
        {{ t("side_panel.notification_center.no_new_notifications") }}
      </div>

      <div class="flex justify-center py-3">
        <Button variant="secondary" size="sm" class="text-xs" @click="$emit('navigate-to-table')">
          {{ t("side_panel.notification_center.view_more") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import type { VirtualItem } from "@tanstack/vue-virtual";

import dayjs from "dayjs";

import type { NotificationEntry } from "../../../stores/notification/types";
import { logFailure } from "../../../stores/log-failure";

import NotificationItem from "./NotificationItem.vue";

type NotificationRow = {
  type: "notification";
  key: string;
  notification: NotificationEntry;
  isUnseen: boolean;
};

type SectionHeaderRow = {
  type: "section-header";
  key: string;
  label: string;
};

type ListRow = NotificationRow | SectionHeaderRow;

type VirtualListItem = {
  virtualItem: VirtualItem;
  row: ListRow;
};

const props = withDefaults(
  defineProps<{
    notifications: NotificationEntry[];
    recentNotifications?: NotificationEntry[];
  }>(),
  {
    recentNotifications: () => [],
  }
);

defineEmits<{
  "show-invite-response": [notification: NotificationEntry];
  "show-invite-request-response": [notification: NotificationEntry];
  "navigate-to-table": [];
}>();

const { t } = useI18n();
const scrollViewportRef = ref<HTMLDivElement | null>(null);

function getTs(n: { created_at?: string | undefined; createdAt?: string | undefined }) {
  const raw = n.created_at ?? n.createdAt;
  const ts = dayjs(raw).valueOf();
  return Number.isFinite(ts) ? ts : 0;
}

const sortedUnseenNotifications = computed(() => [...props.notifications].sort((a, b) => getTs(b) - getTs(a)));

const sortedRecentNotifications = computed(() => [...props.recentNotifications].sort((a, b) => getTs(b) - getTs(a)));

const allRows = computed<ListRow[]>(() => {
  const rows: ListRow[] = [];
  for (const n of sortedUnseenNotifications.value) {
    rows.push({
      type: "notification",
      key: `unseen:${String(n.id)}`,
      notification: n,
      isUnseen: true,
    });
  }
  if (sortedRecentNotifications.value.length) {
    rows.push({
      type: "section-header",
      key: "header:recent",
      label: t("side_panel.notification_center.past_notifications"),
    });
    for (const n of sortedRecentNotifications.value) {
      rows.push({
        type: "notification",
        key: `recent:${String(n.id)}`,
        notification: n,
        isUnseen: false,
      });
    }
  }
  return rows;
});

const virtualizer = useVirtualizer(
  computed(() => ({
    count: allRows.value.length,
    getScrollElement: () => scrollViewportRef.value,
    estimateSize: (index: number) => {
      const row = allRows.value[index];
      return row?.type === "section-header" ? 32 : 56;
    },
    getItemKey: (index: number) => allRows.value[index]?.key ?? index,
    overscan: 8,
  }))
);

function measureRowElement(node: unknown) {
  if (node === null || node instanceof Element) {
    virtualizer.value.measureElement(node);
  }
}

const virtualItems = computed<VirtualListItem[]>(() =>
  virtualizer.value.getVirtualItems().flatMap((virtualItem) => {
    const row = allRows.value[virtualItem.index];
    return row ? [{ virtualItem, row }] : [];
  })
);

const virtualContainerStyle = computed(() => ({
  "--virtual-height": `${virtualizer.value.getTotalSize()}px`,
}));

function remeasureVirtualRows() {
  void nextTick(() => {
    virtualizer.value.measure();
  }).catch(logFailure("measure notification rows"));
}

watch(allRows, () => {
  remeasureVirtualRows();
});
</script>
