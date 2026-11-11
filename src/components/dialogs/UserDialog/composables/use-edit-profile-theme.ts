import { computed } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { AcceptableValue } from "reka-ui";
import type { ProfileTheme } from "vrchat";
import type { useAuthStore } from "@/stores/auth";
import type { useModalStore } from "@/stores/modal";
import type { EditProfileDialogState } from "@/stores/user-state";
import type { Json } from "@/types/vrcx";
import { userRequest } from "../../../../api/user";
import { debounce } from "../../../../shared/utils/common";
import { getThemeHexColor, normalizeColor } from "../edit-profile-colors";

type Translate = ReturnType<typeof useI18n>["t"];
type ModalStore = ReturnType<typeof useModalStore>;
type AuthStore = ReturnType<typeof useAuthStore>;

type EditProfileThemeDeps = {
  t: Translate;
  modalStore: Pick<ModalStore, "prompt">;
  authStore: Pick<AuthStore, "cachedConfig">;
};

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

export function useEditProfileTheme(editProfileDialog: Ref<EditProfileDialogState>, { t, modalStore, authStore }: EditProfileThemeDeps) {
  const themeButtonColorValue = computed(() => getThemeHexColor(editProfileDialog.value.themeButtonColor));
  const themeIconColorValue = computed(() => getThemeHexColor(editProfileDialog.value.themeIconColor));
  const themeSubtextColorValue = computed(() => getThemeHexColor(editProfileDialog.value.themeSubtextColor));

  const saveThemeDebounced = debounce(saveTheme, 300);

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

  return {
    themeButtonColorValue,
    themeIconColorValue,
    themeSubtextColorValue,
    handleThemeChange,
    handleThemeButtonColorInput,
    handleThemeIconColorInput,
    handleThemeSubtextColorInput,
    handleThemeInput,
    handleCreateNewTheme,
    deleteTheme,
  };
}
