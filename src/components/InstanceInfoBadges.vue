<template>
  <div :class="cn('flex items-center gap-1.5 text-muted-foreground rounded-full border border-muted-foreground/10 py-0.5 px-2', extraClass)">
    <TooltipWrapper v-if="instanceInfoState.isValidInstance" side="top">
      <template #content>
        <div class="flex flex-col flex-wrap gap-x-6 gap-y-2">
          <div v-if="instanceDescription" class="flex flex-col gap-1">
            <span>{{ t("dialog.user.info.instance_description") }}</span>
            <span class="max-w-80 whitespace-pre-wrap break-words">{{ instanceDescription }}</span>
          </div>

          <div v-if="instance?.platforms?.standalonewindows || instance?.platforms?.android || instance?.platforms?.ios" class="flex flex-col gap-1">
            <span v-if="instance.platforms.standalonewindows">
              <span class="text-platform-pc border-platform-pc!">PC: </span>
              {{ instance.platforms.standalonewindows }}
            </span>
            <span v-if="instance.platforms.android">
              <span class="text-platform-quest border-platform-quest!">Android: </span>
              {{ instance.platforms.android }}
            </span>
            <span v-if="instance.platforms.ios">
              <span class="text-platform-ios border-platform-quest!">iOS: </span>
              {{ instance.platforms.ios }}
            </span>
          </div>

          <span v-if="instance?.categoryId" class="flex items-center gap-1">
            {{ t("dialog.user.info.instance_category") }}
            <i v-if="instanceCategory?.icon" :class="['leading-none translate-y-px', instanceCategory.icon]" />
            {{ instanceCategory?.name ?? instance.categoryId }}
          </span>

          <span v-if="instance?.vibeIds?.length"> {{ t("dialog.user.info.instance_vibes") }} {{ instanceVibeTitles }} </span>

          <div v-if="instanceLanguages.length" class="flex flex-col gap-1">
            <span>{{ t("dialog.user.info.instance_languages") }}</span>
            <span v-for="lang in instanceLanguages" :key="lang.key" class="flex items-center gap-1.5">
              <span :class="['flags', 'inline-block', languageClass(lang.flagKey)]"></span>
              {{ lang.name }}
              <span v-if="lang.percent !== null" class="text-muted-foreground"> {{ lang.percent }}% </span>
              <Star v-if="lang.isCreationLanguage" class="h-3 w-3 text-yellow-500" :title="t('dialog.user.info.instance_creation_language')" />
            </span>
          </div>

          <span v-if="instance?.gameServerVersion"> {{ t("dialog.user.info.instance_game_version") }} {{ instance?.gameServerVersion }} </span>

          <span v-if="instance?.queueEnabled" class="text-yellow-500 font-medium">
            {{ t("dialog.user.info.instance_queuing_enabled") }}
          </span>

          <span v-if="instanceInfoState.disabledContentSettings">
            {{ t("dialog.user.info.instance_disabled_content") }}
            {{ instanceInfoState.disabledContentSettings }}
          </span>
        </div>
      </template>
      <div :class="cn('flex items-center gap-0.5', !instance?.hasCapacityForYou ? 'text-red-500' : null)">
        <UsersRound class="h-4 w-4" />
        <span v-if="instanceLocation === locationStore.lastLocation.location"> {{ locationStore.lastLocation.playerList.size }}/{{ instance?.capacity }} </span>

        <span v-else-if="instance?.userCount"> {{ instance.userCount }}/{{ instance?.capacity }} </span>
      </div>
    </TooltipWrapper>

    <TooltipWrapper v-if="friendcount" side="top" :content="t('dialog.user.info.instance_friends_tooltip')">
      <span class="flex items-center gap-0.5">
        <UserPlus2 class="h-4 w-4" />
        {{ friendcount }}
      </span>
    </TooltipWrapper>
    <span v-if="showLastJoinIndicator" class="inline-block">
      <TooltipWrapper side="top">
        <template #content>
          <span>{{ t("dialog.user.info.last_join") }} </span>
        </template>
        <span class="flex items-center gap-0.5">
          <MapPin class="h-4 w-4" />
          <Timer :epoch="lastJoin ?? 0" />
        </span>
      </TooltipWrapper>
    </span>

    <template v-if="hasInstanceMetadata">
      <TooltipWrapper v-if="instance?.queueSize" side="top" :content="t('dialog.user.info.instance_queue')">
        <span class="flex items-center gap-0.5">
          <SquareStack class="h-4 w-4" />
          {{ instance.queueSize }}
        </span>
      </TooltipWrapper>
      <TooltipWrapper v-if="instanceInfoState.isAgeGated" side="top" :content="t('dialog.user.info.instance_age_gated')">
        <span class="flex items-center gap-0.5 text-red-500">
          <IdCard class="h-4 w-4" />
        </span>
      </TooltipWrapper>
      <TooltipWrapper v-if="instanceInfoState.isRoleRestricted" side="top" :content="t('dialog.user.info.instance_role_restricted')">
        <span class="flex items-center gap-0.5 text-red-500">
          <UserLock class="h-4 w-4" />
        </span>
      </TooltipWrapper>
      <TooltipWrapper v-if="instance?.calendarEntryId && !isInGroup" side="top" :content="t('dialog.user.info.instance_calendar_event')">
        <span class="flex items-center gap-0.5">
          <CalendarDays class="h-4 w-4" />
        </span>
      </TooltipWrapper>
      <Popover v-else-if="instance?.calendarEntryId" :open="calendarPopoverOpen">
        <PopoverTrigger as-child>
          <span class="flex items-center gap-0.5" @mouseenter="openCalendarPopover" @mouseleave="scheduleCloseCalendarPopover">
            <CalendarDays class="h-4 w-4" />
          </span>
        </PopoverTrigger>
        <PopoverContent side="top" class="w-125 p-3" @mouseenter="openCalendarPopover" @mouseleave="scheduleCloseCalendarPopover">
          <GroupCalendarEventDetails v-if="calendarEvent" :event="calendarEvent" relative-time />
          <span v-else-if="calendarEventFailed" class="text-xs">
            {{ t("dialog.user.info.instance_calendar_event") }}
          </span>
          <div v-else class="flex justify-center">
            <Loader2 class="h-4 w-4 animate-spin" />
          </div>
        </PopoverContent>
      </Popover>
      <TooltipWrapper v-if="currentHypeTrain" side="top">
        <template #content>
          <div class="flex flex-col gap-1">
            <span class="font-medium">{{ t("dialog.user.info.instance_hype_train") }}</span>
            <span>
              {{ t("dialog.user.info.instance_hype_train_gifts") }}
              {{ currentHypeTrain.currentGiftCount }}/{{ currentHypeTrain.totalGiftGoal }}
            </span>
            <span>
              {{ t("dialog.user.info.instance_hype_train_contributors") }}
              {{ currentHypeTrain.totalGiftContributors }}
            </span>
            <span v-if="hypeTrainTimeRemaining">
              {{ t("dialog.user.info.instance_hype_train_time_remaining") }}
              {{ hypeTrainTimeRemaining }}
            </span>
            <span v-if="hypeTrainStartEpoch">
              {{ t("dialog.user.info.instance_hype_train_started") }}
              <Timer :epoch="hypeTrainStartEpoch" />
            </span>
          </div>
        </template>
        <span class="flex items-center gap-0.5">
          <TrainFront class="h-4 w-4" />
        </span>
      </TooltipWrapper>
      <TooltipWrapper
        v-if="instance?.minimumAvatarPerformance && instance.minimumAvatarPerformance !== 'None'"
        side="top"
        :content="t('dialog.user.info.instance_minimum_avatar_performance') + ': ' + instance.minimumAvatarPerformance"
      >
        <img :src="performanceIcon" class="h-4 w-4" />
      </TooltipWrapper>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { ClassValue } from "clsx";
