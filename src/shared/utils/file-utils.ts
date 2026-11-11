function extractFileId(s: unknown): string {
  const match = /file_[0-9A-Za-z-]+/.exec(String(s));
  return match ? match[0] : "";
}

function extractFileVersion(s: unknown): string {
  const match = /(?:\/file_[0-9A-Za-z-]+\/)([0-9]+)/gi.exec(String(s));
  return match?.[1] ?? "";
}

function extractVariantVersion(url: string | null | undefined): string {
  if (!url) {
    return "0";
  }
  try {
    const params = new URLSearchParams(new URL(url).search);
    const version = params.get("v");
    if (version) {
      return version;
    }
    return "0";
  } catch {
    return "0";
  }
}

export { extractFileId, extractFileVersion, extractVariantVersion };
