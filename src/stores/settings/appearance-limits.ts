import type { Ref } from "vue";

import { clampLimit } from "./appearance-helpers";
import type { TableLimitsDialogState } from "./appearance-helpers";
import { configRepository } from "../../services/config";
import { database } from "../../services/database";
import { SEARCH_LIMIT_MAX, SEARCH_LIMIT_MIN, TABLE_MAX_SIZE_MAX, TABLE_MAX_SIZE_MIN } from "../../shared/constants/settings";
import type { useFeedStore } from "../feed";
import type { useGameLogStore } from "../gameLog";
import type { useVrcxStore } from "../vrcx";

export function openTableLimitsDialog(dialog: Ref<TableLimitsDialogState>, vrcxStore: ReturnType<typeof useVrcxStore>): void {
  dialog.value.maxTableSize = vrcxStore.maxTableSize;
  dialog.value.searchLimit = vrcxStore.searchLimit;
  dialog.value.visible = true;
}

export async function saveTableLimits(
  dialog: Ref<TableLimitsDialogState>,
  vrcxStore: ReturnType<typeof useVrcxStore>,
  feedStore: ReturnType<typeof useFeedStore>,
  gameLogStore: ReturnType<typeof useGameLogStore>
): Promise<void> {
  const nextMaxTableSize = clampLimit(dialog.value.maxTableSize, TABLE_MAX_SIZE_MIN, TABLE_MAX_SIZE_MAX);
  if (nextMaxTableSize === null) {
    return;
  }

  const nextSearchLimit = clampLimit(dialog.value.searchLimit, SEARCH_LIMIT_MIN, SEARCH_LIMIT_MAX);
  if (nextSearchLimit === null) {
    return;
  }

  vrcxStore.setMaxTableSize(nextMaxTableSize);
  await configRepository.setInt("VRCX_maxTableSize_v2", vrcxStore.maxTableSize);
  database.setMaxTableSize(vrcxStore.maxTableSize);

  vrcxStore.setSearchLimit(nextSearchLimit);
  await configRepository.setInt("VRCX_searchLimit", vrcxStore.searchLimit);
  database.setSearchTableSize(vrcxStore.searchLimit);

  feedStore.feedTableLookup().catch((error: unknown) => console.error(error));
  gameLogStore.gameLogTableLookup().catch((error: unknown) => console.error(error));
  dialog.value.visible = false;
}
