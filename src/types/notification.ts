export type NotificationDetails = {
  worldId?: string;
  worldName?: string;
};

export type NotificationRecord = {
  type: string;
  displayName?: string | undefined;
  previousDisplayName?: string | undefined;
  senderUsername?: string | undefined;
  senderUserId?: string | undefined;
  sourceUserId?: string | undefined;
  userId?: string | undefined;
  location?: string | undefined;
  instanceId?: string | undefined;
  worldName?: string | undefined;
  groupName?: string | undefined;
  title?: string | undefined;
  message?: string | undefined;
  status?: string | undefined;
  statusDescription?: string | undefined;
  trustLevel?: string | undefined;
  details?: NotificationDetails | undefined;
  name?: string | undefined;
  text?: string | undefined;
  data?: string | undefined;
  notyName?: string | undefined;
};

export type NotificationMessage = {
  title: string | undefined;
  body: string | undefined;
};
