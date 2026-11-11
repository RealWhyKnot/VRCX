import { COMBINING_MARK_RANGES, LINE_BREAK_COMBINING_MARK_RANGES, SYMBOL_LEADING_RANGES, type CodeRange } from "./quick-search-character-ranges";
import {
  parseWorkerRequest,
  type FriendMatchField,
  type FriendSearchResult,
  type IndexEntry,
  type IndexPayload,
  type ItemSearchResult,
  type ItemType,
  type SearchRequest,
  type SearchWorkerResponse,
} from "./quick-search-worker-protocol";

const characterToConfusables = new Map<string, string>([
  [" ", " "],
  ["0", "⓿"],
  ["1", "11⓵➊⑴¹𝟏𝟙１𝟷𝟣⒈𝟭1➀₁①❶⥠"],
  ["2", "⓶⒉⑵➋ƻ²ᒿ𝟚２𝟮𝟤ᒾ𝟸Ƨ𝟐②ᴤ₂➁❷ᘝƨ"],
  ["3", "³ȝჳⳌꞫ𝟑ℨ𝟛𝟯𝟥Ꝫ➌ЗȜ⓷ӠƷ３𝟹⑶⒊ʒʓǯǮƺ𝕴ᶾзᦡ➂③₃ᶚᴣᴟ❸ҘҙӬӡӭӟӞ"],
  ["4", "𝟰𝟺𝟦𝟒➍ҶᏎ𝟜ҷ⓸ҸҹӴӵᶣ４чㄩ⁴➃₄④❹Ӌ⑷⒋"],
  ["5", "𝟱⓹➎Ƽ𝟓𝟻𝟝𝟧５➄₅⑤⁵❺ƽ⑸⒌"],
  ["6", "Ⳓ🄇𝟼Ꮾ𝟲𝟞𝟨𝟔➏⓺Ϭϭ⁶б６ᧈ⑥➅₆❻⑹⒍"],
  ["7", "𝟕𝟟𝟩𝟳𝟽🄈⓻𐓒➐７⁷⑦₇❼➆⑺⒎"],
  ["8", "𐌚🄉➑⓼８𝟠𝟪৪⁸₈𝟴➇⑧❽𝟾𝟖⑻⒏"],
  ["9", "൭Ꝯ𝝑𝞋𝟅🄊𝟡𝟵Ⳋ⓽➒੧৭୨９𝟫𝟿𝟗⁹₉Գ➈⑨❾⑼⒐"],
  ["a", "∂⍺ⓐ"],
  ["b", "ꮟᏏ"],
  ["c", "🝌"],
  ["d", "Ꮷ"],
  ["e", "əәⅇꬲ"],
  ["f", "ꬵꞙẝ"],
  ["g", "ᶃᶢⓖ"],
  ["h", "ꞕ৸"],
  ["i", "⍳ℹⅈ"],
  ["j", "ꭻⅉⓙ"],
  ["k", "ⓚꝁ"],
  ["l", "ⓛ"],
  ["m", "₥ᵯ"],
  ["n", "ոռח"],
  ["o", "ంಂംං"],
  ["p", "ⲣҏ℗ⓟ"],
  ["q", "ꝗ"],
  ["r", "ⓡ"],
  ["s", "ᣵⓢꜱ"],
  ["t", "ⓣ"],
  ["u", "ⓤ"],
  ["v", "∨⌄⋁ⅴ"],
  ["w", "ⓦ"],
  ["x", "᙮ⅹ"],
  ["y", "ʏỿꭚ"],
  ["z", "ⓩꮓ"],
]);

const confusableToCharacter = new Map<string, string>();
for (const [character, confusables] of characterToConfusables) {
  for (const confusable of confusables) {
    confusableToCharacter.set(confusable, character);
  }
}

function escapeCodeUnit(codeUnit: number): string {
  return `\\u${codeUnit.toString(16).padStart(4, "0")}`;
}

function toCharacterClass(ranges: readonly CodeRange[]): string {
  const body = ranges.map(([start, end]) => `${escapeCodeUnit(start)}-${escapeCodeUnit(end)}`).join("");
  return `[${body}]`;
}

