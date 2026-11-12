import * as workerTimers from "worker-timers";

import { useKnownFaces } from "../composables/use-instance-faces";
import { database } from "../services/database";
import type { DiscoveredInstance } from "../shared/utils/instance-discovery";
import { buildSightingPeople, createSightingThrottle, type PictureOwnerKind, type Sighting } from "../shared/utils/instance-sightings";
import { useUserStore } from "../stores/user";
import { logError } from "../stores/vrcx-messages";
import { lookUpPicture, pictureOwnerName } from "./picture-owner-coordinator";

type SightedInstance = {
  location: string;
  worldId: string;
  worldName: string;
  ownerId: string;
  ownerName: string;
  userCount: number;
  capacity: number;
  iconUrls: readonly string[];
};

const RESOLVE_DELAY_MS = 6 * 1000;
const RESOLVE_PAUSE_MS = 10 * 60 * 1000;
const RESOLVE_BATCH = 20;
const MAX_FAILURES_IN_A_ROW = 3;
const RETRY_FAILED_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_SAVED_OWNERS = 2000;

const throttle = createSightingThrottle();
let queue: string[] = [];
let isResolving = false;
let failuresInARow = 0;
let hasLoadedOwners = false;
let writes: Promise<void> = Promise.resolve();

function creatorName(instance: SightedInstance): string {
  if (instance.ownerName) {
    return instance.ownerName;
  }
  return useUserStore().cachedUsers.get(instance.ownerId)?.displayName ?? "";
}

function toSighting(instance: SightedInstance): Sighting {
  const { faceIndex, friendsByLocation } = useKnownFaces();
  return {
    location: instance.location,
    worldId: instance.worldId,
    worldName: instance.worldName,
    creatorId: instance.ownerId,
    creatorName: creatorName(instance),
    userCount: instance.userCount,
    capacity: instance.capacity,
    people: buildSightingPeople(friendsByLocation.value.get(instance.location) ?? [], instance.iconUrls, faceIndex.value),
  };
}

async function saveOwner(fileId: string, kind: PictureOwnerKind, userId: string, displayName: string): Promise<void> {
  await database.savePictureOwner(fileId, kind, userId, displayName, new Date().toJSON());
}

async function resolvePicture(fileId: string): Promise<void> {
  const { owner } = await lookUpPicture(fileId);
  if (owner.kind !== "user") {
    await saveOwner(fileId, owner.kind, "", "");
    return;
  }
  const name = await pictureOwnerName(owner.userId);
  useKnownFaces().owners.set(fileId, { kind: "user", userId: owner.userId, name });
  await saveOwner(fileId, "user", owner.userId, name);
}

async function resolveNext(): Promise<void> {
  if (queue.length === 0) {
    queue = await database.getUnresolvedSightingPictures(new Date(Date.now() - RETRY_FAILED_AFTER_MS).toJSON(), RESOLVE_BATCH);
  }
  const fileId = queue.shift();
  if (fileId === undefined) {
    isResolving = false;
    return;
  }
  let delay = RESOLVE_DELAY_MS;
  try {
    await resolvePicture(fileId);
    failuresInARow = 0;
  } catch (err) {
    logError(err);
    failuresInARow += 1;
    await saveOwner(fileId, "failed", "", "");
    if (failuresInARow >= MAX_FAILURES_IN_A_ROW) {
      failuresInARow = 0;
      queue = [];
      delay = RESOLVE_PAUSE_MS;
    }
  }
  scheduleNext(delay);
}

function scheduleNext(delay: number): void {
  workerTimers.setTimeout(() => {
    void resolveNext().catch((err: unknown) => {
      isResolving = false;
      logError(err);
    });
  }, delay);
}

function startResolving(): void {
  if (isResolving) {
    return;
  }
  isResolving = true;
  scheduleNext(RESOLVE_DELAY_MS);
}

async function loadSavedOwners(): Promise<void> {
  if (hasLoadedOwners) {
    return;
  }
  hasLoadedOwners = true;
  const { owners } = useKnownFaces();
  for (const saved of await database.getPictureOwners(MAX_SAVED_OWNERS)) {
    if (owners.has(saved.fileId)) {
      continue;
    }
    if (saved.kind === "avatar") {
      owners.set(saved.fileId, { kind: "avatar" });
    } else if (saved.userId) {
      owners.set(saved.fileId, { kind: "user", userId: saved.userId, name: saved.displayName });
    }
  }
}

export function recordSighting(instance: SightedInstance): void {
  const sighting = toSighting(instance);
  if (!throttle.shouldLog(sighting, Date.now())) {
    return;
  }
  const createdAt = new Date().toJSON();
  writes = writes
    .then(() => database.addInstanceSighting(sighting, createdAt))
    .then(loadSavedOwners)
    .then(startResolving)
    .catch(logError);
}

export function recordDiscoveredSightings(instances: readonly DiscoveredInstance[]): void {
  for (const instance of instances) {
    recordSighting({
      location: instance.location,
      worldId: instance.worldId,
      worldName: instance.worldName,
      ownerId: instance.ownerId,
      ownerName: instance.ownerName,
      userCount: instance.userCount,
      capacity: instance.capacity,
      iconUrls: [...instance.friendIconUrls, ...instance.userIconUrls],
    });
  }
}

type AppliedInstance = {
  location: string;
  worldId?: string | undefined;
  ownerId?: string | null | undefined;
  userCount?: number | undefined;
  n_users?: number | undefined;
  capacity?: number | undefined;
  userIcons?: readonly string[] | undefined;
  world: { name?: string | undefined };
};

export function recordAppliedInstance(instance: AppliedInstance): void {
  recordSighting({
    location: instance.location,
    worldId: instance.worldId ?? "",
    worldName: instance.world.name ?? "",
    ownerId: instance.ownerId ?? "",
    ownerName: "",
    userCount: instance.userCount ?? instance.n_users ?? 0,
    capacity: instance.capacity ?? 0,
    iconUrls: instance.userIcons ?? [],
  });
}

export type { SightedInstance };
