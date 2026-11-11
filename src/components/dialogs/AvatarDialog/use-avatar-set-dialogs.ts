import { nextTick, ref } from "vue";
import type { Ref } from "vue";
import type { useAvatarStore } from "../../../stores/avatar";
import type { AvatarRef } from "../../../shared/utils/avatar-transforms";
import { logError } from "../../../stores/vrcx-messages";
import type { SetAvatarStylesState, SetAvatarTagsState } from "./avatar-dialog-types";

type AvatarDialogState = ReturnType<typeof useAvatarStore>["avatarDialog"];

export function useAvatarSetDialogs(
  avatarDialog: Ref<AvatarDialogState>,
  currentUser: Ref<{ id: string }>,
  cachedAvatars: Pick<Map<string, AvatarRef>, "values">
) {
  const setAvatarTagsDialog = ref<SetAvatarTagsState>({
    visible: false,
    loading: false,
    ownAvatars: [],
    selectedAvatarIds: [],
    selectedTags: [],
    selectedTagsCsv: "",
    contentHorror: false,
    contentGore: false,
    contentViolence: false,
    contentAdult: false,
    contentSex: false,
  });
  const setAvatarStylesDialog = ref<SetAvatarStylesState>({
    visible: false,
    loading: false,
    avatarId: "",
    initialPrimaryStyle: "",
    initialSecondaryStyle: "",
    primaryStyle: "",
    secondaryStyle: "",
    availableAvatarStyles: [],
    availableAvatarStylesMap: new Map(),
    initialTags: [],
    authorTags: "",
  });

  function showSetAvatarTagsDialog(avatarId: string) {
    const D = setAvatarTagsDialog.value;
    D.selectedAvatarIds = [avatarId];
    D.visible = true;
    D.loading = true;
    D.ownAvatars = [];
    D.selectedTags = [];
    D.selectedTagsCsv = "";
    D.contentHorror = false;
    D.contentGore = false;
    D.contentViolence = false;
    D.contentAdult = false;
    D.contentSex = false;
    const oldTags = avatarDialog.value.ref.tags ?? [];
    oldTags.forEach((tag) => {
      switch (tag) {
        case "content_horror":
          D.contentHorror = true;
          break;
        case "content_gore":
          D.contentGore = true;
          break;
        case "content_violence":
          D.contentViolence = true;
          break;
        case "content_adult":
          D.contentAdult = true;
          break;
        case "content_sex":
          D.contentSex = true;
          break;
        default:
          if (tag.startsWith("content_")) {
            D.selectedTags.push(tag.substring(8));
          }
          break;
      }
    });
    for (const ref of cachedAvatars.values()) {
      if (ref.authorId === currentUser.value.id) {
        D.ownAvatars.push(ref);
      }
    }
    void nextTick(() => {
      D.loading = false;
    }).catch(logError);
  }

  function showSetAvatarStylesDialog() {
    const D = setAvatarStylesDialog.value;
    D.visible = true;
    D.loading = true;
    D.avatarId = avatarDialog.value.id;
    D.primaryStyle = avatarDialog.value.ref.styles?.primary ?? "";
    D.secondaryStyle = avatarDialog.value.ref.styles?.secondary ?? "";
    D.initialPrimaryStyle = D.primaryStyle;
    D.initialSecondaryStyle = D.secondaryStyle;
    D.initialTags = avatarDialog.value.ref.tags ?? [];
    D.authorTags = "";
    for (const tag of D.initialTags) {
      if (tag.startsWith("author_tag_")) {
        if (D.authorTags) {
          D.authorTags += ",";
        }
        D.authorTags += tag.substring(11);
      }
    }
    void nextTick(() => {
      D.loading = false;
    }).catch(logError);
  }

  return {
    setAvatarTagsDialog,
    setAvatarStylesDialog,
    showSetAvatarTagsDialog,
    showSetAvatarStylesDialog,
  };
}