const nonConfusables = /^[!-~]*$/;
const lineBreakCombiningMarks = new RegExp(toCharacterClass(LINE_BREAK_COMBINING_MARK_RANGES), "g");
const symbolWithCombiningMarks = new RegExp(
  `(${toCharacterClass(SYMBOL_LEADING_RANGES)}|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF])(${toCharacterClass(COMBINING_MARK_RANGES)}+)`,
  "g"
);

function removeConfusables(text: string): string {
  if (nonConfusables.test(text)) {
    return text;
  }
  let result = "";
  const stripped = text.normalize().replace(lineBreakCombiningMarks, "").replace(symbolWithCombiningMarks, "$1").replace(/\s/g, "");
  for (const character of stripped) {
    result += confusableToCharacter.get(character) ?? character;
  }
  return result;
}

function removeWhitespace(text: string): string {
  return text.replace(/\s/g, "");
}

function localeIncludes(text: string, search: string, comparer: Intl.Collator): boolean {
  if (search === "") return true;
  if (search.length > text.length) return false;
  for (let index = 0; index <= text.length - search.length; index++) {
    if (comparer.compare(text.substring(index, index + search.length), search) === 0) return true;
  }
  return false;
}

function matchName(name: string | undefined, cleanQuery: string, comparer: Intl.Collator, normalizedName: string | undefined): boolean {
  if (!name || !cleanQuery) return false;
  const cleanName = normalizedName ?? removeConfusables(name);
  if (localeIncludes(cleanName, cleanQuery, comparer)) return true;
  return localeIncludes(name, cleanQuery, comparer);
}

function isPrefixMatch(name: string | undefined, cleanQuery: string, comparer: Intl.Collator): boolean {
  if (!name || !cleanQuery) return false;
  return comparer.compare(name.substring(0, cleanQuery.length), cleanQuery) === 0;
}

function withNormalizedNames(entries: IndexEntry[]): IndexEntry[] {
  for (const entry of entries) {
    entry.normalized = entry.name ? removeConfusables(entry.name) : "";
  }
  return entries;
}

let indexedFriends: IndexEntry[] = [];
let indexedAvatars: IndexEntry[] = [];
let indexedWorlds: IndexEntry[] = [];
let indexedGroups: IndexEntry[] = [];
let indexedFavAvatars: IndexEntry[] = [];
let indexedFavWorlds: IndexEntry[] = [];

function updateIndex(payload: IndexPayload) {
  if (payload.friends) indexedFriends = withNormalizedNames(payload.friends);
  if (payload.avatars) indexedAvatars = withNormalizedNames(payload.avatars);
  if (payload.worlds) indexedWorlds = withNormalizedNames(payload.worlds);
  if (payload.groups) indexedGroups = withNormalizedNames(payload.groups);
  if (payload.favAvatars) indexedFavAvatars = withNormalizedNames(payload.favAvatars);
  if (payload.favWorlds) indexedFavWorlds = withNormalizedNames(payload.favWorlds);
}

type SortableResult = { name: string | undefined };

function sortAndLimit<Result extends SortableResult>(results: Result[], cleanQuery: string, comparer: Intl.Collator, limit: number): Result[] {
  const prefixMatches = new Set(results.filter((result) => isPrefixMatch(result.name, cleanQuery, comparer)));
  results.sort((a, b) => {
    const isPrefixA = prefixMatches.has(a);
    const isPrefixB = prefixMatches.has(b);
    if (isPrefixA && !isPrefixB) return -1;
    if (isPrefixB && !isPrefixA) return 1;
    return comparer.compare(String(a.name), String(b.name));
  });
  if (results.length > limit) results.length = limit;
  return results;
}

function matchFriendField(entry: IndexEntry, query: string, cleanQuery: string, comparer: Intl.Collator): FriendMatchField | undefined {
  if (matchName(entry.name, cleanQuery, comparer, entry.normalized)) return "name";
  if (entry.memo && query.length >= 2 && localeIncludes(entry.memo, query, comparer)) return "memo";
  if (entry.note && query.length >= 2 && localeIncludes(entry.note, query, comparer)) return "note";
  return undefined;
}

