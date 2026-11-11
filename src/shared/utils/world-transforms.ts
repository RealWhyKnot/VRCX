import type { UnityPackage } from "vrchat";
import type { Json, VrcxWorld } from "../../types/vrcx";
import { assignDefinedProps } from "./user-transforms";

export type WorldUnityPackage = Partial<Json<UnityPackage>> & Pick<Json<UnityPackage>, "platform" | "unityVersion">;

export type WorldRef = Omit<VrcxWorld, "releaseStatus" | "unityPackages"> & {
  releaseStatus: string;
  unityPackages: WorldUnityPackage[];
  assetUrl: string;
  assetUrlObject: Record<string, unknown>;
  pluginUrl: string;
  pluginUrlObject: Record<string, unknown>;
  unityPackageUrl: string;
  unityPackageUrlObject: Record<string, unknown>;
};

export type WorldPatch = { [K in keyof WorldRef]?: WorldRef[K] | undefined };

export function createDefaultWorldRef(json: WorldPatch = {}): WorldRef {
  const ref: WorldRef = {
    id: "",
    name: "",
    description: "",
    defaultContentSettings: {},
    disabledPropAbilities: [],
    authorId: "",
    authorName: "",
    capacity: 0,
    recommendedCapacity: 0,
    tags: [],
    releaseStatus: "",
    imageUrl: "",
    thumbnailImageUrl: "",
    assetUrl: "",
    assetUrlObject: {},
    pluginUrl: "",
    pluginUrlObject: {},
    unityPackageUrl: "",
    unityPackageUrlObject: {},
    unityPackages: [],
    version: 0,
    favorites: 0,
    created_at: "",
    updated_at: "",
    publicationDate: "",
    labsPublicationDate: "",
    visits: 0,
    popularity: 0,
    heat: 0,
    publicOccupants: 0,
    privateOccupants: 0,
    occupants: 0,
    instances: [],
    featured: false,
    organization: "",
    previewYoutubeId: "",
    isHypeTrainEligible: false,
    namespace: "",
    slimInstances: [],
    storeId: "",
    udonProducts: [],
    urlList: [],

    $isLabs: false,
  };
  assignDefinedProps(ref, json);
  return ref;
}
