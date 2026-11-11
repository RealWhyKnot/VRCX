<template>
  <div class="flex row-auto gap-2" v-bind="$attrs">
    <div v-if="showButtons" class="flex row-auto gap-2">
      <div v-if="showLaunchButton" class="inline-block">
        <TooltipWrapper side="top" :content="t('dialog.user.info.launch_invite_tooltip')">
          <Button
            class="rounded-full w-6 h-6 text-xs text-muted-foreground hover:text-foreground"
            :style="buttonStyle"
            size="icon-sm"
            variant="outline"
            :aria-label="t('dialog.user.info.launch_invite_tooltip')"
            @click="confirmLaunch"
          >
            <LogIn />
          </Button>
        </TooltipWrapper>
      </div>
      <div v-if="showInviteYourself" class="inline-block">
        <TooltipWrapper v-if="!canOpenInstanceInGame" side="top" :content="t('dialog.user.info.self_invite_tooltip')">
          <Button
            class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-foreground"
            :style="buttonStyle"
            size="icon-sm"
            variant="outline"
            :aria-label="t('dialog.user.info.self_invite_tooltip')"
            @click="confirmInvite"
          >
            <Mail class="h-4 w-4" />
          </Button>
        </TooltipWrapper>
        <TooltipWrapper v-else side="top" :content="t('dialog.user.info.open_in_vrchat_tooltip')">
          <Button
            v-if="isOpeningInstance"
            class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-foreground"
            :style="buttonStyle"
            size="icon-sm"
            variant="outline"
            :aria-label="t('dialog.user.info.open_in_vrchat_tooltip')"
          >
            <Loader2 class="h-4 w-4 animate-spin" />
          </Button>
          <Button
            v-else
            class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-foreground"
            :style="buttonStyle"
            size="icon-sm"
            variant="outline"
            :aria-label="t('dialog.user.info.open_in_vrchat_tooltip')"
            @click="openInstance"
          >
            <Mail class="h-4 w-4" />
          </Button>
        </TooltipWrapper>
      </div>
      <TooltipWrapper v-if="instanceInfoState.canSendAnnouncement" side="top" :content="t('dialog.user.info.instance_announcement_tooltip')">
        <Button
          class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-foreground"
          :style="buttonStyle"
          size="icon-sm"
          variant="outline"
          :aria-label="t('dialog.user.info.instance_announcement_tooltip')"
          @click="instanceAnnouncementDialogVisible = true"
        >
          <Megaphone class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper v-if="instanceInfoState.canLinkCalendarEvent" side="top" :content="t('dialog.user.info.instance_calendar_link_tooltip')">
        <Button
          class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-foreground"
          :style="buttonStyle"
          size="icon-sm"
          variant="outline"
          :aria-label="t('dialog.user.info.instance_calendar_link_tooltip')"
          @click="instanceCalendarLinkDialogVisible = true"
        >
          <CalendarPlus class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper v-if="instanceInfoState.canRenameInstance" side="top" :content="t('dialog.user.info.rename_instance')">
        <Button
          class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-foreground"
          :style="buttonStyle"
          size="icon-sm"
          variant="outline"
          :aria-label="t('dialog.user.info.rename_instance')"
          @click="renameInstance(resolvedInstanceLocation)"
        >
          <Pencil class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper v-if="!instance?.closedAt && instanceInfoState.canCloseInstance" side="top" :content="t('dialog.user.info.close_instance')">
        <Button
          class="rounded-full h-6 w-6 text-xs text-muted-foreground hover:text-red-500"
          :style="buttonStyle"
          size="icon-sm"
          variant="outline"
          :aria-label="t('dialog.user.info.close_instance')"
          @click="closeInstance(resolvedInstanceLocation)"
        >
          <PowerIcon class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper v-if="showRefreshButton" side="top" :content="refreshTooltip">
        <Button
          class="rounded-full w-6 h-6 text-xs text-muted-foreground hover:text-foreground"
          :style="buttonStyle"
          size="icon"
          variant="outline"
          :aria-label="t('common.actions.refresh')"
          @click="handleRefresh"
        >
          <RefreshCw class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
      <TooltipWrapper v-if="showHistoryButton" side="top" :content="historyTooltip">
        <Button
          class="rounded-full w-6 h-6 text-xs text-muted-foreground hover:text-foreground"
          :style="buttonStyle"
          size="icon-sm"
          variant="outline"
          :aria-label="t('dialog.social_status.history')"
          @click="handleHistory"
        >
          <History class="h-4 w-4" />
        </Button>
      </TooltipWrapper>
    </div>

    <InstanceInfoBadges
      v-if="showInstanceInfo"
      :instance="instance"
      :instance-location="resolvedInstanceLocation"
      :last-join="lastJoin"
      :show-last-join="showLastJoin"
      :friendcount="friendcount"
      :instance-info-state="instanceInfoState"
      :extra-class="props.class"
    />
    <InstanceAnnouncementDialog
      v-if="instanceAnnouncementDialogVisible"
      v-model:open="instanceAnnouncementDialogVisible"
      :location="resolvedInstanceLocation"
    />
    <InstanceCalendarLinkDialog
      v-if="instanceCalendarLinkDialogVisible"
      v-model:open="instanceCalendarLinkDialogVisible"
      :location="resolvedInstanceLocation"
      :current-event-id="instance?.calendarEntryId ?? ''"
    />
  </div>
