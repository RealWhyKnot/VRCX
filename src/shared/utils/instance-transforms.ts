import type { VrcxInstance } from "../../types/vrcx";

export type InstanceJsonInput = Omit<Partial<VrcxInstance>, "creationLanguages"> & { creationLanguages?: unknown[] | undefined };

export function toInstanceRecord(json: InstanceJsonInput): Partial<VrcxInstance> {
  const { creationLanguages, ...rest } = json;
  if (creationLanguages === undefined) {
    return rest;
  }
  return {
    ...rest,
    creationLanguages: creationLanguages.filter((language): language is string => typeof language === "string"),
  };
}

export function computeDisabledContentSettings(
  contentSettings: Record<string, boolean | undefined> | null | undefined,
  settingsList: readonly string[]
): string[] {
  const disabled: string[] = [];
  if (!contentSettings || Object.keys(contentSettings).length === 0) {
    return disabled;
  }
  for (const setting of settingsList) {
    if (contentSettings[setting] !== false) {
      continue;
    }
    disabled.push(setting);
  }
  return disabled;
}

export function createDefaultInstanceRef(json: Partial<VrcxInstance>): VrcxInstance {
  return {
    id: "",
    location: "",
    instanceId: "",
    name: "",
    worldId: "",
    type: "",
    ownerId: "",
    tags: [],
    active: false,
    full: false,
    n_users: 0,
    hasCapacityForYou: true,
    capacity: 0,
    recommendedCapacity: 0,
    userCount: 0,
    queueEnabled: false,
    queueSize: 0,
    platforms: {},
    gameServerVersion: 0,
    hardClose: null,
    closedAt: null,
    secureName: "",
    shortName: "",
    world: {},
    users: [],
    contentSettings: {},
    photonRegion: "",
    region: "",
    canRequestInvite: false,
    permanent: false,
    private: "",
    hidden: "",
    nonce: "",
    strict: false,
    displayName: null,
    groupAccessType: null,
    roleRestricted: false,
    instancePersistenceEnabled: null,
    playerPersistenceEnabled: null,
    ageGate: null,
    calendarEntryId: null,
    friends: "",
    creatorId: null,
    categoryId: null,
    description: null,
    displayVibeId: null,
    vibeIds: [],
    dominantLanguage: "",
    languages: [],
    languagesIso639: [],
    languageRatio: {},
    creationLanguages: [],
    disabledPropAbilities: [],
    minimumAvatarPerformance: null,
    userIcons: [],
    hypeTrain: null,

    $fetchedAt: "",
    $disabledContentSettings: [],
    ...json,
  };
}
