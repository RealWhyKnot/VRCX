<template>
  <div id="x-app" class="flex w-screen h-screen overflow-hidden cursor-default x-app-type">
    <div class="wrist" :class="{ background: config && config.backgroundEnabled }">
      <div class="x-container flex-1">
        <div ref="list" class="x-friend-list [color:var(--vr-text-secondary)]">
          <WristFeedMinimal v-if="config && config.minimalFeed" :wrist-feed="wristFeed" :culture="currentCulture" :is-hour12="config.dtHour12" />
          <WristFeedFull v-else :wrist-feed="wristFeed" :culture="currentCulture" :is-hour12="config.dtHour12" />
        </div>
      </div>
      <div v-if="devices.length" class="x-containerbottom">
        <div class="flex [flex-flow:row_wrap]">
          <div v-for="(device, index) in devices" :key="`device-${index}-${device[0]}`" class="tracker-container">
            <div v-if="device[0] === 'headset'" class="tracker-device" :class="trackingResultToClass(device[4])">
              <img
                v-if="device[1] !== 'connected'"
                class="tracker-device"
                src="/images/vr/headset_quest_status_off.png"
                :class="trackingResultToClass(device[4])"
              />
              <img v-else-if="device[2] === 'charging'" src="/images/vr/headset_quest_status_ready_charging.png" />
              <img v-else-if="Number(device[3]) < 20" src="/images/vr/headset_quest_status_ready_low.png" />
              <img v-else src="/images/vr/headset_quest_status_ready.png" />
              <span>{{ device[3] }}%</span>
            </div>
            <div v-if="device[0] === 'leftController'" class="tracker-device" :class="trackingResultToClass(device[4])">
              <img
                v-if="device[1] !== 'connected'"
                class="tracker-device"
                src="/images/vr/left_controller_status_off.png"
                :class="trackingResultToClass(device[4])"
              />
              <img v-else-if="device[2] === 'charging'" src="/images/vr/left_controller_status_ready_charging.png" />
              <img v-else-if="Number(device[3]) < 20" src="/images/vr/left_controller_status_ready_low.png" />
              <img v-else src="/images/vr/left_controller_status_ready.png" />
              <span>{{ device[3] }}%</span>
            </div>
            <div v-else-if="device[0] === 'rightController'" class="tracker-device" :class="trackingResultToClass(device[4])">
              <img v-if="device[1] !== 'connected'" src="/images/vr/right_controller_status_off.png" />
              <img v-else-if="device[2] === 'charging'" src="/images/vr/right_controller_status_ready_charging.png" />
              <img v-else-if="Number(device[3]) < 20" src="/images/vr/right_controller_status_ready_low.png" />
              <img v-else src="/images/vr/right_controller_status_ready.png" />
              <span>{{ device[3] }}%</span>
            </div>
            <div v-else-if="device[0] === 'controller'" class="tracker-device" :class="trackingResultToClass(device[4])">
              <img v-if="device[1] !== 'connected'" src="/images/vr/controller_status_off.png" />
              <img v-else-if="device[2] === 'charging'" src="/images/vr/controller_status_ready_charging.png" />
              <img v-else-if="Number(device[3]) < 20" src="/images/vr/controller_status_ready_low.png" />
              <img v-else src="/images/vr/controller_status_ready.png" />
              <span>{{ device[3] }}%</span>
            </div>
            <div v-else-if="device[0] === 'tracker'" class="tracker-device" :class="trackingResultToClass(device[4])">
              <img v-if="device[1] !== 'connected'" src="/images/vr/tracker_status_off.png" />
              <img v-else-if="device[2] === 'charging'" src="/images/vr/tracker_status_ready_charging.png" />
              <img v-else-if="Number(device[3]) < 20" src="/images/vr/tracker_status_ready_low.png" />
              <img v-else src="/images/vr/tracker_status_ready.png" />
              <span>{{ device[3] }}%</span>
            </div>
            <div v-else-if="device[0] === 'base'" class="tracker-device" :class="trackingResultToClass(device[4])">
              <img v-if="device[1] !== 'connected'" src="/images/vr/base_status_off.png" />
              <img v-else src="/images/vr/base_status_ready.png" />
              <span v-if="device[3] !== 100">{{ device[3] }}x</span>
            </div>
          </div>
        </div>
      </div>
      <div class="x-containerbottom">
        <template v-if="nowPlaying.playing">
          <span class="float-right pl-[10px]">{{ nowPlaying.remainingText }}</span>
          <MarqueeText>{{ nowPlaying.name }}</MarqueeText>
          <div
            class="np-progress-bar ml-[5px]"
            :style="{ '--vr-np-progress': Number.isFinite(nowPlaying.percentage) ? nowPlaying.percentage + '%' : '0%' }"
          ></div>
        </template>
        <div class="float-right">
          <span v-if="!config?.minimalFeed" class="inline-block mr-[5px]">{{ t("vr.status.timer") }}</span>
          <span v-if="lastLocationTimer" class="inline-block mr-[5px]">{{ lastLocationTimer }}</span>
          <span v-if="lastLocationTimer && (onlineForTimer || pcUptime)" class="inline-block"> | </span>
          <span v-if="onlineForTimer" class="inline-block ml-[5px]">{{ onlineForTimer }}</span>
          <span v-if="pcUptime && onlineForTimer" class="inline-block ml-[5px]"> | </span>
          <span v-if="pcUptime" class="inline-block ml-[5px]">{{ pcUptime }}</span>
        </div>
        <template v-if="lastLocation.playerList.length">
          <span v-if="!config?.minimalFeed" class="inline-block mr-[5px]">{{ t("vr.status.players") }}</span>
          <span class="inline-block">{{ lastLocation.playerList.length }}</span>
        </template>
        <span v-if="lastLocation.friendList.length" class="inline-block font-bold ml-[5px]">({{ lastLocation.friendList.length }})</span>

        <br />
        <span class="absolute right-[10px]">{{ currentTime }}</span>
        <span v-if="config && cpuUsageEnabled" class="inline-block mr-[5px]">{{ t("vr.status.cpu") }} {{ cpuUsage }}%</span>
        <span class="inline-block">{{ t("vr.status.online") }} {{ onlineFriendCount }}</span>
        <span class="inline-block ml-[5px]">{{ customInfo }}</span>
      </div>
    </div>

    <div class="hmd">
      <svg class="np-progress-circle">
        <circle class="np-progress-circle-stroke" cx="60" cy="60" stroke="white" r="30" fill="transparent" stroke-width="60"></circle>
      </svg>
      <div class="hud-feed">
        <div v-for="(feed, index) in hudFeed" :key="`hud-${index}-${feed.displayName}-${feed.time}`">
          <div class="item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
            <span v-if="feed.isMaster">👑</span><span v-if="feed.isModerator">⚔️</span
            ><strong class="name" :style="{ '--vr-name-colour': feed.colour }" v-text="feed.displayName"></strong>
            <template v-if="feed.type === 'ChangeAvatar'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">ChangeAvatar</span>
              <span v-if="!feed.inCache" class="[color:var(--vr-text-muted)] ml-[10px]"><Loader2 data-loading class="inline-block h-4 w-4" /> </span>
              <span class="ml-[10px]" v-text="feed.avatar.name"></span>
              <span v-if="feed.avatar.releaseStatus === 'public'" class="ml-[10px] [color:var(--status-online)]">(Public)</span>
              <span v-else-if="feed.avatar.releaseStatus === 'private'" class="ml-[10px] [color:var(--status-askme)]">(Private)</span>
            </template>
            <template v-else-if="feed.type === 'ChangeStatus'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">ChangeStatus</span>
              <span v-if="feed.status !== feed.previousStatus">
                <i class="x-user-status ml-[10px] w-[20px] h-[20px]" :class="statusClass(feed.previousStatus)"></i>
                <span>
                  <ArrowRight class="mx-1 inline-block h-4 w-4" />
                </span>
                <i class="x-user-status w-[20px] h-[20px]" :class="statusClass(feed.status)"></i>
              </span>
              <span v-if="feed.statusDescription !== feed.previousStatusDescription" class="ml-[10px]" v-text="feed.statusDescription"></span>
            </template>
            <template v-else-if="feed.type === 'ChangeGroup'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">ChangeGroup</span>
              <span class="ml-[10px]" v-text="feed.groupName"></span>
            </template>
            <template v-else-if="feed.type === 'ChatBoxMessage'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">ChatBox</span>
              <span class="ml-[10px] whitespace-normal" v-text="feed.text"></span>
            </template>
            <template v-else-if="feed.type === 'PortalSpawn'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">PortalSpawn</span>
              <VrLocation class="ml-[10px]" :location="feed.location" :hint="feed.worldName" :grouphint="feed.groupName" :link="false"></VrLocation>
            </template>
            <template v-else-if="feed.type === 'OnPlayerJoined'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">has joined</span>
              <span v-if="feed.platform === 'Desktop'" class="[color:var(--status-joinme)] ml-[10px]">Desktop</span>
              <span v-else-if="feed.platform === 'VR'" class="[color:var(--status-joinme)] ml-[10px]">VR</span>
              <span v-else-if="feed.platform === 'Quest'" class="[color:var(--platform-quest)] ml-[10px]">Android</span>
              <span v-else-if="feed.platform === 'iOS'" class="[color:var(--platform-ios)] ml-[10px]">iOS</span>
              <span v-if="!feed.inCache" class="[color:var(--vr-text-muted)] ml-[10px]"><Download class="inline-block h-4 w-4" /> </span>
              <span class="ml-[10px]" v-text="feed.avatar.name"></span>
            </template>
            <template v-else-if="feed.type === 'SpawnEmoji'">
              <span class="ml-[10px] [color:var(--vr-text-secondary)]">SpawnEmoji</span>
              <span class="ml-[10px]" v-text="feed.text"></span>
            </template>
            <span v-else-if="feed.color === 'yellow'" class="ml-[10px] [color:var(--vr-feed-yellow-text)]" v-text="feed.text"></span>
            <span v-else class="ml-[10px] [color:var(--vr-text-secondary)]" v-text="feed.text"></span>
            <template v-if="feed.combo > 1">
              <span class="combo ml-[10px]">x{{ feed.combo }}</span>
            </template>
          </div>
        </div>
      </div>
      <div v-if="hudTimeout.length > 0" class="hud-timeout">
        <div class="hud-timeout-feed">
          <div v-for="(feed, index) in hudTimeout" :key="`timeout-${index}-${feed.displayName}-${feed.time}`">
            <p class="item">({{ feed.time }}s) {{ feed.displayName }}</p>
          </div>
        </div>
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve">
          <path
            fill="#ED1B24"
            d="M68.6,96.5L87,78.1c1.6-1.6,1.6-4.1,0-5.7s-4.1-1.6-5.7,0L62.9,90.9L44.5,72.5l18.4-18.4c1.6-1.6,1.6-4.1,0-5.7c-1.6-1.6-4.1-1.6-5.7,0L38.9,66.8l-6.4-6.4L21.2,71.8C11,82,9.7,97.9,17.4,109.5L0,126.9l8.5,8.5L25.9,118c11.6,7.7,27.5,6.4,37.8-3.8L75,102.9C75,102.9,68.6,96.5,68.6,96.5z"
          ></path>
          <path
            fill="#ED1B24"
            d="M102.9,75l11.3-11.3c10.3-10.3,11.5-26.1,3.8-37.8l17.4-17.4L126.9,0l-17.4,17.4C97.9,9.7,82,11,71.8,21.2L60.5,32.5C102,74,60.8,32.9,102.9,75z"
          ></path>
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { isLinuxHost } from "@/shared/constants/platform";
import { nextTick, onBeforeUnmount, onMounted, reactive, toRefs } from "vue";
import { useI18n } from "vue-i18n";

