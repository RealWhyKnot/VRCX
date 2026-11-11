import type { Avatar } from "vrchat";
import type { Json } from "../../types/vrcx";
import { assignDefinedProps } from "./user-transforms";

type AvatarJson = Json<Avatar>;

type RequiredAvatarKey = "assetUrlObject" | "performance" | "publishedListings" | "styles" | "tags" | "unityPackages";

type ReplacedAvatarKey = RequiredAvatarKey | "highestPrice" | "lowestPrice" | "productId" | "releaseStatus" | "unityPackageUrlObject";

type AvatarUnityPackageJson = NonNullable<AvatarJson["unityPackages"]>[number];

export type AvatarUnityPackage = { [K in keyof AvatarUnityPackageJson]?: AvatarUnityPackageJson[K] | undefined };

export type AvatarRef = Omit<AvatarJson, ReplacedAvatarKey> &
  Required<Pick<AvatarJson, Exclude<RequiredAvatarKey, "unityPackages">>> & {
    unityPackages: AvatarUnityPackage[];
    highestPrice: number | null;
    lowestPrice: number | null;
    productId: string | null;
    releaseStatus: string;
    unityPackageUrlObject: { unityPackageUrl?: string };
  };

export type AvatarPatch = { [K in keyof AvatarRef]?: AvatarRef[K] | undefined };

export function createDefaultAvatarRef(json: AvatarPatch): AvatarRef {
  const ref: AvatarRef = {
    acknowledgements: "",
    activeAssetReviewId: "",
    assetUrl: "",
    assetUrlObject: {},
    attribution: null,
    authorId: "",
    authorName: "",
    created_at: "",
    description: "",
    featured: false,
    highestPrice: null,
    id: "",
    imageUrl: "",
    listingDate: null,
    lock: false,
    lowestPrice: null,
    name: "",
    pendingUpload: false,
    performance: {},
    productId: null,
    publishedListings: [],
    releaseStatus: "",
    searchable: false,
    styles: {},
    tags: [],
    thumbnailImageUrl: "",
    unityPackageUrl: "",
    unityPackageUrlObject: {},
    unityPackages: [],
    updated_at: "",
    version: 0,
  };
  assignDefinedProps(ref, json);
  return ref;
}
