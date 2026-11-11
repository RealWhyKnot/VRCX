import { dbVars } from "../database";

import { sqliteService } from "../sqlite.js";

const gameLog = {
  async getGamelogDatabase() {
    const gamelogDatabase = [];
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const dateOffset = date.toJSON();
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: "Location",
        location: dbRow[2],
        worldId: dbRow[3],
        worldName: dbRow[4],
        time: dbRow[5],
        groupName: dbRow[6],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_location WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: dbRow[2],
        displayName: dbRow[3],
        location: dbRow[4],
        userId: dbRow[5],
        time: dbRow[6],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_join_leave WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: "PortalSpawn",
        displayName: dbRow[2],
        location: dbRow[3],
        userId: dbRow[4],
        instanceId: dbRow[5],
        worldName: dbRow[6],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_portal_spawn WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: "VideoPlay",
        videoUrl: dbRow[2],
        videoName: dbRow[3],
        videoId: dbRow[4],
        location: dbRow[5],
        displayName: dbRow[6],
        userId: dbRow[7],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_video_play WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: dbRow[3],
        resourceUrl: dbRow[2],
        location: dbRow[4],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_resource_load WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: "Event",
        data: dbRow[2],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_event WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    await sqliteService.execute((dbRow) => {
      const row = {
        rowId: dbRow[0],
        created_at: dbRow[1],
        type: "External",
        message: dbRow[2],
        displayName: dbRow[3],
        userId: dbRow[4],
        location: dbRow[5],
      };
      gamelogDatabase.push(row);
    }, `SELECT * FROM gamelog_external WHERE created_at >= date('${dateOffset}') ORDER BY id DESC LIMIT ${dbVars.maxTableSize}`);
    const compareByCreatedAt = function (a, b) {
      const A = a.created_at;
      const B = b.created_at;
      if (A < B) {
        return -1;
      }
      if (A > B) {
        return 1;
      }
      return 0;
    };
    gamelogDatabase.sort(compareByCreatedAt);
    if (gamelogDatabase.length > dbVars.maxTableSize) {
      gamelogDatabase.splice(0, gamelogDatabase.length - dbVars.maxTableSize);
    }
    return gamelogDatabase;
  },

  async addGamelogLocationToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(
      `INSERT OR IGNORE INTO gamelog_location (created_at, location, world_id, world_name, time, group_name) VALUES (@created_at, @location, @world_id, @world_name, @time, @group_name)`,
      {
        "@created_at": entry.created_at,
        "@location": entry.location,
        "@world_id": entry.worldId,
        "@world_name": entry.worldName,
        "@time": entry.time,
        "@group_name": entry.groupName,
      }
    );
    return rowId ? { ...entry, rowId } : undefined;
  },

  updateGamelogLocationTimeToDatabase(entry) {
    sqliteService.executeNonQuery(`UPDATE gamelog_location SET time = @time WHERE created_at = @created_at`, {
      "@created_at": entry.created_at,
      "@time": entry.time,
    });
  },

  async addGamelogJoinLeaveToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(
      `INSERT OR IGNORE INTO gamelog_join_leave (created_at, type, display_name, location, user_id, time) VALUES (@created_at, @type, @display_name, @location, @user_id, @time)`,
      {
        "@created_at": entry.created_at,
        "@type": entry.type,
        "@display_name": entry.displayName,
        "@location": entry.location,
        "@user_id": entry.userId,
        "@time": entry.time,
      }
    );
    return rowId ? { ...entry, rowId } : undefined;
  },

  async addGamelogJoinLeaveBulk(inputData) {
    if (inputData.length === 0) {
      return [];
    }
    const entries = await Promise.all(inputData.map((entry) => this.addGamelogJoinLeaveToDatabase(entry)));
    return entries.filter(Boolean);
  },

  async addGamelogPortalSpawnToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(
      `INSERT OR IGNORE INTO gamelog_portal_spawn (created_at, display_name, location, user_id, instance_id, world_name) VALUES (@created_at, @display_name, @location, @user_id, @instance_id, @world_name)`,
      {
        "@created_at": entry.created_at,
        "@display_name": entry.displayName,
        "@location": entry.location,
        "@user_id": entry.userId,
        "@instance_id": entry.instanceId,
        "@world_name": entry.worldName,
      }
    );
    return rowId ? { ...entry, rowId } : undefined;
  },

  async addGamelogVideoPlayToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(
      `INSERT OR IGNORE INTO gamelog_video_play (created_at, video_url, video_name, video_id, location, display_name, user_id) VALUES (@created_at, @video_url, @video_name, @video_id, @location, @display_name, @user_id)`,
      {
        "@created_at": entry.created_at,
        "@video_url": entry.videoUrl,
        "@video_name": entry.videoName,
        "@video_id": entry.videoId,
        "@location": entry.location,
        "@display_name": entry.displayName,
        "@user_id": entry.userId,
      }
    );
    return rowId ? { ...entry, rowId } : undefined;
  },

  updateGamelogVideoPlayName(rowId, videoName) {
    return sqliteService.executeNonQuery(`UPDATE gamelog_video_play SET video_name = @video_name WHERE id = @id`, {
      "@video_name": videoName,
      "@id": rowId,
    });
  },

  async addGamelogResourceLoadToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(
      `INSERT OR IGNORE INTO gamelog_resource_load (created_at, resource_url, resource_type, location) VALUES (@created_at, @resource_url, @resource_type, @location)`,
      {
        "@created_at": entry.created_at,
        "@resource_url": entry.resourceUrl,
        "@resource_type": entry.type,
        "@location": entry.location,
      }
    );
    return rowId ? { ...entry, rowId } : undefined;
  },

  async addGamelogEventToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(`INSERT OR IGNORE INTO gamelog_event (created_at, data) VALUES (@created_at, @data)`, {
      "@created_at": entry.created_at,
      "@data": entry.data,
    });
    return rowId ? { ...entry, rowId } : undefined;
  },

  async addGamelogExternalToDatabase(entry) {
    const rowId = await sqliteService.executeInsert(
      `INSERT OR IGNORE INTO gamelog_external (created_at, message, display_name, user_id, location) VALUES (@created_at, @message, @display_name, @user_id, @location)`,
      {
        "@created_at": entry.created_at,
        "@message": entry.message,
        "@display_name": entry.displayName,
        "@user_id": entry.userId,
        "@location": entry.location,
      }
    );
    return rowId ? { ...entry, rowId } : undefined;
  },

  async getLastVisit(worldId, currentWorldMatch) {
    const count = currentWorldMatch ? 2 : 1;
    let ref = {
      created_at: "",
      worldId: "",
    };
    await sqliteService.execute(
      (row) => {
        ref = {
          created_at: row[0],
          worldId: row[1],
        };
      },
      `SELECT created_at, world_id FROM gamelog_location WHERE world_id = @worldId ORDER BY id DESC LIMIT @count`,
      {
        "@worldId": worldId,
        "@count": count,
      }
    );
    return ref;
  },

  async getVisitCount(worldId) {
    let ref = {
      visitCount: 0,
      worldId: "",
    };
    await sqliteService.execute(
      (row) => {
        ref = {
          visitCount: row[0],
          worldId,
        };
      },
      `SELECT COUNT(DISTINCT location) FROM gamelog_location WHERE world_id = @worldId`,
      {
        "@worldId": worldId,
      }
    );
    return ref;
  },

  async getTimeSpentInWorld(worldId) {
    const ref = {
      timeSpent: 0,
      worldId,
    };
    await sqliteService.execute(
      (row) => {
        if (typeof row[0] === "number") {
          ref.timeSpent += row[0];
        }
      },
      `SELECT time FROM gamelog_location WHERE world_id = @worldId`,
      {
        "@worldId": worldId,
      }
    );
    return ref;
  },

  async getLastGroupVisit(groupId) {
    let ref = {
      created_at: "",
    };
    await sqliteService.execute(
      (row) => {
        ref = {
          created_at: row[0],
        };
      },
      `SELECT created_at FROM gamelog_location WHERE location LIKE @groupId ORDER BY id DESC LIMIT 1`,
      {
        "@groupId": `%${groupId}%`,
      }
    );
    return ref;
  },

  async getGroupJoinCount(groupId) {
    let ref = {
      joinCount: 0,
      groupId,
    };
    await sqliteService.execute(
      (row) => {
        ref = {
          joinCount: row[0] || 0,
          groupId,
        };
      },
      `SELECT COUNT(DISTINCT location) FROM gamelog_location WHERE location LIKE @groupId`,
      {
        "@groupId": `%${groupId}%`,
      }
    );
    return ref;
  },

  async getPreviousInstancesByGroupId(groupId) {
    const data = new Map();
    await sqliteService.execute(
      (dbRow) => {
        let time = 0;
        if (dbRow[2]) {
          time = dbRow[2];
        }
        const ref = data.get(dbRow[1]);
        if (typeof ref !== "undefined") {
          time += ref.time;
        }
        const row = {
          created_at: dbRow[0],
          location: dbRow[1],
          time,
          worldName: dbRow[3],
          groupName: dbRow[4],
        };
        data.set(row.location, row);
      },
      `SELECT created_at, location, time, world_name, group_name
             FROM gamelog_location
             WHERE location LIKE @groupId
             ORDER BY id DESC`,
      {
        "@groupId": `%${groupId}%`,
      }
    );
    return data;
  },

  async getLastSeen(input, inCurrentWorld) {
    const count = inCurrentWorld ? 2 : 1;
    let ref = {
      created_at: "",
      userId: "",
    };
    await sqliteService.execute(
      (row) => {
        if (row[1]) {
          ref = {
            created_at: row[0],
            userId: row[1],
          };
        } else {
          ref = {
            created_at: row[0],
            userId: input.id,
          };
        }
      },
      `SELECT created_at, user_id FROM gamelog_join_leave WHERE user_id = @userId OR display_name = @displayName ORDER BY id DESC LIMIT @count`,
      {
        "@userId": input.id,
        "@displayName": input.displayName,
        "@count": count,
      }
    );
    return ref;
  },

  async getJoinCount(input) {
    let ref = {
      joinCount: "",
      userId: "",
    };
    await sqliteService.execute(
      (row) => {
        if (row[1]) {
          ref = {
            joinCount: row[0],
            userId: row[1],
          };
        } else {
          ref = {
            joinCount: row[0],
            userId: input.id,
          };
        }
      },
      `SELECT COUNT(DISTINCT location) FROM gamelog_join_leave WHERE (type = 'OnPlayerJoined') AND (user_id = @userId OR display_name = @displayName)`,
      {
        "@userId": input.id,
        "@displayName": input.displayName,
      }
    );
    return ref;
  },

  async getTimeSpent(input) {
    const ref = {
      timeSpent: 0,
      userId: input.id,
    };
    await sqliteService.execute(
      (row) => {
        if (typeof row[0] === "number") {
          ref.timeSpent += row[0];
        }
      },
      `SELECT time FROM gamelog_join_leave WHERE (type = 'OnPlayerLeft') AND (user_id = @userId OR display_name = @displayName)`,
      {
        "@userId": input.id,
        "@displayName": input.displayName,
      }
    );
    return ref;
  },

  async getUserStats(input, inCurrentWorld) {
    let i = 0;
    const instances = new Set();
    const ref = {
      timeSpent: 0,
      lastSeen: "",
      joinCount: 0,
      userId: input.id,
      previousDisplayNames: new Map(),
    };
    await sqliteService.execute(
      (row) => {
        if (typeof row[2] === "number") {
          ref.timeSpent += row[2];
        }
        i++;
        if (i === 1 || (inCurrentWorld && i === 2)) {
          ref.lastSeen = row[0];
        }
        instances.add(row[3]);
        if (input.displayName !== row[4]) {
          ref.previousDisplayNames.set(row[4], row[0]);
        }
      },
      `SELECT created_at, user_id, time, location, display_name FROM gamelog_join_leave WHERE user_id = @userId OR display_name = @displayName ORDER BY id DESC`,
      {
        "@userId": input.id,
        "@displayName": input.displayName,
      }
    );
    instances.delete("");
    ref.joinCount = instances.size;
    return ref;
  },

  async getAllUserStats(userIds, displayNames) {
    if (!userIds.length && !displayNames.length) {
      return [];
    }
    const data = [];

    let userIdsString = "";
    for (const userId of userIds) {
      userIdsString += `'${userId}', `;
    }
    userIdsString = userIdsString.slice(0, -2);
    let displayNamesString = "";
    for (const displayName of displayNames) {
      displayNamesString += `'${displayName.replaceAll("'", "''")}', `;
    }
    displayNamesString = displayNamesString.slice(0, -2);
    const whereClauses = [];
    if (userIdsString) {
      whereClauses.push(`g.user_id IN (${userIdsString})`);
    }
    if (displayNamesString) {
      whereClauses.push(`g.display_name IN (${displayNamesString})`);
    }

    await sqliteService.execute(
      (dbRow) => {
        const row = {
          lastSeen: dbRow[0],
          userId: dbRow[1],
          timeSpent: dbRow[2],
          joinCount: dbRow[3],
          displayName: dbRow[4],
        };
        data.push(row);
      },
      `SELECT
                g.created_at,
                g.user_id,
                SUM(g.time) AS timeSpent,
                COUNT(DISTINCT g.location) AS joinCount,
                g.display_name,
                MAX(g.id) AS max_id
            FROM
                gamelog_join_leave g
            WHERE
                ${whereClauses.join("\n                OR ")}
            GROUP BY
                g.user_id,
                g.display_name
            ORDER BY
                g.user_id DESC
            `
    );
    return data;
  },

  async getGameLogByLocation(instanceId, filters, vipList = []) {
    let vipQuery = "";
    const vipArgs = {};
    if (vipList.length > 0) {
      const vipPlaceholders = [];
      vipList.forEach((vip, i) => {
        const key = `@vip_${i}`;
        vipArgs[key] = vip;
        vipPlaceholders.push(key);
      });
      vipQuery = `AND user_id IN (${vipPlaceholders.join(", ")})`;
    }
    let location = true;
    let onplayerjoined = true;
    let onplayerleft = true;
    let portalspawn = true;
    let videoplay = true;
    let resourceload_string = true;
    let resourceload_image = true;
    if (filters.length > 0) {
      location = false;
      onplayerjoined = false;
      onplayerleft = false;
      portalspawn = false;
      videoplay = false;
      resourceload_string = false;
      resourceload_image = false;
      filters.forEach((filter) => {
        switch (filter) {
          case "Location":
            location = true;
            break;
          case "OnPlayerJoined":
            onplayerjoined = true;
            break;
          case "OnPlayerLeft":
            onplayerleft = true;
            break;
          case "PortalSpawn":
            portalspawn = true;
            break;
          case "VideoPlay":
            videoplay = true;
            break;
          case "StringLoad":
            resourceload_string = true;
            break;
          case "ImageLoad":
            resourceload_image = true;
            break;
        }
      });
    }

    const baseColumns = [
      "id",
      "created_at",
      "type",
      "display_name",
      "location",
      "user_id",
      "time",
      "world_id",
      "world_name",
      "group_name",
      "instance_id",
      "video_url",
      "video_name",
      "video_id",
      "resource_url",
      "resource_type",
    ].join(", ");

    const selects = [];
    if (location) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'Location' AS type, NULL AS display_name, location, NULL AS user_id, time, world_id, world_name, group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type FROM gamelog_location WHERE location LIKE @locationLike ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (onplayerjoined || onplayerleft) {
      let query = "";
      if (!onplayerjoined || !onplayerleft) {
        if (onplayerjoined) {
          query = "AND type = 'OnPlayerJoined'";
        } else if (onplayerleft) {
          query = "AND type = 'OnPlayerLeft'";
        }
      }
      selects.push(
        `SELECT * FROM (SELECT id, created_at, type, display_name, location, user_id, time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type FROM gamelog_join_leave WHERE (location LIKE @locationLike AND user_id != '${dbVars.userId}') ${vipQuery} ${query} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (portalspawn) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'PortalSpawn' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, world_name, NULL AS group_name, instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type FROM gamelog_portal_spawn WHERE location LIKE @locationLike ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (videoplay) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'VideoPlay' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, video_url, video_name, video_id, NULL AS resource_url, NULL AS resource_type FROM gamelog_video_play WHERE location LIKE @locationLike ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (resourceload_string || resourceload_image) {
      let checkString = "";
      let checkImage = "";
      if (!resourceload_string) {
        checkString = `AND resource_type != 'StringLoad'`;
      }
      if (!resourceload_image) {
        checkImage = `AND resource_type != 'ImageLoad'`;
      }
      selects.push(
        `SELECT * FROM (SELECT id, created_at, resource_type AS type, NULL AS display_name, location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, resource_url, resource_type FROM gamelog_resource_load WHERE location LIKE @locationLike ${checkString} ${checkImage} ORDER BY id DESC LIMIT @perTable)`
      );
    }

    if (selects.length === 0) {
      return [];
    }

    const gamelogDatabase = [];
    const args = {
      "@locationLike": `%${instanceId}%`,
      "@limit": dbVars.searchTableSize,
      "@perTable": dbVars.searchTableSize,
      ...vipArgs,
    };
    await sqliteService.execute(
      (dbRow) => {
        const type = dbRow[2];
        const row = {
          rowId: dbRow[0],
          created_at: dbRow[1],
          type,
        };
        switch (type) {
          case "Location":
            row.location = dbRow[4];
            row.worldId = dbRow[7];
            row.worldName = dbRow[8];
            row.time = dbRow[6];
            row.groupName = dbRow[9];
            break;
          case "OnPlayerJoined":
          case "OnPlayerLeft":
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.time = dbRow[6];
            break;
          case "PortalSpawn":
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.instanceId = dbRow[10];
            row.worldName = dbRow[8];
            break;
          case "VideoPlay":
            row.videoUrl = dbRow[11];
            row.videoName = dbRow[12];
            row.videoId = dbRow[13];
            row.location = dbRow[4];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            break;
          case "StringLoad":
          case "ImageLoad":
            row.resourceUrl = dbRow[14];
            row.location = dbRow[4];
            break;
        }
        gamelogDatabase.push(row);
      },
      `SELECT ${baseColumns} FROM (${selects.join(" UNION ALL ")}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
      args
    );
    return gamelogDatabase;
  },

  async lookupGameLogDatabase(filters, vipList, maxEntries = dbVars.maxTableSize) {
    const baseColumns = [
      "id",
      "created_at",
      "type",
      "display_name",
      "location",
      "user_id",
      "time",
      "world_id",
      "world_name",
      "group_name",
      "instance_id",
      "video_url",
      "video_name",
      "video_id",
      "resource_url",
      "resource_type",
      "data",
      "message",
    ].join(", ");
    let vipQuery = "";
    if (vipList.length > 0) {
      vipQuery = "AND user_id IN (";
      for (let i = 0; i < vipList.length; i++) {
        vipQuery += `'${vipList[i].replaceAll("'", "''")}'`;
        if (i < vipList.length - 1) {
          vipQuery += ", ";
        }
      }
      vipQuery += ")";
    }
    let location = true;
    let onplayerjoined = true;
    let onplayerleft = true;
    let portalspawn = true;
    let msgevent = true;
    let external = true;
    let videoplay = true;
    let resourceload_string = true;
    let resourceload_image = true;
    if (filters.length > 0) {
      location = false;
      onplayerjoined = false;
      onplayerleft = false;
      portalspawn = false;
      msgevent = false;
      external = false;
      videoplay = false;
      resourceload_string = false;
      resourceload_image = false;
      filters.forEach((filter) => {
        switch (filter) {
          case "Location":
            location = true;
            break;
          case "OnPlayerJoined":
            onplayerjoined = true;
            break;
          case "OnPlayerLeft":
            onplayerleft = true;
            break;
          case "PortalSpawn":
            portalspawn = true;
            break;
          case "Event":
            msgevent = true;
            break;
          case "External":
            external = true;
            break;
          case "VideoPlay":
            videoplay = true;
            break;
          case "StringLoad":
            resourceload_string = true;
            break;
          case "ImageLoad":
            resourceload_image = true;
            break;
        }
      });
    }
    const selects = [];
    if (location) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'Location' AS type, NULL AS display_name, location, NULL AS user_id, time, world_id, world_name, group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_location ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (onplayerjoined || onplayerleft) {
      let query = "";
      if (!onplayerjoined || !onplayerleft) {
        if (onplayerjoined) {
          query = "AND type = 'OnPlayerJoined'";
        } else if (onplayerleft) {
          query = "AND type = 'OnPlayerLeft'";
        }
      }
      selects.push(
        `SELECT * FROM (SELECT id, created_at, type, display_name, location, user_id, time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_join_leave WHERE 1=1 ${vipQuery} ${query} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (portalspawn) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'PortalSpawn' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, world_name, NULL AS group_name, instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_portal_spawn WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (msgevent) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'Event' AS type, NULL AS display_name, NULL AS location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, data, NULL AS message FROM gamelog_event ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (external) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'External' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, message FROM gamelog_external WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (videoplay) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'VideoPlay' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, video_url, video_name, video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_video_play WHERE 1=1 ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (resourceload_string || resourceload_image) {
      let checkString = "";
      let checkImage = "";
      if (!resourceload_string) {
        checkString = `AND resource_type != 'StringLoad'`;
      }
      if (!resourceload_image) {
        checkImage = `AND resource_type != 'ImageLoad'`;
      }
      selects.push(
        `SELECT * FROM (SELECT id, created_at, resource_type AS type, NULL AS display_name, location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, resource_url, resource_type, NULL AS data, NULL AS message FROM gamelog_resource_load WHERE 1=1 ${checkString} ${checkImage} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (selects.length === 0) {
      return [];
    }
    const gamelogDatabase = [];
    const args = {
      "@limit": maxEntries,
      "@perTable": maxEntries,
    };
    await sqliteService.execute(
      (dbRow) => {
        const row = {
          rowId: dbRow[0],
          created_at: dbRow[1],
          type: dbRow[2],
        };
        switch (dbRow[2]) {
          case "Location":
            row.location = dbRow[4];
            row.worldId = dbRow[7];
            row.worldName = dbRow[8];
            row.time = dbRow[6];
            row.groupName = dbRow[9];
            break;
          case "OnPlayerJoined":
          case "OnPlayerLeft":
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.time = dbRow[6];
            break;
          case "PortalSpawn":
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.instanceId = dbRow[10];
            row.worldName = dbRow[8];
            break;
          case "VideoPlay":
            row.videoUrl = dbRow[11];
            row.videoName = dbRow[12];
            row.videoId = dbRow[13];
            row.location = dbRow[4];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            break;
          case "Event":
            row.data = dbRow[16];
            break;
          case "External":
            row.message = dbRow[17];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            row.location = dbRow[4];
            break;
          case "StringLoad":
          case "ImageLoad":
            row.resourceUrl = dbRow[14];
            row.location = dbRow[4];
            break;
        }
        gamelogDatabase.push(row);
      },
      `SELECT ${baseColumns} FROM (${selects.join(" UNION ALL ")}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
      args
    );
    return gamelogDatabase;
  },

  async searchGameLogDatabase(search, filters, vipList, maxEntries = dbVars.searchTableSize) {
    if (search.startsWith("wrld_") || search.startsWith("grp_")) {
      return this.getGameLogByLocation(search, filters, vipList);
    }
    let vipQuery = "";
    const vipArgs = {};
    if (vipList.length > 0) {
      const vipPlaceholders = [];
      vipList.forEach((vip, i) => {
        const key = `@vip_${i}`;
        vipArgs[key] = vip;
        vipPlaceholders.push(key);
      });
      vipQuery = `AND user_id IN (${vipPlaceholders.join(", ")})`;
    }
    let location = true;
    let onplayerjoined = true;
    let onplayerleft = true;
    let portalspawn = true;
    let msgevent = true;
    let external = true;
    let videoplay = true;
    let resourceload_string = true;
    let resourceload_image = true;
    if (filters.length > 0) {
      location = false;
      onplayerjoined = false;
      onplayerleft = false;
      portalspawn = false;
      msgevent = false;
      external = false;
      videoplay = false;
      resourceload_string = false;
      resourceload_image = false;
      filters.forEach((filter) => {
        switch (filter) {
          case "Location":
            location = true;
            break;
          case "OnPlayerJoined":
            onplayerjoined = true;
            break;
          case "OnPlayerLeft":
            onplayerleft = true;
            break;
          case "PortalSpawn":
            portalspawn = true;
            break;
          case "Event":
            msgevent = true;
            break;
          case "External":
            external = true;
            break;
          case "VideoPlay":
            videoplay = true;
            break;
          case "StringLoad":
            resourceload_string = true;
            break;
          case "ImageLoad":
            resourceload_image = true;
            break;
        }
      });
    }
    const searchLike = `%${search}%`;
    const selects = [];
    const baseColumns = [
      "id",
      "created_at",
      "type",
      "display_name",
      "location",
      "user_id",
      "time",
      "world_id",
      "world_name",
      "group_name",
      "instance_id",
      "video_url",
      "video_name",
      "video_id",
      "resource_url",
      "resource_type",
      "data",
      "message",
    ].join(", ");
    if (location) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'Location' AS type, NULL AS display_name, location, NULL AS user_id, time, world_id, world_name, group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_location WHERE (world_name LIKE @searchLike OR group_name LIKE @searchLike) ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (onplayerjoined || onplayerleft) {
      let query = "";
      if (!onplayerjoined || !onplayerleft) {
        if (onplayerjoined) {
          query = "AND type = 'OnPlayerJoined'";
        } else if (onplayerleft) {
          query = "AND type = 'OnPlayerLeft'";
        }
      }
      selects.push(
        `SELECT * FROM (SELECT id, created_at, type, display_name, location, user_id, time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_join_leave WHERE (display_name LIKE @searchLike AND user_id != '${dbVars.userId}') ${vipQuery} ${query} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (portalspawn) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'PortalSpawn' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, world_name, NULL AS group_name, instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_portal_spawn WHERE (display_name LIKE @searchLike OR world_name LIKE @searchLike) ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (msgevent) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'Event' AS type, NULL AS display_name, NULL AS location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, data, NULL AS message FROM gamelog_event WHERE data LIKE @searchLike ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (external) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'External' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, message FROM gamelog_external WHERE (display_name LIKE @searchLike OR message LIKE @searchLike) ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (videoplay) {
      selects.push(
        `SELECT * FROM (SELECT id, created_at, 'VideoPlay' AS type, display_name, location, user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, video_url, video_name, video_id, NULL AS resource_url, NULL AS resource_type, NULL AS data, NULL AS message FROM gamelog_video_play WHERE (video_url LIKE @searchLike OR video_name LIKE @searchLike OR display_name LIKE @searchLike) ${vipQuery} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (resourceload_string || resourceload_image) {
      let checkString = "";
      let checkImage = "";
      if (!resourceload_string) {
        checkString = `AND resource_type != 'StringLoad'`;
      }
      if (!resourceload_image) {
        checkImage = `AND resource_type != 'ImageLoad'`;
      }
      selects.push(
        `SELECT * FROM (SELECT id, created_at, resource_type AS type, NULL AS display_name, location, NULL AS user_id, NULL AS time, NULL AS world_id, NULL AS world_name, NULL AS group_name, NULL AS instance_id, NULL AS video_url, NULL AS video_name, NULL AS video_id, resource_url, resource_type, NULL AS data, NULL AS message FROM gamelog_resource_load WHERE resource_url LIKE @searchLike ${checkString} ${checkImage} ORDER BY id DESC LIMIT @perTable)`
      );
    }
    if (selects.length === 0) {
      return [];
    }
    const gamelogDatabase = [];
    const args = {
      "@searchLike": searchLike,
      "@limit": maxEntries,
      "@perTable": maxEntries,
      ...vipArgs,
    };
    await sqliteService.execute(
      (dbRow) => {
        const type = dbRow[2];
        const row = {
          rowId: dbRow[0],
          created_at: dbRow[1],
          type,
        };
        switch (type) {
          case "Location":
            row.location = dbRow[4];
            row.worldId = dbRow[7];
            row.worldName = dbRow[8];
            row.time = dbRow[6];
            row.groupName = dbRow[9];
            break;
          case "OnPlayerJoined":
          case "OnPlayerLeft":
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.time = dbRow[6];
            break;
          case "PortalSpawn":
            row.displayName = dbRow[3];
            row.location = dbRow[4];
            row.userId = dbRow[5];
            row.instanceId = dbRow[10];
            row.worldName = dbRow[8];
            break;
          case "VideoPlay":
            row.videoUrl = dbRow[11];
            row.videoName = dbRow[12];
            row.videoId = dbRow[13];
            row.location = dbRow[4];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            break;
          case "Event":
            row.data = dbRow[16];
            break;
          case "External":
            row.message = dbRow[17];
            row.displayName = dbRow[3];
            row.userId = dbRow[5];
            row.location = dbRow[4];
            break;
          case "StringLoad":
          case "ImageLoad":
            row.resourceUrl = dbRow[14];
            row.location = dbRow[4];
            break;
        }
        gamelogDatabase.push(row);
      },
      `SELECT ${baseColumns} FROM (${selects.join(" UNION ALL ")}) ORDER BY created_at DESC, id DESC LIMIT @limit`,
      args
    );
    return gamelogDatabase;
  },

  async getLastDateGameLogDatabase() {
    const gamelogDatabase = [];
    let date = new Date().toJSON();
    const dateOffset = new Date(Date.now() - 86400000).toJSON();
    await sqliteService.execute((dbRow) => {
      gamelogDatabase.push(dbRow[0]);
    }, "SELECT created_at FROM gamelog_location ORDER BY id DESC LIMIT 1");
    await sqliteService.execute((dbRow) => {
      gamelogDatabase.push(dbRow[0]);
    }, "SELECT created_at FROM gamelog_join_leave ORDER BY id DESC LIMIT 1");
    await sqliteService.execute((dbRow) => {
      gamelogDatabase.push(dbRow[0]);
    }, "SELECT created_at FROM gamelog_portal_spawn ORDER BY id DESC LIMIT 1");
    await sqliteService.execute((dbRow) => {
      gamelogDatabase.push(dbRow[0]);
    }, "SELECT created_at FROM gamelog_event ORDER BY id DESC LIMIT 1");
    await sqliteService.execute((dbRow) => {
      gamelogDatabase.push(dbRow[0]);
    }, "SELECT created_at FROM gamelog_video_play ORDER BY id DESC LIMIT 1");
    await sqliteService.execute((dbRow) => {
      gamelogDatabase.push(dbRow[0]);
    }, "SELECT created_at FROM gamelog_resource_load ORDER BY id DESC LIMIT 1");
    if (gamelogDatabase.length > 0) {
      gamelogDatabase.sort();
      const newDate = gamelogDatabase[gamelogDatabase.length - 1];
      if (newDate > dateOffset && newDate < date) {
        date = newDate;
      }
    }
    return date;
  },

  async getGameLogWorldNameByWorldId(worldId) {
    let worldName = "";
    await sqliteService.execute(
      (dbRow) => {
        worldName = dbRow[0];
      },
      "SELECT world_name FROM gamelog_location WHERE world_id = @worldId ORDER BY id DESC LIMIT 1",
      {
        "@worldId": worldId,
      }
    );
    return worldName;
  },

  async getPreviousInstancesByUserId(input) {
    const groupingTimeTolerance = 1 * 60 * 60 * 1000;
    const data = new Set();
    let currentGroup;
    let prevEvent;

    await sqliteService.execute(
      (dbRow) => {
        const [created_at_iso, created_at_ts, location, time, worldName, groupName, eventId, eventType] = dbRow;

        if (
          !currentGroup ||
          currentGroup.location !== location ||
          (created_at_ts - currentGroup.last_ts > groupingTimeTolerance && !(prevEvent === "OnPlayerJoined" && eventType === "OnPlayerLeft"))
        ) {
          currentGroup = {
            created_at: created_at_iso,
            location,
            time,
            worldName,
            groupName,
            events: [eventId],
            last_ts: created_at_ts,
          };

          data.add(currentGroup);
        } else {
          currentGroup.time += time;
          currentGroup.last_ts = created_at_ts;
          currentGroup.events.push(eventId);
        }

        prevEvent = eventType;
      },
      `
            WITH grouped_locations AS (
                SELECT DISTINCT location, world_name, group_name
                FROM gamelog_location
            )
            SELECT gamelog_join_leave.created_at, strftime('%s', gamelog_join_leave.created_at) * 1000 created_at_ts, gamelog_join_leave.location, gamelog_join_leave.time, grouped_locations.world_name, grouped_locations.group_name, gamelog_join_leave.id, gamelog_join_leave.type
            FROM gamelog_join_leave
            INNER JOIN grouped_locations ON gamelog_join_leave.location = grouped_locations.location
            WHERE user_id = @userId OR display_name = @displayName
            ORDER BY gamelog_join_leave.id ASC`,
      {
        "@userId": input.id,
        "@displayName": input.displayName,
      }
    );

    return data;
  },

  async getPreviousInstancesByWorldId(input) {
    const data = new Map();
    await sqliteService.execute(
      (dbRow) => {
        let time = 0;
        if (dbRow[2]) {
          time = dbRow[2];
        }
        const ref = data.get(dbRow[1]);
        if (typeof ref !== "undefined") {
          time += ref.time;
        }
        const row = {
          created_at: dbRow[0],
          location: dbRow[1],
          time,
          worldName: dbRow[3],
          groupName: dbRow[4],
        };
        data.set(row.location, row);
      },
      `SELECT created_at, location, time, world_name, group_name
            FROM gamelog_location
            WHERE world_id = @worldId
            ORDER BY id DESC`,
      {
        "@worldId": input.id,
      }
    );
    return data;
  },

  async getPlayersFromInstance(location) {
    const players = new Map();
    await sqliteService.execute(
      (dbRow) => {
        let time = 0;
        let count = 0;
        let created_at = dbRow[0];
        if (dbRow[3]) {
          time = dbRow[3];
        }
        const ref = players.get(dbRow[1]);
        if (typeof ref !== "undefined") {
          time += ref.time;
          count = ref.count;
          created_at = ref.created_at;
        }
        if (dbRow[4] === "OnPlayerJoined") {
          count++;
        }
        const row = {
          created_at,
          displayName: dbRow[1],
          userId: dbRow[2],
          time,
          count,
        };
        players.set(row.displayName, row);
      },
      `SELECT created_at, display_name, user_id, time, type FROM gamelog_join_leave WHERE location = @location`,
      {
        "@location": location,
      }
    );
    return players;
  },

  async getPlayerDetailFromInstance(location) {
    const entries = [];
    await sqliteService.execute(
      (dbRow) => {
        entries.push({
          created_at: dbRow[0],
          display_name: dbRow[1],
          user_id: dbRow[2],
          time: dbRow[3] || 0,
        });
      },
      `SELECT created_at, display_name, user_id, time
             FROM gamelog_join_leave
             WHERE location = @location AND type = 'OnPlayerLeft'
             ORDER BY created_at ASC`,
      {
        "@location": location,
      }
    );
    return entries;
  },

  async getPreviousDisplayNamesByUserId(ref) {
    const data = new Map();
    await sqliteService.execute(
      (dbRow) => {
        const row = {
          created_at: dbRow[0],
          displayName: dbRow[1],
        };
        if (ref.displayName !== row.displayName) {
          data.set(row.displayName, row.created_at);
        }
      },
      `SELECT created_at, display_name
            FROM gamelog_join_leave
            WHERE user_id = @userId
            ORDER BY id DESC`,
      {
        "@userId": ref.id,
      }
    );
    return data;
  },

  async getGameLogInstancesTime() {
    const instances = new Map();
    await sqliteService.execute((dbRow) => {
      let time = 0;
      const location = dbRow[0];
      if (dbRow[1]) {
        time = dbRow[1];
      }
      const ref = instances.get(location);
      if (typeof ref !== "undefined") {
        time += ref;
      }
      instances.set(location, time);
    }, "SELECT location, time FROM gamelog_location");
    return instances;
  },

  async getCurrentUserOnlineSessions(fromDays = 0, toDays = 0) {
    const data = [];
    const now = new Date();
    const params = {};
    const where = [];

    if (fromDays > 0) {
      const fromDate = new Date(now.getTime() - fromDays * 86400000).toISOString();
      params["@fromDate"] = fromDate;
      where.push("created_at >= @fromDate");

      await sqliteService.execute(
        (dbRow) => {
          data.push({ created_at: dbRow[0], time: dbRow[1] || 0 });
        },
        "SELECT created_at, time FROM gamelog_location WHERE created_at < @fromDate ORDER BY created_at DESC LIMIT 1",
        { "@fromDate": fromDate }
      );
    }
    if (toDays > 0) {
      const toDate = new Date(now.getTime() - toDays * 86400000).toISOString();
      params["@toDate"] = toDate;
      where.push("created_at < @toDate");
    }

    const dateClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    await sqliteService.execute(
      (dbRow) => {
        data.push({ created_at: dbRow[0], time: dbRow[1] || 0 });
      },
      `SELECT created_at, time FROM gamelog_location ${dateClause} ORDER BY created_at`,
      params
    );
    return data;
  },

  async getCurrentUserOnlineSessionsAfter(afterCreatedAt, inclusive = false) {
    const data = [];
    const op = inclusive ? ">=" : ">";
    await sqliteService.execute(
      (dbRow) => {
        data.push({ created_at: dbRow[0], time: dbRow[1] || 0 });
      },
      `SELECT created_at, time FROM gamelog_location WHERE created_at ${op} @after ORDER BY created_at`,
      { "@after": afterCreatedAt }
    );
    return data;
  },

  async getMyTopWorlds(days = 0, limit = 5, sortBy = "time", excludeWorldId = "") {
    const results = [];
    const whereClause = days > 0 ? `AND created_at >= datetime('now', @daysOffset)` : "";
    const excludeClause = excludeWorldId ? "AND world_id != @excludeWorldId" : "";
    const orderBy = sortBy === "count" ? "visit_count DESC" : "total_time DESC";
    const params = { "@limit": limit };
    if (days > 0) {
      params["@daysOffset"] = `-${days} days`;
    }
    if (excludeWorldId) {
      params["@excludeWorldId"] = excludeWorldId;
    }
    await sqliteService.execute(
      (dbRow) => {
        results.push({
          worldId: dbRow[0],
          worldName: dbRow[1] || dbRow[0],
          visitCount: dbRow[2],
          totalTime: dbRow[3] || 0,
        });
      },
      `SELECT
                world_id,
                world_name,
                COUNT(*) AS visit_count,
                SUM(time) AS total_time
            FROM gamelog_location
            WHERE world_id IS NOT NULL
                AND world_id != ''
                AND world_id LIKE 'wrld_%'
                ${whereClause}
                ${excludeClause}
            GROUP BY world_id
            ORDER BY ${orderBy}
            LIMIT @limit`,
      params
    );
    return results;
  },

  async getUserIdFromDisplayName(displayName) {
    let userId = "";
    await sqliteService.execute(
      (row) => {
        userId = row[0];
      },
      `SELECT user_id FROM gamelog_join_leave WHERE display_name = @displayName AND user_id != '' ORDER BY id DESC LIMIT 1`,
      {
        "@displayName": displayName,
      }
    );
    return userId;
  },

  async getInstanceActivity(startDate, endDate) {
    const currentUserData = [];
    const detailData = new Map();
    await sqliteService.execute(
      (row) => {
        const rowData = {
          id: row[0],
          created_at: row[1],
          type: row[2],
          display_name: row[3],
          location: row[4],
          user_id: row[5],
          time: row[6],
        };

        if (!rowData.location || rowData.location === "traveling") {
          return;
        }

        if (rowData.user_id === dbVars.userId) {
          currentUserData.push(rowData);
        }
        const instanceData = detailData.get(rowData.location);

        detailData.set(rowData.location, [...(instanceData || []), rowData]);
      },
      `SELECT
                     *
                FROM
                    gamelog_join_leave
                WHERE type = 'OnPlayerLeft'
                    AND (
                        strftime('%Y-%m-%dT%H:%M:%SZ', created_at, '-' || (time * 1.0 / 1000) || ' seconds') BETWEEN @utc_start_date AND @utc_end_date
                        OR created_at BETWEEN @utc_start_date AND @utc_end_date
                    );`,
      {
        "@utc_start_date": startDate,
        "@utc_end_date": endDate,
      }
    );

    return { currentUserData, detailData };
  },

  async getDateOfInstanceActivity() {
    const result = [];
    await sqliteService.execute(
      (row) => {
        result.push(row[0]);
      },
      `SELECT created_at 
                FROM gamelog_join_leave 
                WHERE user_id = @userId`,
      {
        "@userId": dbVars.userId,
      }
    );
    return result;
  },

  async getInstanceJoinHistory() {
    const oneWeekAgo = new Date(Date.now() - 604800000).toJSON();
    const instances = new Map();
    await sqliteService.execute(
      (row) => {
        if (!instances.has(row[1])) {
          const epoch = new Date(row[0]).getTime();
          instances.set(row[1], epoch);
        }
      },
      `SELECT created_at, location FROM gamelog_join_leave WHERE user_id = @userId AND created_at > @created_at ORDER BY created_at DESC`,
      {
        "@userId": dbVars.userId,
        "@created_at": oneWeekAgo,
      }
    );
    return instances;
  },

  deleteGameLogInstanceByInstanceId(input) {
    sqliteService.executeNonQuery(`DELETE FROM gamelog_location WHERE location = @location`, {
      "@location": input.location,
    });
  },

  deleteGameLogInstance(input) {
    sqliteService.executeNonQuery(
      `DELETE FROM gamelog_join_leave WHERE (user_id = @user_id OR display_name = @displayName) AND (location = @location) AND (id in (${input.events.join(",")}))`,
      {
        "@user_id": input.id,
        "@displayName": input.displayName,
        "@location": input.location,
      }
    );
  },

  deleteGameLogEntry(input) {
    switch (input.type) {
      case "VideoPlay":
        this.deleteGameLogVideoPlay(input);
        break;
      case "Event":
        this.deleteGameLogEvent(input);
        break;
      case "External":
        this.deleteGameLogExternal(input);
        break;
      case "StringLoad":
      case "ImageLoad":
        this.deleteGameLogResourceLoad(input);
        break;
    }
  },

  deleteGameLogVideoPlay(input) {
    sqliteService.executeNonQuery(`DELETE FROM gamelog_video_play WHERE created_at = @created_at AND video_url = @video_url AND location = @location`, {
      "@created_at": input.created_at,
      "@video_url": input.videoUrl,
      "@location": input.location,
    });
  },

  deleteGameLogEvent(input) {
    sqliteService.executeNonQuery(`DELETE FROM gamelog_event WHERE created_at = @created_at AND data = @data`, {
      "@created_at": input.created_at,
      "@data": input.data,
    });
  },

  deleteGameLogExternal(input) {
    sqliteService.executeNonQuery(`DELETE FROM gamelog_external WHERE created_at = @created_at AND message = @message`, {
      "@created_at": input.created_at,
      "@message": input.message,
    });
  },

  deleteGameLogResourceLoad(input) {
    sqliteService.executeNonQuery(
      `DELETE FROM gamelog_resource_load WHERE created_at = @created_at AND resource_url = @resource_url AND location = @location`,
      {
        "@created_at": input.created_at,
        "@resource_url": input.resourceUrl,
        "@type": input.type,
        "@location": input.location,
      }
    );
  },

  async getSessionsLocationSegments(beforeId, limit) {
    const data = [];
    const cursorClause = beforeId != null ? "AND id < @beforeId" : "";
    const args = { "@limit": limit };
    if (beforeId != null) {
      args["@beforeId"] = beforeId;
    }
    await sqliteService.execute(
      (dbRow) => {
        data.push({
          id: dbRow[0],
          created_at: dbRow[1],
          location: dbRow[2],
          worldId: dbRow[3],
          worldName: dbRow[4],
          time: dbRow[5],
          groupName: dbRow[6],
        });
      },
      `SELECT id, created_at, location, world_id, world_name, time, group_name
             FROM gamelog_location
             WHERE 1=1 ${cursorClause}
             ORDER BY id DESC
             LIMIT @limit`,
      args
    );
    return data;
  },

  async getSessionsEventsForSegments(locationTags, afterDate, beforeDate) {
    if (!locationTags || locationTags.length === 0) return [];

    const data = [];
    const placeholders = [];
    const args = {
      "@afterDate": afterDate,
      "@beforeDate": beforeDate,
    };

    locationTags.forEach((loc, i) => {
      const key = `@loc_${i}`;
      args[key] = loc;
      placeholders.push(key);
    });

    const locIn = placeholders.join(", ");

    await sqliteService.execute(
      (dbRow) => {
        data.push({
          type: dbRow[0],
          created_at: dbRow[1],
          displayName: dbRow[2],
          userId: dbRow[3],
          location: dbRow[4],
        });
      },
      `SELECT type, created_at, display_name, user_id, location
             FROM gamelog_join_leave
             WHERE location IN (${locIn})
               AND user_id != @selfId
               AND created_at >= @afterDate
               AND created_at <= @beforeDate
             ORDER BY created_at ASC`,
      { ...args, "@selfId": dbVars.userId }
    );

    await sqliteService.execute(
      (dbRow) => {
        data.push({
          type: "VideoPlay",
          created_at: dbRow[0],
          videoUrl: dbRow[1],
          videoName: dbRow[2],
          videoId: dbRow[3],
          displayName: dbRow[4],
          userId: dbRow[5],
          location: dbRow[6],
        });
      },
      `SELECT created_at, video_url, video_name, video_id, display_name, user_id, location
             FROM gamelog_video_play
             WHERE location IN (${locIn})
               AND created_at >= @afterDate
               AND created_at <= @beforeDate
             ORDER BY created_at ASC`,
      args
    );

    return data;
  },

  async getSessionsLocationSegmentsByAnchor(sinceDate, limit) {
    const data = [];
    await sqliteService.execute(
      (dbRow) => {
        data.push({
          id: dbRow[0],
          created_at: dbRow[1],
          location: dbRow[2],
          worldId: dbRow[3],
          worldName: dbRow[4],
          time: dbRow[5],
          groupName: dbRow[6],
        });
      },
      `SELECT id, created_at, location, world_id, world_name, time, group_name
             FROM gamelog_location
             WHERE created_at >= @sinceDate
             ORDER BY id DESC
             LIMIT @limit`,
      {
        "@sinceDate": sinceDate,
        "@limit": limit,
      }
    );
    return data;
  },
};

export { gameLog };
