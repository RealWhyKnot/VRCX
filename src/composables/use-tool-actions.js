import { toast } from "vue-sonner";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { toolDefinitionMap, toolDefinitions } from "../shared/constants/tools";
import { useAdvancedSettingsStore } from "../stores/settings/advanced";
import { useLaunchStore } from "../stores/launch";
import { useToolsStore } from "../stores/tools";
import { useVrcxStore } from "../stores/vrcx";

export async function executeToolAction(definition, { router, t, toolsStore, advancedSettingsStore, launchStore, vrcxStore }) {
  if (!definition?.action) {
    return;
  }

  const { action } = definition;

  if (action.type === "route") {
    router.push({ name: action.routeName });
    return;
  }

  if (action.type === "dialog") {
    toolsStore.openDialog(toDialogStoreKey(action.dialogKey));
    return;
  }

  if (action.type === "store-action") {
    const targetStore = {
      advancedSettings: advancedSettingsStore,
      launch: launchStore,
      vrcx: vrcxStore,
    }[action.target];

    targetStore?.[action.method]?.();
    return;
  }

  if (action.type === "app-api") {
    const result = await AppApi[action.method]();
    if (result) {
      toast.success(t(action.successMessageKey));
      return;
    }
    toast.error(t(action.errorMessageKey));
  }
}

export function toDialogStoreKey(dialogKey) {
  return dialogKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}

export function useToolActions() {
  const router = useRouter();
  const { t } = useI18n();

  const toolsStore = useToolsStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const launchStore = useLaunchStore();
  const vrcxStore = useVrcxStore();

  async function triggerTool(toolOrKey) {
    const definition = typeof toolOrKey === "string" ? toolDefinitionMap.get(toolOrKey) : toolOrKey;

    await executeToolAction(definition, {
      router,
      t,
      toolsStore,
      advancedSettingsStore,
      launchStore,
      vrcxStore,
    });
  }

  return {
    toolDefinitions,
    triggerTool,
  };
}
