import { toast } from "vue-sonner";

import { $throw } from "../services/request";
import { AppDebug } from "../services/app-config.ts";
import { extractFileId } from "../shared/utils/file-utils";
import { imageRequest } from "../api/image";

type UploadMessage = string | (() => string);

type ImageInputSelector = string | HTMLInputElement | (() => HTMLInputElement | null) | null | undefined;

type ImageUploadOptions = {
  inputSelector?: ImageInputSelector;
  maxSize?: number;
  acceptPattern?: RegExp | string | null;
  tooLargeMessage?: UploadMessage;
  invalidTypeMessage?: UploadMessage;
  onClear?: () => void;
};

type ImageUploadResult = {
  file: File | null;
  clearInput: () => void;
};

type UploadEntityType = "avatar" | "world";

type UploadEntity = {
  entityId: string;
  imageUrl: string;
  base64File: string;
  blob: Blob;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function fieldOf(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function isUploadFile(value: unknown): value is File {
  return typeof fieldOf(value, "size") === "number" && typeof fieldOf(value, "type") === "string";
}

function expectResponse<T>(response: T | undefined, step: string): T {
  if (response === undefined) {
    throw new Error(`${step} returned no response`);
  }
  return response;
}

function filesOf(source: unknown): ArrayLike<unknown> | undefined {
  const files = fieldOf(source, "files");
  if (Array.isArray(files) || files instanceof FileList) {
    return files;
  }
  return undefined;
}

function resolveMessage(message: UploadMessage): string {
  if (typeof message === "function") {
    return message();
  }
  return message;
}

function getInputElement(selector: ImageInputSelector): HTMLInputElement | null {
  if (!selector) {
    return null;
  }
  if (typeof selector === "function") {
    return selector();
  }
  if (typeof selector === "string") {
    return document.querySelector<HTMLInputElement>(selector);
  }
  return selector;
}

export function handleImageUploadInput(event: unknown, options: ImageUploadOptions = {}): ImageUploadResult {
  const {
    inputSelector,

    maxSize = 20000000,
    acceptPattern = /image.*/,
    tooLargeMessage,
    invalidTypeMessage,
    onClear,
  } = options;

  const clearInput = () => {
    onClear?.();
    const input = getInputElement(inputSelector);
    if (input) {
      input.value = "";
    }
  };

  const files = filesOf(fieldOf(event, "target")) ?? filesOf(fieldOf(event, "dataTransfer"));
  if (!files || files.length === 0) {
    clearInput();
    return { file: null, clearInput };
  }

  const file: unknown = files[0];
  if (!isUploadFile(file)) {
    throw new TypeError("Image upload input holds no file");
  }
  if (file.size >= maxSize) {
    if (tooLargeMessage) {
      toast.error(resolveMessage(tooLargeMessage));
    }
    clearInput();
    return { file: null, clearInput };
  }

  let acceptRegex: RegExp | null = null;
  if (acceptPattern) {
    acceptRegex = acceptPattern instanceof RegExp ? acceptPattern : new RegExp(acceptPattern);
  }

  if (acceptRegex && !acceptRegex.test(file.type)) {
    if (invalidTypeMessage) {
      toast.error(resolveMessage(invalidTypeMessage));
    }
    clearInput();
    return { file: null, clearInput };
  }

  return { file, clearInput };
}

export async function resizeImageToFitLimits(base64Data: string): Promise<string> {
  return AppApi.ResizeImageToFitLimits(base64Data);
}

export async function uploadImageLegacy(type: UploadEntityType, { entityId, imageUrl, base64File, blob }: UploadEntity): Promise<void> {
  const apiMap = {
    avatar: {
      uploadImage: imageRequest.uploadAvatarImage.bind(imageRequest),
      fileStart: imageRequest.uploadAvatarImageFileStart.bind(imageRequest),
      fileFinish: imageRequest.uploadAvatarImageFileFinish.bind(imageRequest),
      sigStart: imageRequest.uploadAvatarImageSigStart.bind(imageRequest),
      sigFinish: imageRequest.uploadAvatarImageSigFinish.bind(imageRequest),
      setImage: imageRequest.setAvatarImage.bind(imageRequest),
    },
    world: {
      uploadImage: imageRequest.uploadWorldImage.bind(imageRequest),
      fileStart: imageRequest.uploadWorldImageFileStart.bind(imageRequest),
      fileFinish: imageRequest.uploadWorldImageFileFinish.bind(imageRequest),
      sigStart: imageRequest.uploadWorldImageSigStart.bind(imageRequest),
      sigFinish: imageRequest.uploadWorldImageSigFinish.bind(imageRequest),
      setImage: imageRequest.setWorldImage.bind(imageRequest),
    },
  };
  const api = apiMap[type];

  const fileMd5 = await AppApi.MD5File(base64File);
  const fileSizeInBytes = blob.size;
  const base64SignatureFile = await AppApi.SignFile(base64File);
  const signatureMd5 = await AppApi.MD5File(base64SignatureFile);
  const signatureSizeInBytes = Number(await AppApi.FileLength(base64SignatureFile));
  const fileId = extractFileId(imageUrl);

  const uploadRes = expectResponse(await api.uploadImage({ fileMd5, fileSizeInBytes, signatureMd5, signatureSizeInBytes }, fileId), `${type} image upload`);
  const uploadedFileId = uploadRes.json.id;
  const latestVersion = uploadRes.json.versions.at(-1);
  if (!latestVersion) {
    throw new Error(`${type} image upload returned no file versions`);
  }
  const fileVersion = latestVersion.version;

  const fileStartRes = expectResponse(
    await api.fileStart({
      fileId: uploadedFileId,
      fileVersion,
    }),
    `${type} image file start`
  );

  const fileAwsRes = await webApiService.execute({
    url: fileStartRes.json.url,
    uploadFilePUT: true,
    fileData: base64File,
    fileMIME: "image/png",
    fileMD5: fileMd5,
  });
  if (fileAwsRes.status !== 200) {
    $throw(fileAwsRes.status, `${type} image upload failed`, fileStartRes.json.url);
  }

  await api.fileFinish({ fileId: uploadedFileId, fileVersion });

  const sigStartRes = expectResponse(
    await api.sigStart({
      fileId: uploadedFileId,
      fileVersion,
    }),
    `${type} image signature start`
  );

  const sigAwsRes = await webApiService.execute({
    url: sigStartRes.json.url,
    uploadFilePUT: true,
    fileData: base64SignatureFile,
    fileMIME: "application/x-rsync-signature",
    fileMD5: signatureMd5,
  });
  if (sigAwsRes.status !== 200) {
    $throw(sigAwsRes.status, `${type} image upload failed`, sigStartRes.json.url);
  }

  await api.sigFinish({ fileId: uploadedFileId, fileVersion });

  const newImageUrl = `${AppDebug.endpointDomain}/file/${uploadedFileId}/${fileVersion}/file`;
  const setRes = await api.setImage({ id: entityId, imageUrl: newImageUrl });
  if (setRes.json.imageUrl !== newImageUrl) {
    $throw(0, `${type} image change failed`, newImageUrl);
  }
}
