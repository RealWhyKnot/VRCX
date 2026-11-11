<template>
  <component :is="enableContextMenu ? ContextMenu : Passthrough">
    <component :is="enableContextMenu ? ContextMenuTrigger : Passthrough" as-child>
      <div class="cursor-pointer" v-bind="$attrs">
        <div v-if="!text" class="text-transparent">-</div>
        <div v-show="text" class="flex items-center gap-2">
          <template v-if="isAgeRestricted">
            <TooltipWrapper :content="t('dialog.user.info.instance_age_restricted_tooltip')" :delay-duration="300" side="top">
              <div class="inline-flex items-center gap-1 text-muted-foreground">
                <Lock class="size-3.5 shrink-0" />
                <span>{{ t("dialog.user.info.instance_age_restricted") }}</span>
              </div>
            </TooltipWrapper>
          </template>
          <template v-else>
            <div v-if="region" :class="cn('flags shrink-0', region)"></div>
            <TooltipWrapper :content="tooltipContent" :disabled="tooltipDisabled" :delay-duration="300" side="top">
              <div :class="locationClasses" class="inline-flex min-w-0 flex-nowrap items-center overflow-hidden truncate" @click="handleShowWorldDialog">
                <Spinner v-if="isTraveling" class="mr-1 shrink-0" />
                <span class="min-w-0 flex-1 truncate">
                  <span>{{ text }}</span>
                  <span v-if="showInstanceIdInLocation && instanceName" class="ml-1">{{ `· #${instanceName}` }}</span>
                  <span v-if="groupName" class="cursor-pointer" @click.stop="handleShowGroupDialog"> ({{ groupName }}) </span>
                </span>
              </div>
            </TooltipWrapper>
            <div v-if="closedAt">
              <TooltipWrapper side="top">
                <template #content>
                  {{ t("dialog.user.info.instance_closed_at") }}:
                  {{ formatDateFilter(closedAt, "long") }}
                </template>
                <AlertTriangle class="text-orange-500 my-auto" />
              </TooltipWrapper>
            </div>
            <Lock v-if="strict" class="text-muted-foreground" />
          </template>
        </div>
      </div>
    </component>
    <ContextMenuContent v-if="enableContextMenu && parsedLocation.isRealInstance && parsedLocation.worldId">
      <WorldActionMenuItems
        :can-open-instance-in-game="canOpenInstanceInGame"
        :show-share="true"
        :show-previous-instances="true"
        @view-details="handleShowWorldDialog"
        @share="handleShareLocation"
        @new-instance="handleNewInstance"
        @self-invite="handleNewInstanceSelfInvite"
        @show-previous-instances="handleShowPreviousInstances"
      />
    </ContextMenuContent>
  </component>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type Slots } from "vue";
import { AlertTriangle, Lock } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import ContextMenu from "./ui/context-menu/ContextMenu.vue";
import ContextMenuContent from "./ui/context-menu/ContextMenuContent.vue";
import ContextMenuTrigger from "./ui/context-menu/ContextMenuTrigger.vue";

import { getGroupName } from "../shared/utils/group";
import { getLocationText } from "../shared/utils/location";
import { getWorldName } from "../shared/utils/world";
import { copyToClipboard } from "../shared/utils/app-actions";
import { formatDateFilter } from "../coordinators/date-coordinator";
import { parseLocation, resolveRegion, translateAccessType } from "../shared/utils/location-parser";
import { useAppearanceSettingsStore } from "../stores/settings/appearance";
import { useInstanceStore } from "../stores/instance";
import { useInviteStore } from "../stores/invite";
import { useSearchStore } from "../stores/search";
import { useWorldStore } from "../stores/world";
import { logFailure } from "../stores/log-failure";
import { showGroupDialog } from "../coordinators/group-dialog-coordinator";
import { showWorldDialog } from "../coordinators/world-coordinator";
import { runNewInstanceSelfInviteFlow } from "../coordinators/invite-coordinator";
import Spinner from "./ui/spinner/Spinner.vue";
import WorldActionMenuItems from "./WorldActionMenuItems.vue";
import { accessTypeLocaleKeyMap } from "../shared/constants/access-type";
import type { InstanceEntry } from "../stores/instance-types";
import type { ParsedLocation } from "../types/vrcx";
import { cn } from "@/lib/utils";

