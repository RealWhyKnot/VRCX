<template>
  <Dialog v-model:open="editProfileDialog.visible">
    <DialogContent class="x-dialog sm:max-w-150 max-h-[85vh] overflow-hidden p-0 gap-0 flex flex-col">
      <DialogHeader class="px-6 pt-6 pb-4">
        <DialogTitle>{{ t("dialog.user.actions.edit_profile") }}</DialogTitle>
      </DialogHeader>

      <div
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-2 space-y-4 [&>section]:rounded-lg [&>section]:border [&>section]:border-border [&>section]:bg-muted/20 [&>section]:p-4"
      >
        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.social_status.header") }}</h3>

          <div class="flex items-center gap-2 min-w-0">
            <Select :model-value="editProfileDialog.status" :disabled="editProfileDialog.loading" @update:model-value="handleSocialStatusChange">
              <SelectTrigger size="sm" class="w-42 shrink-0">
                <SelectValue>
                  <template v-if="selectedStatusOption">
                    <span class="inline-flex items-center gap-2">
                      <i class="x-user-status" :class="selectedStatusOption.statusClass"></i>
                      <span>{{ selectedStatusOption.label }}</span>
                    </span>
                  </template>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value" :text-value="option.label">
                    <div class="flex items-center gap-2">
                      <i class="x-user-status" :class="option.statusClass"></i>
                      <span>{{ option.label }}</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <InputGroupField
              v-model="editProfileDialog.statusDescription"
              class="min-w-0 flex-1"
              :placeholder="t('dialog.social_status.status_placeholder')"
              :maxlength="32"
              clearable
            >
            </InputGroupField>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <InputGroupButton variant="outline" size="icon-lg">
                  <History class="text-lg" />
                </InputGroupButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem v-if="!historyItems.length" disabled>
                  {{ t("dialog.social_status.history") }}
                </DropdownMenuItem>
                <DropdownMenuItem v-for="item in historyItems" :key="item.no ?? item.status" @click="setSocialStatusFromHistory(item)">
                  {{ item.status }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div v-if="presets.length" class="space-y-2">
            <span class="text-xs text-muted-foreground block">
              {{ t("dialog.social_status.presets") }}
            </span>
            <div class="flex flex-wrap gap-1.5">
              <div
                v-for="(preset, index) in presets"
                :key="index"
                class="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border bg-background text-xs cursor-pointer hover:bg-accent transition-colors max-w-50"
                @click="applyPreset(preset)"
              >
                <i class="x-user-status flex-none" :class="getStatusClass(preset.status)"></i>
                <span class="truncate">{{ preset.statusDescription || getStatusLabel(preset.status) }}</span>
                <button
                  class="flex-none size-4 inline-flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-opacity cursor-pointer"
                  @click.stop="handleDeletePreset(index)"
                >
                  <X class="size-3" />
                </button>
              </div>
            </div>
          </div>

          <Button variant="outline" :disabled="editProfileDialog.loading" @click="handleSavePreset">
            <Bookmark class="size-4" />
            {{ t("dialog.social_status.save_preset") }}
          </Button>
        </section>

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

        <section class="space-y-3">
          <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.profile_theme") }}</h3>
          <div class="flex items-center gap-2">
            <Select :model-value="editProfileDialog.themeId" :disabled="editProfileDialog.loading" @update:model-value="handleThemeChange">
              <SelectTrigger size="sm" class="w-42">
                <SelectValue :placeholder="t('dialog.edit_profile.theme_name_placeholder')">
                  {{ editProfileDialog.themeName }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="option in editProfileDialog.themes" :key="option.id" :value="option.id" :text-value="option.name">
                    <div class="flex w-full items-center justify-between gap-3">
                      <span class="inline-flex shrink-0 items-center gap-1">
                        <span
                          class="size-3 rounded-sm border bg-[var(--swatch-button)]"
                          :style="{ '--swatch-button': getThemeHexColor(option.buttonColor) }"
                          title="Button color"
                        ></span>
                        <span
                          class="size-3 rounded-sm border bg-[var(--swatch-icon)]"
                          :style="{ '--swatch-icon': getThemeHexColor(option.iconColor) }"
                          title="Icon color"
                        ></span>
                        <span
                          class="size-3 rounded-sm border bg-[var(--swatch-subtext)]"
                          :style="{ '--swatch-subtext': getThemeHexColor(option.subtextColor) }"
                          title="Subtext color"
                        ></span>
                      </span>
                      <span class="truncate">{{ option.name }}</span>
                    </div>
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            <Button size="sm" variant="outline" :disabled="editProfileDialog.loading" @click="handleCreateNewTheme">
              {{ t("dialog.edit_profile.create_theme") }}
            </Button>

            <Button size="sm" variant="outline" :disabled="editProfileDialog.loading || !editProfileDialog.themeId" @click="deleteTheme">
              {{ t("dialog.edit_profile.delete_theme") }}
            </Button>
          </div>

          <InputGroupField
            v-model="editProfileDialog.themeName"
            class="min-w-0 flex-1 mb-1"
            :maxlength="12"
            :placeholder="t('dialog.edit_profile.theme_name_placeholder')"
            @input="handleThemeInput"
          >
          </InputGroupField>
          <div class="flex gap-2">
            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">{{ t("dialog.edit_profile.button") }}</span>
              <div class="flex items-center gap-2">
                <ColorPickerButton
                  :model-value="themeButtonColorValue"
                  :disabled="editProfileDialog.loading"
                  @update:model-value="handleThemeButtonColorInput"
                />
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">{{ t("dialog.edit_profile.icon") }}</span>
              <div class="flex items-center gap-2">
                <ColorPickerButton :model-value="themeIconColorValue" :disabled="editProfileDialog.loading" @update:model-value="handleThemeIconColorInput" />
              </div>
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">{{ t("dialog.edit_profile.subtext") }}</span>
              <div class="flex items-center gap-2">
                <ColorPickerButton
                  :model-value="themeSubtextColorValue"
                  :disabled="editProfileDialog.loading"
                  @update:model-value="handleThemeSubtextColorInput"
                />
              </div>
            </div>
          </div>
        </section>

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

        <section class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.nameplate_effect") }}</h3>
            <Button
              size="sm"
              variant="outline"
              :disabled="editProfileDialog.loading || !editProfileDialog.nameplateEffect"
              @click="editProfileDialog.nameplateEffect = ''"
            >
              <X class="size-4" />
              {{ t("common.actions.clear") }}
            </Button>
          </div>
          <Popover v-model:open="nameplateEffectsOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="h-16 w-full justify-between px-3" :disabled="editProfileDialog.loading">
                <span v-if="selectedNameplateEffect" class="flex min-w-0 items-center gap-3">
                  <img
                    :src="selectedNameplateEffect.imageUrl"
                    :alt="selectedNameplateEffect.name"
                    class="size-12 shrink-0 rounded-sm object-cover"
                    loading="lazy"
                  />
                  <span class="truncate">{{ selectedNameplateEffect.name }}</span>
                </span>
                <span v-else class="text-muted-foreground">{{ t("dialog.edit_profile.select_effect") }}</span>
                <ChevronDown class="size-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-130 max-w-[calc(100vw-2rem)] p-3" align="start">
              <div v-if="nameplateEffects.length" class="grid max-h-105 grid-cols-2 gap-3 overflow-y-auto">
                <button
                  v-for="item in nameplateEffects"
                  :key="item.templateId"
                  type="button"
                  class="relative min-w-0 overflow-hidden rounded-md border bg-background text-left transition-colors hover:bg-accent"
                  :class="{
                    'border-primary ring-2 ring-inset ring-primary/40': editProfileDialog.nameplateEffect === item.templateId,
                  }"
                  :aria-label="item.name"
                  :aria-pressed="editProfileDialog.nameplateEffect === item.templateId"
                  @click="selectNameplateEffect(item.templateId)"
                >
                  <img :src="item.imageUrl" :alt="item.name" class="aspect-square w-full object-cover" loading="lazy" />
                  <span class="block truncate px-3 py-2 text-sm font-medium">{{ item.name }}</span>
                  <span
                    v-if="editProfileDialog.nameplateEffect === item.templateId"
                    class="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check class="size-4" />
                  </span>
                </button>
              </div>
              <p v-else class="text-sm text-muted-foreground">{{ t("common.no_data") }}</p>
            </PopoverContent>
          </Popover>
        </section>

        <section class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.profile_effect") }}</h3>
            <Button
              size="sm"
              variant="outline"
              :disabled="editProfileDialog.loading || !editProfileDialog.profileEffect"
              @click="editProfileDialog.profileEffect = ''"
            >
              <X class="size-4" />
              {{ t("common.actions.clear") }}
            </Button>
          </div>
          <Popover v-model:open="profileEffectsOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="h-16 w-full justify-between px-3" :disabled="editProfileDialog.loading">
                <span v-if="selectedProfileEffect" class="flex min-w-0 items-center gap-3">
                  <img
                    :src="selectedProfileEffect.imageUrl"
                    :alt="selectedProfileEffect.name"
                    class="size-12 shrink-0 rounded-sm object-cover"
                    loading="lazy"
                  />
                  <span class="truncate">{{ selectedProfileEffect.name }}</span>
                </span>
                <span v-else class="text-muted-foreground">{{ t("dialog.edit_profile.select_effect") }}</span>
                <ChevronDown class="size-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-130 max-w-[calc(100vw-2rem)] p-3" align="start">
              <div v-if="profileEffects.length" class="grid max-h-105 grid-cols-2 gap-3 overflow-y-auto">
                <button
                  v-for="item in profileEffects"
                  :key="item.id"
                  type="button"
                  class="relative min-w-0 overflow-hidden rounded-md border bg-background text-left transition-colors hover:bg-accent"
                  :class="{
                    'border-primary ring-2 ring-inset ring-primary/40': editProfileDialog.profileEffect === item.templateId,
                  }"
                  :aria-label="item.name"
                  :aria-pressed="editProfileDialog.profileEffect === item.templateId"
                  @click="selectProfileEffect(item.templateId)"
                >
                  <img :src="item.imageUrl" :alt="item.name" class="aspect-square w-full object-cover" loading="lazy" />
                  <span class="block truncate px-3 py-2 text-sm font-medium">{{ item.name }}</span>
                  <span
                    v-if="editProfileDialog.profileEffect === item.templateId"
                    class="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check class="size-4" />
                  </span>
                </button>
              </div>
              <p v-else class="text-sm text-muted-foreground">{{ t("common.no_data") }}</p>
            </PopoverContent>
          </Popover>
        </section>

        <section class="space-y-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="text-sm font-semibold">{{ t("dialog.edit_profile.icon_frame") }}</h3>
            <Button size="sm" variant="outline" :disabled="editProfileDialog.loading || !editProfileDialog.iconFrame" @click="editProfileDialog.iconFrame = ''">
              <X class="size-4" />
              {{ t("common.actions.clear") }}
            </Button>
          </div>
          <Popover v-model:open="iconFramesOpen">
            <PopoverTrigger as-child>
              <Button variant="outline" class="h-16 w-full justify-between px-3" :disabled="editProfileDialog.loading">
                <span v-if="selectedIconFrame" class="flex min-w-0 items-center gap-3">
                  <img :src="selectedIconFrame.imageUrl" :alt="selectedIconFrame.name" class="size-12 shrink-0 rounded-sm object-cover" loading="lazy" />
                  <span class="truncate">{{ selectedIconFrame.name }}</span>
                </span>
                <span v-else class="text-muted-foreground">{{ t("dialog.edit_profile.select_effect") }}</span>
                <ChevronDown class="size-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-130 max-w-[calc(100vw-2rem)] p-3" align="start">
              <div v-if="iconFrames.length" class="grid max-h-105 grid-cols-2 gap-3 overflow-y-auto">
                <button
                  v-for="item in iconFrames"
                  :key="item.templateId"
                  type="button"
                  class="relative min-w-0 overflow-hidden rounded-md border bg-background text-left transition-colors hover:bg-accent"
                  :class="{
                    'border-primary ring-2 ring-inset ring-primary/40': editProfileDialog.iconFrame === item.templateId,
                  }"
                  :aria-label="item.name"
                  :aria-pressed="editProfileDialog.iconFrame === item.templateId"
                  @click="selectIconFrame(item.templateId)"
                >
                  <img :src="item.imageUrl" :alt="item.name" class="aspect-square w-full object-cover" loading="lazy" />
                  <span class="block truncate px-3 py-2 text-sm font-medium">{{ item.name }}</span>
                  <span
                    v-if="editProfileDialog.iconFrame === item.templateId"
                    class="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Check class="size-4" />
                  </span>
                </button>
              </div>
              <p v-else class="text-sm text-muted-foreground">{{ t("common.no_data") }}</p>
            </PopoverContent>
          </Popover>
        </section>
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
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { Bookmark, Check, ChevronDown, History, Trash2, X } from "lucide-vue-next";
import type { BannerType, ProfileTheme, UpdateProfileRequest, UpdateUserRequest, UserStatus } from "vrchat";
import type { AcceptableValue } from "reka-ui";

