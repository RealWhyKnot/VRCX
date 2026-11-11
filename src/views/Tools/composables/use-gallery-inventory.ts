import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import { inventoryRequest } from "../../../api/inventory";
import { useAdvancedSettingsStore } from "../../../stores/settings/advanced";
import { useGalleryStore } from "../../../stores/gallery";
import { useModalStore } from "../../../stores/modal";
import { logError, removeItemById } from "./gallery-file-actions";

export function useGalleryInventory() {
  const { t } = useI18n();
  const modalStore = useModalStore();
  const { currentUserInventory } = storeToRefs(useAdvancedSettingsStore());
  const { inventoryTable } = storeToRefs(useGalleryStore());
  const { getInventory } = useGalleryStore();

  const inventoryTypeFilter = ref("all");

  const inventoryTypeOptions = computed(() => {
    const optionsByType = new Set<string>();
    for (const item of inventoryTable.value) {
      if (optionsByType.has(item.itemTypeLabel)) {
        continue;
      }
      optionsByType.add(item.itemTypeLabel);
    }
    return Array.from(optionsByType.values()).sort((a, b) => a.localeCompare(b));
  });

  const filteredInventoryTable = computed(() => {
    const selectedType = inventoryTypeFilter.value;
    if (selectedType === "all") {
      return inventoryTable.value;
    }

    return inventoryTable.value.filter((item) => item.itemTypeLabel === selectedType);
  });

  async function consumeInventoryBundle(inventoryId: string) {
    try {
      await inventoryRequest.consumeInventoryBundle({
        inventoryId,
      });
      currentUserInventory.value.delete(inventoryId);
      removeItemById(inventoryTable.value, inventoryId);
      void getInventory().catch(logError);
    } catch (error) {
      console.error("Error consuming inventory bundle:", error);
    }
  }

  function redeemReward() {
    void modalStore
      .prompt({
        title: t("prompt.redeem.header"),
        description: t("prompt.redeem.description"),
        confirmText: t("prompt.redeem.redeem"),
        cancelText: t("prompt.redeem.cancel"),
      })
      .then(({ ok, value }) => {
        if (!ok) return;
        if (value) {
          void inventoryRequest
            .redeemReward({
              code: value.trim(),
            })
            .then(() => {
              toast.success(t("prompt.redeem.success"));
              void getInventory().catch(logError);
            })
            .catch((error: unknown) => {
              console.error("Error redeeming reward:", error);
            });
        }
      })
      .catch(logError);
  }

  return {
    getInventory,
    inventoryTypeFilter,
    inventoryTypeOptions,
    filteredInventoryTable,
    consumeInventoryBundle,
    redeemReward,
  };
}
