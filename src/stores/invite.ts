import { computed, ref, watch } from "vue";
import { defineStore } from "pinia";
import type { InviteMessage, InviteMessageType } from "vrchat";

import type { Json } from "../types/vrcx";
import { inviteMessagesRequest } from "../api/invite-messages";
import { useAdvancedSettingsStore } from "./settings/advanced";
import { useGameStore } from "./game";
import { watchState } from "../services/watch-state";

type InviteMessageTable = {
  data: Json<InviteMessage[]>;
  layout: string;
  visible: boolean;
};

export const useInviteStore = defineStore("Invite", () => {
  const gameStore = useGameStore();
  const advancedSettingsStore = useAdvancedSettingsStore();

  const inviteMessageTable = ref<InviteMessageTable>({
    data: [],
    layout: "table",
    visible: false,
  });

  const inviteResponseMessageTable = ref<InviteMessageTable>({
    data: [],
    layout: "table",
    visible: false,
  });

  const inviteRequestMessageTable = ref<InviteMessageTable>({
    data: [],
    layout: "table",
    visible: false,
  });

  const inviteRequestResponseMessageTable = ref<InviteMessageTable>({
    data: [],
    layout: "table",
    visible: false,
  });

  watch(
    () => watchState.isLoggedIn,
    () => {
      inviteMessageTable.value.data = [];
      inviteResponseMessageTable.value.data = [];
      inviteRequestMessageTable.value.data = [];
      inviteRequestResponseMessageTable.value.data = [];
      inviteMessageTable.value.visible = false;
      inviteResponseMessageTable.value.visible = false;
      inviteRequestMessageTable.value.visible = false;
      inviteRequestResponseMessageTable.value.visible = false;
    },
    { flush: "sync" }
  );

  const canOpenInstanceInGame = computed(() => {
    return gameStore.isGameRunning && !advancedSettingsStore.selfInviteOverride;
  });

  function refreshInviteMessageTableData(mode: InviteMessageType) {
    inviteMessagesRequest
      .refreshInviteMessageTableData(mode)
      .then(({ json }) => {
        switch (mode) {
          case "message":
            inviteMessageTable.value.data = json;
            break;
          case "response":
            inviteResponseMessageTable.value.data = json;
            break;
          case "request":
            inviteRequestMessageTable.value.data = json;
            break;
          case "requestResponse":
            inviteRequestResponseMessageTable.value.data = json;
            break;
        }
      })
      .catch((err: unknown) => {
        console.error("refreshInviteMessageTableData Failed：", err);
      });
  }

  return {
    inviteMessageTable,
    inviteResponseMessageTable,
    inviteRequestMessageTable,
    inviteRequestResponseMessageTable,
    refreshInviteMessageTableData,
    canOpenInstanceInGame,
  };
});
