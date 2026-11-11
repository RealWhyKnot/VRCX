import { AppDebug } from "../../services/app-config.js";

function convertFileUrlToImageUrl(url, resolution = 128, endpointDomain = AppDebug.endpointDomain) {
  if (!url || typeof url !== "string") {
    return "";
  }

  const imagePattern = /image\/file_([a-f0-9-]+)\/(\d+)\/(\d+)\/?$/;
  const pattern = /file\/file_([a-f0-9-]+)\/(\d+)(\/file)?\/?$/;
  const match = url.match(imagePattern) || url.match(pattern);

  if (match) {
    const fileId = match[1];
    const version = match[2];
    return `${endpointDomain}/image/file_${fileId}/${version}/${resolution}`;
  }

  return url;
}

function debounce(func, delay) {
  let timer = null;
  return function (...args) {
    const context = this;
    clearTimeout(timer);
    timer = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

export { convertFileUrlToImageUrl, debounce };
