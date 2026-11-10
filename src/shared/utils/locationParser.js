function displayLocation(location, worldName, groupName = "") {
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
      text = `${worldName} ${L.accessTypeName}(${groupName})`;
    } else if (L.instanceId) {
      text = `${worldName} ${L.accessTypeName}`;
    }
  }
  return text;
}

function parseLocation(tag) {
  let _tag = String(tag || "");
  const ctx = {
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
      ctx.shortName = _tag.substr(shortNameIndex + shortNameQualifier.length);
      _tag = _tag.substr(0, shortNameIndex);
    }
    if (sep >= 0) {
      ctx.worldId = _tag.substr(0, sep);
      ctx.instanceId = _tag.substr(sep + 1);
      ctx.instanceId.split("~").forEach((s, i) => {
        if (i) {
          const A = s.indexOf("(");
          const Z = A >= 0 ? s.lastIndexOf(")") : -1;
          const key = Z >= 0 ? s.substr(0, A) : s;
          const value = A < Z ? s.substr(A + 1, Z - A - 1) : "";
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

function resolveRegion(L) {
  if (L.isOffline || L.isPrivate || L.isTraveling) {
    return "";
  }
  if (L.region) {
    return L.region;
  }
  if (L.instanceId) {
    return "us";
  }
  return "";
}

function translateAccessType(accessTypeName, t, keyMap) {
  const key = keyMap[accessTypeName];
  if (!key) {
    return accessTypeName;
  }
  if (accessTypeName === "groupPublic" || accessTypeName === "groupPlus") {
    const groupKey = keyMap["group"];
    return t(groupKey) + " " + t(key);
  }
  return t(key);
}

export { parseLocation, displayLocation, resolveRegion, translateAccessType };
