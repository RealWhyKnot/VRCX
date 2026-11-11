<template>
  <Dialog :open="isInfoPushDialogVisible" @update:open="(open) => !open && closeDialog()">
    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.info_push.header") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-2">
        <ToggleGroup type="single" variant="outline" size="sm" :model-value="activeCategory" @update:model-value="selectCategory">
          <ToggleGroupItem v-for="category in categories" :key="category.name" :value="category.name">
            {{ getCategoryLabel(category.name) }} ({{ category.count }})
          </ToggleGroupItem>
        </ToggleGroup>
        <Button size="sm" variant="outline" class="ml-auto" :disabled="isLoading" @click="loadInfoPush">
          <RefreshCw class="size-4" :class="{ 'animate-spin': isLoading }" />
        </Button>
      </div>

      <div ref="listRef" class="max-h-[60vh] overflow-y-auto">
        <DataTableEmpty v-if="!filteredInfoPushes.length && !isLoading" type="nodata" />
        <div v-else-if="BANNER_CATEGORIES.includes(activeCategory)" class="space-y-4">
          <div v-for="item in filteredInfoPushes" :id="`info-push-${item.id}`" :key="item.id">
            <img
              v-if="getImageUrl(item)"
              :src="getImageUrl(item)"
              :alt="getName(item)"
              class="w-full cursor-pointer rounded"
              loading="lazy"
              @click="showFullscreenImageDialog(getImageUrl(item))"
            />
            <div v-else class="text-sm font-medium" v-text="getName(item)"></div>
            <div class="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <TooltipWrapper :content="getEndDateTooltip(item)" side="top">
                <span>{{ formatDateFilter(item.startDate ?? item.createdAt, "long") }}</span>
              </TooltipWrapper>
              <Button v-if="getAction(item) && isLinkActionable(getAction(item))" size="sm" variant="outline" class="ml-auto" @click="runLink(getAction(item))">
                {{ getLinkLabel(getAction(item)) }}
              </Button>
            </div>
          </div>
        </div>
        <template v-else>
          <div v-for="item in filteredInfoPushes" :id="`info-push-${item.id}`" :key="item.id" class="border-b py-2 last:border-b-0">
            <div class="flex cursor-pointer gap-3" @click="toggleInSet(expandedIds, item.id)">
              <img
                v-if="getImageUrl(item)"
                :src="getImageUrl(item)"
                class="h-14 w-24 flex-none cursor-pointer rounded object-cover"
                loading="lazy"
                @click.stop="showFullscreenImageDialog(getImageUrl(item))"
              />
              <div class="min-w-0 flex-1 text-sm">
                <div class="flex items-center gap-2">
                  <ChevronRight class="size-4 flex-none text-muted-foreground transition-transform" :class="{ 'rotate-90': expandedIds.has(item.id) }" />
                  <span class="truncate font-medium" v-text="getName(item)"></span>
                  <Badge v-if="getStatus(item)" variant="destructive" class="flex-none">
                    {{ t(`dialog.info_push.${getStatus(item)}`) }}
                  </Badge>
                  <span class="ml-auto flex-none text-xs text-muted-foreground">
                    {{ formatDateFilter(item.startDate ?? item.createdAt, "long") }}
                  </span>
                </div>
                <div
                  v-if="getDescription(item)"
                  class="text-xs text-muted-foreground"
                  :class="{ 'line-clamp-2': !expandedIds.has(item.id) }"
                  v-text="getDescription(item)"
                ></div>
                <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span v-if="item.endDate">
                    {{ t("dialog.info_push.end_date") }}:
                    {{ formatDateFilter(item.endDate, "long") }}
                  </span>
                  <Badge v-for="tag in item.requireClientTags" :key="tag" variant="outline" class="text-xs">
                    {{ tag }}
                  </Badge>
                  <template v-if="getAction(item)">
                    <button
                      v-if="isLinkActionable(getAction(item))"
                      type="button"
                      class="cursor-pointer text-primary hover:underline"
                      @click.stop="runLink(getAction(item))"
                    >
                      {{ getLinkLabel(getAction(item)) }}
                    </button>
                    <span v-else>{{ getAction(item)?.command }}</span>
                  </template>
                </div>
              </div>
            </div>

            <div v-if="expandedIds.has(item.id)" class="mt-3 space-y-3 pl-7 text-sm">
              <div v-if="getArticleBlocks(item).length" class="space-y-2">
                <template v-for="(block, index) in getArticleBlocks(item)" :key="index">
                  <img
                    v-if="block.type === 'image'"
                    :src="block.value"
                    class="w-full max-w-lg cursor-pointer rounded"
                    loading="lazy"
                    @click="showFullscreenImageDialog(block.value)"
                  />
                  <Button v-else-if="block.type === 'video'" size="sm" variant="outline" @click="openExternalLink(block.value)">
                    <Video class="size-4" />
                    {{ t("dialog.info_push.open_video") }}
                  </Button>
                  <p v-else class="whitespace-pre-line" :class="{ 'text-base font-semibold': block.type === 'heading' }" v-text="block.value"></p>
                </template>
              </div>

              <div v-if="item.data.domainList?.length" class="flex flex-wrap items-center gap-1">
                <span class="text-xs text-muted-foreground">{{ t("dialog.info_push.domains") }}:</span>
                <Badge v-for="entry in item.data.domainList" :key="entry.domain ?? ''" variant="outline">
                  {{ entry.domain }}
                </Badge>
              </div>

              <div v-if="getLinks(item).length" class="flex flex-wrap gap-2">
                <Button
                  v-for="link in getLinks(item)"
                  :key="`${link.command}:${link.target}`"
                  size="sm"
                  variant="outline"
                  :disabled="!isLinkActionable(link)"
                  @click="runLink(link)"
                >
                  {{ getLinkLabel(link) }}
                </Button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ChevronRight, RefreshCw, Video } from "lucide-vue-next";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import { computed, nextTick, reactive, ref, watch } from "vue";
