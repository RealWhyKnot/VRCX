<template>
  <Dialog :open="ossDialog" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.open_source.header") }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle class="text-base">
              {{ t("dialog.open_source.description") }}
            </CardTitle>
            <CardDescription>
              {{ t("dialog.open_source.notice_location_prefix") }}
              <code class="rounded bg-muted px-1.5 py-0.5 text-xs">
                {{ noticeRelativePath }}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input v-model="searchQuery" :placeholder="t('dialog.open_source.search_placeholder')" />
          </CardContent>
        </Card>

        <div v-if="isLoading" class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {{ t("dialog.open_source.loading") }}
        </div>

        <div v-else-if="loadError" class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
          {{ t("dialog.open_source.unavailable") }}
        </div>

        <div v-else class="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div class="h-[28rem] space-y-3 overflow-y-auto pr-1">
            <Card
              v-for="entry in filteredEntries"
              :key="entry.id"
              :class="['cursor-pointer transition-colors', entry.id === selectedEntry?.id ? 'border-primary bg-accent' : 'hover:bg-accent/40']"
              @click="selectedEntryId = entry.id"
            >
              <CardHeader class="gap-2">
                <CardTitle class="truncate text-sm" :title="entry.name">
                  {{ entry.name }}
                </CardTitle>
                <CardDescription>
                  {{ entry.version || t("dialog.open_source.no_version") }}
                </CardDescription>
              </CardHeader>
              <CardContent class="flex min-w-0 flex-wrap items-center gap-2">
                <Badge variant="secondary" class="max-w-full min-w-0 shrink truncate" :title="entry.license">
                  {{ getLicenseLabel(entry.license) }}
                </Badge>
                <span class="min-w-0 text-xs text-muted-foreground">
                  {{ entry.sourceLabel }}
                </span>
              </CardContent>
            </Card>

            <div v-if="filteredEntries.length === 0" class="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              {{ t("dialog.open_source.no_results") }}
            </div>
          </div>

          <Card class="min-h-[28rem]">
            <template v-if="selectedEntry">
              <CardHeader>
                <div class="flex flex-wrap items-center gap-2">
                  <CardTitle>{{ selectedEntry.name }}</CardTitle>
                  <Badge variant="secondary" class="max-w-full whitespace-normal break-words">
                    {{ selectedEntry.license }}
                  </Badge>
                  <Badge v-if="selectedEntry.needsReview" variant="outline">
                    {{ t("dialog.open_source.review_required") }}
                  </Badge>
                </div>
                <CardDescription>
                  {{ selectedEntry.sourceLabel }}
                  <span v-if="selectedEntry.projects?.length"> · {{ selectedEntry.projects.join(", ") }} </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div class="flex flex-wrap gap-2">
                  <Button v-if="selectedEntry.projectUrl" size="sm" variant="outline" @click="openExternalLink(selectedEntry.projectUrl)">
                    {{ t("dialog.open_source.open_project") }}
                  </Button>

                  <Button v-if="selectedEntry.licenseUrl" size="sm" variant="outline" @click="openExternalLink(selectedEntry.licenseUrl)">
                    {{ t("dialog.open_source.open_license_url") }}
                  </Button>
                </div>

                <pre v-if="selectedEntry.noticeText" class="mt-4 max-h-[20rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">{{
                  selectedEntry.noticeText
                }}</pre>
                <div v-else class="mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  {{ t("dialog.open_source.notice_unavailable") }}
                </div>
              </CardContent>
            </template>

            <CardContent v-else class="flex h-full min-h-[28rem] items-center justify-center text-sm text-muted-foreground">
              {{ t("dialog.open_source.select_package") }}
            </CardContent>
          </Card>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import Card from "@/components/ui/card/Card.vue";
import CardContent from "@/components/ui/card/CardContent.vue";
import CardDescription from "@/components/ui/card/CardDescription.vue";
import CardHeader from "@/components/ui/card/CardHeader.vue";
import CardTitle from "@/components/ui/card/CardTitle.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Input from "@/components/ui/input/Input.vue";
import { openExternalLink } from "@/shared/utils/app-actions";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const LICENSE_MANIFEST_TIMEOUT_MS = 10_000;

