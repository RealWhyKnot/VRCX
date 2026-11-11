<template>
  <Dialog :open="isVRChatConfigDialogVisible" @update:open="(open) => (open ? null : closeDialog())">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.config_json.header") }}</DialogTitle>
        <DialogDescription>
          {{ t("dialog.config_json.description1") }}
          {{ t("dialog.config_json.description2") }}
        </DialogDescription>
      </DialogHeader>

      <FieldGroup class="gap-4">
        <Field orientation="horizontal">
          <FieldLabel>{{ t("dialog.config_json.cache_size") }}</FieldLabel>
          <div class="flex items-center gap-2 text-sm">
            <span>{{ VRChatUsedCacheSize }} / {{ totalCacheSize }} GB</span>
            <TooltipWrapper side="top" :content="t('dialog.config_json.refresh')">
              <Button
                class="rounded-full"
                variant="outline"
                size="icon-sm"
                :disabled="VRChatCacheSizeLoading"
                :aria-label="t('dialog.config_json.refresh')"
                @click="getVRChatCacheSize"
              >
                <Spinner v-if="VRChatCacheSizeLoading" />
                <RefreshCw v-else />
              </Button>
            </TooltipWrapper>
          </div>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{{ t("dialog.config_json.delete_all_cache") }}</FieldLabel>
          <Button size="sm" variant="outline" @click="showDeleteAllVRChatCacheConfirm">
            {{ t("dialog.config_json.delete_cache") }}
          </Button>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{{ t("dialog.config_json.delete_old_cache") }}</FieldLabel>
          <Button size="sm" variant="outline" @click="sweepVRChatCache">
            {{ t("dialog.config_json.sweep_cache") }}
          </Button>
        </Field>

        <Field v-for="(item, key) in VRChatConfigList" :key="key" class="gap-2">
          <FieldLabel>{{ item.name }}</FieldLabel>
          <InputGroupAction
            :model-value="getConfigText(key)"
            :placeholder="item.default"
            size="sm"
            :type="item.type ? item.type : 'text'"
            :min="item.min"
            :max="item.max"
            @update:model-value="setConfigValue(key, $event)"
            @input="refreshDialogValues"
          >
            <template #actions>
              <Button v-if="item.folderBrowser" size="icon-sm" variant="outline" @click="openConfigFolderBrowser(key)">
                <FolderOpen />
              </Button>
            </template>
          </InputGroupAction>
        </Field>

        <Field orientation="horizontal">
          <FieldLabel>{{ t("dialog.config_json.camera_resolution") }}</FieldLabel>
          <Select v-model="vrchatCameraResolutionKey">
            <SelectTrigger size="sm" class="w-48">
              <SelectValue :placeholder="getVRChatCameraResolution()" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="row in VRChatCameraResolutions" :key="row.name" :value="getVRChatResolutionKey(row)">
                  {{ row.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{{ t("dialog.config_json.spout_resolution") }}</FieldLabel>
          <Select v-model="vrchatSpoutResolutionKey">
            <SelectTrigger size="sm" class="w-48">
              <SelectValue :placeholder="getVRChatSpoutResolution()" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="row in VRChatScreenshotResolutions" :key="row.name" :value="getVRChatResolutionKey(row)">
                  {{ row.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
        <Field orientation="horizontal">
          <FieldLabel>{{ t("dialog.config_json.screenshot_resolution") }}</FieldLabel>
          <Select v-model="vrchatScreenshotResolutionKey">
            <SelectTrigger size="sm" class="w-48">
              <SelectValue :placeholder="getVRChatScreenshotResolution()" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="row in VRChatScreenshotResolutions" :key="row.name" :value="getVRChatResolutionKey(row)">
                  {{ row.name }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <label class="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Checkbox v-model="isPictureOutputSplitByDate" @update:model-value="refreshDialogValues" />
          {{ t("dialog.config_json.picture_sort_by_date") }}
        </label>
        <label class="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <Checkbox v-model="isDisableRichPresence" @update:model-value="refreshDialogValues" />
          {{ t("dialog.config_json.disable_discord_presence") }}
        </label>
      </FieldGroup>

      <DialogFooter>
        <Button variant="outline" class="sm:mr-auto" @click="openExternalLink('https://docs.vrchat.com/docs/configuration-file')">
          {{ t("dialog.config_json.vrchat_docs") }}
        </Button>
        <Button variant="secondary" @click="closeDialog">{{ t("dialog.config_json.cancel") }}</Button>
        <Button :disabled="loading" @click="saveVRChatConfigFile">{{ t("dialog.config_json.save") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectGroup from "@/components/ui/select/SelectGroup.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import { computed, ref, watch } from "vue";
import { FolderOpen, RefreshCw } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupAction from "@/components/ui/input-group/InputGroupAction.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import { useAdvancedSettingsStore } from "../../../stores/settings/advanced";
import { useGameStore } from "../../../stores/game";
import { useModalStore } from "../../../stores/modal";
import { logError } from "../../../stores/notification/errors";
import { parseLeadingInt } from "../../../stores/vrcx-messages";
import { runSweepVRChatCacheFlow as sweepVRChatCache } from "../../../coordinators/game-coordinator";
import { VRChatCameraResolutions, VRChatScreenshotResolutions } from "../../../shared/constants/settings";
import { getVRChatResolution } from "../../../shared/utils/setting";
import { openExternalLink } from "../../../shared/utils/app-actions";

type VRChatConfigValue = string | number | boolean;

type VRChatConfigData = Record<string, VRChatConfigValue>;

type VRChatConfigItem = {
  name: string;
  default: string;
  type?: string;
  min?: number;
  max?: number;
  folderBrowser?: boolean;
};

type VRChatResolution = {
  name: string;
  width: number | string;
  height: number | string;
};

const { VRChatUsedCacheSize, VRChatTotalCacheSize, VRChatCacheSizeLoading } = storeToRefs(useGameStore());
const { getVRChatCacheSize } = useGameStore();
const { folderSelectorDialog } = useAdvancedSettingsStore();
const { isVRChatConfigDialogVisible } = storeToRefs(useAdvancedSettingsStore());
const modalStore = useModalStore();

const { t } = useI18n();

const VRChatConfigFile = ref<VRChatConfigData>({});

const VRChatConfigList = ref<Record<string, VRChatConfigItem>>({
  cache_size: {
    name: t("dialog.config_json.max_cache_size"),
    default: "30",
    type: "number",
    min: 30,
  },
  cache_expiry_delay: {
    name: t("dialog.config_json.cache_expiry_delay"),
    default: "30",
    type: "number",
    min: 30,
  },
  cache_directory: {
    name: t("dialog.config_json.cache_directory"),
    default: "%AppData%\\..\\LocalLow\\VRChat\\VRChat",
    folderBrowser: true,
  },
  picture_output_folder: {
    name: t("dialog.config_json.picture_directory"),

    default: `%UserProfile%\\Pictures\\VRChat`,
    folderBrowser: true,
  },

  fpv_steadycam_fov: {
    name: t("dialog.config_json.fpv_steadycam_fov"),
    default: "50",
    type: "number",
    min: 30,
    max: 110,
  },
});

const loading = ref(false);

watch(
  () => isVRChatConfigDialogVisible.value,
  async (isVisible) => {
    if (isVisible) {
      loading.value = true;
      await readVRChatConfigFile();
      loading.value = false;
    }
  }
);

const totalCacheSize = computed(() => {
  const cacheSize = VRChatConfigFile.value["cache_size"];
  if (cacheSize) {
    return cacheSize;
  }
  return VRChatTotalCacheSize.value;
});

const isPictureOutputSplitByDate = computed({
  get: () => VRChatConfigFile.value["picture_output_split_by_date"] === true,
  set: (isEnabled: boolean) => {
    VRChatConfigFile.value["picture_output_split_by_date"] = isEnabled;
  },
});

const isDisableRichPresence = computed({
  get: () => VRChatConfigFile.value["disableRichPresence"] === true,
  set: (isEnabled: boolean) => {
    VRChatConfigFile.value["disableRichPresence"] = isEnabled;
  },
});

const VRCHAT_RESOLUTION_DEFAULT_KEY = "__default__";

function getVRChatResolutionKey(row: VRChatResolution) {
  const width = Number(row.width);
  const height = Number(row.height);
  if (width > 0 && height > 0) {
    return `${width}x${height}`;
  }
  return VRCHAT_RESOLUTION_DEFAULT_KEY;
}

const vrchatCameraResolutionKey = computed({
  get: () => {
    const width = Number(VRChatConfigFile.value["camera_res_width"]);
    const height = Number(VRChatConfigFile.value["camera_res_height"]);
    if (width > 0 && height > 0) {
      return `${width}x${height}`;
    }
    return VRCHAT_RESOLUTION_DEFAULT_KEY;
  },
  set: (value) => {
    const row = VRChatCameraResolutions.find((r) => getVRChatResolutionKey(r) === value);
    if (row) {
      setVRChatCameraResolution(row);
    }
  },
});

const vrchatSpoutResolutionKey = computed({
  get: () => {
    const width = Number(VRChatConfigFile.value["camera_spout_res_width"]);
    const height = Number(VRChatConfigFile.value["camera_spout_res_height"]);
    if (width > 0 && height > 0) {
      return `${width}x${height}`;
    }
    return VRCHAT_RESOLUTION_DEFAULT_KEY;
  },
  set: (value) => {
    const row = VRChatScreenshotResolutions.find((r) => getVRChatResolutionKey(r) === value);
    if (row) {
      setVRChatSpoutResolution(row);
    }
  },
});

const vrchatScreenshotResolutionKey = computed({
  get: () => {
    const width = Number(VRChatConfigFile.value["screenshot_res_width"]);
    const height = Number(VRChatConfigFile.value["screenshot_res_height"]);
    if (width > 0 && height > 0) {
      return `${width}x${height}`;
    }
    return VRCHAT_RESOLUTION_DEFAULT_KEY;
  },
  set: (value) => {
    const row = VRChatScreenshotResolutions.find((r) => getVRChatResolutionKey(r) === value);
    if (row) {
      setVRChatScreenshotResolution(row);
    }
  },
});

function showDeleteAllVRChatCacheConfirm() {
  modalStore
    .confirm({
      description: t("confirm.clear_cache"),
      title: t("confirm.title"),
    })
    .then(({ ok }) => {
      if (ok) {
        void deleteAllVRChatCache().catch(logError);
      }
    })
    .catch(logError);
}

async function deleteAllVRChatCache() {
  try {
    await window.AssetBundleManager.DeleteAllCache();
    toast.success(t("message.cache.deleted"));
  } catch (error) {
    toast.error(t("message.cache.delete_error", { error: error instanceof Error ? error.message : String(error) }));
  }
  void getVRChatCacheSize().catch(logError);
}

async function openConfigFolderBrowser(key: string) {
  const oldPath = VRChatConfigFile.value[key];
  const newPath = await folderSelectorDialog(typeof oldPath === "string" ? oldPath : undefined);
  if (newPath) {
    VRChatConfigFile.value[key] = newPath;
    refreshDialogValues();
  }
}

function getConfigText(key: string): string | number {
  const value = VRChatConfigFile.value[key];
  return typeof value === "string" || typeof value === "number" ? value : "";
}

function setConfigValue(key: string, value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    VRChatConfigFile.value[key] = value;
  }
}

function refreshDialogValues() {
  loading.value = true;
  loading.value = false;
}

function setVRChatSpoutResolution(res: VRChatResolution) {
  VRChatConfigFile.value["camera_spout_res_height"] = res.height;
  VRChatConfigFile.value["camera_spout_res_width"] = res.width;
  refreshDialogValues();
}

function setVRChatCameraResolution(res: VRChatResolution) {
  VRChatConfigFile.value["camera_res_height"] = res.height;
  VRChatConfigFile.value["camera_res_width"] = res.width;
  refreshDialogValues();
}

function setVRChatScreenshotResolution(res: VRChatResolution) {
  VRChatConfigFile.value["screenshot_res_height"] = res.height;
  VRChatConfigFile.value["screenshot_res_width"] = res.width;
  refreshDialogValues();
}

function getVRChatCameraResolution() {
  if (VRChatConfigFile.value["camera_res_height"] && VRChatConfigFile.value["camera_res_width"]) {
    const res = `${VRChatConfigFile.value["camera_res_width"]}x${VRChatConfigFile.value["camera_res_height"]}`;
    return getVRChatResolution(res);
  }
  return "1920x1080 (1080p)";
}

function getVRChatSpoutResolution() {
  if (VRChatConfigFile.value["camera_spout_res_height"] && VRChatConfigFile.value["camera_spout_res_width"]) {
    const res = `${VRChatConfigFile.value["camera_spout_res_width"]}x${VRChatConfigFile.value["camera_spout_res_height"]}`;
    return getVRChatResolution(res);
  }
  return "1920x1080 (1080p)";
}

function getVRChatScreenshotResolution() {
  if (VRChatConfigFile.value["screenshot_res_height"] && VRChatConfigFile.value["screenshot_res_width"]) {
    const res = `${VRChatConfigFile.value["screenshot_res_width"]}x${VRChatConfigFile.value["screenshot_res_height"]}`;
    return getVRChatResolution(res);
  }
  return "1920x1080 (1080p)";
}

function saveVRChatConfigFile() {
  const config: VRChatConfigData = {};
  for (const [item, value] of Object.entries(VRChatConfigFile.value)) {
    if (item === "picture_output_split_by_date") {
      if (!value) {
        config[item] = value;
      }
    } else if (value === "") {
      continue;
    } else if (typeof value === "boolean" && !value) {
      continue;
    } else if (typeof value === "string") {
      const parsed = parseLeadingInt(value);
      config[item] = Number.isNaN(parsed) ? value : parsed;
    } else {
      config[item] = value;
    }
  }
  VRChatConfigFile.value = config;
  WriteVRChatConfigFile();
  closeDialog();
}

function WriteVRChatConfigFile() {
  const json = JSON.stringify(VRChatConfigFile.value, null, "\t");
  void window.AppApi.WriteConfigFile(json).catch(logError);
}

function isVRChatConfigValue(value: unknown): value is VRChatConfigValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function toVRChatConfigData(value: unknown): VRChatConfigData {
  const data: VRChatConfigData = {};
  if (typeof value !== "object" || value === null) {
    return data;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (isVRChatConfigValue(entry)) {
      data[key] = entry;
    }
  }
  return data;
}

async function readVRChatConfigFile() {
  const config = await window.AppApi.ReadConfigFileSafe();
  if (config) {
    try {
      const parsedConfig: unknown = JSON.parse(config);
      VRChatConfigFile.value = { ...VRChatConfigFile.value, ...toVRChatConfigData(parsedConfig) };
    } catch (error) {
      toast.error(t("message.cache.invalid_config"));
      throw new Error("Invalid JSON in config.json", { cause: error });
    }
  }
  if (typeof VRChatConfigFile.value["picture_output_split_by_date"] === "undefined") {
    VRChatConfigFile.value["picture_output_split_by_date"] = true;
  }
}

function closeDialog() {
  isVRChatConfigDialogVisible.value = false;
}
</script>
