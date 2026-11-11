<template>
  <div class="x-container x-container--auto-height">
    <DataTableLayout
      :table="table"
      :loading="isNotificationsLoading"
      auto-height
      :page-sizes="pageSizes"
      :total-items="totalItems"
      :on-page-size-change="handlePageSizeChange"
    >
      <template #toolbar>
        <div class="mb-2 flex justify-between items-center gap-2">
          <Select
            multiple
            :model-value="Array.isArray(notificationTable.filters?.[0]?.value) ? notificationTable.filters[0].value : []"
            @update:model-value="handleNotificationFilterChange"
          >
            <SelectTrigger class="max-w-1/2 min-w-50">
              <SelectValue :placeholder="t('view.notification.filter_placeholder')" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem
                  v-for="type in [
                    'requestInvite',
                    'invite',
                    'requestInviteResponse',
                    'inviteResponse',
                    'friendRequest',
                    'ignoredFriendRequest',
                    'message',
                    'boop',
                    'event.announcement',
                    'groupChange',
                    'group.announcement',
                    'group.informative',
                    'group.invite',
                    'group.joinRequest',
                    'group.transfer',
                    'group.queueReady',
                    'group.event.created',
                    'group.event.starting',
                    'moderation.warning.group',
                    'moderation.report.closed',
                    'moderation.contentrestriction',
                    'instance.closed',
                    'economy.alert',
                    'twitchdrop.fulfilled',
                  ]"
                  :key="type"
                  :value="type"
                >
                  {{ t("view.notification.filters." + type) }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <div class="flex flex-row justify-end">
            <InputGroupField
              v-model="notificationTable.filters[1].value"
              :placeholder="t('view.notification.search_placeholder')"
              clearable
              class="flex-[0.4] my-0 mx-2 min-w-50"
            />
            <TooltipWrapper side="bottom" :content="t('view.notification.refresh_tooltip')">
              <Button
                class="rounded-full"
                variant="ghost"
                size="icon-sm"
                :disabled="isNotificationsLoading"
                style="flex: none"
                :aria-label="t('view.notification.refresh_tooltip')"
                @click="refreshNotifications()"
              >
                <Spinner v-if="isNotificationsLoading" />
                <RefreshCw v-else />
              </Button>
            </TooltipWrapper>
          </div>
        </div>
      </template>
    </DataTableLayout>
    <SendInviteResponseDialog
      v-model:send-invite-response-dialog="sendInviteResponseDialog"
      v-model:send-invite-response-dialog-visible="sendInviteResponseDialogVisible"
    />
    <SendInviteRequestResponseDialog
      v-model:send-invite-response-dialog="sendInviteResponseDialog"
      v-model:send-invite-request-response-dialog-visible="sendInviteRequestResponseDialogVisible"
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
import { computed, onMounted, ref } from "vue";
import Button from "@/components/ui/button/Button.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import { RefreshCw } from "lucide-vue-next";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import dayjs from "dayjs";

import { useAppearanceSettingsStore } from "../../stores/settings/appearance";
import { useGalleryStore } from "../../stores/gallery";
import { useInviteStore } from "../../stores/invite";
import { useNotificationStore } from "../../stores/notification";
import { useVrcxStore } from "../../stores/vrcx";
import { logFailure } from "../../stores/log-failure";
import DataTableLayout from "../../components/ui/data-table/DataTableLayout.vue";
import { convertFileUrlToImageUrl } from "../../shared/utils/common";
import { createColumns } from "./columns.tsx";
import type { NotificationRow } from "./columns.tsx";
import { useVrcxVueTable } from "../../lib/table/use-vrcx-vue-table";

import SendInviteRequestResponseDialog from "./dialogs/SendInviteRequestResponseDialog.vue";
import SendInviteResponseDialog from "./dialogs/SendInviteResponseDialog.vue";
import type { InviteResponseSelection } from "./dialogs/send-invite-response-columns.tsx";
import { configRepository } from "../../services/config";

defineOptions({ name: "NotificationView" });

const { refreshInviteMessageTableData } = useInviteStore();
const { clearInviteImageUpload } = useGalleryStore();
const { notificationTable, isNotificationsLoading } = storeToRefs(useNotificationStore());
const {
  refreshNotifications,
  acceptFriendRequestNotification,
  hideNotification,
  hideNotificationPrompt,
  acceptRequestInvite,
  sendNotificationResponse,
  deleteNotificationLog,
  deleteNotificationLogPrompt,
  openNotificationLink,
  markAllAsSeen,
} = useNotificationStore();
const { showFullscreenImageDialog } = useGalleryStore();
const appearanceSettingsStore = useAppearanceSettingsStore();
const vrcxStore = useVrcxStore();

const { t } = useI18n();

type CreatedAtSource = { created_at?: unknown; createdAt?: unknown };
type NotificationFilterValue = { prop: string | string[]; value: string | string[] };

function getNotificationCreatedAt(row: CreatedAtSource): string {
  if (typeof row.created_at === "string" && row.created_at.length > 0) {
    return row.created_at;
  }
  if (typeof row.createdAt === "string" && row.createdAt.length > 0) {
    return row.createdAt;
  }
  return "";
}

function getNotificationCreatedAtTs(row: CreatedAtSource): number {
  const createdAtRaw = row.created_at ?? row.createdAt;
  if (typeof createdAtRaw === "number") {
    const ts = createdAtRaw > 1_000_000_000_000 ? createdAtRaw : createdAtRaw * 1000;
    return Number.isFinite(ts) ? ts : 0;
  }

  const createdAt = getNotificationCreatedAt(row);
  const ts = dayjs(createdAt).valueOf();
  return Number.isFinite(ts) ? ts : 0;
}

function isEmptyFilterValue(value: unknown): boolean {
  return Array.isArray(value) ? value.length === 0 : !value;
}

function isString(item: unknown): item is string {
  return typeof item === "string";
}

function applyFilter(row: Record<string, unknown>, filter: NotificationFilterValue): boolean {
  if (Array.isArray(filter.prop)) {
    return filter.prop.some((propItem) => applyFilter(row, { prop: propItem, value: filter.value }));
  }

  const cellValue = row[filter.prop];
  if (typeof cellValue !== "string" && typeof cellValue !== "number" && typeof cellValue !== "boolean") {
    return false;
  }

  if (Array.isArray(filter.value)) {
    return filter.value.some((val) => String(cellValue).toLowerCase() === val.toLowerCase());
  }
  return String(cellValue).toLowerCase().includes(filter.value.toLowerCase());
}

const notificationDisplayData = computed(() => {
  const rawData = notificationTable.value.data;
  const activeFilters = notificationTable.value.filters.filter((filter) => !isEmptyFilterValue(filter.value));

  if (activeFilters.length === 0) {
    return rawData.slice();
  }

  return rawData.filter((row) => activeFilters.every((filter) => applyFilter(row, filter)));
});

const columns = createColumns({
  getNotificationCreatedAt,
  getNotificationCreatedAtTs,
  openNotificationLink,
  showFullscreenImageDialog: (imageUrl) => showFullscreenImageDialog(imageUrl, ""),
  getSmallThumbnailUrl,
  acceptFriendRequestNotification,
  showSendInviteResponseDialog,
  showSendInviteRequestResponseDialog,
  acceptRequestInvite,
  sendNotificationResponse,
  hideNotification: (row) => {
    void hideNotification(row).catch(logFailure("Hiding notification failed:"));
  },
  hideNotificationPrompt,
  deleteNotificationLog,
  deleteNotificationLogPrompt,
});

const pageSizes = computed(() => appearanceSettingsStore.tablePageSizes);

const { table, pagination } = useVrcxVueTable<NotificationRow>({
  persistKey: "notifications",
  get data() {
    return notificationDisplayData.value;
  },
  columns,
  getRowId: (row) => row.id ?? `${row.type}:${row.senderUserId ?? ""}:${row.created_at}`,
  initialSorting: [{ id: "created_at", desc: true }],
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

const sendInviteResponseDialog = ref<InviteResponseSelection>({
  messageSlot: {},
  invite: {},
});

const sendInviteResponseDialogVisible = ref(false);

const sendInviteRequestResponseDialogVisible = ref(false);

function saveTableFilters() {
  void configRepository
    .setString("VRCX_notificationTableFilters", JSON.stringify(notificationTable.value.filters[0].value))
    .catch(logFailure("Saving notification filters failed:"));
}

function handleNotificationFilterChange(value: unknown) {
  notificationTable.value.filters[0].value = Array.isArray(value) ? value.filter(isString) : [];
  saveTableFilters();
}

function getSmallThumbnailUrl(url: string) {
  return convertFileUrlToImageUrl(url);
}

function showSendInviteResponseDialog(invite: NotificationRow) {
  sendInviteResponseDialog.value.invite = invite;
  sendInviteResponseDialog.value.messageSlot = {};
  refreshInviteMessageTableData("response");
  clearInviteImageUpload();
  sendInviteResponseDialogVisible.value = true;
}

function showSendInviteRequestResponseDialog(invite: NotificationRow) {
  sendInviteResponseDialog.value.invite = invite;
  sendInviteResponseDialog.value.messageSlot = {};
  refreshInviteMessageTableData("requestResponse");
  clearInviteImageUpload();
  sendInviteRequestResponseDialogVisible.value = true;
}

onMounted(() => {
  markAllAsSeen();
});
</script>