import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Button from "@/components/ui/button/Button.vue";
import Popover from "@/components/ui/popover/Popover.vue";
import PopoverContent from "@/components/ui/popover/PopoverContent.vue";
import PopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import ColorPickerButton from "@/components/ColorPickerButton.vue";
import InputGroupAction from "@/components/ui/input-group/InputGroupAction.vue";
import InputGroupButton from "@/components/ui/input-group/InputGroupButton.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";

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
import { arraysMatch } from "../../../shared/utils/base/array";
import { debounce } from "../../../shared/utils/common";
import { useUserStore } from "../../../stores/user";
import { useAuthStore } from "../../../stores/auth";
import { useGalleryStore } from "../../../stores/gallery";
import { useModalStore } from "../../../stores/modal";
import { isUserStatus, useStatusPresets } from "./composables/use-status-presets";
import type { StatusPreset } from "./composables/use-status-presets";
import GallerySelectDialog from "../GroupDialog/GallerySelectDialog.vue";
import { updateUserDialogProfile } from "@/coordinators/user-coordinator";
import { profileBackgrounds } from "@/shared/constants/backgrounds";
import type { EditProfileDialogState } from "@/stores/user-state";
import type { Json } from "@/types/vrcx";

type BackgroundType = NonNullable<UpdateProfileRequest["backgroundType"]>;
type StatusOption = { value: UserStatus; statusClass: string; label: string };

