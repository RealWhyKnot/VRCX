<template>
  <div class="x-container flex flex-col overflow-hidden">
    <div class="flex items-center gap-2 ml-2">
      <Button variant="ghost" size="sm" class="mr-3" @click="goBack">
        <ArrowLeft />
        {{ t("nav_tooltip.tools") }}
      </Button>
      <span class="header">{{ t("view.tools.instance_browser.title") }}</span>
      <div class="ml-auto flex min-w-0 items-center gap-2">
        <InputGroupField v-model="searchText" :maxlength="100" :placeholder="t('view.tools.instance_browser.search_placeholder')" class="w-[220px] min-w-0" />
        <TooltipWrapper side="bottom" :content="t('view.tools.instance_browser.refresh')">
          <Button
            class="shrink-0 rounded-full"
            size="icon-sm"
            variant="ghost"
            :aria-label="t('view.tools.instance_browser.refresh')"
            :disabled="isLoading"
            data-testid="refresh"
            @click="reload"
          >
            <Spinner v-if="isLoading" />
            <RefreshCw v-else />
          </Button>
        </TooltipWrapper>
      </div>
    </div>

    <TabsUnderline class="shrink-0" :model-value="source" :items="sourceTabs" @update:model-value="pickSource">
      <template v-for="entry in SOURCES" :key="entry" #[`label-${entry}`]>
        <span :data-testid="`source-${entry}`">{{ t(`view.tools.instance_browser.source_${entry}`) }}</span>
      </template>
    </TabsUnderline>

    <div v-if="source === 'discover'" class="shrink-0 mb-2 flex flex-wrap items-center gap-2">
      <Select :model-value="filters.mode" @update:model-value="(value) => setChoice('mode', value)">
        <SelectTrigger size="sm" class="w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="mode in DISCOVER_MODES" :key="mode" :value="mode">{{ t(`view.tools.instance_browser.mode_${mode}`) }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select :model-value="filters.region || ANY" @update:model-value="(value) => setChoice('region', value)">
        <SelectTrigger size="sm" class="w-[130px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="ANY">{{ t("view.tools.instance_browser.any_region") }}</SelectItem>
            <SelectItem v-for="region in DISCOVER_REGIONS" :key="region" :value="region">
              <span :class="['flags', region]" />
              {{ region.toUpperCase() }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select :model-value="filters.platform || ANY" @update:model-value="(value) => setChoice('platform', value)">
        <SelectTrigger size="sm" class="w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="ANY">{{ t("view.tools.instance_browser.any_platform") }}</SelectItem>
            <SelectItem v-for="platform in DISCOVER_PLATFORMS" :key="platform" :value="platform">
              {{ t(`view.tools.instance_browser.platform_${platform}`) }}
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select :model-value="filters.categoryId || ANY" @update:model-value="(value) => setChoice('categoryId', value)">
        <SelectTrigger size="sm" class="w-[160px]">
          <SelectValue>
            <span class="truncate">{{ categoryName(filters.categoryId) || t("view.tools.instance_browser.any_category") }}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem :value="ANY">{{ t("view.tools.instance_browser.any_category") }}</SelectItem>
            <SelectItem v-for="category in instanceCategories" :key="category.id" :value="category.id">{{ category.name }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select multiple :model-value="filters.vibeIds" @update:model-value="setVibes">
        <SelectTrigger size="sm" class="w-[180px]">
          <SelectValue>
            <span class="truncate">{{ vibeNames(filters.vibeIds) || t("view.tools.instance_browser.any_vibe") }}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem v-for="vibe in instanceVibes" :key="vibe.id" :value="vibe.id">{{ vibe.title }}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <InputGroupField
        :model-value="filters.minOccupants || ''"
        type="number"
        size="sm"
        class="w-[130px]"
        :maxlength="3"
        :placeholder="t('view.tools.instance_browser.min_people')"
        @change="setMinOccupants"
      />
      <label class="flex items-center gap-1 text-sm">
        <Switch v-model="filters.isGroupHosted" />
        {{ t("view.tools.instance_browser.group_hosted") }}
      </label>
      <label class="flex items-center gap-1 text-sm">
        <Switch v-model="filters.isTrendingOnly" />
        {{ t("view.tools.instance_browser.trending_only") }}
      </label>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0">
      <div v-if="isLoading && !visibleInstances.length" class="flex items-center justify-center h-full">
        <Spinner class="text-2xl" />
      </div>
      <template v-else-if="visibleInstances.length > 0">
        <ItemGroup class="grid gap-3 grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          <Item v-for="instance in visibleInstances" :key="instance.location" variant="outline" size="sm" class="p-3" as-child>
            <div class="overflow-hidden" data-testid="instance-card">
              <ItemHeader class="relative">
                <img
                  v-if="instance.worldImageUrl"
                  :src="instance.worldImageUrl"
                  :alt="instance.worldName"
                  loading="lazy"
                  class="aspect-video w-full cursor-pointer rounded-lg object-cover"
                  @click="showWorldDialog(instance.worldId)"
                />
                <Badge variant="outline" class="absolute top-2 right-2 border-transparent bg-black/60 text-white/90 backdrop-blur-sm">
                  <Users class="h-3 w-3" />
                  {{ instance.capacity > 0 ? `${instance.userCount}/${instance.capacity}` : instance.userCount }}
                </Badge>
              </ItemHeader>
              <ItemContent class="min-w-0">
                <TooltipWrapper side="top" :content="instance.description || instance.worldName" content-class="max-w-80 break-words">
                  <ItemTitle class="block w-full cursor-pointer truncate" @click="showWorldDialog(instance.worldId)">{{ instance.worldName }}</ItemTitle>
                </TooltipWrapper>
                <ItemDescription class="line-clamp-1 break-all text-xs">
                  {{ instance.displayName || instance.worldAuthorName }}
                </ItemDescription>
                <div class="flex min-w-0 flex-wrap items-center gap-1 text-[11px]">
                  <span v-if="instance.region" :class="['flags shrink-0', instance.region]" />
                  <Badge v-if="instance.accessType" variant="outline" class="h-5 px-1.5 text-[11px] leading-none">{{ accessLabel(instance.accessType) }}</Badge>
                  <Badge v-if="categoryName(instance.categoryId)" variant="outline" class="h-5 max-w-full px-1.5 text-[11px] leading-none">
                    <span class="truncate">{{ categoryName(instance.categoryId) }}</span>
                  </Badge>
                  <Badge v-if="instance.isFull" variant="outline" class="h-5 px-1.5 text-[11px] leading-none text-red-500 border-red-500!">
                    {{ t("view.tools.instance_browser.full") }}
                  </Badge>
                  <Badge v-if="instance.queueSize > 0" variant="outline" class="h-5 px-1.5 text-[11px] leading-none">
                    {{ t("view.tools.instance_browser.queue", { count: instance.queueSize }) }}
                  </Badge>
                  <Badge v-if="instance.friendCount > 0" variant="outline" class="h-5 px-1.5 text-[11px] leading-none text-green-500 border-green-500!">
                    {{ t("view.tools.instance_browser.friends_here", { count: instance.friendCount }) }}
                  </Badge>
                </div>
                <InstanceFaces
                  :faces="facesFor(instance.location).faces"
                  :hidden-count="facesFor(instance.location).hiddenCount"
                  :owners="owners"
                  @pick="pickFace"
                  @peek="peekFace"
                />
                <ItemDescription v-if="vibeNames(instance.vibeIds)" class="line-clamp-1 text-xs">{{ vibeNames(instance.vibeIds) }}</ItemDescription>
                <div v-if="instance.ownerName" class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <img v-if="instance.ownerIconUrl" :src="instance.ownerIconUrl" alt="" loading="lazy" class="size-4 shrink-0 rounded-full object-cover" />
                  <span class="truncate">{{ t("view.tools.instance_browser.hosted_by", { name: instance.ownerName }) }}</span>
                </div>
                <div class="mt-1 flex gap-2">
                  <Button size="sm" variant="outline" class="min-w-0 flex-1" data-testid="launch" @click="launch(instance)">
                    <LogIn />
                    <span class="truncate">{{ t("view.tools.instance_browser.launch") }}</span>
                  </Button>
                  <Button size="sm" variant="outline" class="min-w-0 flex-1" data-testid="invite" @click="inviteMe(instance)">
                    <Mail />
                    <span class="truncate">{{ t("view.tools.instance_browser.invite_me") }}</span>
                  </Button>
                </div>
              </ItemContent>
            </div>
          </Item>
        </ItemGroup>
        <div v-if="hasMore" class="my-3 flex justify-center">
          <Button size="sm" variant="outline" :disabled="isLoading" data-testid="load-more" @click="more">
            {{ t("view.tools.instance_browser.load_more") }}
          </Button>
        </div>
      </template>
      <div v-else-if="hasLoadFailed" class="flex h-full items-center justify-center text-sm text-muted-foreground" data-testid="load-failed">
        {{ t("view.tools.instance_browser.load_failed") }}
      </div>
      <DataTableEmpty v-else type="nodata" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, LogIn, Mail, RefreshCw, Users } from "lucide-vue-next";
import { computed, onActivated } from "vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

import Badge from "@/components/ui/badge/Badge.vue";
import Button from "@/components/ui/button/Button.vue";
import DataTableEmpty from "@/components/ui/data-table/DataTableEmpty.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Item from "@/components/ui/item/Item.vue";
import ItemContent from "@/components/ui/item/ItemContent.vue";
import ItemDescription from "@/components/ui/item/ItemDescription.vue";
import ItemGroup from "@/components/ui/item/ItemGroup.vue";
import ItemHeader from "@/components/ui/item/ItemHeader.vue";
import ItemTitle from "@/components/ui/item/ItemTitle.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Switch from "@/components/ui/switch/Switch.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { instanceRequest } from "@/api/instance";
import { showWorldDialog } from "@/coordinators/world-coordinator";
import { accessTypeLocaleKeyMap } from "@/shared/constants/access-type";
import { DISCOVER_MODES, DISCOVER_PLATFORMS, DISCOVER_REGIONS, type DiscoveredInstance } from "@/shared/utils/instance-discovery";
import type { InstanceFace } from "@/shared/utils/instance-faces";
import { parseLocation, translateAccessType } from "@/shared/utils/location-parser";
import { useInstanceStore } from "@/stores/instance";
import { useLaunchStore } from "@/stores/launch";
import { logError } from "@/stores/vrcx-messages";
import InstanceFaces from "../../components/InstanceFaces.vue";
import { useInstanceBrowser, type InstanceBrowserSource } from "./composables/use-instance-browser";
import { useInstanceFaces } from "../../composables/use-instance-faces";

defineOptions({ name: "InstanceBrowserView" });

const ANY = "any";

const { t } = useI18n();
const router = useRouter();
const instanceStore = useInstanceStore();
const { instanceCategories, instanceVibes } = storeToRefs(instanceStore);
const launchStore = useLaunchStore();

const { filters, source, searchText, visibleInstances, isLoading, hasLoadFailed, hasMore, refresh, loadMore, setVibes, setMinOccupants } = useInstanceBrowser();

const { facesFor, identify, peek, owners } = useInstanceFaces(visibleInstances);

function pickFace(face: InstanceFace) {
  void identify(face).catch(logError);
}

function peekFace(face: InstanceFace) {
  void peek(face).catch(logError);
}

onActivated(() => {
  void instanceStore.loadInstanceCategoriesAndVibes().catch(logError);
  void refresh().catch(logError);
});

const SOURCES: readonly InstanceBrowserSource[] = ["discover", "active"];
const sourceTabs = computed(() => SOURCES.map((entry) => ({ value: entry, label: t(`view.tools.instance_browser.source_${entry}`) })));

function pickSource(value: string | number) {
  const picked = SOURCES.find((entry) => entry === value);
  if (picked) {
    source.value = picked;
  }
}

function goBack() {
  void router.push({ name: "tools" }).catch(logError);
}

function reload() {
  void refresh().catch(logError);
}

function more() {
  void loadMore().catch(logError);
}

function setChoice(key: "mode" | "region" | "platform" | "categoryId", value: unknown) {
  const choice = typeof value === "string" && value !== ANY ? value : "";
  if (key === "mode") {
    filters.value.mode = DISCOVER_MODES.find((mode) => mode === choice) ?? "active";
    return;
  }
  filters.value[key] = choice;
}

function categoryName(categoryId: string): string {
  return instanceCategories.value.find((category) => category.id === categoryId)?.name ?? "";
}

function vibeNames(vibeIds: string[]): string {
  return vibeIds
    .map((vibeId) => instanceVibes.value.find((vibe) => vibe.id === vibeId)?.title ?? "")
    .filter((title) => title !== "")
    .join(", ");
}

function accessLabel(accessType: string): string {
  return translateAccessType(accessType, t, accessTypeLocaleKeyMap);
}

function launch(instance: DiscoveredInstance) {
  void launchStore.showLaunchDialog(instance.location, instance.shortName || null).catch(logError);
}

function inviteMe(instance: DiscoveredInstance) {
  const parsed = parseLocation(instance.location);
  if (!parsed.isRealInstance) {
    return;
  }
  const target = instance.shortName
    ? { worldId: parsed.worldId, instanceId: parsed.instanceId, shortName: instance.shortName }
    : { worldId: parsed.worldId, instanceId: parsed.instanceId };
  void instanceRequest
    .selfInvite(target)
    .then(() => {
      toast.success(t("message.invite.self_sent"));
    })
    .catch(logError);
}
</script>
