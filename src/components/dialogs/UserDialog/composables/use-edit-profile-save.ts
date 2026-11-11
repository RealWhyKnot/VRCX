import type { Ref } from "vue";
import { toast } from "vue-sonner";
import type { BannerType, UpdateProfileRequest, UpdateUserRequest } from "vrchat";
import { updateUserDialogProfile } from "@/coordinators/user-coordinator";
import type { CurrentUserState, EditProfileDialogState } from "@/stores/user-state";
import { userRequest } from "../../../../api/user";
import { arraysMatch } from "../../../../shared/utils/base/array";
import { isUserStatus } from "./use-status-presets";

type BackgroundType = NonNullable<UpdateProfileRequest["backgroundType"]>;

function isBannerType(value: string): value is BannerType {
  return value === "avatarBanner" || value === "color" || value === "customImage";
}

function isBackgroundType(value: string): value is BackgroundType {
  return value === "default" || value === "gradient" || value === "inventory" || value === "texture";
}

export function useEditProfileSave(editProfileDialog: Ref<EditProfileDialogState>, currentUser: Ref<CurrentUserState>) {
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

  return { saveProfile };
}