type LicenseEntry = {
  id: string;
  name: string;
  version: string;
  license: string;
  sourceLabel: string;
  projects?: string[];
  projectUrl?: string;
  licenseUrl?: string;
  noticeText?: string;
  needsReview?: boolean;
};

const props = withDefaults(defineProps<{ ossDialog?: boolean }>(), { ossDialog: false });

const emit = defineEmits<{ "update:ossDialog": [value: boolean] }>();
const isLoading = ref(false);
const loadError = ref(false);
const licenses = ref<LicenseEntry[]>([]);
const noticeRelativePath = ref("licenses/THIRD_PARTY_NOTICES.txt");
const searchQuery = ref("");
const selectedEntryId = ref("");
let hasLoadedLicenses = false;

const filteredEntries = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLowerCase();

  if (!normalizedQuery) {
    return licenses.value;
  }

  return licenses.value.filter((entry) => {
    const haystack = [entry.name, entry.version, entry.license, entry.sourceLabel, ...(entry.projects ?? [])].filter(Boolean).join(" ").toLowerCase();

    return haystack.includes(normalizedQuery);
  });
});
const selectedEntry = computed(() => filteredEntries.value.find((entry) => entry.id === selectedEntryId.value) ?? filteredEntries.value[0] ?? null);
watch(
  () => props.ossDialog,
  async (isOpen) => {
    if (isOpen && !hasLoadedLicenses) {
      await loadLicenses();
    }
  },
  { immediate: true }
);

watch(filteredEntries, (entries) => {
  if (!entries.some((entry) => entry.id === selectedEntryId.value)) {
    selectedEntryId.value = entries[0]?.id ?? "";
  }
});

function closeDialog() {
  emit("update:ossDialog", false);
}

function buildAssetUrl(relativePath: string) {
  return new URL(relativePath, window.location.href).toString();
}

function getLicenseLabel(license: string) {
  if (license.startsWith("Public Domain")) {
    return "Public Domain";
  }

  return license;
}

function readManifestField(manifest: unknown, key: string): unknown {
  return typeof manifest === "object" && manifest !== null ? Reflect.get(manifest, key) : undefined;
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isOptionalStringArray(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function isLicenseEntry(value: unknown): value is LicenseEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return (
    typeof readManifestField(value, "id") === "string" &&
    typeof readManifestField(value, "name") === "string" &&
    typeof readManifestField(value, "version") === "string" &&
    typeof readManifestField(value, "license") === "string" &&
    typeof readManifestField(value, "sourceLabel") === "string" &&
    isOptionalStringArray(readManifestField(value, "projects")) &&
    isOptionalString(readManifestField(value, "projectUrl")) &&
    isOptionalString(readManifestField(value, "licenseUrl")) &&
    isOptionalString(readManifestField(value, "noticeText")) &&
    isOptionalBoolean(readManifestField(value, "needsReview"))
  );
}

async function loadLicenses() {
  isLoading.value = true;
  loadError.value = false;

  try {
    const response = await fetch(buildAssetUrl("licenses/third-party-licenses.json"), {
      cache: "no-store",
      signal: AbortSignal.timeout(LICENSE_MANIFEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Failed to load third-party license manifest: ${response.status}`);
    }

    const manifest: unknown = await response.json();
    const manifestEntries = readManifestField(manifest, "entries");
    licenses.value = Array.isArray(manifestEntries) ? manifestEntries.filter(isLicenseEntry) : [];
    const noticePath = readManifestField(manifest, "noticePath");
    noticeRelativePath.value = typeof noticePath === "string" && noticePath ? noticePath : "licenses/THIRD_PARTY_NOTICES.txt";
    selectedEntryId.value = licenses.value[0]?.id ?? "";
    hasLoadedLicenses = true;
  } catch (error) {
    console.error(error);
    loadError.value = true;
  } finally {
    isLoading.value = false;
  }
}
</script>
