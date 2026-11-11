import type { useI18n } from "vue-i18n";
import type { Ref } from "vue";

import type { PreviousInstancesVariant } from "./instance-types";
import { parseLocation } from "../shared/utils/location-parser";
import { queryRequest } from "../api/query-request";
import { accessTypeLocaleKeyMap } from "../shared/constants/access-type";
import { resolveRef } from "../shared/utils/resolve-ref";
import { textOf, localeKeyOf } from "./instance-value-parsers";
import { toUserRefTarget, toNamedRefTarget } from "./instance-room-records";
import type { useUiStore } from "./ui";
import type { UserRefTarget, NamedRefTarget } from "./instance-types";

export type CreatePreviousInstancesDialogsDeps = {
  uiStore: ReturnType<typeof useUiStore>;
  cachedWorldNameOf: (worldId: string) => unknown;
  previousInstancesInfoDialog: Ref<{ instanceId: string; lastId: string; visible: boolean }>;
  previousInstancesListDialog: Ref<{
    visible: boolean;
    variant: PreviousInstancesVariant;
    userRef: UserRefTarget;
    worldRef: NamedRefTarget;
    groupRef: NamedRefTarget;
    lastId: string;
  }>;
  t: ReturnType<typeof useI18n>["t"];
};

export function createPreviousInstancesDialogs(deps: CreatePreviousInstancesDialogsDeps) {
  const { uiStore, cachedWorldNameOf, previousInstancesInfoDialog, previousInstancesListDialog, t } = deps;

  function hidePreviousInstancesDialogs() {
    previousInstancesInfoDialog.value.visible = false;
    previousInstancesListDialog.value.visible = false;
  }

  function setPreviousInstancesInfoDialogVisible(isVisible: boolean) {
    previousInstancesInfoDialog.value.visible = isVisible;
  }

  function setPreviousInstancesListDialogVisible(isVisible: boolean) {
    previousInstancesListDialog.value.visible = isVisible;
  }

  function resolveUserRef(input: unknown) {
    return resolveRef(input, {
      emptyDefault: { id: "", displayName: "" },
      idAlias: "userId",
      nameKey: "displayName",
      fetchFn: (id) => queryRequest.fetch("user.dialog", { userId: id }),
    });
  }

  function resolveWorldRef(input: unknown) {
    return resolveRef(input, {
      emptyDefault: { id: "", name: "" },
      idAlias: "worldId",
      nameKey: "name",
      fetchFn: (id) => queryRequest.fetch("world.location", { worldId: id }),
    });
  }

  function resolveGroupRef(input: unknown) {
    return resolveRef(input, {
      emptyDefault: { id: "", name: "" },
      idAlias: "groupId",
      nameKey: "name",
      fetchFn: (id) => queryRequest.fetch("group.dialog", { groupId: id }),
    });
  }

  function translateAccessType(accessTypeNameRaw: string) {
    const key = localeKeyOf(accessTypeNameRaw);
    if (!key) {
      return accessTypeNameRaw;
    }
    if (accessTypeNameRaw === "groupPublic" || accessTypeNameRaw === "groupPlus") {
      const groupKey = accessTypeLocaleKeyMap.group;
      return `${t(groupKey)} ${t(key)}`;
    }
    return t(key);
  }

  function formatPreviousInstancesInfoLabel(instanceId: string, worldNameOverride = "") {
    const location = parseLocation(instanceId);
    const worldId = location.worldId;
    const worldName = worldNameOverride || (worldId ? textOf(cachedWorldNameOf(worldId)) : "");
    const baseLabel = worldName || worldId || instanceId || "";
    const accessTypeLabel = translateAccessType(location.accessTypeName || "");
    if (!accessTypeLabel || !location.instanceId) {
      return baseLabel;
    }
    return `${baseLabel} · ${accessTypeLabel}`;
  }

  function showPreviousInstancesInfoDialog(instanceId: string) {
    previousInstancesInfoDialog.value.visible = true;
    previousInstancesInfoDialog.value.instanceId = instanceId;
    uiStore.openDialog({
      type: "previous-instances-info",
      id: instanceId || "",
      label: instanceId ? formatPreviousInstancesInfoLabel(instanceId) : "",
    });
    if (instanceId) {
      const location = parseLocation(instanceId);
      if (location.worldId && !cachedWorldNameOf(location.worldId)) {
        queryRequest
          .fetch("world.dialog", { worldId: location.worldId })
          .then((args) => {
            uiStore.setDialogCrumbLabel("previous-instances-info", instanceId, formatPreviousInstancesInfoLabel(instanceId, args.ref.name || ""));
          })
          .catch((error: unknown) => {
            console.error("Error fetching world name for previous instances:", error);
          });
      }
    }
  }

  async function showPreviousInstancesListDialog(variant: PreviousInstancesVariant, targetRef: unknown) {
    previousInstancesListDialog.value.variant = variant;
    let resolved: Record<string, unknown>;
    if (variant === "user") {
      resolved = await resolveUserRef(targetRef);
      previousInstancesListDialog.value.userRef = toUserRefTarget(resolved);
    } else if (variant === "world") {
      resolved = await resolveWorldRef(targetRef);
      previousInstancesListDialog.value.worldRef = toNamedRefTarget(resolved);
    } else {
      resolved = await resolveGroupRef(targetRef);
      previousInstancesListDialog.value.groupRef = toNamedRefTarget(resolved);
    }
    previousInstancesListDialog.value.visible = true;
    const dialogId = textOf(resolved["id"]);
    const label = dialogId ? (variant === "user" ? textOf(resolved["displayName"]) || dialogId : textOf(resolved["name"]) || dialogId) : "";
    uiStore.openDialog({
      type: `previous-instances-${variant}`,
      id: dialogId,
      label,
    });
  }

  return {
    hidePreviousInstancesDialogs,
    setPreviousInstancesInfoDialogVisible,
    setPreviousInstancesListDialogVisible,
    showPreviousInstancesInfoDialog,
    showPreviousInstancesListDialog,
  };
}