</template>
<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { CSSProperties } from "vue";
import type { ClassValue } from "clsx";
import Button from "@/components/ui/button/Button.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { CalendarPlus, History, Loader2, LogIn, Mail, Megaphone, Pencil, PowerIcon, RefreshCw } from "lucide-vue-next";
import type { RoomRef } from "../stores/instance-types";
import { useInstanceStore } from "../stores/instance";
import { useInviteStore } from "../stores/invite";
import { useLaunchStore } from "../stores/launch";
import { logFailure } from "../stores/log-failure";
import { useModalStore } from "../stores/modal";
import { parseLocation } from "../shared/utils/location-parser";
import { useInviteChecks } from "../composables/use-invite-checks";
import { useInstanceInfoState } from "../composables/use-instance-info-state";
import { instanceRequest } from "../api/instance";
import { miscRequest } from "../api/misc";
import InstanceAnnouncementDialog from "./dialogs/InstanceAnnouncementDialog.vue";
import InstanceCalendarLinkDialog from "./dialogs/InstanceCalendarLinkDialog.vue";
import InstanceInfoBadges from "./InstanceInfoBadges.vue";

defineOptions({
  inheritAttrs: false,
});

const { t } = useI18n();

const instanceStore = useInstanceStore();
const launchStore = useLaunchStore();
const inviteStore = useInviteStore();
const modalStore = useModalStore();
const { instanceJoinHistory } = storeToRefs(instanceStore);
const { canOpenInstanceInGame } = storeToRefs(inviteStore);
const { isOpeningInstance } = storeToRefs(launchStore);
const { checkCanInviteSelf } = useInviteChecks();

type InstanceActionBarProps = {
  location?: string;
  launchLocation?: string;
  inviteLocation?: string;
  lastJoinLocation?: string;
  instanceLocation?: string;
  shortname?: string;
  instance?: RoomRef | null;
  friendcount?: number | undefined;
  currentlocation?: string;
  showLaunch?: boolean;
  showInvite?: boolean;
  showRefresh?: boolean;
  showHistory?: boolean;
  showLastJoin?: boolean;
  showInstanceInfo?: boolean;
  showButtons?: boolean;
  refreshTooltip?: string;
  historyTooltip?: string;
  onRefresh?: (() => void) | null;
  onHistory?: (() => void) | null;
  buttonStyle?: CSSProperties;
  class?: ClassValue | undefined;
};

const props = withDefaults(defineProps<InstanceActionBarProps>(), {
  location: "",
  launchLocation: "",
  inviteLocation: "",
  lastJoinLocation: "",
  instanceLocation: "",
  shortname: "",
  instance: null,
  friendcount: undefined,
  currentlocation: "",
  class: undefined,
  showLaunch: true,
  showInvite: true,
  showRefresh: true,
  showHistory: false,
  showLastJoin: true,
  showInstanceInfo: true,
  showButtons: true,
  refreshTooltip: "",
  historyTooltip: "",
  onRefresh: null,
  onHistory: null,
  buttonStyle: () => ({}),
});

