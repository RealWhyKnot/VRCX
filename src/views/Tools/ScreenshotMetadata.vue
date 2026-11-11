<template>
  <div class="screenshot-metadata-page x-container flex flex-col overflow-hidden">
    <div class="flex items-center gap-2 ml-2">
      <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
        <ArrowLeft />
        {{ t("nav_tooltip.tools") }}
      </Button>
      <span class="header">{{ t("dialog.screenshot_metadata.header") }}</span>
    </div>

    <div class="flex items-center gap-2 my-2 flex-wrap">
      <Button size="sm" variant="outline" @click="getAndDisplayScreenshotFromFile">
        <FolderSearch />
        {{ t("dialog.screenshot_metadata.browse") }}
      </Button>
      <Button size="sm" variant="outline" @click="getAndDisplayLastScreenshot">
        <ImageIcon />
        {{ t("dialog.screenshot_metadata.last_screenshot") }}
      </Button>
      <Button
        v-if="screenshotMetadataDialog.metadata.filePath"
        size="sm"
        variant="outline"
        @click="openImageFolder(screenshotMetadataDialog.metadata.filePath)"
      >
        <FolderOpen />
        {{ t("dialog.screenshot_metadata.open_folder") }}
      </Button>
      <div class="flex-1" />
      <InputGroupSearch
        v-model="screenshotMetadataDialog.search"
        :placeholder="t('dialog.screenshot_metadata.search_placeholder')"
        class="w-[200px]"
        @input="screenshotMetadataSearch"
      />
      <Select :model-value="screenshotMetadataDialog.searchType" @update:model-value="handleSearchTypeChange">
        <SelectTrigger size="sm" class="w-[150px]">
          <SelectValue :placeholder="t('dialog.screenshot_metadata.search_type_placeholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="type in screenshotMetadataDialog.searchTypes" :key="type" :value="type">
              {{ t(screenshotMetadataSearchTypeLabels.get(type) ?? type) }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <span v-if="searchViewMode === 'table' && searchResultsData.length" class="whitespace-pre-wrap text-xs">{{
        t("dialog.screenshot_metadata.result_count", { count: searchResultsData.length })
      }}</span>
      <span v-else-if="screenshotMetadataDialog.searchIndex !== null && screenshotMetadataDialog.searchResults" class="whitespace-pre-wrap text-xs">{{
        screenshotMetadataDialog.searchIndex + 1 + "/" + screenshotMetadataDialog.searchResults.length
      }}</span>
    </div>

    <ScreenshotSearchTable
      v-if="searchViewMode === 'table'"
      :rows="sortedSearchResults"
      :sort="searchSort"
      :has-match-column="searchHasMatchColumn"
      :selected-file-path="selectedSearchFilePath"
      @sort="toggleSearchSort"
      @select="selectSearchResult"
    />

    <div v-else class="grid flex-1 min-h-0 overflow-hidden gap-4 grid-cols-[1fr_380px]">
      <div class="flex flex-col items-center min-h-0" @dragover.prevent @dragenter.prevent @drop="handleDrop">
        <div class="relative flex-1 w-full min-h-0 flex items-center justify-center">
          <template v-if="screenshotMetadataDialog.metadata.filePath">
            <img
              class="cursor-pointer max-w-full max-h-full object-contain"
              :src="screenshotMetadataDialog.metadata.filePath"
              @click="showMetadataImageFullscreen(screenshotMetadataDialog.metadata.filePath)"
            />
            <Button
              variant="ghost"
              size="icon"
              class="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity bg-background/50 rounded-full"
              @click="navigatePrev"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 hover:opacity-100 transition-opacity bg-background/50 rounded-full"
              @click="navigateNext"
            >
              <ChevronRight />
            </Button>
          </template>
          <span v-else class="text-muted-foreground text-sm">{{ t("dialog.screenshot_metadata.drag") }}</span>
        </div>
        <div class="shrink-0 flex items-center justify-center h-[50px]">
          <ButtonGroup class="shadow-lg rounded-lg">
            <Button variant="outline" size="sm" @click="navigatePrev">
              <ArrowLeft />
              <Kbd class="ml-1">{{ isMac ? "⌥" : "Alt" }}</Kbd>
              <Kbd>←</Kbd>
            </Button>
            <Button variant="outline" size="sm" @click="navigateNext">
              <Kbd class="ml-1">{{ isMac ? "⌥" : "Alt" }}</Kbd>
              <Kbd>→</Kbd>
              <ArrowRight />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div class="overflow-y-auto pr-1">
        <Button v-if="searchResultsData.length" variant="ghost" size="sm" class="mb-2" @click="searchViewMode = 'table'">
          <ArrowLeft class="size-3.5" />
          {{ t("dialog.screenshot_metadata.back_to_results", { count: searchResultsData.length }) }}
        </Button>
        <template v-if="screenshotMetadataDialog.metadata.error">
          <pre class="whitespace-pre-wrap text-xs" v-text="screenshotMetadataDialog.metadata.error"></pre>
        </template>
        <template v-else>
          <div v-if="screenshotMetadataDialog.metadata.world || screenshotMetadataDialog.metadata.author" class="pb-4">
            <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
              {{ t("dialog.screenshot_metadata.section_location") }}
            </h4>
            <Location
              v-if="screenshotMetadataDialog.metadata.world"
              :location="screenshotMetadataDialog.metadata.world.instanceId"
              :hint="screenshotMetadataDialog.metadata.world.name"
            />
            <div v-if="screenshotMetadataDialog.metadata.author" class="flex items-center gap-1 text-muted-foreground">
              <Camera class="size-3.5 shrink-0" />
              <DisplayName :userid="screenshotMetadataDialog.metadata.author.id" :hint="screenshotMetadataDialog.metadata.author.displayName" />
            </div>
          </div>

          <div v-if="screenshotMetadataDialog.metadata.players?.length" class="border-t pt-4 pb-4">
            <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
              {{ t("dialog.screenshot_metadata.section_players") }} ({{ screenshotMetadataDialog.metadata.players.length }})
            </h4>
            <div class="flex flex-wrap gap-1 max-h-[180px] overflow-y-auto">
              <Badge
                v-for="(user, index) in screenshotMetadataDialog.metadata.players"
                :key="index"
                variant="secondary"
                class="cursor-pointer hover:bg-accent transition-colors"
                @click="lookupUser(toLookupRef(user))"
              >
                {{ user.displayName }}
              </Badge>
            </div>
          </div>

          <div class="border-t pt-4 pb-4">
            <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
              {{ t("dialog.screenshot_metadata.section_file_info") }}
            </h4>
            <span v-if="screenshotMetadataDialog.metadata.dateTime" class="text-sm">{{
              formatDateFilter(new Date(screenshotMetadataDialog.metadata.dateTime).toISOString(), "long")
            }}</span>
            <br />
            <span class="text-xs text-muted-foreground">
              <span v-if="screenshotMetadataDialog.metadata.fileResolution" v-text="screenshotMetadataDialog.metadata.fileResolution"></span>
              <span v-if="screenshotMetadataDialog.metadata.fileResolution && screenshotMetadataDialog.metadata.fileSize"> · </span>
              <span v-if="screenshotMetadataDialog.metadata.fileSize">{{ screenshotMetadataDialog.metadata.fileSize }}</span>
            </span>
            <br />
            <span class="text-xs text-muted-foreground/60" v-text="screenshotMetadataDialog.metadata.fileName"></span>
          </div>

          <div v-if="screenshotMetadataDialog.metadata.note" class="border-t pt-4 pb-4">
            <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
              {{ t("dialog.screenshot_metadata.section_note") }}
            </h4>
            <span class="text-sm text-muted-foreground" v-text="screenshotMetadataDialog.metadata.note"></span>
          </div>

          <div v-if="screenshotMetadataDialog.metadata.filePath" class="border-t pt-4 pb-4">
            <h4 class="text-[11px] font-medium uppercase tracking-[0.08em] mb-1.5 text-muted-foreground">
              {{ t("dialog.screenshot_metadata.section_actions") }}
            </h4>
            <div class="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" @click="copyImageToClipboard(screenshotMetadataDialog.metadata.filePath)">
                <Copy />
                {{ t("dialog.screenshot_metadata.copy_image") }}
              </Button>
              <Button
                v-if="isLocalUserVrcPlusSupporter && screenshotMetadataDialog.metadata.filePath"
                size="sm"
                variant="outline"
                @click="uploadScreenshotToGallery"
              >
                <Upload />
                {{ t("dialog.screenshot_metadata.upload") }}
              </Button>
              <Button
                v-if="screenshotMetadataDialog.metadata.filePath"
                size="sm"
                variant="destructive"
                @click="deleteMetadata(screenshotMetadataDialog.metadata.filePath)"
              >
                <Trash2 />
                {{ t("dialog.screenshot_metadata.delete_metadata") }}
              </Button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Location from "@/components/Location.vue";
import type { AcceptableValue } from "reka-ui";
import { isLinuxHost } from "@/shared/constants/platform";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { onMounted, reactive, ref, computed } from "vue";
import { useGalleryStore } from "@/stores/gallery";
import { useUserStore } from "@/stores/user";
import { useVrcxStore } from "@/stores/vrcx";
import { ArrowLeft, ArrowRight, Camera, ChevronLeft, ChevronRight, Copy, FolderOpen, FolderSearch, ImageIcon, Trash2, Upload } from "lucide-vue-next";
import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import InputGroupSearch from "@/components/ui/input-group/InputGroupSearch.vue";
import Kbd from "@/components/ui/kbd/Kbd.vue";
import ScreenshotSearchTable from "./components/ScreenshotSearchTable.vue";
import { loadSearchResultsMetadata } from "./composables/screenshot-search-results";
import { useScreenshotNavigation } from "./composables/use-screenshot-navigation";
import {
  isString,
  parseJsonRecord,
  readScreenshotMetadata,
  readString,
  toLookupRef,
  type ScreenshotDialogState,
  type ScreenshotSearchRow,
  type ScreenshotSortKey,
} from "./composables/screenshot-metadata-parse";

import { formatDateFilter } from "@/coordinators/date-coordinator";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { vrcPlusImageRequest } from "@/api/vrc-plus-image";
import { lookupUser } from "@/coordinators/user-coordinator";

function logError(error: unknown) {
  console.error(error);
}

const router = useRouter();
const { t } = useI18n();

const isMac = navigator.platform.toUpperCase().includes("MAC");

const { showFullscreenImageDialog, handleGalleryImageAdd } = useGalleryStore();
const { currentlyDroppingFile } = storeToRefs(useVrcxStore());
const { isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const { fullscreenImageDialog } = storeToRefs(useGalleryStore());

const screenshotMetadataDialog = reactive<ScreenshotDialogState>({
  loading: false,
  search: "",
  searchType: "Player Name",
  searchTypes: ["Player Name", "Player ID", "World Name", "World ID"],
  searchIndex: null,
  searchResults: null,
  metadata: {},
  isUploading: false,
});

const screenshotMetadataSearchTypeLabels = new Map<string, string>([
  ["Player Name", "dialog.screenshot_metadata.search_types.player_name"],
  ["Player ID", "dialog.screenshot_metadata.search_types.player_id"],
  ["World Name", "dialog.screenshot_metadata.search_types.world_name"],
  ["World ID", "dialog.screenshot_metadata.search_types.world_id"],
]);

const searchViewMode = ref<"detail" | "table">("detail");
const searchResultsData = ref<ScreenshotSearchRow[]>([]);
const selectedSearchFilePath = ref<string | null>(null);
const searchSort = reactive<{ key: ScreenshotSortKey; asc: boolean }>({ key: "dateTime", asc: false });

const searchHasMatchColumn = computed(() => {
  const type = screenshotMetadataDialog.searchType;
  return type === "Player Name" || type === "Player ID";
});

const sortedSearchResults = computed(() => {
  const data = [...searchResultsData.value];
  const { key, asc } = searchSort;
  data.sort((a, b) => {
    let va: string | number = a[key];
    let vb: string | number = b[key];
    if (typeof va === "string") va = va.toLowerCase();
    if (typeof vb === "string") vb = vb.toLowerCase();
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
  return data;
});

function toggleSearchSort(key: ScreenshotSortKey) {
  if (searchSort.key === key) {
    searchSort.asc = !searchSort.asc;
  } else {
    searchSort.key = key;
    searchSort.asc = key === "dateTime" ? false : true;
  }
}

function selectSearchResult(idx: number) {
  const row = sortedSearchResults.value[idx];
  if (!row) return;
  screenshotMetadataDialog.searchIndex = idx;
  selectedSearchFilePath.value = row.filePath;
  searchViewMode.value = "detail";
  getAndDisplayScreenshot(row.filePath, false);
}

const screenshotMetadataSearchInputs = ref(0);

onMounted(() => {
  if (!screenshotMetadataDialog.metadata.filePath) {
    getAndDisplayLastScreenshot();
  }
});

const { navigatePrev, navigateNext } = useScreenshotNavigation(screenshotMetadataDialog, getAndDisplayScreenshot);

function goBack() {
  void router.push({ name: "tools" }).catch(logError);
}

function handleDrop(event: DragEvent) {
  if (currentlyDroppingFile.value === null) {
    return;
  }
  console.log("Dropped file into viewer: ", currentlyDroppingFile.value);

  screenshotMetadataResetSearch();
  getAndDisplayScreenshot(currentlyDroppingFile.value);

  event.preventDefault();
}

async function getAndDisplayScreenshotFromFile() {
  let filePath: string;

  if (isLinuxHost()) {
    filePath = await window.electron.openFileDialog();
  } else {
    filePath = await window.AppApi.OpenFileSelectorDialog(await window.AppApi.GetVRChatPhotosLocation(), ".png", "PNG Files (*.png)|*.png");
  }

  if (filePath === "") {
    return;
  }

  screenshotMetadataResetSearch();
  getAndDisplayScreenshot(filePath);
}

function getAndDisplayLastScreenshot() {
  screenshotMetadataResetSearch();
  void window.AppApi.GetLastScreenshot()
    .then((path) => {
      if (!path) {
        return;
      }
      getAndDisplayScreenshot(path);
    })
    .catch(logError);
}

function copyImageToClipboard(path: string | undefined) {
  if (!path) {
    return;
  }
  void window.AppApi.CopyImageToClipboard(path)
    .then(() => {
      toast.success("Image copied to clipboard");
    })
    .catch(logError);
}

function openImageFolder(path: string | undefined) {
  if (!path) {
    return;
  }
  void window.AppApi.OpenFolderAndSelectItem(path)
    .then(() => {
      toast.success("Opened image folder");
    })
    .catch(logError);
}

function deleteMetadata(path: string | undefined) {
  if (!path) {
    return;
  }
  void window.AppApi.DeleteScreenshotMetadata(path)
    .then((isDeleted) => {
      if (!isDeleted) {
        toast.error(t("message.screenshot_metadata.delete_failed"));
        return;
      }
      toast.success(t("message.screenshot_metadata.deleted"));
      const D = screenshotMetadataDialog;
      getAndDisplayScreenshot(D.metadata.filePath, true);
    })
    .catch(logError);
}

function uploadScreenshotToGallery() {
  const D = screenshotMetadataDialog;
  const filePath = D.metadata.filePath;
  if (!filePath) {
    return;
  }
  if (Number(D.metadata.fileSizeBytes) > 10000000) {
    toast.error(t("message.file.too_large"));
    return;
  }
  D.isUploading = true;
  void window.AppApi.GetFileBase64(filePath)
    .then((base64Body) => {
      void vrcPlusImageRequest
        .uploadGalleryImage(base64Body ?? "")
        .then((args) => {
          handleGalleryImageAdd(args);
          toast.success(t("message.gallery.uploaded"));
          return args;
        })
        .finally(() => {
          D.isUploading = false;
        })
        .catch(logError);
    })
    .catch((err: unknown) => {
      toast.error(t("message.gallery.failed"));
      console.error(err);
      D.isUploading = false;
    });
}

function screenshotMetadataSearch() {
  const D = screenshotMetadataDialog;

  screenshotMetadataSearchInputs.value++;
  const current = screenshotMetadataSearchInputs.value;
  setTimeout(() => {
    if (current !== screenshotMetadataSearchInputs.value) {
      return;
    }
    screenshotMetadataSearchInputs.value = 0;

    const search = D.search.trim();
    if (search.length < 3) {
      D.searchIndex = null;
      D.searchResults = null;
      searchResultsData.value = [];
      selectedSearchFilePath.value = null;
      searchViewMode.value = "detail";

      if (search.length === 0) {
        screenshotMetadataResetSearch();
        getAndDisplayScreenshot(D.metadata.filePath, true);
      }
      return;
    }

    const searchType = D.searchTypes.indexOf(D.searchType);
    D.loading = true;
    void window.AppApi.FindScreenshotsBySearch(search, searchType)
      .then(async (json) => {
        const parsed: unknown = JSON.parse(json);
        const results: string[] = Array.isArray(parsed) ? parsed.filter(isString) : [];

        if (results.length === 0) {
          D.metadata = {};
          D.metadata.error = t("dialog.screenshot_metadata.no_results");

          D.searchIndex = null;
          D.searchResults = null;
          searchResultsData.value = [];
          searchViewMode.value = "detail";
          return;
        }

        D.searchIndex = 0;
        D.searchResults = results;

        const enriched = await loadSearchResultsMetadata(results, search, searchType);
        searchResultsData.value = enriched;
        searchViewMode.value = "table";
      })
      .finally(() => {
        D.loading = false;
      })
      .catch(logError);
  }, 500);
}

function handleSearchTypeChange(value: AcceptableValue) {
  if (!isString(value)) {
    return;
  }
  screenshotMetadataDialog.searchType = value;
  screenshotMetadataSearch();
}

function screenshotMetadataResetSearch() {
  const D = screenshotMetadataDialog;

  D.search = "";
  D.searchIndex = null;
  D.searchResults = null;
  searchResultsData.value = [];
  selectedSearchFilePath.value = null;
  searchViewMode.value = "detail";
}

function showMetadataImageFullscreen(path: string | undefined) {
  showFullscreenImageDialog(path ?? "", "");
}

function getAndDisplayScreenshot(path: string | undefined, needsCarouselFiles = true) {
  void window.AppApi.GetScreenshotMetadata(path ?? "")
    .then((metadata) => displayScreenshotMetadata(metadata, needsCarouselFiles))
    .catch(logError);
}

async function displayScreenshotMetadata(json: string, needsCarouselFiles = true) {
  const D = screenshotMetadataDialog;
  D.metadata.author = {};
  D.metadata.world = {};
  D.metadata.players = [];
  D.metadata.creationDate = "";
  D.metadata.application = "";

  let metadataRecord: Record<string, unknown> | null = null;
  try {
    metadataRecord = parseJsonRecord(json);
  } catch (e) {
    console.error("Error parsing screenshot metadata JSON:", e);
  }
  const sourceFile = metadataRecord ? readString(metadataRecord, "sourceFile") : undefined;
  if (!metadataRecord || !sourceFile) {
    D.metadata = {};
    D.metadata.error = t("dialog.screenshot_metadata.invalid_file");
    return;
  }

  D.loading = true;
  const extraData = await window.AppApi.GetExtraScreenshotData(sourceFile, needsCarouselFiles);
  D.loading = false;
  const extraDataObj: unknown = JSON.parse(extraData);
  Object.assign(metadataRecord, extraDataObj);

  D.metadata = readScreenshotMetadata(metadataRecord);

  const regex = D.metadata.fileName?.match(
    /VRChat_((\d{3,})x(\d{3,})_(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{1,})|(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})\.(\d{3})_(\d{3,})x(\d{3,}))/
  );
  if (regex) {
    if (regex[2] !== undefined && regex[4]?.length === 4) {
      const date = regex.slice(4, 7).join("-");
      const time = regex.slice(7, 10).join(":");
      D.metadata.dateTime = Date.parse(`${date} ${time}`);
    } else if (regex[11]?.length === 4) {
      const date = regex.slice(11, 14).join("-");
      const time = regex.slice(14, 17).join(":");
      D.metadata.dateTime = Date.parse(`${date} ${time}`);
    }
  }
  if (D.metadata.timestamp) {
    D.metadata.dateTime = Date.parse(D.metadata.timestamp);
  }
  const hasDateTime = Boolean(D.metadata.dateTime);
  if (!hasDateTime) {
    D.metadata.dateTime = Date.parse(D.metadata.creationDate ?? "");
  }

  if (fullscreenImageDialog.value.visible) {
    showMetadataImageFullscreen(D.metadata.filePath);
  }
}
</script>
