<template>
  <div class="flex min-h-0 min-w-0 flex-col gap-2">
    <div class="min-h-0 overflow-y-auto" :aria-busy="isLoading">
      <Table class="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" class="w-1/3">{{ t("table.friendLog.date") }}</TableHead>
            <TableHead scope="col">{{ columnLabel }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="item in items" :key="item.id">
            <TableCell class="align-top"
              ><time class="block truncate tabular-nums" :datetime="item.at" :title="item.date">{{ item.date }}</time></TableCell
            >
            <TableCell>
              <div class="flex min-w-0 items-center gap-2">
                <Avatar v-if="kind === 'avatar'" class="size-7 shrink-0 rounded">
                  <AvatarImage v-if="item.image" :src="item.image" alt="" class="object-cover" />
                  <AvatarFallback class="rounded"><Image class="size-4 text-muted-foreground" aria-hidden="true" /></AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <span class="block truncate" :title="item.title">{{ item.title }}</span>
                  <Location
                    v-if="item.location"
                    :location="item.location"
                    :hint="item.worldName"
                    :grouphint="item.groupName"
                    :can-fetch-names="false"
                    has-full-text-tooltip
                    enable-context-menu
                    class="min-w-0 text-xs text-muted-foreground"
                    :title="item.location"
                  />
                  <ProfileHistoryTags v-else-if="item.tags" :tags="item.tags" />
                  <span v-else-if="item.detail" class="block truncate text-xs text-muted-foreground" :title="item.detail">{{ item.detail }}</span>
                </div>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div v-if="isLoading" role="status" class="flex justify-center p-4"><Spinner /></div>
      <div v-else-if="hasError" role="alert" class="flex flex-wrap items-center justify-center gap-2 p-3 text-sm">
        {{ t("view.tools.people_patterns.load_failed") }}
        <Button size="sm" variant="outline" @click="load(requestedPage)">{{ t("common.actions.retry") }}</Button>
      </div>
      <DataTableEmpty v-else-if="!items.length" />
    </div>
    <div v-if="page || hasNext" class="flex shrink-0 justify-end gap-2">
      <Button size="sm" variant="outline" :disabled="isLoading || !page" @click="load(page - 1)">{{ t("table.pagination.previous") }}</Button>
      <Button size="sm" variant="outline" :disabled="isLoading || !hasNext" @click="load(page + 1)">{{ t("table.pagination.next") }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Image } from "lucide-vue-next";
import Avatar from "@/components/ui/avatar/Avatar.vue";
import AvatarImage from "@/components/ui/avatar/AvatarImage.vue";
import AvatarFallback from "@/components/ui/avatar/AvatarFallback.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Table from "@/components/ui/table/Table.vue";
import TableBody from "@/components/ui/table/TableBody.vue";
import TableCell from "@/components/ui/table/TableCell.vue";
import TableHead from "@/components/ui/table/TableHead.vue";
import TableHeader from "@/components/ui/table/TableHeader.vue";
import TableRow from "@/components/ui/table/TableRow.vue";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import { retainedEvents, type HistoryRow } from "@/services/database/retained-events";
import Location from "@/components/Location.vue";
import ProfileHistoryTags from "./ProfileHistoryTags.vue";
import { historyText } from "./history-text";

const props = defineProps<{ kind: "avatar" | "profile" | "platform" | "favorite"; userId?: string }>();
const { t } = useI18n();
const rows = shallowRef<HistoryRow[]>([]);
const pageSize = 25;
const cursors: (number | null)[] = [null];
const isLoading = ref(false);
const hasNext = ref(false);
const hasError = ref(false);
const page = ref(0);
const requestedPage = ref(0);
let revision = 0;
const columnLabel = computed(() =>
  t(
    { avatar: "table.playerList.avatar", profile: "dialog.retained_history.profile", platform: "table.playerList.platform", favorite: "nav_tooltip.favorites" }[
      props.kind
    ]
  )
);
const items = computed(() =>
  rows.value.map((row) => {
    let title = row.detail;
    let detail = "";
    let image = "";
    let location = "";
    let tags: string[] | undefined;
    switch (props.kind) {
      case "avatar": {
        title = historyText(row.data, "avatarName") || row.detail;
        image = historyText(row.data, "thumbnailImageUrl") || historyText(row.data, "imageUrl");
        location = historyText(row.data, "location");
        break;
      }
      case "profile": {
        if (row.detail === "bio") title = t("dialog.user.info.bio");
        if (row.detail === "pronouns") title = t("dialog.user.pronouns");
        if (row.detail === "tags") title = t("dialog.avatar.info.tags");
        if (row.detail === "tags" && Array.isArray(row.data)) tags = row.data.filter((tag: unknown) => typeof tag === "string");
        else detail = typeof row.data === "string" && row.data ? row.data : t("dialog.retained_history.cleared");
        break;
      }
      case "platform": {
        const platform = historyText(row.data, "platform");
        title = ["standalonewindows", "android", "ios"].includes(platform) ? t(`view.tools.instance_browser.platform_${platform}`) : platform;
        detail = row.detail === "Online" ? t("dialog.user.status.online") : row.detail === "Offline" ? t("dialog.user.status.offline") : row.detail;
        break;
      }
      case "favorite": {
        const action = historyText(row.data, "action");
        const name = historyText(row.data, "name") || row.subject;
        title = action === "add" ? t("dialog.retained_history.added", { name }) : action === "remove" ? t("dialog.retained_history.removed", { name }) : name;
        const type = row.detail.replace(/^remote-/, "");
        const group = historyText(row.data, "group");
        const typeLabel =
          type === "friend" ? t("view.tools.people_patterns.friend") : type === "world" || type === "avatar" ? t(`view.tools.jams.${type}`) : type;
        detail = [t(row.detail.startsWith("remote-") ? "dialog.favorite.vrchat_favorites" : "dialog.favorite.local_favorites"), typeLabel, group]
          .filter(Boolean)
          .join(" · ");
        break;
      }
    }
    return {
      id: row.id,
      at: row.createdAt,
      date: formatDateFilter(row.createdAt, "long"),
      title,
      detail,
      location,
      worldName: historyText(row.data, "worldName"),
      groupName: historyText(row.data, "groupName"),
      tags,
      image,
    };
  })
);

function read(before: number | null) {
  const limit = pageSize + 1;
  if (props.kind === "favorite") return retainedEvents.getFavoriteHistory(limit, before);
  if (!props.userId) return Promise.resolve([]);
  if (props.kind === "profile") return retainedEvents.getProfileHistory(props.userId, limit, before);
  if (props.kind === "platform") return retainedEvents.getFriendPlatformHistory(props.userId, limit, before);
  return retainedEvents.getPlayerAvatarHistory(props.userId, limit, before);
}

async function load(target: number) {
  const current = ++revision;
  requestedPage.value = target;
  isLoading.value = true;
  hasError.value = false;
  try {
    const result = await read(cursors[target] ?? null);
    if (current !== revision) return;
    rows.value = result.slice(0, pageSize);
    page.value = target;
    hasNext.value = result.length > pageSize;
    const last = rows.value.at(-1);
    if (last) cursors.splice(target + 1, cursors.length, last.id);
  } catch {
    if (current === revision) hasError.value = true;
  } finally {
    if (current === revision) isLoading.value = false;
  }
}
watch(
  () => [props.kind, props.userId],
  () => {
    rows.value = [];
    page.value = 0;
    hasNext.value = false;
    cursors.splice(1);
    void load(0).catch(console.error);
  },
  { immediate: true }
);
</script>
