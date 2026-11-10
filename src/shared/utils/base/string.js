function escapeTag(tag) {
  const s = String(tag);
  return s.replace(/["&'<>]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function escapeTagRecursive(obj) {
  if (typeof obj === "string") {
    return escapeTag(obj);
  }
  if (typeof obj === "object") {
    for (const key in obj) {
      obj[key] = escapeTagRecursive(obj[key]);
    }
  }
  return obj;
}

function textToHex(text) {
  const s = String(text);
  return s
    .split("")
    .map((c) => c.charCodeAt(0).toString(16).toUpperCase())
    .join(" ");
}

function commaNumber(num) {
  if (!num) {
    return "0";
  }
  const numValue = Number(num);
  if (isNaN(numValue)) {
    return "0";
  }
  const s = String(numValue);
  return s.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
}

function localeIncludes(str, search, comparer) {
  if (search === "") {
    return true;
  } else if (!str || !search) {
    return false;
  }
  const strObj = String(str);
  const searchObj = String(search);

  if (strObj.length === 0) {
    return false;
  }

  if (searchObj.length > strObj.length) {
    return false;
  }

  for (let i = 0; i < str.length - searchObj.length + 1; i++) {
    const substr = strObj.substring(i, i + searchObj.length);
    if (comparer.compare(substr, searchObj) === 0) {
      return true;
    }
  }
  return false;
}

function changeLogRemoveLinks(text) {
  return text.replace(/([^!])\[[^\]]+\]\([^)]+\)/g, "$1");
}

function replaceBioSymbols(text) {
  if (typeof text !== "string") {
    return "";
  }
  const symbolList = {
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
  };
  let newText = text;
  for (const key in symbolList) {
    const regex = new RegExp(symbolList[key], "g");
    newText = newText.replace(regex, key);
  }
  return newText.replace(/ {1,}/g, " ").trimRight();
}

function removeEmojis(text) {
  if (!text) {
    return "";
  }
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export { escapeTag, escapeTagRecursive, textToHex, commaNumber, localeIncludes, changeLogRemoveLinks, replaceBioSymbols, removeEmojis };
