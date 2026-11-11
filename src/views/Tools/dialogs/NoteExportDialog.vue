<template>
  <Dialog :open="isNoteExportDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.note_export.header") }}</DialogTitle>
      </DialogHeader>
      <div class="text-xs">
        {{ t("dialog.note_export.description1") }} <br />
        {{ t("dialog.note_export.description2") }} <br />
        {{ t("dialog.note_export.description3") }} <br />
        {{ t("dialog.note_export.description4") }} <br />
        {{ t("dialog.note_export.description5") }} <br />
        {{ t("dialog.note_export.description6") }} <br />
        {{ t("dialog.note_export.description7") }} <br />
        {{ t("dialog.note_export.description8") }} <br />
      </div>

      <Button size="sm" class="mr-2 mt-2" variant="outline" :disabled="loading" @click="updateNoteExportDialog">
        {{ t("dialog.note_export.refresh") }}
      </Button>
      <Button size="sm" class="mr-2 mt-2" variant="outline" :disabled="loading" @click="exportNoteExport">
        {{ t("dialog.note_export.export") }}
      </Button>
      <Button v-if="loading" class="mt-2" size="sm" variant="outline" @click="cancelNoteExport">
        {{ t("dialog.note_export.cancel") }}
      </Button>
      <span v-if="loading" class="m-2">
        <Spinner class="inline-block ml-2 mr-2" />
        {{ t("dialog.note_export.progress") }} {{ progress }}/{{ progressTotal }}
      </span>

      <template v-if="errors">
        <Button size="sm" variant="outline" @click="errors = ''">
          {{ t("dialog.note_export.clear_errors") }}
        </Button>
        <h2 class="m-0 font-bold">
          {{ t("dialog.note_export.errors") }}
        </h2>
        <pre class="whitespace-pre-wrap text-xs" v-text="errors"></pre>
      </template>

      <DataTableLayout class="min-w-0 w-full mt-2" :table="table" :loading="loading" :table-style="tableStyle" :show-pagination="false" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableLayout from "@/components/ui/data-table/DataTableLayout.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { removeFromArray } from "../../../shared/utils/base/array";
import { useUserDisplay } from "../../../composables/use-user-display";
import { useFriendStore } from "../../../stores/friend";
import { useGalleryStore } from "../../../stores/gallery";
import { createColumns, type NoteExportRow } from "./note-export-columns.tsx";
import { miscRequest } from "../../../api/misc";
import { useVrcxVueTable } from "../../../lib/table/use-vrcx-vue-table";

import * as workerTimers from "worker-timers";
import { showUserDialog } from "../../../coordinators/user-coordinator";

const { userImage, userImageFull } = useUserDisplay();
const { t } = useI18n();

const { friends } = storeToRefs(useFriendStore());

const { showFullscreenImageDialog } = useGalleryStore();

const props = withDefaults(
  defineProps<{
    isNoteExportDialogVisible?: boolean | undefined;
  }>(),
  {
    isNoteExportDialogVisible: false,
  }
);

const noteExportTable = ref<{ data: NoteExportRow[] }>({
  data: [],
});

const tableStyle = { maxHeight: "500px" };

const rows = computed(() => noteExportTable.value.data.slice());

const columns = computed(() =>
  createColumns({
    userImage,
    userImageFull,
    onShowFullscreenImage: showFullscreenImageDialog,
    onShowUser: showUserDialog,
    onRemove: removeFromNoteExportTable,
  })
);

const { table } = useVrcxVueTable({
  persistKey: "noteExportDialog",
  get data() {
    return rows.value;
  },
  columns: columns.value,
  getRowId: (row) => row.id,
  enablePagination: false,
  enableSorting: false,
});

const progress = ref(0);
const progressTotal = ref(0);
const loading = ref(false);
const errors = ref("");

watch(
  () => props.isNoteExportDialogVisible,
  (isVisible) => {
    if (isVisible) {
      initData();
    }
  }
);

function initData() {
  noteExportTable.value.data = [];
  progress.value = 0;
  progressTotal.value = 0;
  loading.value = false;
  errors.value = "";
}

const emit = defineEmits<{
  close: [];
}>();

function updateNoteExportDialog() {
  const data: NoteExportRow[] = [];
  friends.value.forEach((ctx) => {
    const ref = ctx.ref;
    if (!ref) return;
    const memo = ref.$memo || "";
    const newMemo = memo.replace(/[\r\n]/g, " ");
    if (memo && ref.note !== newMemo.slice(0, 256)) {
      data.push({
        id: ctx.id,
        name: ctx.name,
        memo: newMemo,
        ref,
      });
    }
  });
  noteExportTable.value.data = data;
}

function isExportRunning(): boolean {
  return loading.value;
}

async function exportNoteExport() {
  let ctx: NoteExportRow | undefined;

  loading.value = true;
  const data = [...noteExportTable.value.data];
  progressTotal.value = data.length;
  try {
    for (const row of data) {
      if (props.isNoteExportDialogVisible && isExportRunning()) {
        ctx = row;
        await miscRequest.saveNote({
          targetUserId: row.id,
          note: row.memo.slice(0, 256),
        });
        removeFromArray(noteExportTable.value.data, row);
        progress.value++;
        await new Promise<void>((resolve) => {
          workerTimers.setTimeout(resolve, 5000);
        });
      }
    }
  } catch (err) {
    errors.value = `Name: ${ctx?.name ?? ""}\n${String(err)}\n\n`;
  } finally {
    progress.value = 0;
    progressTotal.value = 0;
    loading.value = false;
  }
}

function cancelNoteExport() {
  loading.value = false;
}

function removeFromNoteExportTable(row: NoteExportRow) {
  removeFromArray(noteExportTable.value.data, row);
}

function closeDialog() {
  emit("close");
}
</script>