import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import ToggleGroup from "@/components/ui/toggle-group/ToggleGroup.vue";
import ToggleGroupItem from "@/components/ui/toggle-group/ToggleGroupItem.vue";
import { useI18n } from "vue-i18n";
import type { InfoPush } from "vrchat";

import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";

import type { Json } from "../../../types/vrcx";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { openExternalLink } from "../../../shared/utils/app-actions";
import { miscRequest } from "../../../api/misc";
import { useGalleryStore } from "../../../stores/gallery";
import { logError } from "../../../stores/vrcx-messages";

const BANNER_CATEGORIES = ["quick-menu-banner", "loading-screen-banners"];
const DEFAULT_CATEGORY = "help-article";
const CATEGORY_ORDER: readonly string[] = [DEFAULT_CATEGORY, ...BANNER_CATEGORIES];

type InfoPushItem = Json<InfoPush>;
type InfoPushLink = { command: string; target: string; name: string };
type InfoPushBlock = { type: "image" | "video" | "heading" | "text"; value: string };
type InfoPushLocalized = string | { fallback: string } | null | undefined;

const props = withDefaults(
  defineProps<{
    isInfoPushDialogVisible?: boolean | undefined;
  }>(),
  {
    isInfoPushDialogVisible: false,
  }
);

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();
const { showFullscreenImageDialog } = useGalleryStore();

const infoPushes = ref<InfoPushItem[]>([]);
const isLoading = ref(false);
const activeCategory = ref(DEFAULT_CATEGORY);
const expandedIds = reactive(new Set<string>());
const listRef = ref<HTMLElement | null>(null);

const itemsById = computed(() => new Map<string, InfoPushItem>(infoPushes.value.map((item): [string, InfoPushItem] => [item.id, item])));

const categoryById = computed(() => new Map<string, string>(infoPushes.value.map((item): [string, string] => [item.id, getCategory(item)])));

const categories = computed(() => {
  const counts = new Map<string, number>();
  for (const category of categoryById.value.values()) {
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => getCategoryRank(a.name) - getCategoryRank(b.name) || b.count - a.count || a.name.localeCompare(b.name));
});

const filteredInfoPushes = computed(() => infoPushes.value.filter((item) => categoryById.value.get(item.id) === activeCategory.value));

watch(
  () => props.isInfoPushDialogVisible,
  (isVisible) => {
    if (isVisible) {
      void loadInfoPush().catch(logError);
    }
  }
);

function closeDialog() {
  emit("close");
}

function selectCategory(value: unknown) {
  if (typeof value === "string" && value !== "") {
    activeCategory.value = value;
  }
}

async function loadInfoPush() {
  infoPushes.value = [];
  expandedIds.clear();
  isLoading.value = true;
  try {
    const { json } = await miscRequest.getInfoPush({
      require: "user-all",
      include: ["help-article", "quick-menu-banner", "loading-screen-banners"],
    });
    infoPushes.value = json.toSorted((a, b) => getSortDate(b) - getSortDate(a));
    if (!categories.value.some((category) => category.name === activeCategory.value)) {
      activeCategory.value = categories.value[0]?.name ?? DEFAULT_CATEGORY;
    }
  } finally {
    isLoading.value = false;
  }
}

function getCategoryLabel(name: string) {
  return CATEGORY_ORDER.includes(name) ? t(`dialog.info_push.categories.${name}`) : name;
}

