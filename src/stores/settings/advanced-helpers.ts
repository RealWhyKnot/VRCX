export type YouTubeVideoItem = {
  snippet: { title: string };
  contentDetails: { duration: string };
};

export type YouTubeVideoLookup = {
  pageInfo: { totalResults: number };
  items: YouTubeVideoItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function readField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

export function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) {
    if (value) {
      return value;
    }
  }
  return "";
}

export function readModelIds(data: unknown): string[] | null {
  const modelList = readField(data, "data");
  if (Array.isArray(modelList)) {
    const models: unknown[] = modelList;
    return models
      .map((model) => readField(model, "id"))
      .filter(isNonEmptyString)
      .sort();
  }
  if (Array.isArray(data)) {
    const models: unknown[] = data;
    return models
      .map((model) => readIdOrName(model))
      .filter(isNonEmptyString)
      .sort();
  }
  return null;
}

function readIdOrName(model: unknown): unknown {
  const id = readField(model, "id");
  if (id) {
    return id;
  }
  return readField(model, "name");
}

export function readGoogleTranslatedText(data: unknown): string | undefined {
  const translations = readField(readField(data, "data"), "translations");
  if (!Array.isArray(translations)) {
    return undefined;
  }
  const list: unknown[] = translations;
  const translatedText = readField(list[0], "translatedText");
  return typeof translatedText === "string" ? translatedText : undefined;
}

export function readChatCompletionContent(data: unknown): string | null {
  const choices = readField(data, "choices");
  if (!Array.isArray(choices)) {
    return null;
  }
  const list: unknown[] = choices;
  const content = readField(readField(list[0], "message"), "content");
  return typeof content === "string" ? content : null;
}

function readYouTubeVideoItem(item: unknown): YouTubeVideoItem | null {
  const title = readField(readField(item, "snippet"), "title");
  const duration = readField(readField(item, "contentDetails"), "duration");
  if (typeof title !== "string" || typeof duration !== "string") {
    return null;
  }
  return { snippet: { title }, contentDetails: { duration } };
}

export function readYouTubeVideoLookup(data: unknown): YouTubeVideoLookup | null {
  const rawItemsValue = readField(data, "items");
  if (!Array.isArray(rawItemsValue)) {
    return null;
  }
  const totalResults = readField(readField(data, "pageInfo"), "totalResults");
  if (typeof totalResults !== "number") {
    return null;
  }
  const rawItems: unknown[] = rawItemsValue;
  const items: YouTubeVideoItem[] = [];
  for (const rawItem of rawItems) {
    const item = readYouTubeVideoItem(rawItem);
    if (!item) {
      return null;
    }
    items.push(item);
  }
  return { pageInfo: { totalResults }, items };
}
