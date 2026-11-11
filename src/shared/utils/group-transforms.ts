import type { GroupMember } from "vrchat";
import type { Json, VrcxGroup } from "../../types/vrcx";

type InputFields<T> = { [K in keyof T]?: T[K] | null | undefined };

export type GroupMyMemberInput = InputFields<NonNullable<VrcxGroup["myMember"]>>;

export type GroupMemberInput = InputFields<Json<GroupMember>>;

export type GroupRefInput = Omit<InputFields<VrcxGroup>, "myMember"> & {
  myMember?: GroupMyMemberInput | null | undefined;
};

export function createDefaultGroupRef(json: GroupRefInput): VrcxGroup {
  const ref: VrcxGroup = {
    id: "",
    name: "",
    shortCode: "",
    description: "",
    bannerId: "",
    bannerUrl: "",
    createdAt: "",
    discriminator: "",
    galleries: [],
    iconId: "",
    iconUrl: "",
    isVerified: false,
    languages: [],
    links: [],
    memberCount: 0,
    memberCountSyncedAt: "",
    onlineMemberCount: 0,
    ownerId: "",
    rules: null,
    tags: [],
    ageVerificationBetaCode: "",
    ageVerificationBetaSlots: 0,
    ageVerificationSlotsAvailable: false,
    allowGroupJoinPrompt: false,
    badges: [],
    lastPostCreatedAt: "",
    nameplateId: null,
    nameplateUrl: null,
    storeId: "",
    transferTargetId: "",

    initialRoleIds: [],
    myMember: {
      bannedAt: null,
      groupId: "",
      has2FA: false,
      id: "",
      isRepresenting: false,
      isSubscribedToAnnouncements: false,
      isSubscribedToEventAnnouncements: false,
      joinedAt: "",
      managerNotes: "",
      permissions: [],
      roleIds: [],
      userId: "",
      visibility: "",
    },
    updatedAt: "",

    roles: [],

    $memberId: "",
    groupId: "",
    isRepresenting: false,
    memberVisibility: false,
    mutualGroup: false,

    $languages: [],
  };
  Object.assign(ref, json);
  return ref;
}
