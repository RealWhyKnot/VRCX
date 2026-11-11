import { defineStore } from "pinia";
import { reactive, toRefs } from "vue";

const initialDialogState = () => ({
  groupCalendar: false,
  blockedGroups: false,
  groupInvites: false,
  noteExport: false,
  exportDiscordNames: false,
  exportFriendsList: false,
  exportAvatarsList: false,
  editInviteMessages: false,
  autoChangeStatus: false,
  moderationReports: false,
  purchaseHistory: false,
  creatorEarnings: false,
  infoPush: false,
});

type ToolDialogState = ReturnType<typeof initialDialogState>;
type ToolDialogKey = keyof ToolDialogState;

function isToolDialogKey(dialogKey: string, dialogs: ToolDialogState): dialogKey is ToolDialogKey {
  return dialogKey in dialogs;
}

export const useToolsStore = defineStore("Tools", () => {
  const dialogs = reactive(initialDialogState());

  function setDialogVisible(dialogKey: string, isVisible: boolean) {
    if (!isToolDialogKey(dialogKey, dialogs)) {
      console.warn(`[toolsStore] Unknown dialog key "${dialogKey}" passed to setDialogVisible`);
      return;
    }
    dialogs[dialogKey] = isVisible;
  }

  function openDialog(dialogKey: string) {
    setDialogVisible(dialogKey, true);
  }

  function closeDialog(dialogKey: string) {
    setDialogVisible(dialogKey, false);
  }

  function closeAllDialogs() {
    Object.keys(dialogs).forEach((dialogKey) => {
      setDialogVisible(dialogKey, false);
    });
  }

  return {
    ...toRefs(dialogs),
    setDialogVisible,
    openDialog,
    closeDialog,
    closeAllDialogs,
  };
});
