import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { FaceOwner, FileOwner, KnownUser } from "../../src/shared/utils/instance-faces";
import type { Sighting } from "../../src/shared/utils/instance-sightings";

type SavedOwner = { fileId: string; kind: string; userId: string; displayName: string };

const mocks = vi.hoisted(() => ({
  addInstanceSighting: vi.fn<(sighting: Sighting, createdAt: string) => Promise<void>>(),
  getUnresolvedSightingPictures: vi.fn<(retryFailedBefore: string, limit: number) => Promise<string[]>>(),
  getPictureOwners: vi.fn<(limit: number) => Promise<SavedOwner[]>>(),
  savePictureOwner: vi.fn<(fileId: string, kind: string, userId: string, displayName: string, resolvedAt: string) => Promise<void>>(),
  lookUpPicture: vi.fn<(fileId: string) => Promise<{ owner: FileOwner; uploaderId: string }>>(),
  pictureOwnerName: vi.fn<(userId: string) => Promise<string>>(),
  logError: vi.fn<(err: unknown) => void>(),
  owners: new Map<string, FaceOwner>(),
  faceIndex: { value: new Map<string, KnownUser>() },
  friendsByLocation: { value: new Map<string, KnownUser[]>() },
  cachedUsers: new Map<string, { displayName: string }>(),
}));

vi.mock("worker-timers", () => ({
  get setTimeout() {
    return globalThis.setTimeout;
  },
}));
vi.mock("../../src/composables/use-instance-faces", () => ({
  useKnownFaces: () => ({ owners: mocks.owners, faceIndex: mocks.faceIndex, friendsByLocation: mocks.friendsByLocation }),
}));
vi.mock("../../src/services/database", () => ({
  database: {
    addInstanceSighting: mocks.addInstanceSighting,
    getUnresolvedSightingPictures: mocks.getUnresolvedSightingPictures,
    getPictureOwners: mocks.getPictureOwners,
    savePictureOwner: mocks.savePictureOwner,
  },
}));
vi.mock("../../src/stores/user", () => ({ useUserStore: () => ({ cachedUsers: mocks.cachedUsers }) }));
vi.mock("../../src/stores/vrcx-messages", () => ({ logError: mocks.logError }));
vi.mock("../../src/coordinators/picture-owner-coordinator", () => ({ lookUpPicture: mocks.lookUpPicture, pictureOwnerName: mocks.pictureOwnerName }));

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const NOW = Date.UTC(2026, 10, 12, 10);

function icon(fileId: string): string {
  return `https://api.vrchat.cloud/api/1/file/${fileId}/1/file`;
}

function instance(location: string, iconUrls: string[]) {
  return { location, worldId: "wrld_a", worldName: "Miami Beach", ownerId: "usr_owner", ownerName: "", userCount: 6, capacity: 60, iconUrls };
}

async function load() {
  vi.resetModules();
  return import("../../src/coordinators/instance-sighting-coordinator");
}

