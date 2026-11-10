import { request } from "../services/request";

import authRequest from "./auth";
import avatarModerationRequest from "./avatar-moderation";
import avatarRequest from "./avatar";
import favoriteRequest from "./favorite";
import friendRequest from "./friend";
import groupRequest from "./group";
import imageRequest from "./image";
import instanceRequest from "./instance";
import inventoryRequest from "./inventory";
import inviteMessagesRequest from "./invite-messages";
import miscRequest from "./misc";
import moderationReportRequest from "./moderation-report";
import notificationRequest from "./notification";
import playerModerationRequest from "./player-moderation";
import propRequest from "./prop";
import queryRequest from "./query-request";
import userRequest from "./user";
import vrcPlusIconRequest from "./vrc-plus-icon";
import vrcPlusImageRequest from "./vrc-plus-image";
import worldRequest from "./world";
import cosmeticsRequest from "./cosmetics";
import marketplaceRequest from "./marketplace";

window.request = {
  request,
  userRequest,
  worldRequest,
  instanceRequest,
  friendRequest,
  avatarRequest,
  notificationRequest,
  playerModerationRequest,
  avatarModerationRequest,
  favoriteRequest,
  vrcPlusIconRequest,
  vrcPlusImageRequest,
  inviteMessagesRequest,
  miscRequest,
  authRequest,
  groupRequest,
  inventoryRequest,
  propRequest,
  imageRequest,
  queryRequest,
  cosmeticsRequest,
  marketplaceRequest,
  moderationReportRequest,
};

export {
  request,
  userRequest,
  worldRequest,
  instanceRequest,
  friendRequest,
  avatarRequest,
  notificationRequest,
  playerModerationRequest,
  avatarModerationRequest,
  favoriteRequest,
  vrcPlusIconRequest,
  vrcPlusImageRequest,
  inviteMessagesRequest,
  miscRequest,
  authRequest,
  groupRequest,
  inventoryRequest,
  propRequest,
  imageRequest,
  queryRequest,
  cosmeticsRequest,
  marketplaceRequest,
  moderationReportRequest,
};
