import type { InviteMessage, InviteMessageType, UpdateInviteMessageRequest } from "vrchat";
import type { Json } from "../types/vrcx";
import { request } from "../services/request";
import { useUserStore } from "../stores/user";

function getCurrentUserId() {
  return useUserStore().currentUser.id;
}

function isInviteMessageList(value: unknown): value is Json<InviteMessage[]> {
  return Array.isArray(value);
}

function expectInviteMessageList(value: unknown, endpoint: string): Json<InviteMessage[]> {
  if (!isInviteMessageList(value)) {
    throw new Error(`Invite message response is not a list: ${endpoint}`);
  }
  return value;
}

const inviteMessagesRequest = {
  async refreshInviteMessageTableData(messageType: InviteMessageType): Promise<{ json: Json<InviteMessage[]>; messageType: InviteMessageType }> {
    const endpoint = `message/${getCurrentUserId()}/${messageType}`;
    const response: unknown = await request(endpoint, {
      method: "GET",
    });
    const json = expectInviteMessageList(response, endpoint);
    const args = {
      json,
      messageType,
    };
    return args;
  },

  async editInviteMessage(
    params: UpdateInviteMessageRequest,
    messageType: InviteMessageType,
    slot: number
  ): Promise<{
    json: Json<InviteMessage[]>;
    params: UpdateInviteMessageRequest;
    messageType: InviteMessageType;
    slot: number;
  }> {
    const endpoint = `message/${getCurrentUserId()}/${messageType}/${slot}`;
    const response: unknown = await request(endpoint, {
      method: "PUT",
      params,
    });
    const json = expectInviteMessageList(response, endpoint);
    const args = {
      json,
      params,
      messageType,
      slot,
    };
    return args;
  },
};

export { inviteMessagesRequest };
