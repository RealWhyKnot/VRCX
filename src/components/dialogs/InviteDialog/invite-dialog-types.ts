import type { FriendContext } from "../../../stores/friend-types";

export type InviteDialogState = {
  visible: boolean;
  loading: boolean;
  worldId: string;
  worldName: string;
  userIds: string[];
  friendsInInstance: FriendContext[];
};

export type EditAndSendInviteDialogState = {
  visible: boolean;
  newMessage: string;
};