import MarqueeText from "vue-marquee-text-component";
import { ArrowRight, Download, Loader2 } from "lucide-vue-next";

import { changeHtmlLangAttribute } from "../shared/utils/base/ui";
import { loadLocalizedStrings } from "../plugins/i18n";

import VrLocation from "./components/VrLocation.vue";
import WristFeedFull from "./components/WristFeedFull.vue";
import WristFeedMinimal from "./components/WristFeedMinimal.vue";
import { refreshCustomScript, setNotyOpacity, updateNowPlayingCircle } from "./vr-dom";
import { createHudFeed } from "./vr-hud";
import { logVrError } from "./vr-loop";
import { createOverlayQueueLoop } from "./vr-overlay";
import { isVrConfig, isVrFeedList, isVrLastLocation, isVrNowPlaying, parseVrPayload } from "./vr-payload";
import { notyClear, playNoty } from "./vr-noty";
import { createVrState } from "./vr-state";
import { createStatsLoop } from "./vr-stats";
import { statusClass, trackingResultToClass } from "./vr-status";

import "./vr.css";

defineOptions({
  name: "VrOverlay",
});

const { t, locale } = useI18n();

const vrState = reactive(createVrState());
const hudController = createHudFeed(vrState);
const statsLoop = createStatsLoop(vrState);
const overlayQueueLoop = createOverlayQueueLoop();

