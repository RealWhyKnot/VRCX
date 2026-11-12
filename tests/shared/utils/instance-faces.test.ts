import { describe, expect, test } from "vitest";

import { MAX_FACES, buildFaceIndex, buildInstanceFaces, readFileOwner, type FaceSource, type KnownUser } from "../../../src/shared/utils/instance-faces";

function icon(id: string): string {
  return `https://api.vrchat.cloud/api/1/image/file_${id}/1/256`;
}

function user(id: string, overrides: Partial<KnownUser> = {}): KnownUser {
  return { id: `usr_${id}`, name: `Name ${id}`, iconUrl: icon(id), ownedIconUrls: [icon(id)], location: "", isFriend: false, ...overrides };
}

function source(overrides: Partial<FaceSource> = {}): FaceSource {
  return { location: "wrld_1:1", userCount: 0, friendIconUrls: [], userIconUrls: [], ...overrides };
}

describe("buildFaceIndex", () => {
  test("maps an owned icon file to its user", () => {
    const index = buildFaceIndex([user("a")]);
    expect(index.get("file_a")?.id).toBe("usr_a");
  });

  test("prefers a friend when two users share a file", () => {
    const index = buildFaceIndex([user("a"), user("b", { ownedIconUrls: [icon("a")], isFriend: true })]);
    expect(index.get("file_a")?.id).toBe("usr_b");
  });

  test("skips urls without a file id", () => {
    expect(buildFaceIndex([user("a", { ownedIconUrls: ["https://example.test/x.png", ""] })]).size).toBe(0);
  });
});

describe("buildInstanceFaces", () => {
  test("puts friends in the instance first, then known people, then unknown faces", () => {
    const friend = user("f", { isFriend: true, location: "wrld_1:1" });
    const known = user("k");
    const result = buildInstanceFaces(source({ userCount: 3, userIconUrls: [icon("x"), icon("k"), icon("f")] }), [friend], buildFaceIndex([friend, known]));
    expect(result.faces.map((face) => face.key)).toEqual(["usr_f", "usr_k", "file_x:0"]);
    expect(result.faces.map((face) => face.kind)).toEqual(["known", "known", "unknown"]);
    expect(result.hiddenCount).toBe(0);
  });

  test("shows a friend once even when their icon is in both lists", () => {
    const friend = user("f", { isFriend: true });
    const result = buildInstanceFaces(source({ userCount: 1, friendIconUrls: [icon("f")], userIconUrls: [icon("f")] }), [friend], buildFaceIndex([friend]));
    expect(result.faces).toHaveLength(1);
  });

  test("marks unmatched friend icons as friends", () => {
    const result = buildInstanceFaces(source({ userCount: 2, friendIconUrls: [icon("q")], userIconUrls: [icon("z")] }), [], new Map());
    expect(result.faces.map((face) => [face.kind, face.isFriend])).toEqual([
      ["unknown", true],
      ["unknown", false],
    ]);
  });

  test("caps the faces and counts the rest", () => {
    const urls = Array.from({ length: 40 }, (_, position) => icon(`n${position}`));
    const result = buildInstanceFaces(source({ userCount: 60, userIconUrls: urls }), [], new Map());
    expect(result.faces).toHaveLength(MAX_FACES);
    expect(result.hiddenCount).toBe(60 - MAX_FACES);
  });

  test("never reports a negative remainder when the count lags behind the icons", () => {
    const result = buildInstanceFaces(source({ userCount: 1, userIconUrls: [icon("a"), icon("b"), icon("c")] }), [], new Map(), 2);
    expect(result.faces).toHaveLength(2);
    expect(result.hiddenCount).toBe(1);
  });

  test("ignores icons without a file id and repeated files", () => {
    const result = buildInstanceFaces(source({ userCount: 3, userIconUrls: ["https://example.test/a.png", icon("a"), icon("a")] }), [], new Map());
    expect(result.faces).toHaveLength(1);
    expect(result.hiddenCount).toBe(2);
  });

  test("returns nothing for an empty instance", () => {
    expect(buildInstanceFaces(source(), [], new Map())).toEqual({ faces: [], hiddenCount: 0 });
  });
});

describe("readFileOwner", () => {
  test.each([["icon"], ["gallery"]])("trusts the owner of a %s upload", (tag) => {
    expect(readFileOwner({ ownerId: "usr_1", name: "pic", tags: [tag] })).toEqual({ kind: "user", userId: "usr_1" });
  });

  test("does not treat an avatar image's author as the person", () => {
    expect(readFileOwner({ ownerId: "usr_1", name: "Avatar - Fox - Image - 2022", tags: ["icon"] })).toEqual({ kind: "avatar" });
  });

  test.each([
    [null],
    ["text"],
    [{}],
    [{ ownerId: "usr_1", name: "pic", tags: [] }],
    [{ ownerId: 5, name: "pic", tags: ["icon"] }],
    [{ ownerId: "grp_1", name: "pic", tags: ["icon"] }],
  ])("gives up on %j", (file) => {
    expect(readFileOwner(file)).toEqual({ kind: "unknown" });
  });
});
