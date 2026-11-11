<template>
  <Dialog v-model:open="isVisible">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.launch.header") }}</DialogTitle>
        <DialogDescription class="sr-only">{{ t("dialog.launch.header") }}</DialogDescription>
      </DialogHeader>
      <FieldGroup class="gap-4">
        <Field>
          <FieldLabel>{{ t("dialog.launch.url") }}</FieldLabel>
          <FieldContent class="flex-row items-center gap-2">
            <InputGroupField v-model="launchDialog.url" size="sm" @click="selectInputText" />
            <TooltipWrapper side="right" :content="t('dialog.launch.copy_tooltip')">
              <Button
                class="rounded-full"
                size="icon-sm"
                variant="ghost"
                :aria-label="t('dialog.launch.copy_tooltip')"
                @click="copyInstanceMessage(launchDialog.url)"
                ><Copy
              /></Button>
            </TooltipWrapper>
          </FieldContent>
        </Field>
        <Field v-if="launchDialog.shortUrl">
          <FieldLabel>
            <span class="flex items-center gap-1">
              <span>{{ t("dialog.launch.short_url") }}</span>
              <TooltipWrapper side="top" :content="t('dialog.launch.short_url_notice')">
                <Info class="text-muted-foreground" :aria-label="t('dialog.launch.short_url_notice')" />
              </TooltipWrapper>
            </span>
          </FieldLabel>
          <FieldContent class="flex-row items-center gap-2">
            <InputGroupField v-model="launchDialog.shortUrl" size="sm" @click="selectInputText" />
            <TooltipWrapper side="right" :content="t('dialog.launch.copy_tooltip')">
              <Button
                class="rounded-full"
                size="icon-sm"
                variant="ghost"
                :aria-label="t('dialog.launch.copy_tooltip')"
                @click="copyInstanceMessage(launchDialog.shortUrl)"
                ><Copy
              /></Button>
            </TooltipWrapper>
          </FieldContent>
        </Field>
        <Field>
          <FieldLabel>{{ t("dialog.launch.location") }}</FieldLabel>
          <FieldContent class="flex-row items-center gap-2">
            <InputGroupField v-model="launchDialog.location" size="sm" @click="selectInputText" />
            <TooltipWrapper side="right" :content="t('dialog.launch.copy_tooltip')">
              <Button
                class="rounded-full"
                size="icon-sm"
                variant="ghost"
                :aria-label="t('dialog.launch.copy_tooltip')"
                @click="copyInstanceMessage(launchDialog.location)"
                ><Copy
              /></Button>
            </TooltipWrapper>
          </FieldContent>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button class="mr-1.5" variant="outline" :disabled="!checkCanInvite(launchDialog.location)" @click="showInviteDialog(launchDialog.location)">
          {{ t("dialog.launch.invite") }}
        </Button>
        <Button
          v-if="canOpenInstanceInGame"
          variant="outline"
          :disabled="!launchDialog.secureOrShortName"
          @click="handleAttachGame(launchDialog.location, launchDialog.shortName)"
        >
          {{ t("dialog.launch.open_ingame") }}
        </Button>
        <Button
          v-else
          variant="outline"
          class="mr-1.25"
          :disabled="!launchDialog.secureOrShortName"
          @click="selfInvite(launchDialog.location, launchDialog.shortName)"
        >
          {{ t("dialog.launch.self_invite") }}
        </Button>
        <ButtonGroup>
          <Button :disabled="!launchDialog.secureOrShortName" @click="handleLaunchDefault(launchDialog.location, launchDialog.shortName)">
            {{ launchModeLabel }}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button size="icon" :disabled="!launchDialog.secureOrShortName" :aria-label="t('dialog.new_instance.launch')">
                <MoreHorizontal class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-52">
              <DropdownMenuItem @click="handleLaunchCommand(launchDialog.desktop ? 'vr' : 'desktop', launchDialog.location, launchDialog.shortName)">
                {{ launchDialog.desktop ? t("dialog.launch.launch") : t("dialog.launch.start_as_desktop") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </DialogFooter>

      <InviteDialog :invite-dialog="inviteDialog" @close-invite-dialog="closeInviteDialog" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { Copy, Info, MoreHorizontal } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import ButtonGroup from "@/components/ui/button-group/ButtonGroup.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useFriendStore } from "../../stores/friend";
import { useGameStore } from "../../stores/game";
import { useInviteStore } from "../../stores/invite";
import { useLaunchStore } from "../../stores/launch";
import { useLocationStore } from "../../stores/location";
import { logFailure } from "../../stores/log-failure";
import { useModalStore } from "../../stores/modal";
import { getLaunchURL, isRealInstance } from "../../shared/utils/instance";
import { parseLocation } from "../../shared/utils/location-parser";
import { useInviteChecks } from "../../composables/use-invite-checks";
import { instanceRequest } from "../../api/instance";
import { queryRequest } from "../../api/query-request";

import InviteDialog from "./InviteDialog/InviteDialog.vue";
import type { InviteDialogState } from "./InviteDialog/invite-dialog-types";
import { configRepository } from "../../services/config";

const { t } = useI18n();

const modalStore = useModalStore();

const { friends } = storeToRefs(useFriendStore());
const { lastLocation } = storeToRefs(useLocationStore());
const { launchGame, tryOpenInstanceInVrc } = useLaunchStore();
const { launchDialogData } = storeToRefs(useLaunchStore());

const { canOpenInstanceInGame } = storeToRefs(useInviteStore());
const { isGameRunning } = storeToRefs(useGameStore());
const { checkCanInvite } = useInviteChecks();

const launchModeLabel = computed(() => (launchDialog.value.desktop ? t("dialog.launch.start_as_desktop") : t("dialog.launch.launch")));

let launchAsDesktopTimeoutId: ReturnType<typeof setTimeout> | undefined;

function selectInputText(event: MouseEvent) {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    target.select();
  }
}

onBeforeUnmount(() => {
  clearTimeout(launchAsDesktopTimeoutId);
});

const launchDialog = ref({
  loading: false,
  desktop: false,
  tag: "",
  location: "",
  url: "",
  shortName: "",
  shortUrl: "",
  secureOrShortName: "",
});

const inviteDialog = ref<InviteDialogState>({
  visible: false,
  loading: false,
  worldId: "",
  worldName: "",
  userIds: [],
  friendsInInstance: [],
});

const isVisible = computed({
  get() {
    return launchDialogData.value.visible;
  },
  set(isOpen: boolean) {
    launchDialogData.value.visible = isOpen;
  },
});

watch(
  () => launchDialogData.value.loading,
  (isLoading) => {
    if (isLoading) {
      getConfig();
      void initLaunchDialog().catch(logFailure("Preparing the launch dialog failed:"));
    }
  }
);

getConfig();

function closeInviteDialog() {
  inviteDialog.value.visible = false;
}

function showInviteDialog(tag: string) {
  if (!isRealInstance(tag)) {
    return;
  }
  const L = parseLocation(tag);
  void queryRequest
    .fetch("world", {
      worldId: L.worldId,
    })
    .then((args) => {
      const D = inviteDialog.value;
      D.userIds = [];
      D.worldId = L.tag;
      D.worldName = args.ref.name;
      D.friendsInInstance = [];
      const friendsInCurrentInstance = lastLocation.value.friendList;
      for (const friend of friendsInCurrentInstance.values()) {
        const ctx = friends.value.get(friend.userId);
        if (typeof ctx?.ref === "undefined") {
          continue;
        }
        D.friendsInInstance.push(ctx);
      }
      D.visible = true;
    })
    .catch(logFailure("Loading the world for the invite dialog failed:"));
}

function handleLaunchGame(location: string, shortName: string, isDesktop: boolean) {
  if (isGameRunning.value) {
    void modalStore
      .confirm({
        description: t("dialog.launch.game_running_warning"),
        title: t("dialog.launch.header"),
        confirmText: t("dialog.launch.confirm_yes"),
        cancelText: t("dialog.launch.confirm_no"),
      })
      .then(({ ok }) => {
        if (!ok) return;
        void launchGame(location, shortName, isDesktop).catch(logFailure("Launching the game failed:"));
        isVisible.value = false;
      })
      .catch(logFailure("Confirming the game launch failed:"));
    return;
  }
  void launchGame(location, shortName, isDesktop).catch(logFailure("Launching the game failed:"));
  isVisible.value = false;
}

function handleLaunchDefault(location: string, shortName: string) {
  handleLaunchGame(location, shortName, launchDialog.value.desktop);
}

function handleLaunchCommand(command: string, location: string, shortName: string) {
  const isDesktop = command === "desktop";
  void configRepository.setBool("launchAsDesktop", isDesktop).catch(logFailure("Saving the launch mode failed:"));
  handleLaunchGame(location, shortName, isDesktop);
  clearTimeout(launchAsDesktopTimeoutId);
  launchAsDesktopTimeoutId = setTimeout(() => {
    launchDialog.value.desktop = isDesktop;
  }, 500);
}

function handleAttachGame(location: string, shortName: string) {
  void tryOpenInstanceInVrc(location, shortName).catch(logFailure("Opening the instance in VRChat failed:"));
  isVisible.value = false;
}

function selfInvite(location: string, shortName: string) {
  const L = parseLocation(location);
  if (!L.isRealInstance) {
    return;
  }
  void instanceRequest
    .selfInvite({
      instanceId: L.instanceId,
      worldId: L.worldId,
      shortName,
    })
    .then((args) => {
      toast.success(t("message.invite.self_sent"));
      return args;
    })
    .catch(logFailure("Sending the self invite failed:"));
}

function getConfig() {
  void configRepository
    .getBool("launchAsDesktop")
    .then((isDesktop) => (launchDialog.value.desktop = isDesktop ?? false))
    .catch(logFailure("Loading the launch mode failed:"));
}
async function initLaunchDialog() {
  const tag = launchDialogData.value.tag;
  const shortName = launchDialogData.value.shortName ?? "";
  if (!isRealInstance(tag)) {
    return;
  }
  const D = launchDialog.value;
  D.tag = tag;
  D.secureOrShortName = shortName;
  D.shortUrl = "";
  D.shortName = shortName;
  const L = parseLocation(tag);
  L.shortName = shortName;
  if (shortName) {
    D.shortUrl = `https://vrch.at/${shortName}`;
  }
  if (L.instanceId) {
    D.location = `${L.worldId}:${L.instanceId}`;
  } else {
    D.location = L.worldId;
  }
  D.url = getLaunchURL(L);
  if (!shortName) {
    const res = await instanceRequest.getInstanceShortName({
      worldId: L.worldId,
      instanceId: L.instanceId,
    });
    const resLocation = `${res.instance.worldId}:${res.instance.instanceId}`;
    if (resLocation === launchDialog.value.tag) {
      const resShortName = res.json.shortName ?? "";
      let secureOrShortName = res.json.secureName;
      if (res.json.shortName) {
        secureOrShortName = res.json.shortName;
      }
      const parsedL = parseLocation(resLocation);
      parsedL.shortName = resShortName;
      launchDialog.value.shortName = resShortName;
      launchDialog.value.secureOrShortName = secureOrShortName;
      if (resShortName) {
        launchDialog.value.shortUrl = `https://vrch.at/${resShortName}`;
      }
      launchDialog.value.url = getLaunchURL(parsedL);
    }
  }
}

async function copyInstanceMessage(input: string) {
  try {
    await navigator.clipboard.writeText(input);
    toast.success("Instance copied to clipboard");
  } catch (error: unknown) {
    toast.error("Instance copied failed");
    console.error(error);
  }
}
</script>
