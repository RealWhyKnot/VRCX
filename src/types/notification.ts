export type NotificationDetails = {
  worldId?: string;
  worldName?: string;
};

export type NotificationRecord = {
  type: string;
  displayName?: string;
  previousDisplayName?: string;
  senderUsername?: string;
  senderUserId?: string;
  sourceUserId?: string;
  userId?: string;
  location?: string;
  instanceId?: string;
  worldName?: string;
  groupName?: string;
  title?: string;
  message?: string;
  status?: string;
  statusDescription?: string;
  trustLevel?: string;
  details?: NotificationDetails;
  name?: string;
  text?: string;
  data?: string;
  notyName?: string;
};

export type NotificationMessage = {
  title: string | undefined;
  body: string | undefined;
};
