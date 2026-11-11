import { toast } from "vue-sonner";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { Router } from "vue-router";

import { toolDefinitionMap, toolDefinitions } from "../shared/constants/tools";
import { useAdvancedSettingsStore } from "../stores/settings/advanced";
import { useLaunchStore } from "../stores/launch";
import { useToolsStore } from "../stores/tools";
import { useVrcxStore } from "../stores/vrcx";

type ToolAction = {
  type: string;
  routeName?: string;
  dialogKey?: string;
  target?: string;
  method?: string;
  successMessageKey?: string;
  errorMessageKey?: string;
};

type ToolDefinition = {
  action?: ToolAction;
};

type ToolStores = {
  advancedSettingsStore: ReturnType<typeof useAdvancedSettingsStore>;
  launchStore: ReturnType<typeof useLaunchStore>;
  vrcxStore: ReturnType<typeof useVrcxStore>;
};

type ToolActionDeps = ToolStores & {
  router: Router;
  t: (key: string) => string;
  toolsStore: ReturnType<typeof useToolsStore>;
};

const APP_API_TOOL_METHODS = [
  "OpenVrcPhotosFolder",
  "OpenVrcScreenshotsFolder",
  "OpenVrcxAppDataFolder",
  "OpenVrcAppDataFolder",
  "OpenCrashVrcCrashDumps",
] as const;

type AppApiToolMethod = (typeof APP_API_TOOL_METHODS)[number];

function requireField(value: string | undefined, field: string): string {
  if (value === undefined) {
    throw new TypeError(`Tool action is missing ${field}`);
  }
  return value;
}

function requireAppApiMethod(value: string | undefined): AppApiToolMethod {
  const method = APP_API_TOOL_METHODS.find((name) => name === value);
  if (method === undefined) {
    throw new TypeError(`Unknown app API tool method: ${value}`);
  }
  return method;
}

async function runStoreAction(stores: ToolStores, target: string, method: string): Promise<void> {
  if (target === "advancedSettings" && method === "showVRChatConfig") {
    await stores.advancedSettingsStore.showVRChatConfig();
    return;
  }
  if (target === "launch" && method === "showLaunchOptions") {
    stores.launchStore.showLaunchOptions();
    return;
  }
  if (target === "vrcx" && method === "showRegistryBackupDialog") {
    stores.vrcxStore.showRegistryBackupDialog();
  }
}

export async function executeToolAction(definition: ToolDefinition | undefined, deps: ToolActionDeps): Promise<void> {
  if (!definition?.action) {
    return;
  }

  const { action } = definition;

  if (action.type === "route") {
    await deps.router.push({ name: requireField(action.routeName, "routeName") });
    return;
  }

  if (action.type === "dialog") {
    deps.toolsStore.openDialog(toDialogStoreKey(requireField(action.dialogKey, "dialogKey")));
    return;
  }

  if (action.type === "store-action") {
    await runStoreAction(deps, requireField(action.target, "target"), requireField(action.method, "method"));
    return;
  }

  if (action.type === "app-api") {
    const isSuccess = await AppApi[requireAppApiMethod(action.method)]();
    if (isSuccess) {
      toast.success(deps.t(requireField(action.successMessageKey, "successMessageKey")));
      return;
    }
    toast.error(deps.t(requireField(action.errorMessageKey, "errorMessageKey")));
  }
}

export function toDialogStoreKey(dialogKey: string): string {
  return dialogKey.replace(/-([a-z])/g, (_: string, char: string) => char.toUpperCase());
}

export function useToolActions() {
  const router = useRouter();
  const { t } = useI18n();

  const toolsStore = useToolsStore();
  const advancedSettingsStore = useAdvancedSettingsStore();
  const launchStore = useLaunchStore();
  const vrcxStore = useVrcxStore();

  async function triggerTool(toolOrKey: string | ToolDefinition) {
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
