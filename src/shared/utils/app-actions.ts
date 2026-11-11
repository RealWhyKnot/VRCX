import { toast } from "vue-sonner";

import { useExternalLinkStore } from "../../stores/external-link";
import { useSearchStore } from "../../stores/search";
import { escapeTag } from "./base/string";
import { i18n } from "../../plugins/i18n";

function downloadAndSaveJson(fileName, data) {
  if (!fileName || !data) {
    return;
  }
  try {
    const link = document.createElement("a");
    link.setAttribute("href", `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`);
    link.setAttribute("download", `${fileName}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    toast.error(escapeTag("Failed to download JSON."));
  }
}

function copyToClipboard(text, message = "Copied successfully!") {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      toast.success(message);
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      toast.error(i18n.global.t("message.copy_failed"));
    });
}

function openExternalLink(link) {
  const searchStore = useSearchStore();
  if (searchStore.directAccessParse(link)) {
    return;
  }

  const externalLinkStore = useExternalLinkStore();
  externalLinkStore.showExternalLinkDialog(link);
}

function openDiscordProfile(discordId) {
  if (!discordId) {
    toast.error("No Discord ID provided!");
    return;
  }
  AppApi.OpenDiscordProfile(discordId).catch((err) => {
    console.error("Failed to open Discord profile:", err);
    toast.error("Failed to open Discord profile!");
  });
}

function openFolderGeneric(path) {
  AppApi.OpenFolderAndSelectItem(path, true);
}

export { downloadAndSaveJson, copyToClipboard, openExternalLink, openDiscordProfile, openFolderGeneric };
