import type { Inventory, StoreShelf } from "vrchat";
import type { Json, TableFilter } from "../../types/vrcx";

export type NotificationJson = Record<string, unknown>;

type NotificationFields = {
  type: string;
  senderUserId?: string | undefined;
  senderUsername?: string | undefined;
  receiverUserId?: string | undefined;
  message: string;
  title?: string | undefined;
  imageUrl?: string | undefined;
  seen?: boolean | undefined;
  created_at: string;
  createdAt?: string | undefined;
  expiresAt?: string | undefined;
  version?: number | undefined;
  $isExpired?: boolean | undefined;
  isFriend?: boolean | undefined;
  isFavorite?: boolean | undefined;
  notyName?: string | undefined;
  displayName?: string | undefined;
  previousDisplayName?: string | undefined;
  sourceDisplayName?: string | undefined;
  userId?: string | undefined;
  location?: string | undefined;
  videoName?: string | undefined;
  data?: unknown;
};

export type StoredNotificationEntry = NotificationFields & {
  id: string;
  details: Record<string, unknown>;
};

export type LocalNotificationEntry = NotificationFields & {
  id?: undefined;
  details?: undefined;
};

export type NotificationEntry = StoredNotificationEntry | LocalNotificationEntry;

export type NotificationArgs = {
  json: NotificationJson;
  params?: unknown;
  ref?: NotificationEntry;
};

export type NotificationResponse = {
  type: string;
  data: string;
};

export type NotificationTable = {
  data: NotificationEntry[];
  filters: [TableFilter<NotificationEntry, string[]>, TableFilter<NotificationEntry, string>];
  pageSize: number;
  pageSizeLinked: boolean;
  paginationProps: { layout: string };
};

export type InventoryBundle = Json<Inventory>["data"][number];

export type FreeStoreShelf = Json<StoreShelf>;

export type FreeStoreListing = NonNullable<FreeStoreShelf["listings"]>[number];

export type InventoryBundleDialog = {
  visible: boolean;
  bundles: InventoryBundle[];
};

export type FreeStoreItemDialog = {
  visible: boolean;
  listings: FreeStoreListing[];
};

export type NotyEntry = {
  type: string;
  created_at: string;
  id?: string | undefined;
  displayName?: string | null | undefined;
  previousDisplayName?: string | null | undefined;
  senderUsername?: string | null | undefined;
  senderUserId?: string | null | undefined;
  sourceDisplayName?: string | null | undefined;
  userId?: string | null | undefined;
  location?: string | null | undefined;
  title?: string | null | undefined;
  message?: string | null | undefined;
  data?: unknown;
  details?: Record<string, unknown> | undefined;
  videoName?: string | null | undefined;
  notyName?: string | undefined;
  isFriend?: boolean | null | undefined;
  isFavorite?: boolean | null | undefined;
};
