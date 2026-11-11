<template>
  <SettingsItem :label="t('view.settings.appearance.appearance.font_family')">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="sm" class="min-w-[180px] justify-between font-normal">
          <span class="truncate">{{ fontDropdownDisplayText }}</span>
          <ChevronDown class="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuCheckboxItem
          v-for="option in westernFontItems"
          :key="option.key"
          :model-value="appFontFamily === option.key"
          @select="handleSelectWesternFont(option.key)"
        >
          {{ option.label }}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          v-for="option in cjkFontItems"
          :key="option.key"
          :model-value="appCjkFontPack === option.key && appFontFamily !== 'custom'"
          @select="handleSelectCjkFont(option.key)"
        >
          {{ option.label }}
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem :model-value="appFontFamily === 'custom'" @select="handleSelectCustomFont">
          {{ t("view.settings.appearance.appearance.font_family_custom") }}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog v-model:open="customFontDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t("view.settings.appearance.appearance.font_family_custom_dialog_title") }}</DialogTitle>
          <DialogDescription>{{ t("view.settings.appearance.appearance.font_family_custom_dialog_description") }}</DialogDescription>
        </DialogHeader>
        <Input v-model="customFontInput" placeholder="'My Font', Arial, sans-serif" />
        <DialogFooter>
          <Button variant="outline" @click="customFontDialogOpen = false">
            {{ t("dialog.alertdialog.cancel") }}
          </Button>
          <Button @click="saveCustomFont">
            {{ t("dialog.alertdialog.ok") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </SettingsItem>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { useAppearanceSettingsStore } from "@/stores/settings/appearance";
import Button from "@/components/ui/button/Button.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuCheckboxItem from "@/components/ui/dropdown-menu/DropdownMenuCheckboxItem.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogDescription from "@/components/ui/dialog/DialogDescription.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Input from "@/components/ui/input/Input.vue";
import { APP_CJK_FONT_PACKS, APP_FONT_CONFIG, APP_FONT_DEFAULT_KEY, APP_FONT_FAMILIES } from "@/shared/constants/fonts";
import SettingsItem from "../SettingsItem.vue";

const { t } = useI18n();

const appearanceSettingsStore = useAppearanceSettingsStore();
const { appFontFamily, customFontFamily, appCjkFontPack } = storeToRefs(appearanceSettingsStore);
const { setAppFontFamily, setCustomFontFamily, setAppCjkFontPack } = appearanceSettingsStore;

const fontDropdownDisplayText = computed(() => {
  if (appFontFamily.value === "custom") {
    return t("view.settings.appearance.appearance.font_family_custom");
  }
  const western = t(`view.settings.appearance.appearance.font_family_${appFontFamily.value}`);
  const cjk =
    appCjkFontPack.value === "system"
      ? t("view.settings.appearance.appearance.font_family_system_ui")
      : t(`view.settings.appearance.appearance.cjk_font_pack_${appCjkFontPack.value}`);
  return `${western} / ${cjk}`;
});

const westernFontItems = computed(() => {
  return APP_FONT_FAMILIES.filter((key) => key !== "custom" && key !== "system_ui").map((key) => ({
    key,
    label: t(`view.settings.appearance.appearance.font_family_${key}`),
  }));
});

const cjkFontItems = computed(() => {
  return APP_CJK_FONT_PACKS.map((key) => ({
    key,
    label: key === "system" ? t("view.settings.appearance.appearance.font_family_system_ui") : t(`view.settings.appearance.appearance.cjk_font_pack_${key}`),
  }));
});

const FONT_FAMILY_REGEX = /^\s*(([-_\p{L}][\p{L}\p{N}_\s-]*)|'[^']+'|"[^"]+")\s*(,\s*(([-_\p{L}][\p{L}\p{N}_\s-]*)|'[^']+'|"[^"]+")\s*)*$/u;

const customFontDialogOpen = ref(false);
const customFontInput = ref("");

function handleSelectWesternFont(key: string) {
  setAppFontFamily(key);
}

function handleSelectCjkFont(key: string) {
  if (appFontFamily.value === "custom") {
    setAppFontFamily(APP_FONT_DEFAULT_KEY);
  }
  setAppCjkFontPack(key);
}

const fontConfigByKey: Record<string, { readonly cssName: string } | undefined> = APP_FONT_CONFIG;

function handleSelectCustomFont() {
  const cssVarValue = getComputedStyle(document.documentElement).getPropertyValue("--font-western-primary").trim();
  const currentKey = (appFontFamily.value === "" ? APP_FONT_DEFAULT_KEY : appFontFamily.value).trim().toLowerCase();
  const fallbackFont = fontConfigByKey[currentKey]?.cssName ?? APP_FONT_CONFIG[APP_FONT_DEFAULT_KEY].cssName;
  const customValue = customFontFamily.value.trim();
  customFontInput.value = [customValue, cssVarValue, fallbackFont].find((candidate) => candidate !== "") ?? "";
  customFontDialogOpen.value = true;
}

function saveCustomFont() {
  const trimmed = customFontInput.value.trim();
  if (!trimmed || !FONT_FAMILY_REGEX.test(trimmed)) {
    toast.error(t("view.settings.appearance.appearance.font_family_custom_invalid"));
    return;
  }
  setCustomFontFamily(trimmed);
  setAppFontFamily("custom");
  customFontDialogOpen.value = false;
}
</script>
