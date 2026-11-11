import type { ParsedLocation } from "../../types/vrcx";

function displayLocation(location: string | null | undefined, worldName: string | undefined, groupName = ""): string | undefined {
  let text = worldName;
  const L = parseLocation(location);
  if (L.isOffline) {
    text = "Offline";
  } else if (L.isPrivate) {
    text = "Private";
  } else if (L.isTraveling) {
    text = "Traveling";
  } else if (L.worldId) {
    if (groupName) {
      text = `${String(worldName)} ${L.accessTypeName}(${groupName})`;
    } else if (L.instanceId) {
      text = `${String(worldName)} ${L.accessTypeName}`;
    }
  }
  return text;
}

function parseLocation(tag: string | null | undefined): ParsedLocation {
  let _tag = tag ?? "";
  const ctx: ParsedLocation = {
    tag: _tag,
    isOffline: false,
    isPrivate: false,
    isTraveling: false,
    isRealInstance: false,
    worldId: "",
    instanceId: "",
    instanceName: "",
    accessType: "",
    accessTypeName: "",
    region: "",
    shortName: "",
    userId: null,
    hiddenId: null,
    privateId: null,
    friendsId: null,
    groupId: null,
    groupAccessType: null,
    canRequestInvite: false,
    strict: false,
    ageGate: false,
  };
  if (_tag === "offline" || _tag === "offline:offline") {
    ctx.isOffline = true;
  } else if (_tag === "private" || _tag === "private:private") {
    ctx.isPrivate = true;
  } else if (_tag === "traveling" || _tag === "traveling:traveling") {
    ctx.isTraveling = true;
  } else if (tag && !_tag.startsWith("local")) {
    ctx.isRealInstance = true;
    const sep = _tag.indexOf(":");

    const shortNameQualifier = "&shortName=";
    const shortNameIndex = _tag.indexOf(shortNameQualifier);
    if (shortNameIndex >= 0) {
      ctx.shortName = _tag.slice(shortNameIndex + shortNameQualifier.length);
      _tag = _tag.slice(0, shortNameIndex);
    }
    if (sep >= 0) {
      ctx.worldId = _tag.slice(0, sep);
      ctx.instanceId = _tag.slice(sep + 1);
      ctx.instanceId.split("~").forEach((s, i) => {
        if (i) {
          const A = s.indexOf("(");
          const Z = A >= 0 ? s.lastIndexOf(")") : -1;
          const key = Z >= 0 ? s.slice(0, A) : s;
          const value = A < Z ? s.slice(A + 1, Z) : "";
          if (key === "hidden") {
            ctx.hiddenId = value;
          } else if (key === "private") {
            ctx.privateId = value;
          } else if (key === "friends") {
            ctx.friendsId = value;
          } else if (key === "canRequestInvite") {
            ctx.canRequestInvite = true;
          } else if (key === "region") {
            ctx.region = value;
          } else if (key === "group") {
            ctx.groupId = value;
          } else if (key === "groupAccessType") {
            ctx.groupAccessType = value;
          } else if (key === "strict") {
            ctx.strict = true;
          } else if (key === "ageGate") {
            ctx.ageGate = true;
          }
        } else {
          ctx.instanceName = s;
        }
      });
      ctx.accessType = "public";
      if (ctx.privateId !== null) {
        if (ctx.canRequestInvite) {
          ctx.accessType = "invite+";
        } else {
          ctx.accessType = "invite";
        }
        ctx.userId = ctx.privateId;
      } else if (ctx.friendsId !== null) {
        ctx.accessType = "friends";
        ctx.userId = ctx.friendsId;
      } else if (ctx.hiddenId !== null) {
        ctx.accessType = "friends+";
        ctx.userId = ctx.hiddenId;
      } else if (ctx.groupId !== null) {
        ctx.accessType = "group";
      }
      ctx.accessTypeName = ctx.accessType;
      if (ctx.groupAccessType !== null) {
        if (ctx.groupAccessType === "public") {
          ctx.accessTypeName = "groupPublic";
        } else if (ctx.groupAccessType === "plus") {
          ctx.accessTypeName = "groupPlus";
        }
      }
    } else {
      ctx.worldId = _tag;
    }
  }
  return ctx;
}

function resolveRegion(parsed: Pick<ParsedLocation, "isOffline" | "isPrivate" | "isTraveling" | "region" | "instanceId">): string {
  if (parsed.isOffline || parsed.isPrivate || parsed.isTraveling) {
    return "";
  }
  if (parsed.region) {
    return parsed.region;
  }
  if (parsed.instanceId) {
    return "us";
  }
  return "";
}

function translateAccessType(accessTypeName: string, t: (key: string) => string, keyMap: Partial<Record<string, string>>): string {
  const key = keyMap[accessTypeName];
  if (!key) {
    return accessTypeName;
  }
  if (accessTypeName === "groupPublic" || accessTypeName === "groupPlus") {
    const groupKey = keyMap["group"] ?? "";
    return `${t(groupKey)} ${t(key)}`;
  }
  return t(key);
}

export { parseLocation, displayLocation, resolveRegion, translateAccessType };