function searchFriends(query: string, cleanQuery: string, comparer: Intl.Collator, limit = 10): FriendSearchResult[] {
  const results: FriendSearchResult[] = [];
  for (const entry of indexedFriends) {
    const matchedField = matchFriendField(entry, query, cleanQuery, comparer);
    if (matchedField) {
      results.push({
        id: entry.id,
        name: entry.name,
        type: "friend",
        imageUrl: entry.imageUrl,
        memo: entry.memo ?? "",
        note: entry.note ?? "",
        matchedField,
      });
    }
  }
  return sortAndLimit(results, cleanQuery, comparer, limit);
}

function searchItems(
  cleanQuery: string,
  items: IndexEntry[],
  type: ItemType,
  comparer: Intl.Collator,
  ownerKey: "authorId" | "ownerId" | undefined,
  ownerId: string | undefined,
  limit = 10
): ItemSearchResult[] {
  const results: ItemSearchResult[] = [];
  for (const entry of items) {
    if (!entry.name) continue;
    if (ownerId && ownerKey && entry[ownerKey] !== ownerId) continue;
    if (matchName(entry.name, cleanQuery, comparer, entry.normalized)) {
      results.push({
        id: entry.id,
        name: entry.name,
        type,
        imageUrl: entry.imageUrl,
      });
    }
  }
  return sortAndLimit(results, cleanQuery, comparer, limit);
}

function postSearchResult(payload: SearchWorkerResponse["payload"]) {
  self.postMessage({ type: "searchResult", payload });
}

function handleSearch({ seq, query, currentUserId, language }: SearchRequest) {
  if (query.length < 1) {
    postSearchResult({
      seq,
      friends: [],
      ownAvatars: [],
      favAvatars: [],
      ownWorlds: [],
      favWorlds: [],
      ownGroups: [],
      joinedGroups: [],
    });
    return;
  }

  const locale = language === undefined || language === "" ? "en" : language;
  const comparer = new Intl.Collator(locale.replace("_", "-"), {
    usage: "search",
    sensitivity: "base",
  });

  const cleanQuery = removeWhitespace(query);

  const friends = searchFriends(query, cleanQuery, comparer);
  const ownAvatars = searchItems(cleanQuery, indexedAvatars, "avatar", comparer, "authorId", currentUserId);
  const favAvatars = searchItems(cleanQuery, indexedFavAvatars, "avatar", comparer, undefined, undefined);
  const ownWorlds = searchItems(cleanQuery, indexedWorlds, "world", comparer, "authorId", currentUserId);
  const favWorlds = searchItems(cleanQuery, indexedFavWorlds, "world", comparer, undefined, undefined);
  const ownGroups = searchItems(cleanQuery, indexedGroups, "group", comparer, "ownerId", currentUserId);
  const joinedGroups = searchItems(cleanQuery, indexedGroups, "group", comparer, undefined, undefined);

  const ownAvatarIds = new Set(ownAvatars.map((result) => result.id));
  const dedupedFavAvatars = favAvatars.filter((result) => !ownAvatarIds.has(result.id));
  const ownWorldIds = new Set(ownWorlds.map((result) => result.id));
  const dedupedFavWorlds = favWorlds.filter((result) => !ownWorldIds.has(result.id));
  const ownGroupIds = new Set(ownGroups.map((result) => result.id));
  const dedupedJoinedGroups = joinedGroups.filter((result) => !ownGroupIds.has(result.id));

  postSearchResult({
    seq,
    friends,
    ownAvatars,
    favAvatars: dedupedFavAvatars,
    ownWorlds,
    favWorlds: dedupedFavWorlds,
    ownGroups,
    joinedGroups: dedupedJoinedGroups,
  });
}

self.addEventListener("message", (event) => {
  const request = parseWorkerRequest(event.data);
  switch (request.type) {
    case "updateIndex":
      updateIndex(request.payload);
      break;
    case "search":
      handleSearch(request.payload);
      break;
    case "unknown":
      console.warn("[SearchWorker] Unknown message type:", request.received);
      break;
  }
});