function getCategoryRank(name: string) {
  const index = CATEGORY_ORDER.indexOf(name);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function getSortDate(item: InfoPushItem) {
  return Date.parse(item.startDate ?? item.createdAt) || 0;
}

function toggleInSet(set: Set<string>, id: string) {
  if (!set.delete(id)) {
    set.add(id);
  }
}

function localize(value: InfoPushLocalized): string {
  if (typeof value === "string") {
    return value;
  }
  return value?.fallback ?? "";
}

function firstFilled(...values: (string | null | undefined)[]): string {
  return values.find((value): value is string => Boolean(value)) ?? "";
}

function getCategory(item: InfoPushItem): string {
  return item.tags.find((tag) => CATEGORY_ORDER.includes(tag)) ?? "other";
}

function getName(item: InfoPushItem): string {
  const data = item.data;
  return firstFilled(localize(data.name), data.title, localize(data.contentList?.name), data.finalName, data.worldTag, data.version, item.id);
}

function getDescription(item: InfoPushItem): string {
  const data = item.data;
  return firstFilled(
    localize(data.description),
    data.subtitle,
    localize(data.tooltipDescription),
    data.disclaimerText,
    data.body,
    data.search?.searchQuery,
    data.authorName
  );
}

function getImageUrl(item: InfoPushItem): string {
  const data = item.data;
  return firstFilled(data.imageUrl, data.thumbnailImageUrl, data.bannerImageUrl, data.iconImageUrl);
}

function getEndDateTooltip(item: InfoPushItem): string | undefined {
  if (!item.endDate) {
    return undefined;
  }
  return `${t("dialog.info_push.end_date")}: ${formatDateFilter(item.endDate, "long")}`;
}

function getStatus(item: InfoPushItem): string {
  if (!item.isEnabled) {
    return "disabled";
  }
  const now = Date.now();
  if (item.endDate && Date.parse(item.endDate) < now) {
    return "expired";
  }
  if (item.startDate && Date.parse(item.startDate) > now) {
    return "scheduled";
  }
  return "";
}

function toPlainText(text: string) {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function getArticleBlocks(item: InfoPushItem): InfoPushBlock[] {
  const blocks: InfoPushBlock[] = [];
  for (const content of item.data.article?.content ?? []) {
    if (content.imageUrl) {
      blocks.push({ type: "image", value: content.imageUrl });
    } else if (content.videoUrl) {
      blocks.push({ type: "video", value: content.videoUrl });
    } else if (content.text) {
      const value = toPlainText(content.text);
      if (value) {
        const isHeading = /^<size=[^>]+>\s*<b>/i.test(content.text.trim());
        blocks.push({ type: isHeading ? "heading" : "text", value });
      }
    }
  }
  return blocks;
}

function toLink(source: { command?: string | undefined; parameters?: string[] | undefined; name?: string | undefined }): InfoPushLink {
  return {
    command: source.command ?? "",
    target: source.parameters?.[0] ?? "",
    name: source.name ?? "",
  };
}

function getAction(item: InfoPushItem): InfoPushLink | undefined {
  const onPressed = item.data.onPressed;
  return onPressed?.command ? toLink(onPressed) : undefined;
}

function getLinks(item: InfoPushItem): InfoPushLink[] {
  const article = item.data.article;
  const links = new Map<string, InfoPushLink>();
  for (const source of [...(article?.moreInfoLinks ?? []), ...(article?.embeddedLinkData ?? [])]) {
    if (!source.command) {
      continue;
    }
    const link = toLink(source);
    const key = `${link.command}:${link.target}`;
    if (!links.has(key)) {
      links.set(key, link);
    }
  }
  return [...links.values()];
}

function isLinkActionable(link: InfoPushLink | undefined) {
  if (link?.command === "OpenURL") {
    return Boolean(link.target);
  }
  return link?.command === "OpenHelpArticle" && itemsById.value.has(link.target);
}

function getLinkLabel(link: InfoPushLink | undefined) {
  if (link?.name) {
    return link.name;
  }
  const linkedItem = link?.command === "OpenHelpArticle" ? itemsById.value.get(link.target) : undefined;
  if (linkedItem) {
    return getName(linkedItem);
  }
  if (link?.command === "OpenURL") {
    return t("dialog.info_push.open_link");
  }
  return link?.command ?? "";
}

function runLink(link: InfoPushLink | undefined) {
  if (link?.command === "OpenURL") {
    openExternalLink(link.target);
  } else if (link?.command === "OpenHelpArticle") {
    void showInfoPush(link.target).catch(logError);
  }
}

async function showInfoPush(id: string) {
  const category = categoryById.value.get(id);
  if (category) {
    activeCategory.value = category;
  }
  expandedIds.add(id);
  await nextTick();
  listRef.value?.querySelector(`#info-push-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>
