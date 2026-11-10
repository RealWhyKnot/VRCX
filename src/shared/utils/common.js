import { extractFileId, extractFileVersion, extractVariantVersion } from "./file-utils";
import { replaceBioSymbols } from "./base/string";
import { getFaviconUrl, replaceVrcPackageUrl } from "./url-utils";
import { AppDebug } from "../../services/app-config.js";
import { getAvailablePlatforms } from "./platform-utils";

function convertFileUrlToImageUrl(url, resolution = 128, endpointDomain = AppDebug.endpointDomain) {
  if (!url || typeof url !== "string") {
    return "";
  }

  const imagePattern = /image\/file_([a-f0-9-]+)\/(\d+)\/(\d+)\/?$/;
  const pattern = /file\/file_([a-f0-9-]+)\/(\d+)(\/file)?\/?$/;
  const match = url.match(imagePattern) || url.match(pattern);

  if (match) {
    const fileId = match[1];
    const version = match[2];
    return `${endpointDomain}/image/file_${fileId}/${version}/${resolution}`;
  }

  return url;
}

function debounce(func, delay) {
  let timer = null;
  return function (...args) {
    const context = this;
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

export { downloadAndSaveJson, copyToClipboard, openExternalLink, openDiscordProfile, openFolderGeneric } from "./app-actions";

export { deleteVRChatCache, checkVRChatCache, getBundleDateSize } from "../../coordinators/cache-coordinator";

export {
  getAvailablePlatforms,
  getFaviconUrl,
  convertFileUrlToImageUrl,
  replaceVrcPackageUrl,
  extractFileId,
  extractFileVersion,
  extractVariantVersion,
  replaceBioSymbols,
  debounce,
};
