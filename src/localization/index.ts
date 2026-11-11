const localizedStringsUrls = import.meta.glob("./*.json", {
  eager: true,
  query: "?url",
  import: "default",
});

function isLocaleRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getLocalizedStrings(code: string): Promise<Record<string, unknown>> {
  const fallbackUrl = localizedStringsUrls["./en.json"];
  const url = localizedStringsUrls[`./${code}.json`] ?? fallbackUrl;
  if (!url) {
    return {};
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`${res.status}`);
    const data: unknown = await res.json();
    return isLocaleRecord(data) ? data : {};
  } catch {
    if (fallbackUrl && url !== fallbackUrl) {
      try {
        const res = await fetch(fallbackUrl, { signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return {};
        const data: unknown = await res.json();
        return isLocaleRecord(data) ? data : {};
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

function getLanguageName(code: string): string {
  const name: unknown = languageNames[`./${code}.json`];
  return typeof name === "string" ? name : code;
}

function resolveSystemLanguage(systemLanguage: string | null | undefined, codes: string[]): string | null {
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

export { getLanguageName, getLocalizedStrings, resolveSystemLanguage };
