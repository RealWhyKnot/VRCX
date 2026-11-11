import type { VrcxGroup } from "../../../types/vrcx";

export type GroupPostEditDialogState = {
  visible: boolean;
  groupRef: Partial<VrcxGroup>;
  groupId: string;
  postId: string;
  title: string;
  text: string;
  sendNotification: boolean;
  visibility: "public" | "group";
  roleIds: string[];
};

export type GroupPostSelectedImage = {
  selectedFileId: string;
  selectedImageUrl: string;
};

export type GallerySelectDialogState = {
  visible: boolean;
  selectedFileId: string;
  selectedImageUrl: string;
  selectedFileVersion?: number | undefined;
  isIconGallerySelectDialog: boolean;
};

export type GallerySelectionPayload = {
  imageUrl: string;
  fileId: string;
  fileVersion?: number | undefined;
};

export type GroupTransferDialogState = {
  visible: boolean;
  groupId: string;
  groupName: string;
  ownerId: string;
};