import { useIntervalFn } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { CalendarDays, IdCard, Loader2, MapPin, SquareStack, Star, TrainFront, UserLock, UserPlus2, UsersRound } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import { useGroupStore } from "../stores/group";
import { useInstanceStore } from "../stores/instance";
import type { RoomRef } from "../stores/instance-types";
import { useLocationStore } from "../stores/location";
import { useUserStore } from "../stores/user";
import { logFailure } from "../stores/log-failure";
import { formatSeconds } from "../shared/utils/base/format";
import { languageClass } from "../shared/utils/user";
import { instanceCategoryIcons } from "../shared/constants/instance";
import { queryRequest } from "../api/query-request";
import type { InstanceInfoState } from "../composables/use-instance-info-state";
import GroupCalendarEventDetails from "../views/Tools/components/GroupCalendarEventDetails.vue";
import Timer from "./Timer.vue";

type InstanceInfoBadgesProps = {
  instance: RoomRef | null;
  instanceLocation: string;
  lastJoin: number | undefined;
  showLastJoin: boolean;
  friendcount: number | undefined;
  instanceInfoState: InstanceInfoState;
  extraClass?: ClassValue | undefined;
};

const props = defineProps<InstanceInfoBadgesProps>();

const { t } = useI18n();
const locationStore = useLocationStore();
const userStore = useUserStore();
const groupStore = useGroupStore();
const instanceStore = useInstanceStore();
const { instanceCategories, instanceVibes } = storeToRefs(instanceStore);

