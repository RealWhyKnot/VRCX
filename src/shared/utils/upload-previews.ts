export type UploadPreviewKind = "photo" | "icon";

export type UploadPreviewTile = { id: string; labelKey: string; frameClass: string; imageClass: string };

const WHOLE_IMAGE = "size-full object-cover";

export const UPLOAD_PREVIEW_TILES = {
  photo: [
    { id: "profile-picture", labelKey: "dialog.image_crop.preview_profile_picture", frameClass: "h-16 w-[85px] rounded-md", imageClass: WHOLE_IMAGE },
    { id: "list", labelKey: "dialog.image_crop.preview_list", frameClass: "size-9 rounded-full", imageClass: WHOLE_IMAGE },
    { id: "group-banner", labelKey: "dialog.image_crop.preview_group_banner", frameClass: "h-16 w-[114px] rounded-md", imageClass: WHOLE_IMAGE },
    {
      id: "banner-nameplate",
      labelKey: "dialog.image_crop.preview_banner_nameplate",
      frameClass: "relative h-8 w-[199px] rounded-md",
      imageClass: "absolute left-[-24.04%] top-[-146.1%] aspect-video w-[148.37%] max-w-none object-cover",
    },
    {
      id: "banner-group-page",
      labelKey: "dialog.image_crop.preview_banner_group_page",
      frameClass: "relative h-8 w-[190px] rounded-md",
      imageClass: "absolute left-0 top-[-116.9%] aspect-video w-full max-w-none object-cover",
    },
  ],
  icon: [
    { id: "profile-icon", labelKey: "dialog.image_crop.preview_profile_icon", frameClass: "size-16 rounded-full", imageClass: WHOLE_IMAGE },
    { id: "list", labelKey: "dialog.image_crop.preview_list", frameClass: "size-9 rounded-full", imageClass: WHOLE_IMAGE },
    { id: "group-icon", labelKey: "dialog.image_crop.preview_group_icon", frameClass: "size-16 rounded-lg", imageClass: WHOLE_IMAGE },
  ],
} as const satisfies Record<UploadPreviewKind, readonly UploadPreviewTile[]>;