defineOptions({
  name: "LocationText",
  inheritAttrs: false,
});

const Passthrough = (_: unknown, { slots }: { slots: Slots }) => slots["default"]?.();

const { t } = useI18n();

const { cachedWorlds } = useWorldStore();
const { showPreviousInstancesInfoDialog } = useInstanceStore();
const { verifyShortName } = useSearchStore();
const { cachedInstances } = useInstanceStore();
const { lastInstanceApplied } = storeToRefs(useInstanceStore());
const { canOpenInstanceInGame } = useInviteStore();
const { showInstanceIdInLocation, isAgeGatedInstancesVisible } = storeToRefs(useAppearanceSettingsStore());

const props = withDefaults(
  defineProps<{
    location?: string | undefined;
    traveling?: string | undefined;
    hint?: string | undefined;
    grouphint?: string;
    excludeGroupName?: boolean;
    link?: boolean;
    disableTooltip?: boolean;
    isOpenPreviousInstanceInfoDialog?: boolean;
    enableContextMenu?: boolean;
  }>(),
  {
    location: undefined,
    traveling: undefined,
    hint: "",
    grouphint: "",
    excludeGroupName: false,
    link: true,
    disableTooltip: false,
    isOpenPreviousInstanceInfoDialog: false,
    enableContextMenu: false,
  }
);

const text = ref("");
const region = ref("");
const strict = ref(false);
const ageGate = ref(false);
const isTraveling = ref(false);
const parsedLocation = ref<ParsedLocation>(parseLocation(""));
const groupName = ref("");
const closedAt = ref("");
const instanceName = ref("");
const instanceRef = ref<InstanceEntry | null>(null);

const isAgeRestricted = computed(() => !isAgeGatedInstancesVisible.value && ageGate.value);
const isLocationLink = computed(() => props.link && props.location !== "private" && props.location !== "offline");
const locationClasses = computed(() => [
  "x-location",
  {
    "cursor-pointer": isLocationLink.value,
  },
]);
const tooltipContent = computed(() => `${t("dialog.new_instance.instance_id")}: #${instanceName.value}`);
const tooltipDisabled = computed(() => props.disableTooltip || !instanceName.value || showInstanceIdInLocation.value);

let isDisposed = false;
onBeforeUnmount(() => {
  isDisposed = true;
});

watch(() => [props.location, props.traveling, props.hint, props.grouphint, props.excludeGroupName], parse, {
  immediate: true,
});

watch(
  () => lastInstanceApplied.value,
  (instanceId) => {
    if (instanceId === currentInstanceId()) {
      parse();
    }
  }
);

function currentInstanceId() {
  if (typeof props.traveling !== "undefined" && props.location === "traveling") {
    return props.traveling;
  }
  return props.location;
}

function resetState() {
  text.value = "";
  region.value = "";
  strict.value = false;
  ageGate.value = false;
  isTraveling.value = false;
  groupName.value = "";
  closedAt.value = "";
  instanceName.value = "";
}

function parse() {
  if (isDisposed) {
    return;
  }
  resetState();

  let instanceId = props.location;
  if (typeof props.traveling !== "undefined" && props.location === "traveling") {
    instanceId = props.traveling;
    isTraveling.value = true;
  }
  const L = parseLocation(instanceId);
  parsedLocation.value = L;
  setText(L);
  instanceName.value = L.instanceName;
  closedAt.value = "";
  if (!L.isRealInstance) {
    return;
  }

  applyInstanceRef(L);
  updateGroupName(L, instanceId);
  updateRegion(L);
  strict.value = L.strict;
  ageGate.value = L.ageGate;
}

