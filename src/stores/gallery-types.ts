import type { File, GetFiles, InventoryItem, Print } from "vrchat";
import type * as workerTimers from "worker-timers";
import type { Json } from "../types/vrcx";

export type GalleryFile = Json<File>;

export type GalleryPrint = Json<Print>;

export type GalleryEmojiMetadata = {
  frames?: number | null;
  framesOverTime?: number | null;
  loopStyle?: string | null;
};

export type GalleryInventoryItem = Json<InventoryItem> & {
  metadata: Json<InventoryItem["metadata"]> & GalleryEmojiMetadata;
};

export type GalleryFileListArgs = {
  json: Json<File[]>;
  params: GetFiles["query"];
};

export type GalleryFileRequestArgs = {
  json: GalleryFile;
};

export type GalleryQueueItem = {
  inventoryId: string;
  userId: string;
};

export type GalleryTimerId = ReturnType<typeof workerTimers.setInterval>;

export type GalleryState = {
  printCache: string[];
  printQueue: string[];
  printQueueWorker: GalleryTimerId | null;
  instanceInventoryCache: string[];
  instanceInventoryQueue: GalleryQueueItem[];
  instanceInventoryQueueWorker: GalleryTimerId | null;
};