describe("instance sighting coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.owners.clear();
    mocks.faceIndex.value = new Map();
    mocks.friendsByLocation.value = new Map();
    mocks.cachedUsers.clear();
    mocks.addInstanceSighting.mockResolvedValue();
    mocks.savePictureOwner.mockResolvedValue();
    mocks.getPictureOwners.mockResolvedValue([]);
    mocks.getUnresolvedSightingPictures.mockResolvedValue([]);
    mocks.pictureOwnerName.mockResolvedValue("Stranger");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("stores the creator, the friends there and the faces shown", async () => {
    mocks.cachedUsers.set("usr_owner", { displayName: "Sheepa" });
    mocks.friendsByLocation.value.set("wrld_a:85920", [
      { id: "usr_f", name: "Amnesty", iconUrl: icon("file_f"), ownedIconUrls: [], location: "wrld_a:85920", isFriend: true },
    ]);
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:85920", [icon("file_f"), icon("file_s")]));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.addInstanceSighting).toHaveBeenCalledTimes(1);
    expect(mocks.addInstanceSighting.mock.calls[0]?.[0]).toEqual({
      location: "wrld_a:85920",
      worldId: "wrld_a",
      worldName: "Miami Beach",
      creatorId: "usr_owner",
      creatorName: "Sheepa",
      userCount: 6,
      capacity: 60,
      people: [
        { userId: "usr_f", fileId: "file_f", displayName: "Amnesty", isFriend: true },
        { userId: "", fileId: "file_s", displayName: "", isFriend: false },
      ],
    });
    expect(mocks.addInstanceSighting.mock.calls[0]?.[1]).toBe(new Date(NOW).toJSON());
  });

  test("does not store the same view of an instance twice in a row", async () => {
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:1", [icon("file_s")]));
    recordSighting(instance("wrld_a:1", [icon("file_s")]));
    recordSighting(instance("private", [icon("file_s")]));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.addInstanceSighting).toHaveBeenCalledTimes(1);
  });

  test("looks up one unknown face every six seconds and keeps the name", async () => {
    mocks.getUnresolvedSightingPictures.mockResolvedValueOnce(["file_a", "file_b"]).mockResolvedValue([]);
    mocks.lookUpPicture
      .mockResolvedValueOnce({ owner: { kind: "user", userId: "usr_a" }, uploaderId: "usr_a" })
      .mockResolvedValueOnce({ owner: { kind: "avatar" }, uploaderId: "" });
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:1", [icon("file_a"), icon("file_b")]));
    await vi.advanceTimersByTimeAsync(5 * SECOND);
    expect(mocks.lookUpPicture).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SECOND);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(1);
    expect(mocks.owners.get("file_a")).toEqual({ kind: "user", userId: "usr_a", name: "Stranger" });
    expect(mocks.savePictureOwner).toHaveBeenCalledWith("file_a", "user", "usr_a", "Stranger", expect.any(String));
    await vi.advanceTimersByTimeAsync(5 * SECOND);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(SECOND);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(2);
    expect(mocks.savePictureOwner).toHaveBeenCalledWith("file_b", "avatar", "", "", expect.any(String));
    await vi.advanceTimersByTimeAsync(10 * MINUTE);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(2);
    expect(mocks.getUnresolvedSightingPictures).toHaveBeenCalledTimes(2);
    expect(mocks.getUnresolvedSightingPictures.mock.calls[0]).toEqual([new Date(NOW + 6 * SECOND - 24 * 60 * MINUTE).toJSON(), 20]);
  });

  test("starts looking again when a later sighting brings new faces", async () => {
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:1", [icon("file_a")]));
    await vi.advanceTimersByTimeAsync(6 * SECOND);
    expect(mocks.getUnresolvedSightingPictures).toHaveBeenCalledTimes(1);
    mocks.getUnresolvedSightingPictures.mockResolvedValueOnce(["file_b"]);
    mocks.lookUpPicture.mockResolvedValue({ owner: { kind: "unknown" }, uploaderId: "" });
    recordSighting(instance("wrld_a:2", [icon("file_b")]));
    await vi.advanceTimersByTimeAsync(6 * SECOND);
    expect(mocks.lookUpPicture).toHaveBeenCalledWith("file_b");
    expect(mocks.savePictureOwner).toHaveBeenCalledWith("file_b", "unknown", "", "", expect.any(String));
  });

  test("marks failed lookups and rests ten minutes after three in a row", async () => {
    mocks.getUnresolvedSightingPictures.mockResolvedValue(["file_a", "file_b", "file_c", "file_d"]);
    mocks.lookUpPicture.mockRejectedValue(new Error("429"));
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:1", [icon("file_a")]));
    await vi.advanceTimersByTimeAsync(18 * SECOND);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(3);
    expect(mocks.savePictureOwner.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      ["file_a", "failed"],
      ["file_b", "failed"],
      ["file_c", "failed"],
    ]);
    expect(mocks.logError).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(9 * MINUTE);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(MINUTE);
    expect(mocks.lookUpPicture).toHaveBeenCalledTimes(4);
  });

  test("loads saved names once and keeps the ones already known", async () => {
    mocks.owners.set("file_known", { kind: "avatar" });
    mocks.getPictureOwners.mockResolvedValue([
      { fileId: "file_a", kind: "user", userId: "usr_a", displayName: "Ann" },
      { fileId: "file_b", kind: "avatar", userId: "", displayName: "" },
      { fileId: "file_c", kind: "failed", userId: "", displayName: "" },
      { fileId: "file_known", kind: "user", userId: "usr_k", displayName: "Kay" },
    ]);
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:1", [icon("file_s")]));
    recordSighting(instance("wrld_a:2", [icon("file_s")]));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.getPictureOwners).toHaveBeenCalledTimes(1);
    expect(mocks.getPictureOwners).toHaveBeenCalledWith(2000);
    expect([...mocks.owners.entries()]).toEqual([
      ["file_known", { kind: "avatar" }],
      ["file_a", { kind: "user", userId: "usr_a", name: "Ann" }],
      ["file_b", { kind: "avatar" }],
    ]);
  });

  test("logs a failed write and still stores the next sighting", async () => {
    mocks.addInstanceSighting.mockRejectedValueOnce(new Error("locked"));
    const { recordSighting } = await load();
    recordSighting(instance("wrld_a:1", [icon("file_s")]));
    recordSighting(instance("wrld_a:2", [icon("file_s")]));
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.logError).toHaveBeenCalledTimes(1);
    expect(mocks.addInstanceSighting).toHaveBeenCalledTimes(2);
  });

  test("reads an instance VRCX fetched and the pages of the Instance Browser", async () => {
    const { recordAppliedInstance, recordDiscoveredSightings } = await load();
    recordAppliedInstance({ location: "wrld_a:1", worldId: "wrld_a", ownerId: null, n_users: 4, userIcons: [icon("file_s")], world: {} });
    recordDiscoveredSightings([
      {
        location: "wrld_b:2",
        worldId: "wrld_b",
        instanceId: "2",
        shortName: "",
        displayName: "",
        description: "",
        worldName: "Black Cat",
        worldAuthorName: "",
        worldImageUrl: "",
        userCount: 40,
        capacity: 80,
        queueSize: 0,
        friendCount: 1,
        friendIconUrls: [icon("file_f")],
        userIconUrls: [icon("file_u")],
        isFull: false,
        region: "us",
        accessType: "public",
        ownerId: "usr_owner",
        ownerName: "Sheepa",
        ownerIconUrl: "",
        categoryId: "",
        vibeIds: [],
        dominantLanguage: "",
      },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    const stored = mocks.addInstanceSighting.mock.calls.map((call) => call[0]);
    expect(stored[0]).toMatchObject({ location: "wrld_a:1", worldName: "", creatorId: "", userCount: 4, capacity: 0 });
    expect(stored[0]?.people.map((person) => person.fileId)).toEqual(["file_s"]);
    expect(stored[1]).toMatchObject({
      location: "wrld_b:2",
      worldName: "Black Cat",
      creatorId: "usr_owner",
      creatorName: "Sheepa",
      userCount: 40,
      capacity: 80,
    });
    expect(stored[1]?.people.map((person) => person.fileId)).toEqual(["file_f", "file_u"]);
  });
});