const { t } = useI18n();
const { currentUser, isLocalUserVrcPlusSupporter } = storeToRefs(useUserStore());
const authStore = useAuthStore();
const modalStore = useModalStore();
const { refreshGalleryTable, getInventory } = useGalleryStore();
const { presets, addPreset, removePreset, getStatusClass, MAX_PRESETS } = useStatusPresets();
const { inventoryTable } = storeToRefs(useGalleryStore());

const editProfileDialog = defineModel<EditProfileDialogState>("editProfileDialog", { required: true });

function isBannerType(value: string): value is BannerType {
  return value === "avatarBanner" || value === "color" || value === "customImage";
}

function isBackgroundType(value: string): value is BackgroundType {
  return value === "default" || value === "gradient" || value === "inventory" || value === "texture";
}

function isProfileTheme(value: unknown): value is Json<ProfileTheme> {
  if (typeof value !== "object" || value === null) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "buttonColor" in value &&
    typeof value.buttonColor === "string" &&
    "iconColor" in value &&
    typeof value.iconColor === "string" &&
    "subtextColor" in value &&
    typeof value.subtextColor === "string"
  );
}

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
const historyItems = computed(() => editProfileDialog.value.socialStatusHistoryTable);

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
const themeButtonColorValue = computed(() => getThemeHexColor(editProfileDialog.value.themeButtonColor));
const themeIconColorValue = computed(() => getThemeHexColor(editProfileDialog.value.themeIconColor));
const themeSubtextColorValue = computed(() => getThemeHexColor(editProfileDialog.value.themeSubtextColor));
const backgroundGradientBottomColorValue = computed(() => getThemeHexColor(editProfileDialog.value.backgroundGradientBottom));
const backgroundGradientTopColorValue = computed(() => getThemeHexColor(editProfileDialog.value.backgroundGradientTop));