function applyInstanceRef(parsed: ParsedLocation) {
  const cachedInstanceRef = cachedInstances.get(parsed.tag);
  if (typeof cachedInstanceRef === "undefined") {
    return;
  }
  instanceRef.value = cachedInstanceRef;
  if (cachedInstanceRef.displayName) {
    setText(parsed);
    instanceName.value = cachedInstanceRef.displayName;
  }
  if (cachedInstanceRef.closedAt) {
    closedAt.value = cachedInstanceRef.closedAt;
  }
}

function updateGroupName(parsed: ParsedLocation, instanceId: string | undefined) {
  if (props.excludeGroupName) {
    return;
  }
  if (props.grouphint) {
    groupName.value = props.grouphint;
    return;
  }
  if (!parsed.groupId) {
    return;
  }
  groupName.value = parsed.groupId;
  void getGroupName(instanceId)
    .then((name) => {
      if (!isDisposed && name && currentInstanceId() === parsed.tag) {
        groupName.value = name;
      }
    })
    .catch(logFailure("Failed to load group name:"));
}

function updateRegion(parsed: ParsedLocation) {
  region.value = resolveRegion(parsed);
}

function getAccessTypeLabel(accessTypeName: string) {
  return translateAccessType(accessTypeName, t, accessTypeLocaleKeyMap);
}

function setText(parsed: ParsedLocation) {
  const accessTypeLabel = getAccessTypeLabel(parsed.accessTypeName);
  const cachedRef = parsed.worldId ? cachedWorlds.get(parsed.worldId) : undefined;
  const worldName = typeof cachedRef !== "undefined" ? cachedRef.name : undefined;

  text.value = getLocationText(parsed, {
    hint: props.hint,
    worldName,
    accessTypeLabel,
    t,
  });

  if (parsed.worldId && typeof cachedRef === "undefined") {
    void getWorldName(parsed.worldId)
      .then((name) => {
        if (!isDisposed && name && currentInstanceId() === parsed.tag) {
          text.value = getLocationText(parsed, {
            hint: props.hint,
            worldName: name,
            accessTypeLabel: getAccessTypeLabel(parsed.accessTypeName),
            t,
          });
        }
      })
      .catch(logFailure("Failed to load world name:"));
  }
}

function handleShowWorldDialog() {
  if (props.link) {
    const instanceId = currentInstanceId();
    if (!instanceId && props.hint.length === 8) {
      void verifyShortName("", props.hint).catch(logFailure("Checking the instance short name failed:"));
      return;
    }
    if (props.isOpenPreviousInstanceInfoDialog) {
      showPreviousInstancesInfoDialog(instanceId ?? "");
    } else {
      showWorldDialog(instanceId ?? "");
    }
  }
}

function handleShowGroupDialog() {
  const location = currentInstanceId();
  if (!location) {
    return;
  }
  const L = parseLocation(location);
  if (!L.groupId) {
    return;
  }
  showGroupDialog(L.groupId);
}

function handleShareLocation() {
  const L = parsedLocation.value;
  if (!L.worldId) return;
  copyToClipboard(`https://vrchat.com/home/world/${L.worldId}`, t("message.world.url_copied"));
}

function handleNewInstance() {
  const L = parsedLocation.value;
  if (!L.worldId) return;
  showWorldDialog(L.tag, L.shortName);
}

function handleNewInstanceSelfInvite() {
  const L = parsedLocation.value;
  if (!L.worldId) return;
  runNewInstanceSelfInviteFlow(L.worldId);
}

function handleShowPreviousInstances() {
  const instanceId = currentInstanceId();
  if (!instanceId) return;
  showPreviousInstancesInfoDialog(instanceId);
}
</script>