function configUpdate(json: string): void {
  vrState.config = parseVrPayload(json, "config", isVrConfig);
  if (vrState.config.isWristDisabled) {
    vrState.isWristDisabled = true;
  }
  if (!vrState.config.overlayNotifications) {
    vrState.isHmdDisabled = false;
  }
  vrState.hudFeed = [];
  vrState.hudTimeout = [];
  setDatetimeFormat().catch(logVrError);
  setAppLanguage(vrState.config.appLanguage).catch(logVrError);
  updateFeedLength();
  if (vrState.config.vrOverlayCpuUsage !== vrState.cpuUsageEnabled || vrState.config.pcUptimeOnFeed !== vrState.pcUptimeEnabled) {
    vrState.cpuUsageEnabled = vrState.config.vrOverlayCpuUsage ?? false;
    vrState.pcUptimeEnabled = vrState.config.pcUptimeOnFeed ?? false;
    window.AppApiVr.ToggleSystemMonitor(vrState.cpuUsageEnabled || vrState.pcUptimeEnabled).catch(logVrError);
  }
  const notificationOpacity = vrState.config.notificationOpacity;
  if (notificationOpacity !== undefined && notificationOpacity !== vrState.notificationOpacity) {
    vrState.notificationOpacity = notificationOpacity;
    setNotyOpacity(notificationOpacity);
  }
}