const showLastJoinIndicator = computed(() => props.showLastJoin && props.lastJoin);

const hasInstanceMetadata = computed(() => {
  return !!(
    !!props.instance?.queueSize ||
    props.instanceInfoState.isAgeGated ||
    props.instanceInfoState.isRoleRestricted ||
    !!props.instance?.calendarEntryId ||
    !!props.instance?.hypeTrain?.current ||
    (props.instance?.minimumAvatarPerformance && props.instance.minimumAvatarPerformance !== "None")
  );
});

const performanceIcon = computed(() => {
  const rank = props.instance?.minimumAvatarPerformance?.toLowerCase();
  if (!rank || rank === "none") return undefined;
  return `/images/performance_ranks/${rank}.png`;
});

type InstanceLanguageRow = {
  key: string;
  flagKey: string;
  name: string;
  percent: number | null;
  isCreationLanguage: boolean;
};

const languageNameOf = (key: string): string | undefined => (Object.hasOwn(userStore.subsetOfLanguages, key) ? userStore.subsetOfLanguages[key] : undefined);

const instanceLanguages = computed(() => {
  const rawLanguages = props.instance?.languages;
  const languages: string[] = Array.isArray(rawLanguages) ? rawLanguages : [];
  const iso639: string[] = props.instance?.languagesIso639 ?? [];
  const creationLanguages = new Set<string>(props.instance?.creationLanguages ?? []);
  const baseOf = (code: string) => code.split("-")[0] ?? code;
  const uniqueBases = [...new Set(languages.map(baseOf))];
  const iso639ByBase = new Map(uniqueBases.map((base, i): [string, string | undefined] => [base, iso639[i]]));
  const list: InstanceLanguageRow[] = languages.map((code) => {
    const key = iso639ByBase.get(baseOf(code)) ?? code;
    const region = code.split("-")[1];
    const name = languageNameOf(key) ?? code;
    return {
      key: code,
      flagKey: key,
      name: region ? `${name} (${region.toUpperCase()})` : name,
      percent: Math.round(Number(props.instance?.languageRatio?.[code] ?? 0) * 100),
      isCreationLanguage: creationLanguages.has(key) || creationLanguages.has(code),
    };
  });
  const listedKeys = new Set(list.flatMap((lang) => [lang.key, lang.flagKey]));
  for (const key of creationLanguages) {
    if (listedKeys.has(key)) continue;
    list.push({
      key,
      flagKey: key,
      name: languageNameOf(key) ?? key,
      percent: null,
      isCreationLanguage: true,
    });
  }
  return list.sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
});

