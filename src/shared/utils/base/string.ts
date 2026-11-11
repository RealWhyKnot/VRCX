type Row = Record<string, unknown>;

type Comparer = {
  compare: (a: string, b: string) => number;
};

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null;
}

function escapeTag(tag: unknown): string {
  const s = String(tag);
  return s.replace(/["&'<>]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeTagRecursive<T>(obj: T): T;
function escapeTagRecursive(obj: unknown): unknown {
  if (typeof obj === "string") {
    return escapeTag(obj);
  }
  if (isRow(obj)) {
    for (const key of Object.keys(obj)) {
      obj[key] = escapeTagRecursive(obj[key]);
    }
  }
  return obj;
}

function textToHex(text: unknown): string {
  const s = String(text);
  return s
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).toUpperCase())
    .join(" ");
}

function commaNumber(num: unknown): string {
  if (!num) {
    return "0";
  }
  const numValue = Number(num);
  if (Number.isNaN(numValue)) {
    return "0";
  }
  const s = String(numValue);
  return s.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

function localeIncludes(str: string | null | undefined, search: string | null | undefined, comparer: Comparer): boolean {
  if (search === "") {
    return true;
  } else if (!str || !search) {
    return false;
  }
  if (str.length === 0) {
    return false;
  }

  if (search.length > str.length) {
    return false;
  }

  for (let i = 0; i < str.length - search.length + 1; i++) {
    const substr = str.substring(i, i + search.length);
    if (comparer.compare(substr, search) === 0) {
      return true;
    }
  }
  return false;
}

function changeLogRemoveLinks(text: string): string {
  return text.replace(/([^!])\[[^\]]+\]\([^)]+\)/g, "$1");
}

const BIO_SYMBOL_REPLACEMENTS = {
  "@": "＠",
  "#": "＃",
  $: "＄",
  "%": "％",
  "&": "＆",
  "=": "＝",
  "+": "＋",
  "/": "⁄",
  "\\": "＼",
  ";": ";",
  ":": "˸",
  ",": "‚",
  "?": "？",
  "!": "ǃ",
  '"': "＂",
  "<": "≺",
  ">": "≻",
  ".": "․",
  "^": "＾",
  "{": "｛",
  "}": "｝",
  "[": "［",
  "]": "］",
  "(": "（",
  ")": "）",
  "|": "｜",
  "*": "∗",
} satisfies Record<string, string>;

function replaceBioSymbols(text: unknown): string {
  if (typeof text !== "string") {
    return "";
  }
  let newText = text;
  for (const [asciiSymbol, fullWidthSymbol] of Object.entries(BIO_SYMBOL_REPLACEMENTS)) {
    const regex = new RegExp(fullWidthSymbol, "g");
    newText = newText.replace(regex, asciiSymbol);
  }
  return newText.replace(/ {1,}/g, " ").trimEnd();
}

function removeEmojis(text: string | null | undefined): string {
  if (!text) {
    return "";
  }
  return text
    .replace(/([✀-➿]|[-]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[‑-⛿]|\uD83E[\uDD10-\uDDFF])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export { escapeTag, escapeTagRecursive, textToHex, commaNumber, localeIncludes, changeLogRemoveLinks, replaceBioSymbols, removeEmojis };