function updateOnlineFriendCount(count: string): void {
  vrState.onlineFriendCount = Number(count);
}

function nowPlayingUpdate(json: string): void {
  vrState.nowPlaying = parseVrPayload(json, "now playing", isVrNowPlaying);
  updateNowPlayingCircle(vrState.nowPlaying.percentage, vrState.lastLocation.progressPie);
  updateFeedLength();
}

function lastLocationUpdate(json: string): void {
  vrState.lastLocation = parseVrPayload(json, "last location", isVrLastLocation);
}

function wristFeedUpdate(json: string): void {
  vrState.wristFeed = parseVrPayload(json, "wrist feed", isVrFeedList);
  updateFeedLength();
}

function updateFeedLength(): void {
  if (vrState.wristFeed.length === 0) {
    return;
  }
  let length = 19;
  if (!vrState.config.hideDevicesFromFeed) {
    length -= 2;
    if (vrState.deviceCount > 8) {
      length -= 1;
    }
  }
  if (vrState.nowPlaying.playing) {
    length -= 1;
  }
  if (length < vrState.wristFeed.length) {
    vrState.wristFeed.length = length;
  }
}

async function setDatetimeFormat(): Promise<void> {
  vrState.currentCulture = await window.AppApiVr.CurrentCulture();
}

async function setAppLanguage(appLanguage: string | undefined): Promise<void> {
  if (!appLanguage) {
    return;
  }
  vrState.appLanguage = appLanguage;

  await loadLocalizedStrings(appLanguage);
  changeHtmlLangAttribute(vrState.appLanguage);
  locale.value = vrState.appLanguage;
}

onMounted(() => {
  const hooks = {
    configUpdate,
    updateOnlineFriendCount,
    nowPlayingUpdate,
    lastLocationUpdate,
    wristFeedUpdate,
    refreshCustomScript,
    playNoty: (json: string) => playNoty(vrState, json),
    statusClass,
    notyClear,
    addEntryHudFeed: hudController.addEntry,
    updateHudFeedTag: hudController.updateTag,
    updateHudTimeout: hudController.updateTimeout,
    setDatetimeFormat,
    setAppLanguage,
    trackingResultToClass,
    updateFeedLength,
    updateStatsLoop: statsLoop.start,
    updateVrElectronLoop: overlayQueueLoop.start,
    cleanHudFeedLoop: hudController.cleanLoop,
    cleanHudFeed: hudController.clean,
    vrState,
  } satisfies Record<string, unknown>;
  window.$vr = hooks;

  if (isLinuxHost()) {
    overlayQueueLoop.start();
  }
  refreshCustomScript().catch(logVrError);
  statsLoop.start();
  setDatetimeFormat().catch(logVrError);

  nextTick(() => {
    window.AppApiVr.VrInit().catch(logVrError);
  }).catch(logVrError);
});

onBeforeUnmount(() => {
  statsLoop.stop();
  overlayQueueLoop.stop();
  hudController.stop();

  try {
    notyClear();
  } catch (err) {
    console.error("Error closing Noty notifications:", err);
  }

  const hooksObject = window.$vr;
  if (hooksObject) {
    for (const key of Object.keys(hooksObject)) {
      Reflect.deleteProperty(hooksObject, key);
    }
  }
  Reflect.deleteProperty(window, "$vr");
});

const {
  config,
  wristFeed,
  devices,
  nowPlaying,
  lastLocation,
  lastLocationTimer,
  onlineForTimer,
  pcUptime,
  currentTime,
  currentCulture,
  cpuUsageEnabled,
  cpuUsage,
  onlineFriendCount,
  customInfo,
  hudFeed,
  hudTimeout,
} = toRefs(vrState);
</script>