const resolvedLaunchLocation = computed(() => (props.launchLocation !== "" ? props.launchLocation : props.location));
const resolvedInviteLocation = computed(() => (props.inviteLocation !== "" ? props.inviteLocation : props.location));
const resolvedLastJoinLocation = computed(() => (props.lastJoinLocation !== "" ? props.lastJoinLocation : props.location));
const resolvedInstanceLocation = computed(() => (props.instanceLocation !== "" ? props.instanceLocation : props.location));

const showLaunchButton = computed(() => props.showLaunch && checkCanInviteSelf(resolvedLaunchLocation.value));
const showInviteYourself = computed(() => props.showInvite && checkCanInviteSelf(resolvedInviteLocation.value));

const showRefreshButton = computed(() => props.showRefresh && typeof props.onRefresh === "function");
const showHistoryButton = computed(() => props.showHistory && typeof props.onHistory === "function");

const lastJoin = ref<number | undefined>();
const instanceAnnouncementDialogVisible = ref(false);
const instanceCalendarLinkDialogVisible = ref(false);
const { instanceInfoState } = useInstanceInfoState(props, resolvedInstanceLocation);

const handleRefresh = () => {
  if (typeof props.onRefresh === "function") {
    props.onRefresh();
  }
};

const handleHistory = () => {
  if (typeof props.onHistory === "function") {
    props.onHistory();
  }
};

const confirmLaunch = () => {
  void launchStore.showLaunchDialog(resolvedLaunchLocation.value).catch(logFailure("Showing the launch dialog failed:"));
};

const confirmInvite = () => {
  const L = parseLocation(resolvedInviteLocation.value);
  if (!L.isRealInstance) {
    return;
  }

  void instanceRequest
    .selfInvite({
      instanceId: L.instanceId,
      worldId: L.worldId,
      shortName: props.shortname,
    })
    .then(() => {
      toast.success(t("message.invite.self_sent"));
    })
    .catch(logFailure("Sending the self invite failed:"));
};

const openInstance = () => {
  const L = parseLocation(resolvedInviteLocation.value);
  if (!L.isRealInstance) {
    return;
  }

  void launchStore.tryOpenInstanceInVrc(L.tag, props.shortname).catch(logFailure("Opening the instance in VRChat failed:"));
};

const parseLastJoin = () => {
  lastJoin.value = instanceJoinHistory.value.get(resolvedLastJoinLocation.value);
};
const refreshInstance = (location: string) => {
  const L = parseLocation(location);
  return instanceRequest.getInstance({ worldId: L.worldId, instanceId: L.instanceId });
};

const closeInstance = (location: string) => {
  void modalStore
    .confirm({
      description: t("confirm.close_instance"),
      title: t("confirm.title"),
    })
    .then(async ({ ok }) => {
      if (!ok) return;
      const args = await miscRequest.closeInstance({ location, hardClose: false });
      toast.success(t("message.instance.closed"));
      instanceStore.applyInstance(args.json);
      await refreshInstance(location);
    })
    .catch(logFailure("Closing the instance failed:"));
};

const renameInstance = (location: string) => {
  void modalStore
    .prompt({
      title: t("prompt.rename_instance.header"),
      description: t("prompt.rename_instance.description"),
      inputValue: props.instance?.displayName ?? "",
    })
    .then(async ({ ok, value }) => {
      if (!ok) return;
      const displayName = value.trim() || null;
      if (displayName === (props.instance?.displayName ?? null)) return;
      await instanceRequest.updateInstance({ location, displayName });
      toast.success(t("message.instance.renamed"));
      await refreshInstance(location);
    })
    .catch(logFailure("Renaming the instance failed:"));
};

watch(() => resolvedLastJoinLocation.value, parseLastJoin, { immediate: true });
watch(() => props.currentlocation, parseLastJoin);
</script>
