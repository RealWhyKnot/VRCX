import * as workerTimers from "worker-timers";

import { userRequest } from "../api/user";
import { syncFriendSearchIndex } from "../coordinators/search-index-coordinator";
import { database } from "../services/database";
import { replaceBioSymbols } from "../shared/utils/base/string";
import type { VrcxUser } from "../types/vrcx";

import type { FriendContext } from "./friend-types";
import type { UserStoreNotesState } from "./user-state";

export type UserNotesDeps = {
  state: UserStoreNotesState;
  cachedUsers: Map<string, VrcxUser>;
  friends: Map<string, FriendContext>;
};

function applyNoteToCachedUser(deps: UserNotesDeps, userId: string, note: string) {
  const user = deps.cachedUsers.get(userId);
  if (user) {
    user.note = note;
    const friendCtx = deps.friends.get(userId);
    if (friendCtx) {
      syncFriendSearchIndex(friendCtx);
    }
  }
}

export async function initUserNotes(deps: UserNotesDeps) {
  const { state } = deps;
  state.lastNoteCheck = new Date();
  state.lastDbNoteDate = null;
  state.notes.clear();
  try {
    const dbNotes = await database.getAllUserNotes();
    for (const note of dbNotes) {
      if (note.userId === null || note.note === null || note.createdAt === null) {
        continue;
      }
      state.notes.set(note.userId, note.note);
      applyNoteToCachedUser(deps, note.userId, note.note);
      if (!state.lastDbNoteDate || state.lastDbNoteDate < note.createdAt) {
        state.lastDbNoteDate = note.createdAt;
      }
    }
    await getLatestUserNotes(deps);
  } catch (error) {
    console.error("Error initializing user notes:", error);
  }
}

export async function getLatestUserNotes(deps: UserNotesDeps) {
  const { state } = deps;
  state.lastNoteCheck = new Date();
  const params = {
    offset: 0,
    n: 10,
  };
  const newNotes = new Map<string, { targetUserId: string; targetUser?: { displayName?: string }; note: string; createdAt: string }>();
  let isDone = false;
  try {
    for (let i = 0; i < 100; i++) {
      params.offset = i * params.n;
      const args = await userRequest.getUserNotes(params);
      for (const note of args.json) {
        if (state.lastDbNoteDate && state.lastDbNoteDate > note.createdAt) {
          isDone = true;
        }
        if (!state.lastDbNoteDate || state.lastDbNoteDate < note.createdAt) {
          state.lastDbNoteDate = note.createdAt;
        }
        note.note = replaceBioSymbols(note.note);
        newNotes.set(note.targetUserId, note);
      }
      if (isDone || args.json.length === 0) {
        break;
      }
      params.n = 100;
      await new Promise((resolve) => {
        workerTimers.setTimeout(resolve, 1000);
      });
    }
  } catch (error) {
    console.error("Error fetching user notes:", error);
  }

  for (const note of newNotes.values()) {
    const displayName = note.targetUser?.displayName;
    await database.addUserNote({
      userId: note.targetUserId,
      displayName: displayName === undefined || displayName === "" ? note.targetUserId : displayName,
      note: note.note,
      createdAt: note.createdAt,
    });
    state.notes.set(note.targetUserId, note.note);
    applyNoteToCachedUser(deps, note.targetUserId, note.note);
  }
}

export async function checkNote(deps: UserNotesDeps, userId: string, newNote: string | undefined) {
  const { state } = deps;
  if (!state.lastNoteCheck || state.lastNoteCheck.getTime() + 5 * 60 * 1000 > Date.now()) {
    return;
  }
  const existingNote = state.notes.get(userId);
  if (typeof existingNote !== "undefined" && !newNote) {
    console.log("deleting note", userId);
    state.notes.delete(userId);
    database.deleteUserNote(userId);
    return;
  }
  if (typeof existingNote === "undefined" || existingNote !== newNote) {
    console.log("detected note change", userId, newNote);
    await getLatestUserNotes(deps);
  }
}
