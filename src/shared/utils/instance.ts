type LaunchLocation = {
  worldId: string;
  instanceId?: string | null;
  shortName?: string | null;
};

type LegacyInstanceTagInput = {
  instanceName?: string | null;
  userId?: string | null;
  accessType: string;
  groupId?: string | null;
  groupAccessType?: string | null;
  region: string;
  ageGate?: boolean | null;
  strict?: boolean | null;
};

const REGION_TAG_CODES = {
  "US West": "us",
  "US East": "use",
  Europe: "eu",
  Japan: "jp",
} as const satisfies Record<string, string>;

const regionTagMap: Readonly<Record<string, string | undefined>> = REGION_TAG_CODES;

function isRealInstance(instanceId: string | null | undefined): boolean {
  if (!instanceId) {
    return false;
  }
  switch (instanceId) {
    case ":":
    case "offline":
    case "offline:offline":
    case "private":
    case "private:private":
    case "traveling":
    case "traveling:traveling":
      return false;
  }
  if (instanceId.startsWith("local")) {
    return false;
  }
  return true;
}

function getLaunchURL(instance: LaunchLocation): string {
  const L = instance;
  if (L.instanceId) {
    if (L.shortName) {
      return `https://vrchat.com/home/launch?worldId=${encodeURIComponent(
        L.worldId
      )}&instanceId=${encodeURIComponent(L.instanceId)}&shortName=${encodeURIComponent(L.shortName)}`;
    }
    return `https://vrchat.com/home/launch?worldId=${encodeURIComponent(L.worldId)}&instanceId=${encodeURIComponent(L.instanceId)}`;
  }
  return `https://vrchat.com/home/launch?worldId=${encodeURIComponent(L.worldId)}`;
}

function buildLegacyInstanceTag({ instanceName, userId, accessType, groupId, groupAccessType, region, ageGate, strict }: LegacyInstanceTagInput): string {
  const tags: string[] = [];

  if (instanceName) {
    tags.push(instanceName);
  }

  if (accessType !== "public") {
    if (accessType === "friends+") {
      tags.push(`~hidden(${String(userId)})`);
    } else if (accessType === "friends") {
      tags.push(`~friends(${String(userId)})`);
    } else if (accessType === "group") {
      tags.push(`~group(${String(groupId)})`);
      tags.push(`~groupAccessType(${String(groupAccessType)})`);
    } else {
      tags.push(`~private(${String(userId)})`);
    }
    if (accessType === "invite+") {
      tags.push("~canRequestInvite");
    }
  }

  if (accessType === "group" && ageGate) {
    tags.push("~ageGate");
  }

  const regionCode = regionTagMap[region];
  if (regionCode) {
    tags.push(`~region(${regionCode})`);
  }

  if (strict && (accessType === "invite" || accessType === "friends")) {
    tags.push("~strict");
  }

  return tags.join("");
}

export { isRealInstance, getLaunchURL, buildLegacyInstanceTag };