const saveThemeDebounced = debounce(saveTheme, 300);

function normalizeColor(value: string | null | undefined) {
  const hex = (value ?? "").trim().replace(/^#/, "").toLowerCase();
  return /^[0-9a-f]{6}$/.test(hex) ? hex : "";
}

function getThemeHexColor(value: string) {
  const normalized = normalizeColor(value);
  return normalized ? `#${normalized}` : "#ffffff";
}

const statusOptions = computed(() => {
  const options: StatusOption[] = [
    {
      value: "join me",
      statusClass: "joinme",
      label: t("dialog.user.status.join_me"),
    },
    {
      value: "active",
      statusClass: "online",
      label: t("dialog.user.status.online"),
    },
    {
      value: "ask me",
      statusClass: "askme",
      label: t("dialog.user.status.ask_me"),
    },
    {
      value: "busy",
      statusClass: "busy",
      label: t("dialog.user.status.busy"),
    },
  ];
  if (currentUser.value.$isModerator) {
    options.push({
      value: "offline",
      statusClass: "offline",
      label: t("dialog.user.status.offline"),
    });
  }
  return options;
});

const selectedStatusOption = computed(() => statusOptions.value.find((option) => option.value === editProfileDialog.value.status));

function getStatusLabel(status: string) {
  const option = statusOptions.value.find((item) => item.value === status);
  if (!option?.label) {
    return status;
  }
  return option.label;
}

function applyPreset(preset: StatusPreset) {
  editProfileDialog.value.status = preset.status;
  editProfileDialog.value.statusDescription = preset.statusDescription;
}

async function handleSavePreset() {
  const D = editProfileDialog.value;
  if (!isUserStatus(D.status)) return;
  const result = await addPreset(D.status, D.statusDescription);
  if (result === "ok") {
    toast.success(t("dialog.social_status.preset_saved"));
  } else if (result === "exists") {
    toast.info(t("dialog.social_status.preset_exists"));
  } else {
    toast.warning(t("dialog.social_status.preset_limit", { max: MAX_PRESETS }));
  }
}

async function handleDeletePreset(index: number) {
  await removePreset(index);
}

function handleSocialStatusChange(value: unknown) {
  editProfileDialog.value.status = String(value);
}

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

function setSocialStatusFromHistory(val: { status: string } | null) {
  if (val === null) {
    return;
  }
  editProfileDialog.value.statusDescription = val.status;
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

function handleThemeChange(value: AcceptableValue) {
  if (typeof value !== "string") {
    return;
  }
  const D = editProfileDialog.value;
  D.themeId = value;
  const selectedTheme = D.themes.find((option) => option.id === D.themeId);
  if (!selectedTheme) {
    return;
  }
  D.themeName = selectedTheme.name;
  D.themeButtonColor = normalizeColor(selectedTheme.buttonColor);
  D.themeIconColor = normalizeColor(selectedTheme.iconColor);
  D.themeSubtextColor = normalizeColor(selectedTheme.subtextColor);
}

function handleThemeButtonColorInput(event: string) {
  const D = editProfileDialog.value;
  D.themeButtonColor = normalizeColor(event);
  handleThemeInput();
}

function handleThemeIconColorInput(event: string) {
  const D = editProfileDialog.value;
  D.themeIconColor = normalizeColor(event);
  handleThemeInput();
}

function handleThemeSubtextColorInput(event: string) {
  const D = editProfileDialog.value;
  D.themeSubtextColor = normalizeColor(event);
  handleThemeInput();
}

function handleThemeInput() {
  const D = editProfileDialog.value;
  if (D.themeId) {
    const selectedTheme = D.themes.find((option) => option.id === D.themeId);
    if (selectedTheme) {
      selectedTheme.name = D.themeName;
    }
    saveThemeDebounced();
  }
}

function createTheme() {
  const profileDefaults = authStore.cachedConfig.profileDefaults;
  const D = editProfileDialog.value;
  const payload = {
    name: D.themeName,
    buttonColor: profileDefaults?.themeButtonColor ?? "064b5c",
    iconColor: profileDefaults?.themeIconColor ?? "6ae3f9",
    subtextColor: profileDefaults?.themeSubtextColor ?? "a9a9a9",
  };
  void userRequest
    .createProfileTheme(payload)
    .then((args) => {
      const newTheme = args.json;
      if (isProfileTheme(newTheme) && newTheme.id) {
        D.themes.push(newTheme);
        D.themeId = newTheme.id;
        D.themeName = newTheme.name;
        D.themeButtonColor = newTheme.buttonColor;
        D.themeIconColor = newTheme.iconColor;
        D.themeSubtextColor = newTheme.subtextColor;
      }
    })
    .catch((error: unknown) => {
      console.error("Failed to create profile theme:", error);
    });
}

function saveTheme() {
  const D = editProfileDialog.value;
  const payload = {
    themeId: D.themeId,
    name: D.themeName,
    buttonColor: D.themeButtonColor,
    iconColor: D.themeIconColor,
    subtextColor: D.themeSubtextColor,
  };
  void userRequest
    .saveProfileTheme(payload)
    .then(() => {
      const index = D.themes.findIndex((option) => option.id === payload.themeId);
      if (index !== -1) {
        D.themes[index] = {
          id: payload.themeId,
          name: payload.name,
          buttonColor: payload.buttonColor,
          iconColor: payload.iconColor,
          subtextColor: payload.subtextColor,
        };
      }
    })
    .catch((error: unknown) => {
      console.error("Failed to update profile theme:", error);
    });
}

function deleteTheme() {
  const D = editProfileDialog.value;
  void userRequest
    .deleteProfileTheme({ id: D.themeId })
    .then(() => {
      const index = D.themes.findIndex((option) => option.id === D.themeId);
      if (index !== -1) {
        D.themes.splice(index, 1);
        D.themeId = "";
        D.themeName = "";
        D.themeButtonColor = "";
        D.themeIconColor = "";
        D.themeSubtextColor = "";
        const lastTheme = D.themes.at(-1);
        if (lastTheme) {
          handleThemeChange(lastTheme.id);
        }
      }
    })
    .catch((error: unknown) => {
      console.error("Failed to delete profile theme:", error);
    });
}

function handleCreateNewTheme() {
  const D = editProfileDialog.value;

  void modalStore
    .prompt({
      title: t("dialog.edit_profile.profile_theme"),
      description: "Enter a theme name (1-12 characters).",
      confirmText: "Create",
      cancelText: t("dialog.alertdialog.cancel"),
      pattern: /^.{1,12}$/,
      errorMessage: "Theme name must be between 1 and 12 characters.",
    })
    .then(({ ok, value }) => {
      if (!ok) {
        return;
      }

      D.themeId = "";
      D.themeName = value;
      D.themeButtonColor = "";
      D.themeIconColor = "";
      D.themeSubtextColor = "";
      createTheme();
    })
    .catch((error: unknown) => {
      console.error("Failed to prompt for profile theme name:", error);
    });
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

async function saveProfile() {
  const D = editProfileDialog.value;
  if (D.loading) {
    return;
  }

  const userPayload: UpdateUserRequest = {};
  if (D.status !== currentUser.value.status && isUserStatus(D.status)) {
    userPayload.status = D.status;
  }
  if (D.statusDescription !== currentUser.value.statusDescription) {
    userPayload.statusDescription = D.statusDescription;
  }
  if (D.pronouns !== currentUser.value.pronouns) {
    userPayload.pronouns = D.pronouns;
  }

  const profilePayload: UpdateProfileRequest = {};
  if (D.bio !== D.selfProfileRef.bio) {
    profilePayload.bio = D.bio;
  }
  if (!arraysMatch(D.bioLinks, D.selfProfileRef.bioLinks)) {
    profilePayload.bioLinks = D.bioLinks;
  }
  if (D.bannerColor !== D.selfProfileRef.bannerColor) {
    profilePayload.bannerColor = D.bannerColor;
  }
  if (D.bannerUrl !== D.selfProfileRef.bannerUrl) {
    profilePayload.bannerCustomUrl = D.bannerUrl;
  }
  if (D.bannerType !== D.selfProfileRef.bannerType && isBannerType(D.bannerType)) {
    profilePayload.bannerType = D.bannerType;
    if (D.bannerType === "avatarBanner") {
      delete profilePayload.bannerCustomUrl;
      delete profilePayload.bannerColor;
    }
    if (D.bannerType === "color") {
      delete profilePayload.bannerCustomUrl;
    }
    if (D.bannerType === "customImage") {
      delete profilePayload.bannerColor;
    }
  }
  if (D.iconUrl !== D.selfProfileRef.iconUrl) {
    profilePayload.userIcon = D.iconUrl;
  }
  if (D.themeId !== D.selfProfileRef.themeId) {
    profilePayload.themeId = D.themeId;
  }
  if (D.backgroundType !== D.selfProfileRef.backgroundType && isBackgroundType(D.backgroundType)) {
    profilePayload.backgroundType = D.backgroundType;
  }
  if (D.backgroundTextureId !== D.selfProfileRef.backgroundTextureId) {
    profilePayload.backgroundTextureId = D.backgroundTextureId;
  }
  if (D.backgroundGradientBottom !== D.selfProfileRef.backgroundGradientBottom) {
    profilePayload.backgroundGradientBottom = D.backgroundGradientBottom;
  }
  if (D.backgroundGradientTop !== D.selfProfileRef.backgroundGradientTop) {
    profilePayload.backgroundGradientTop = D.backgroundGradientTop;
  }
  if (D.nameplateEffect !== D.selfProfileRef.nameplateEffect) {
    profilePayload.nameplateEffect = D.nameplateEffect;
  }
  if (D.profileEffect !== D.selfProfileRef.profileEffect) {
    profilePayload.profileEffect = D.profileEffect;
  }
  if (D.iconFrame !== D.selfProfileRef.iconFrame) {
    profilePayload.iconFrame = D.iconFrame;
  }

  D.loading = true;
  try {
    if (Object.keys(profilePayload).length) {
      console.log("Saving profile with payload:", profilePayload);
      await userRequest.saveProfile(profilePayload);
    }
    if (Object.keys(userPayload).length) {
      console.log("Saving user with payload:", userPayload);
      await userRequest.saveCurrentUser(userPayload);
    }
    D.visible = false;
    updateUserDialogProfile();
    toast.success("Profile updated");
  } finally {
    D.loading = false;
  }
}
</script>
