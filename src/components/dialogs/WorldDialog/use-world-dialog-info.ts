import { computed } from "vue";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { toast as vueSonnerToast } from "vue-sonner";
import { commaNumber } from "../../../shared/utils/base/string";
import { compareUnityVersion } from "../../../shared/utils/avatar";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { timeToText } from "../../../shared/utils/base/format";
import { database } from "../../../services/database";
import type { useWorldStore } from "../../../stores/world";

type Translate = ReturnType<typeof useI18n>["t"];
type WorldDialogState = ReturnType<typeof useWorldStore>["worldDialog"];
type SdkUnityVersion = Parameters<typeof compareUnityVersion>[1];

export function useWorldDialogInfo(
  worldDialog: Ref<WorldDialogState>,
  {
    t,
    toast,
    sdkUnityVersion,
  }: {
    t: Translate;
    toast: Pick<typeof vueSonnerToast, "success" | "error">;
    sdkUnityVersion: SdkUnityVersion;
  }
) {
  const { memo, onWorldMemoChange } = useWorldMemo(worldDialog);

  const isTimeInLabVisible = computed(() => {
    return (
      worldDialog.value.ref.publicationDate &&
      worldDialog.value.ref.publicationDate !== "none" &&
      worldDialog.value.ref.labsPublicationDate &&
      worldDialog.value.ref.labsPublicationDate !== "none"
    );
  });

  const timeInLab = computed(() => {
    return timeToText(new Date(worldDialog.value.ref.publicationDate ?? "").getTime() - new Date(worldDialog.value.ref.labsPublicationDate ?? "").getTime());
  });

  const favoriteRate = computed(() => {
    const { favorites, visits } = worldDialog.value.ref;
    return Math.round((((Number(favorites) - Number(visits)) / Number(visits)) * 100 + 100) * 100) / 100;
  });

  const worldTags = computed(() => {
    return worldDialog.value.ref.tags
      ?.filter((tag) => tag.startsWith("author_tag"))
      .map((tag) => tag.replace("author_tag_", ""))
      .join(", ");
  });

  const worldDialogPlatform = computed(() => {
    const { ref } = worldDialog.value;
    const platforms: string[] = [];
    if (ref.unityPackages) {
      for (const unityPackage of ref.unityPackages) {
        if (!compareUnityVersion(unityPackage.unitySortNumber, sdkUnityVersion)) {
          continue;
        }
        let platform = "PC";
        if (unityPackage.platform === "standalonewindows") {
          platform = "PC";
        } else if (unityPackage.platform === "android") {
          platform = "Android";
        } else if (unityPackage.platform) {
          platform = unityPackage.platform;
        }
        const platformWithVersion = `${platform}/${unityPackage.unityVersion}`;
        if (platforms.includes(platformWithVersion)) {
          continue;
        }
        platforms.unshift(platformWithVersion);
      }
    }
    return platforms.join("\n");
  });

  const worldDialogPlatformCreatedAt = computed(() => {
    const { ref } = worldDialog.value;
    if (!ref.unityPackages) {
      return null;
    }
    const newest = new Map<string, string | null | undefined>();
    for (const unityPackage of ref.unityPackages) {
      if (unityPackage.variant && unityPackage.variant !== "standard" && unityPackage.variant !== "security") {
        continue;
      }
      const platform = unityPackage.platform;
      const createdAt = unityPackage.created_at;
      const newestCreatedAt = newest.get(platform);
      if (!newestCreatedAt || new Date(createdAt ?? "") > new Date(newestCreatedAt)) {
        newest.set(platform, createdAt);
      }
    }
    return Object.fromEntries(newest);
  });

  function copyWorldId() {
    navigator.clipboard
      .writeText(worldDialog.value.id)
      .then(() => {
        toast.success(t("message.world.id_copied"));
      })
      .catch((err: unknown) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function copyWorldUrl() {
    navigator.clipboard
      .writeText(`https://vrchat.com/home/world/${worldDialog.value.id}`)
      .then(() => {
        toast.success(t("message.world.url_copied"));
      })
      .catch((err: unknown) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  function copyWorldName() {
    navigator.clipboard
      .writeText(String(worldDialog.value.ref.name))
      .then(() => {
        toast.success(t("message.world.name_copied"));
      })
      .catch((err: unknown) => {
        console.error("copy failed:", err);
        toast.error(t("message.copy_failed"));
      });
  }

  return {
    memo,
    isTimeInLabVisible,
    timeInLab,
    favoriteRate,
    worldTags,
    worldDialogPlatform,
    worldDialogPlatformCreatedAt,
    onWorldMemoChange,
    copyWorldId,
    copyWorldUrl,
    copyWorldName,
    commaNumber,
    formatDateFilter,
  };
}

export function useWorldMemo(worldDialog: Ref<WorldDialogState>) {
  const memo = computed({
    get() {
      return worldDialog.value.memo;
    },
    set(value: string) {
      worldDialog.value.memo = value;
    },
  });

  function onWorldMemoChange() {
    const worldId = worldDialog.value.id;
    const memo = worldDialog.value.memo;
    if (memo) {
      database.setWorldMemo({
        worldId,
        editedAt: new Date().toJSON(),
        memo,
      });
    } else {
      database.deleteWorldMemo(worldId);
    }
  }

  return {
    memo,
    onWorldMemoChange,
  };
}
