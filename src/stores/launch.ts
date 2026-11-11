import { nextTick, ref, watch } from "vue";
import { defineStore } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import type { InstanceShortNameResponse } from "vrchat";
import type { Json } from "../types/vrcx";

import { instanceRequest } from "../api/instance";
import { parseLocation } from "../shared/utils/location-parser";
import { watchState } from "../services/watch-state";

import { configRepository } from "../services/config";

type LaunchDialogData = {
  visible: boolean;
  loading: boolean;
  tag: string;
  shortName: string | null;
};

function toShortName(json: Json<InstanceShortNameResponse> | undefined) {
  if (!json) {
    return "";
  }
  if (json.shortName) {
    return json.shortName;
  }
  return json.secureName;
}

function toInviteShortName(shortName: string | null | undefined) {
  return shortName ? { shortName } : {};
}

export const useLaunchStore = defineStore("Launch", () => {
  const isLaunchOptionsDialogVisible = ref(false);
  const isOpeningInstance = ref(false);
  const { t } = useI18n();
  const launchDialogData = ref<LaunchDialogData>({
    visible: false,
    loading: false,
    tag: "",
    shortName: "",
  });

  watch(
    () => watchState.isLoggedIn,
    () => {
      isLaunchOptionsDialogVisible.value = false;
    },
    { flush: "sync" }
  );

  function showLaunchOptions() {
    isLaunchOptionsDialogVisible.value = true;
  }

  async function showLaunchDialog(tag: string, shortName: string | null = null) {
    launchDialogData.value = {
      visible: true,

      loading: true,
      tag,
      shortName,
    };
    await nextTick(() => {
      launchDialogData.value.loading = false;
    });
  }

  async function getLaunchUrl(location: string, shortName: string | null | undefined): Promise<string> {
    const L = parseLocation(location);
    if (shortName && L.groupAccessType !== "public") {
      return `vrchat://launch?ref=vrcx.app&id=${location}&shortName=${shortName}`;
    }

    const response = await instanceRequest.getInstanceShortName({
      worldId: L.worldId,
      instanceId: L.instanceId,
    });
    const newShortName = toShortName(response.json);
    if (newShortName) {
      return `vrchat://launch?ref=vrcx.app&id=${location}&shortName=${newShortName}`;
    }
    return `vrchat://launch?ref=vrcx.app&id=${location}`;
  }

  async function tryOpenInstanceInVrc(location: string, shortName: string | null | undefined) {
    if (isOpeningInstance.value) {
      return;
    }
    isOpeningInstance.value = true;
    let launchUrl = "";
    let isOpened = false;
    try {
      launchUrl = await getLaunchUrl(location, shortName);
      isOpened = await AppApi.TryOpenInstanceInVrc(launchUrl);
    } catch (e: unknown) {
      console.error(e);
    }
    console.log("Attach Game", launchUrl, isOpened);
    if (!isOpened) {
      toast.warning("Failed open instance in VRChat, falling back to self invite");

      try {
        const L = parseLocation(location);
        await instanceRequest.selfInvite({
          instanceId: L.instanceId,
          worldId: L.worldId,
          ...toInviteShortName(shortName),
        });
        toast.success(t("message.invite.self_sent"));
      } catch (e: unknown) {
        console.error(e);
      }
    }
    setTimeout(() => {
      isOpeningInstance.value = false;
    }, 1000);
  }

  async function launchGame(location: string, shortName: string | null | undefined, isDesktopMode: boolean) {
    const launchUrl = await getLaunchUrl(location, shortName);
    const args = [launchUrl];
    const launchArguments = await configRepository.getString("launchArguments");
    const vrcLaunchPathOverride = await configRepository.getString("vrcLaunchPathOverride");
    if (launchArguments) {
      args.push(launchArguments);
    }
    if (isDesktopMode) {
      args.push("--no-vr");
    }
    try {
      if (vrcLaunchPathOverride && !isHostLinux) {
        const isStarted = await AppApi.StartGameFromPath(vrcLaunchPathOverride, args.join(" "));
        if (!isStarted) {
          toast.error("Failed to launch VRChat, invalid custom path set");
        } else {
          toast.success("VRChat launched");
        }
      } else {
        const isStarted = await AppApi.StartGame(args.join(" "));
        if (!isStarted) {
          toast.error("Failed to find VRChat, set a custom path in launch options");
        } else {
          toast.success("VRChat launched");
        }
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error(`Failed to launch VRChat: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log("Launch Game", args.join(" "), isDesktopMode);
  }

  return {
    isLaunchOptionsDialogVisible,
    isOpeningInstance,
    launchDialogData,
    showLaunchOptions,
    showLaunchDialog,
    getLaunchUrl,
    launchGame,
    tryOpenInstanceInVrc,
  };
});