const instanceDescription = computed(() => {
  const description = props.instance?.description?.trim();
  const worldDescription = props.instance?.world?.description?.trim();
  if (!description || worldDescription?.startsWith(description)) return "";
  return description;
});

const isInstanceCategoryIconKey = (value: string): value is keyof typeof instanceCategoryIcons => Object.hasOwn(instanceCategoryIcons, value);

const instanceCategory = computed(() => {
  const category = instanceCategories.value.find((entry) => entry.id === props.instance?.categoryId);
  if (!category) return null;
  const icon = isInstanceCategoryIconKey(category.iconUrl) ? instanceCategoryIcons[category.iconUrl] : undefined;
  return { name: category.name, icon };
});

const instanceVibeTitles = computed(() => {
  const vibeById = new Map(instanceVibes.value.map((vibe): [string, string] => [vibe.id, vibe.title]));
  return (props.instance?.vibeIds ?? []).map((id) => vibeById.get(id) ?? id).join(", ");
});

type HypeTrainCurrent = {
  startDate: string;
  endDate: string;
  currentGiftCount?: number;
  totalGiftGoal?: number;
  totalGiftContributors?: number;
};

const currentHypeTrain = computed<HypeTrainCurrent | null>(() => props.instance?.hypeTrain?.current ?? null);
const hypeTrainStartEpoch = computed(() => {
  const startDate = currentHypeTrain.value?.startDate;
  return startDate ? Date.parse(startDate) || 0 : 0;
});
const now = ref(Date.now());
const { pause: pauseNow, resume: resumeNow } = useIntervalFn(() => (now.value = Date.now()), 1000, {
  immediate: false,
  immediateCallback: true,
});
watch(currentHypeTrain, (train) => (train ? resumeNow() : pauseNow()), { immediate: true });
const hypeTrainTimeRemaining = computed(() => {
  const endEpoch = Date.parse(currentHypeTrain.value?.endDate ?? "");
  if (!endEpoch) return "";
  return formatSeconds(Math.max(0, (endEpoch - now.value) / 1000));
});

const calendarPopoverOpen = ref(false);
const calendarEvent = ref<ReturnType<typeof groupStore.applyGroupEvent> | null>(null);
const calendarEventFailed = ref(false);
let calendarPopoverCloseTimer: ReturnType<typeof setTimeout> | undefined;

const isInGroup = computed(() => groupStore.currentUserGroups.has(props.instance?.ownerId ?? ""));

const currentCalendarEntryId = () => props.instance?.calendarEntryId;

const fetchCalendarEvent = async () => {
  const groupId = props.instance?.ownerId;
  const eventId = props.instance?.calendarEntryId;
  if (!groupId || !eventId || !isInGroup.value || calendarEvent.value?.id === eventId) return;
  try {
    const args = await queryRequest.fetch("groupCalendarEvent", { groupId, eventId });
    if (currentCalendarEntryId() === eventId) {
      calendarEvent.value = groupStore.applyGroupEvent(args.json);
    }
  } catch (error) {
    console.error("Failed to load calendar event:", error);
    calendarEventFailed.value = true;
  }
};

const openCalendarPopover = () => {
  clearTimeout(calendarPopoverCloseTimer);
  calendarPopoverOpen.value = true;
  void fetchCalendarEvent().catch(logFailure("Loading the calendar event failed:"));
};

const scheduleCloseCalendarPopover = () => {
  clearTimeout(calendarPopoverCloseTimer);
  calendarPopoverCloseTimer = setTimeout(() => {
    calendarPopoverOpen.value = false;
  }, 100);
};

watch(
  () => props.instance?.calendarEntryId,
  () => {
    calendarEvent.value = null;
    calendarEventFailed.value = false;
  }
);
</script>
