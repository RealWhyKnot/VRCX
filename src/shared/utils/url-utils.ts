function getFaviconUrl(resource: string | null | undefined): string {
  if (!resource) {
    return "";
  }
  try {
    const url = new URL(resource);
    return `https://icons.duckduckgo.com/ip2/${url.host}.ico`;
  } catch (err) {
    console.error("Invalid URL:", resource, err);
    return "";
  }
}

function replaceVrcPackageUrl(url: string | null | undefined): string {
  if (!url) {
    return "";
  }
  return url.replace("https://api.vrchat.cloud/", "https://vrchat.com/");
}

export { getFaviconUrl, replaceVrcPackageUrl };
