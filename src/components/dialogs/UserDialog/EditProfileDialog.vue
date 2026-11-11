<template>
  <Dialog v-model:open="editProfileDialog.visible">
    <DialogContent class="x-dialog sm:max-w-150 max-h-[85vh] overflow-hidden p-0 gap-0 flex flex-col">
      <DialogHeader class="px-6 pt-6 pb-4">
        <DialogTitle>{{ t("dialog.user.actions.edit_profile") }}</DialogTitle>
      </DialogHeader>

      <div
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-2 space-y-4 [&>section]:rounded-lg [&>section]:border [&>section]:border-border [&>section]:bg-muted/20 [&>section]:p-4"
      >
        <EditProfileSocialStatusSection v-model:edit-profile-dialog="editProfileDialog" />
        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.icon") }}</h3>

          <div class="flex items-center gap-2">
            <img
              :src="editProfileDialog.iconUrl || currentUser.currentAvatarThumbnailImageUrl"
              class="inline-block h-16 aspect-square rounded-md object-cover"
              :alt="t('dialog.edit_profile.icon')"
              loading="lazy"
            />
            <Button
              v-if="editProfileDialog.iconUrl !== currentUser.currentAvatarThumbnailImageUrl"
              size="sm"
              variant="outline"
              :disabled="editProfileDialog.loading"
              :aria-label="t('common.actions.delete')"
              @click="clearUserIcon"
            >
              <X class="size-4" />
            </Button>
            <Button size="sm" variant="outline" @click="showIconSelectDialog">
              {{ t("dialog.invite_message.select_image") }}
            </Button>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.banner") }}</h3>

          <Select :model-value="selectedBannerType" :disabled="editProfileDialog.loading" @update:model-value="handleBannerTypeChange">
            <SelectTrigger size="sm" class="w-42">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="option in bannerTypeOptions" :key="option.value" :value="option.value" :text-value="option.label">
                  {{ option.label }}
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <div v-if="selectedBannerType === 'color'" class="flex items-center gap-2">
            <ColorPickerButton :model-value="bannerColorValue" :disabled="editProfileDialog.loading" @update:model-value="handleBannerColorInput" />
          </div>
          <div v-else-if="selectedBannerType === 'avatarBanner'">
            <img
              :src="currentUser.currentAvatarThumbnailImageUrl"
              class="inline-block h-16 aspect-17/6 rounded-md object-cover"
              :alt="t('dialog.edit_profile.banner_type_avatar_banner')"
            />
          </div>
          <div v-else-if="selectedBannerType === 'customImage'">
            <div class="flex items-center gap-2 mt-2">
              <img
                v-if="editProfileDialog.bannerUrl"
                :src="editProfileDialog.bannerUrl"
                class="inline-block h-16 aspect-17/6 rounded-md object-cover"
                :alt="t('dialog.edit_profile.banner_type_custom_image')"
              />
              <Button size="sm" variant="outline" @click="showGallerySelectDialog">
                {{ t("dialog.invite_message.select_image") }}
              </Button>
            </div>
          </div>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.pronouns.header") }}</h3>
          <InputGroupTextareaField
            v-model="editProfileDialog.pronouns"
            :maxlength="32"
            :rows="1"
            input-class="min-h-0 py-2"
            :placeholder="t('dialog.pronouns.pronouns_placeholder')"
            show-count
          />
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.bio.header") }}</h3>

          <InputGroupTextareaField
            v-model="editProfileDialog.bio"
            :maxlength="512"
            :rows="5"
            :placeholder="t('dialog.bio.bio_placeholder')"
            show-count
            autosize
          />

          <InputGroupAction
            v-for="(link, index) in editProfileDialog.bioLinks"
            :key="index"
            :model-value="link"
            :maxlength="1000"
            size="sm"
            @update:model-value="(value) => (editProfileDialog.bioLinks[index] = String(value))"
          >
            <template #leading>
              <img v-if="link" :src="getFaviconUrl(link)" class="size-4 align-middle" />
              <div v-else class="size-4" />
            </template>
            <template #actions>
              <Button variant="ghost" size="icon-sm" :aria-label="t('common.actions.delete')" @click="editProfileDialog.bioLinks.splice(index, 1)">
                <Trash2 class="size-4" />
              </Button>
            </template>
          </InputGroupAction>

          <Button
            variant="outline"
            :disabled="editProfileDialog.bioLinks.length >= 3 || editProfileDialog.loading"
            size="sm"
            @click="editProfileDialog.bioLinks.push('')"
          >
            {{ t("dialog.bio.add_link") }}
          </Button>
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.language.header") }}</h3>

          <div v-for="item in currentLanguages" :key="item.key" class="my-2">
            <Badge class="mr-1.5" variant="outline">
              <span class="flags mr-1.5 inline-block" :class="languageClass(item.key)"></span>
              {{ item.value }} ({{ item.key.toUpperCase() }})
              <button
                class="ml-2 p-0 [border:none] [background:transparent] inline-flex items-center [color:inherit] cursor-pointer"
                type="button"
                @click="removeUserLanguage(item.key)"
              >
                <X class="h-3 w-3" />
              </button>
            </Badge>
          </div>

          <Select
            :model-value="selectedLanguageToAdd"
            :disabled="editProfileDialog.loading || currentLanguages.length === 3"
            @update:model-value="handleAddUserLanguage"
          >
            <SelectTrigger size="sm">
              <SelectValue :placeholder="t('dialog.language.select_language')" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem v-for="item in availableLanguages" :key="item.key" :value="item.key" :text-value="item.value">
                  <span class="flags mr-1.5 inline-block" :class="languageClass(item.key)"></span>
                  {{ item.value }} ({{ item.key.toUpperCase() }})
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </section>

        <EditProfileThemeSection v-model:edit-profile-dialog="editProfileDialog" />

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.profile_background") }}</h3>
          <div class="flex items-center gap-2">
            <Select
              :model-value="editProfileDialog.backgroundType"
              :disabled="editProfileDialog.loading"
              @update:model-value="handleProfileBackgroundTypeChange"
            >
              <SelectTrigger size="sm" class="w-42">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="option in profileBackgroundTypeOptions" :key="option.value" :value="option.value" :text-value="option.label">
                    {{ option.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div v-if="editProfileDialog.backgroundType === 'gradient'" class="flex gap-2">
            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">
                {{ t("dialog.edit_profile.gradient_top") }}
              </span>
              <div class="flex items-center gap-2">
                <ColorPickerButton
                  :model-value="backgroundGradientTopColorValue"
                  :disabled="editProfileDialog.loading"
                  @update:model-value="handleBackgroundGradientTopColorInput"
                />
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">
                {{ t("dialog.edit_profile.gradient_bottom") }}
              </span>
              <div class="flex items-center gap-2">
                <ColorPickerButton
                  :model-value="backgroundGradientBottomColorValue"
                  :disabled="editProfileDialog.loading"
                  @update:model-value="handleBackgroundGradientBottomColorInput"
                />
              </div>
            </div>
          </div>

          <div v-if="editProfileDialog.backgroundType === 'texture'" class="space-y-2">
            <Select
              :model-value="editProfileDialog.backgroundTextureId"
              :disabled="editProfileDialog.loading"
              @update:model-value="handleBackgroundTextureChange"
            >
              <SelectTrigger size="sm" class="h-14! w-80">
                <SelectValue :placeholder="t('dialog.edit_profile.profile_background_type_image')">
                  <template v-if="selectedProfileBackgroundTextureOption">
                    <span class="inline-flex min-w-0 items-center gap-2">
                      <img
                        :src="selectedProfileBackgroundTextureOption.thumbnail"
                        class="h-9 w-16 shrink-0 rounded-sm object-cover"
                        :alt="selectedProfileBackgroundTextureOption.label"
                        loading="lazy"
                      />
                      <span class="truncate">{{ selectedProfileBackgroundTextureOption.label }}</span>
                    </span>
                  </template>
                </SelectValue>
              </SelectTrigger>
              <SelectContent class="w-80">
                <SelectGroup>
                  <SelectItem
                    v-for="option in profileBackgrounds"
                    :key="option.id"
                    :value="option.id"
                    :text-value="option.label"
                    :disabled="!isLocalUserVrcPlusSupporter && option.isVRCPlus"
                  >
                    <div class="flex items-center gap-2">
                      <img :src="option.thumbnail" class="h-9 w-16 shrink-0 rounded-sm object-cover" :alt="option.label" loading="lazy" />
                      <span>{{ option.label }}</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </section>

        <EditProfileEffectSection
          v-model:open="nameplateEffectsOpen"
          :title="t('dialog.edit_profile.nameplate_effect')"
          :value="editProfileDialog.nameplateEffect"
          :selected-item="selectedNameplateEffect"
          :items="nameplateEffects"
          :loading="editProfileDialog.loading"
          @select="selectNameplateEffect"
          @clear="editProfileDialog.nameplateEffect = ''"
        />
        <EditProfileEffectSection
          v-model:open="profileEffectsOpen"
          :title="t('dialog.edit_profile.profile_effect')"
          :value="editProfileDialog.profileEffect"
          :selected-item="selectedProfileEffect"
          :items="profileEffects"
          :loading="editProfileDialog.loading"
          @select="selectProfileEffect"
          @clear="editProfileDialog.profileEffect = ''"
        />
        <EditProfileEffectSection
          v-model:open="iconFramesOpen"
          :title="t('dialog.edit_profile.icon_frame')"
          :value="editProfileDialog.iconFrame"
          :selected-item="selectedIconFrame"
          :items="iconFrames"
          :loading="editProfileDialog.loading"
          @select="selectIconFrame"
          @clear="editProfileDialog.iconFrame = ''"
        />
      </div>

      <DialogFooter class="px-6 py-4">
        <Button variant="outline" :disabled="editProfileDialog.loading" @click="editProfileDialog.visible = false">
          {{ t("dialog.user.note_memo.cancel") }}
        </Button>
        <Button :disabled="editProfileDialog.loading" @click="saveProfile">
          {{ t("dialog.bio.update") }}
        </Button>
      </DialogFooter>

      <GallerySelectDialog :gallery-select-dialog="gallerySelectDialog" @select-image="handleGalleryImageSelect" />
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { Trash2, X } from "lucide-vue-next";
import type { AcceptableValue } from "reka-ui";

import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import ColorPickerButton from "@/components/ColorPickerButton.vue";
import InputGroupAction from "@/components/ui/input-group/InputGroupAction.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";

import Select from "../../ui/select/Select.vue";
import SelectContent from "../../ui/select/SelectContent.vue";
import SelectGroup from "../../ui/select/SelectGroup.vue";
import SelectItem from "../../ui/select/SelectItem.vue";
import SelectTrigger from "../../ui/select/SelectTrigger.vue";
import SelectValue from "../../ui/select/SelectValue.vue";
import Badge from "../../ui/badge/Badge.vue";

import { userRequest } from "../../../api/user";
import { languageClass } from "../../../shared/utils/user";
import { getFaviconUrl } from "../../../shared/utils/url-utils";
import { useUserStore } from "../../../stores/user";
import { useAuthStore } from "../../../stores/auth";
import { useGalleryStore } from "../../../stores/gallery";
import EditProfileEffectSection from "./EditProfileEffectSection.vue";
import EditProfileSocialStatusSection from "./EditProfileSocialStatusSection.vue";
import EditProfileThemeSection from "./EditProfileThemeSection.vue";
import { useEditProfileSave } from "./composables/use-edit-profile-save";
import { getThemeHexColor, normalizeColor } from "./edit-profile-colors";
import GallerySelectDialog from "../GroupDialog/GallerySelectDialog.vue";
import { profileBackgrounds } from "@/shared/constants/backgrounds";
import type { EditProfileDialogState } from "@/stores/user-state";

const { t } = useI18n();
const { currentUser, isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const authStore = useAuthStore();
const { refreshGalleryTable, getInventory } = useGalleryStore();
const { inventoryTable } = storeToRefs(useGalleryStore());

const editProfileDialog = defineModel<EditProfileDialogState>("editProfileDialog", { required: true });

const { saveProfile } = useEditProfileSave(editProfileDialog, currentUser);

const selectedLanguageToAdd = ref("");
const nameplateEffectsOpen = ref(false);
const profileEffectsOpen = ref(false);
const iconFramesOpen = ref(false);
const gallerySelectDialog = ref({
  visible: false,
  selectedFileId: "",
  selectedImageUrl: "",
  isIconGallerySelectDialog: false,
});

watch(
  () => editProfileDialog.value.visible,
  (isVisible) => {
    if (isVisible) {
      void getInventory().catch((error: unknown) => {
        console.error("Error fetching inventory items:", error);
      });
    }
  },
  { immediate: true }
);
const nameplateEffects = computed(() => inventoryTable.value.filter((item) => item.itemType === "nameplateEffect"));
const profileEffects = computed(() => inventoryTable.value.filter((item) => item.itemType === "profileEffect"));
const iconFrames = computed(() => inventoryTable.value.filter((item) => item.itemType === "iconFrame"));
const selectedNameplateEffect = computed(() => nameplateEffects.value.find((item) => item.templateId === editProfileDialog.value.nameplateEffect));
const selectedProfileEffect = computed(() => profileEffects.value.find((item) => item.templateId === editProfileDialog.value.profileEffect));
const selectedIconFrame = computed(() => iconFrames.value.find((item) => item.templateId === editProfileDialog.value.iconFrame));

const currentLanguages = computed(() => currentUser.value.$languages);
const availableLanguages = computed(() => {
  const options = authStore.cachedConfig.constants?.LANGUAGE.SPOKEN_LANGUAGE_OPTIONS ?? {};
  return Object.entries(options).map(([key, value]) => ({ key, value }));
});
const bannerTypeOptions = [
  { value: "color", label: t("dialog.edit_profile.banner_type_color") },
  { value: "avatarBanner", label: t("dialog.edit_profile.banner_type_avatar_banner") },
  { value: "customImage", label: t("dialog.edit_profile.banner_type_custom_image") },
];
const profileBackgroundTypeOptions = [
  { value: "default", label: t("dialog.edit_profile.profile_background_type_none") },
  { value: "texture", label: t("dialog.edit_profile.profile_background_type_image") },
  { value: "gradient", label: t("dialog.edit_profile.profile_background_type_gradient") },
];
const selectedProfileBackgroundTextureOption = computed(() => profileBackgrounds.find((option) => option.id === editProfileDialog.value.backgroundTextureId));

const selectedBannerType = computed(() => {
  const type = editProfileDialog.value.bannerType;
  return bannerTypeOptions.some((option) => option.value === type) ? type : "color";
});
const bannerColorValue = computed(() => getThemeHexColor(editProfileDialog.value.bannerColor));
const backgroundGradientBottomColorValue = computed(() => getThemeHexColor(editProfileDialog.value.backgroundGradientBottom));
const backgroundGradientTopColorValue = computed(() => getThemeHexColor(editProfileDialog.value.backgroundGradientTop));

function selectNameplateEffect(id: string) {
  editProfileDialog.value.nameplateEffect = id;
  nameplateEffectsOpen.value = false;
}

function selectProfileEffect(id: string) {
  editProfileDialog.value.profileEffect = id;
  profileEffectsOpen.value = false;
}

function selectIconFrame(id: string) {
  editProfileDialog.value.iconFrame = id;
  iconFramesOpen.value = false;
}

function handleBannerColorInput(event: string) {
  const normalized = normalizeColor(event);
  if (!normalized) {
    return;
  }
  const D = editProfileDialog.value;
  D.bannerColor = normalized;
  D.bannerType = "color";
}

function handleBannerTypeChange(value: AcceptableValue) {
  if (typeof value !== "string") {
    return;
  }
  if (!bannerTypeOptions.some((option) => option.value === value)) {
    return;
  }
  const D = editProfileDialog.value;
  D.bannerType = value;
}

function handleProfileBackgroundTypeChange(value: AcceptableValue) {
  if (typeof value !== "string") {
    return;
  }
  if (!profileBackgroundTypeOptions.some((option) => option.value === value)) {
    return;
  }
  const D = editProfileDialog.value;
  D.backgroundType = value;
  if (value === "texture" && !profileBackgrounds.some((option) => option.id === D.backgroundTextureId)) {
    D.backgroundTextureId = profileBackgrounds[0]?.id ?? "";
  }
  if (value === "gradient") {
    const profileDefaults = authStore.cachedConfig.profileDefaults;
    D.backgroundGradientTop = profileDefaults?.backgroundGradientTop ?? "000000";
    D.backgroundGradientBottom = profileDefaults?.backgroundGradientBottom ?? "000000";
  }
}

function handleBackgroundTextureChange(value: AcceptableValue) {
  if (typeof value !== "string") {
    return;
  }
  if (!profileBackgrounds.some((option) => option.id === value)) {
    return;
  }
  const D = editProfileDialog.value;
  D.backgroundTextureId = value;
  D.backgroundType = "texture";
}

function handleBackgroundGradientTopColorInput(event: string) {
  const normalized = normalizeColor(event);
  if (!normalized) {
    return;
  }
  const D = editProfileDialog.value;
  D.backgroundGradientTop = normalized;
  D.backgroundType = "gradient";
}

function handleBackgroundGradientBottomColorInput(event: string) {
  const normalized = normalizeColor(event);
  if (!normalized) {
    return;
  }
  const D = editProfileDialog.value;
  D.backgroundGradientBottom = normalized;
  D.backgroundType = "gradient";
}

function showGallerySelectDialog() {
  const D = gallerySelectDialog.value;
  D.visible = true;
  D.isIconGallerySelectDialog = false;
  refreshGalleryTable();
}

function showIconSelectDialog() {
  const D = gallerySelectDialog.value;
  D.visible = true;
  D.isIconGallerySelectDialog = true;
  refreshGalleryTable();
}

function handleGalleryImageSelect({ imageUrl }: { imageUrl: string }) {
  const D = editProfileDialog.value;
  if (gallerySelectDialog.value.isIconGallerySelectDialog) {
    D.iconUrl = imageUrl;
  } else {
    if (!imageUrl) {
      D.bannerType = "color";
      D.bannerUrl = "";
      return;
    }
    D.bannerUrl = imageUrl;
  }
}

function clearUserIcon() {
  const D = editProfileDialog.value;
  D.iconUrl = "";
}

function handleAddUserLanguage(language: AcceptableValue) {
  if (typeof language !== "string") {
    return;
  }
  addUserLanguage(language);
  selectedLanguageToAdd.value = "";
}

function removeUserLanguage(language: string) {
  const D = editProfileDialog.value;
  D.loading = true;
  userRequest
    .removeUserTags({
      tags: [`language_${language}`],
    })
    .catch((error: unknown) => {
      console.error("Failed to remove user language:", error);
    })
    .finally(() => {
      D.loading = false;
    });
}

function addUserLanguage(language: string) {
  const D = editProfileDialog.value;
  D.loading = true;
  userRequest
    .addUserTags({
      tags: [`language_${language}`],
    })
    .catch((error: unknown) => {
      console.error("Failed to add user language:", error);
    })
    .finally(() => {
      D.loading = false;
    });
}
</script>
