<template>
  <div class="x-container x-container-auto-height">
    <div class="flex shrink-0 min-w-0 flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" @click="goBack">
        <ArrowLeft />
        {{ t(selectedJam ? "view.tools.jams.title" : "nav_tooltip.tools") }}
      </Button>
      <span class="header min-w-0 flex-1 basis-0 truncate" :title="title">{{ title }}</span>
      <ToggleGroup v-if="!selectedJam" class="ml-auto" type="single" variant="outline" size="sm" :model-value="type" @update:model-value="selectType">
        <ToggleGroupItem value="world">{{ t("view.tools.jams.world") }}</ToggleGroupItem>
        <ToggleGroupItem value="avatar">{{ t("view.tools.jams.avatar") }}</ToggleGroupItem>
      </ToggleGroup>
    </div>

    <div class="my-2 min-h-0 min-w-0 overflow-y-auto" :aria-busy="isLoading">
      <Spinner v-if="isLoading" class="mx-auto my-4" />
      <Button v-else-if="hasError" size="sm" variant="outline" @click="loadRows">{{ t("common.actions.retry") }}</Button>
      <DataTableEmpty v-else-if="!rowCount" />
      <Table v-else-if="selectedJam" class="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>{{ t("view.tools.jams.submission") }}</TableHead>
            <TableHead class="w-24">{{ t("view.tools.jams.submitted") }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="submission in visibleSubmissions" :key="submission.id">
            <TableCell>
              <Button
                size="sm"
                variant="ghost"
                class="w-full min-w-0 justify-start px-0"
                :title="submission.description || submission.contentId"
                @click="openSubmission(submission.contentId)"
              >
                <span class="truncate">{{ submission.description || submission.contentId }}</span>
              </Button>
            </TableCell>
            <TableCell class="truncate">{{ formatDateFilter(submission.created_at, "short") }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Table v-else class="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead>{{ t("view.tools.jams.title") }}</TableHead>
            <TableHead class="w-24">{{ t("view.tools.jams.state") }}</TableHead>
            <TableHead class="w-24 max-sm:hidden">{{ t("view.tools.jams.opens") }}</TableHead>
            <TableHead class="w-24">{{ t("view.tools.jams.closes") }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="jam in visibleJams" :key="jam.id">
            <TableCell>
              <Button size="sm" variant="ghost" class="w-full min-w-0 justify-start px-0" :title="jam.title" @click="selectJam(jam)">
                <span class="truncate">{{ jam.title }}</span>
              </Button>
            </TableCell>
            <TableCell>
              <Badge variant="outline" class="max-w-full" :title="jamState(jam.state)">
                <span class="truncate">{{ jamState(jam.state) }}</span>
              </Badge>
            </TableCell>
            <TableCell class="truncate max-sm:hidden">{{ dateLabel(jam.stateChangeDates.submissionsOpened) }}</TableCell>
            <TableCell class="truncate">{{ dateLabel(jam.stateChangeDates.submissionsClosed ?? jam.stateChangeDates.closed) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <div v-if="!isLoading && !hasError && rowCount > pageSize" class="flex shrink-0 justify-end gap-2">
      <Button size="sm" variant="outline" :disabled="page === 0" @click="page--">{{ t("table.pagination.previous") }}</Button>
      <Button size="sm" variant="outline" :disabled="(page + 1) * pageSize >= rowCount" @click="page++">{{ t("table.pagination.next") }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft } from "lucide-vue-next";
import { computed, onActivated, ref, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { jamRequest, type JamType } from "@/api/jam";
import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Table from "@/components/ui/table/Table.vue";
import TableBody from "@/components/ui/table/TableBody.vue";
import TableCell from "@/components/ui/table/TableCell.vue";
import TableHead from "@/components/ui/table/TableHead.vue";
import TableHeader from "@/components/ui/table/TableHeader.vue";
import TableRow from "@/components/ui/table/TableRow.vue";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import { showAvatarDialog } from "@/coordinators/avatar-coordinator";
import { formatDateFilter } from "@/coordinators/date-coordinator";
import { showWorldDialog } from "@/coordinators/world-coordinator";
import { logError } from "@/stores/vrcx-messages";
import type { Json } from "@/types/vrcx";
import type { Jam, JamSubmission } from "vrchat";

defineOptions({ name: "JamsView" });

const { t } = useI18n();
const router = useRouter();
const type = ref<JamType>("world");
const selectedJam = shallowRef<Json<Jam>>();
const jams = shallowRef<Json<Jam>[]>([]);
const submissions = shallowRef<Json<JamSubmission>[]>([]);
const page = ref(0);
const pageSize = 12;
const isLoading = ref(false);
const hasError = ref(false);
const title = computed(() => selectedJam.value?.title ?? t("view.tools.jams.title"));
const rowCount = computed(() => (selectedJam.value ? submissions.value.length : jams.value.length));
const pageStart = computed(() => page.value * pageSize);
const visibleJams = computed(() => jams.value.slice(pageStart.value, pageStart.value + pageSize));
const visibleSubmissions = computed(() => submissions.value.slice(pageStart.value, pageStart.value + pageSize));
let generation = 0;

onActivated(() => void loadRows().catch(logError));

async function loadRows() {
  const requestGeneration = ++generation;
  isLoading.value = true;
  hasError.value = false;
  try {
    const jam = selectedJam.value;
    if (jam) {
      const rows = await jamRequest.getSubmissions(jam.id);
      if (requestGeneration === generation) submissions.value = rows;
    } else {
      const rows = await jamRequest.getJams(type.value);
      if (requestGeneration === generation) jams.value = rows;
    }
  } catch (error) {
    if (requestGeneration === generation) hasError.value = true;
    logError(error);
  } finally {
    if (requestGeneration === generation) isLoading.value = false;
  }
}

function selectType(value: unknown) {
  if ((value !== "world" && value !== "avatar") || type.value === value) return;
  type.value = value;
  page.value = 0;
  void loadRows().catch(logError);
}

function selectJam(jam: Json<Jam>) {
  selectedJam.value = jam;
  page.value = 0;
  void loadRows().catch(logError);
}

function goBack() {
  if (selectedJam.value) {
    selectedJam.value = undefined;
    page.value = 0;
    void loadRows().catch(logError);
  } else {
    void router.push({ name: "tools" }).catch(logError);
  }
}

function openSubmission(contentId: string) {
  if (contentId.startsWith("avtr_")) showAvatarDialog(contentId);
  else if (contentId.startsWith("wrld_")) showWorldDialog(contentId);
}

function jamState(state: string) {
  if (state === "submissions_open") return t("view.tools.jams.open");
  if (state === "closed") return t("view.tools.jams.closed");
  return state;
}

function dateLabel(date: string | null | undefined) {
  return date ? formatDateFilter(date, "short") : "—";
}
</script>
