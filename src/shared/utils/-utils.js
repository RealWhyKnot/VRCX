import { checkVRChatCache, deleteVRChatCache } from "../../coordinators/cache-coordinator";
import { displayLocation, parseLocation } from "./location-parser";
import { extractFileId, extractFileVersion, extractVariantVersion } from "./file-utils";
import { getAvailablePlatforms } from "./platform-utils";
import { getBundleLocation } from "./base/devtool";
import { getLaunchURL, isRealInstance } from "./instance";
import { getPrintFileName, getPrintLocalDate } from "./gallery";
import { isFriendOnline } from "./friend";

const utils = {
  getAvailablePlatforms,
  deleteVRChatCache,
  checkVRChatCache,
  getLaunchURL,
  extractFileId,
  extractFileVersion,
  extractVariantVersion,
  isRealInstance,
  displayLocation,
  parseLocation,
  getPrintFileName,
  getPrintLocalDate,
  isFriendOnline,
  getBundleLocation,
};

export { utils };
