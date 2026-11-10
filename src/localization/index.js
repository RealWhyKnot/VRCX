const localizedStringsUrls = import.meta.glob("./*.json", {
  eager: true,
  query: "?url",
  import: "default",
});

async function getLocalizedStrings(code) {
  const fallbackUrl = localizedStringsUrls["./en.json"];
  const url = localizedStringsUrls[`./${code}.json`] || fallbackUrl;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } catch {
    if (url !== fallbackUrl) {
      try {
        const res = await fetch(fallbackUrl);
        return await res.json();
      } catch {
        return {};
      }
    }
    return {};
  }
}

const languageNames = import.meta.glob("./*.json", {
  eager: true,
  import: "language",
});

function getLanguageName(code) {
  return String(languageNames[`./${code}.json`] ?? code);
}

function resolveSystemLanguage(systemLanguage, codes) {
  if (!systemLanguage) return null;

  if (codes.includes(systemLanguage)) {
    return systemLanguage;
  }

  const lang = systemLanguage.split("-")[0];

  if (lang === "zh") {
    const parts = systemLanguage.split("-").slice(1);
    const hasHant = parts.includes("Hant");
    const hasHans = parts.includes("Hans");
    const traditionalRegions = ["TW", "HK", "MO"];
    const hasTraditionalRegion = parts.some((p) => traditionalRegions.includes(p));

    if (hasHant || hasTraditionalRegion) {
      return codes.includes("zh-TW") ? "zh-TW" : null;
    }
    if (hasHans) {
      return codes.includes("zh-CN") ? "zh-CN" : null;
    }

    return codes.includes("zh-CN") ? "zh-CN" : null;
  }

  return codes.find((code) => code.split("-")[0] === lang) ?? null;
}

export * from "./locales";
export { getLanguageName, getLocalizedStrings, resolveSystemLanguage };
