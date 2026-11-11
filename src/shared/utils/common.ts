import { AppDebug } from "../../services/app-config.ts";

function convertFileUrlToImageUrl(url: unknown, resolution = 128, endpointDomain = AppDebug.endpointDomain) {
  if (!url || typeof url !== "string") {
    return "";
  }

  const imagePattern = /image\/file_([a-f0-9-]+)\/(\d+)\/(\d+)\/?$/;
  const pattern = /file\/file_([a-f0-9-]+)\/(\d+)(\/file)?\/?$/;
  const match = imagePattern.exec(url) ?? pattern.exec(url);

  if (match) {
    const fileId = match[1] ?? "";
    const version = match[2] ?? "";
    return `${endpointDomain}/image/file_${fileId}/${version}/${resolution}`;
  }

  return url;
}

function debounce<TArgs extends unknown[]>(func: (this: unknown, ...args: TArgs) => void, delay: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return function (this: unknown, ...args: TArgs) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

export { convertFileUrlToImageUrl, debounce };
