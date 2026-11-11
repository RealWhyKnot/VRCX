import { toast } from "vue-sonner";
import type { Ref } from "vue";

import { logWebRequest } from "../../services/app-config";
import { webApiService } from "../../services/webapi";
import { firstNonEmpty, readChatCompletionContent, readGoogleTranslatedText, readModelIds, readYouTubeVideoLookup } from "./advanced-helpers";
import type { YouTubeVideoLookup } from "./advanced-helpers";
import { messageOf } from "./advanced-failure-logs";

type TranslationOverrides = {
  type?: string;
  key?: string;
  endpoint?: string;
  model?: string;
  prompt?: string;
};

type FetchModelsOverrides = {
  endpoint?: string;
  key?: string;
};

export type CreateAdvancedTranslationDeps = {
  youTubeApiKey: Ref<string>;
  translationApi: Ref<boolean>;
  translationApiKey: Ref<string>;
  translationApiType: Ref<string>;
  translationApiEndpoint: Ref<string>;
  translationApiModel: Ref<string>;
  translationApiPrompt: Ref<string>;
};

export function createAdvancedTranslation(deps: CreateAdvancedTranslationDeps) {
  const { youTubeApiKey, translationApi, translationApiKey, translationApiType, translationApiEndpoint, translationApiModel, translationApiPrompt } = deps;

  async function fetchAvailableModels(overrides: FetchModelsOverrides = {}): Promise<string[]> {
    const baseURL = firstNonEmpty(overrides.endpoint, translationApiEndpoint.value);

    if (!baseURL) {
      toast.warning("Translation endpoint not configured");
      return [];
    }

    let modelsURL: string;
    try {
      const url = new URL(baseURL);
      const basePath = url.pathname.replace(/\/+$/, "");

      if (basePath.endsWith("/chat/completions")) {
        url.pathname = basePath.replace(/\/chat\/completions$/, "/models");
      } else if (basePath.endsWith("/models")) {
        url.pathname = basePath;
      } else {
        url.pathname = `${basePath}/models`;
      }

      url.search = "";
      url.hash = "";
      modelsURL = url.toString();
    } catch {
      const normalizedBaseURL = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;

      if (normalizedBaseURL.includes("/chat/completions")) {
        modelsURL = normalizedBaseURL.replace(/\/chat\/completions$/, "/models");
      } else if (normalizedBaseURL.endsWith("/models")) {
        modelsURL = normalizedBaseURL;
      } else {
        modelsURL = `${normalizedBaseURL}/models`;
      }
    }

    const keyToUse = overrides.key ?? translationApiKey.value;
    const headers = keyToUse ? { Authorization: `Bearer ${keyToUse}` } : {};

    try {
      const response = await webApiService.execute({
        url: modelsURL,
        method: "GET",
        headers,
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch models: ${response.status} - ${response.data}`);
      }

      const data: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL GET]", modelsURL, `(${response.status})`, data);

      const modelIds = readModelIds(data);
      if (modelIds) {
        return modelIds;
      }

      throw new Error("Unexpected API response format");
    } catch (error) {
      console.error("Failed to fetch models:", error);
      toast.error(`Failed to fetch models: ${messageOf(error)}`);
      return [];
    }
  }

  async function lookupYouTubeVideo(videoId: string): Promise<YouTubeVideoLookup | null> {
    if (!youTubeApiKey.value) {
      console.warn("no Youtube API key configured");
      return null;
    }
    let data: YouTubeVideoLookup | null = null;
    const apiKey = youTubeApiKey.value;
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet,contentDetails&key=${apiKey}`;
      const response = await webApiService.execute({
        url,
        method: "GET",
        headers: {
          Referer: "https://vrcx.app",
        },
      });
      const json: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL GET]", url, `(${response.status})`, json);
      if (response.status === 200) {
        const lookup = readYouTubeVideoLookup(json);
        if (!lookup) {
          throw new Error("YouTube API returned an unexpected response");
        }
        data = lookup;
      } else {
        throw new Error(`Error: ${response.data}`);
      }
    } catch {
      console.error(`YouTube video lookup failed for ${videoId}`);
    }
    return data;
  }

  async function translateText(text: string, targetLang: string, overrides?: TranslationOverrides): Promise<string | null> {
    if (!translationApi.value) {
      toast.warning("Translation API disabled");
      return null;
    }

    const provider = firstNonEmpty(overrides?.type, translationApiType.value, "google");

    if (provider === "google") {
      const keyToUse = overrides?.key ?? translationApiKey.value;
      if (!keyToUse) {
        toast.warning("No Translation API key configured");
        return null;
      }
      try {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${keyToUse}`;
        const request = {
          url,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Referer: "https://vrcx.app",
          },
          body: JSON.stringify({
            q: text,
            target: targetLang,
            format: "text",
          }),
        };
        const response = await webApiService.execute(request);
        if (response.status !== 200) {
          throw new Error(`Translation API error: ${response.status} - ${response.data}`);
        }
        const data: unknown = JSON.parse(response.data);
        logWebRequest("[EXTERNAL POST]", url, `(${response.status})`, data);
        const translated = readGoogleTranslatedText(data);
        if (translated === undefined) {
          throw new Error("Translation API returned no translated text");
        }
        return translated;
      } catch (err) {
        toast.error(`Translation failed: ${messageOf(err)}`);
        return null;
      }
    }

    const endpoint = firstNonEmpty(overrides?.endpoint, translationApiEndpoint.value, "https://api.openai.com/v1/chat/completions");
    const model = firstNonEmpty(overrides?.model, translationApiModel.value, "gpt-5.1");
    const prompt = firstNonEmpty(
      overrides?.prompt,
      translationApiPrompt.value,
      `You are a translation assistant. Translate the user message into ${targetLang}. Only return the translated text.`
    );

    if (!endpoint || !model) {
      toast.warning("Translation endpoint/model missing");
      return null;
    }

    const keyToUse = overrides?.key ?? translationApiKey.value;
    const headers = {
      "Content-Type": "application/json",
      Referer: "https://vrcx.app",
      "HTTP-Referer": "https://vrcx.app",
      "X-Title": "VRCX",
      ...(keyToUse ? { Authorization: `Bearer ${keyToUse}` } : {}),
    };

    try {
      const request = {
        url: endpoint,
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: text,
            },
          ],
        }),
      };
      const response = await webApiService.execute(request);

      if (response.status !== 200) {
        throw new Error(`Translation API error: ${response.status} - ${response.data}`);
      }

      const data: unknown = JSON.parse(response.data);
      logWebRequest("[EXTERNAL POST]", endpoint, `(${response.status})`, data);

      return readChatCompletionContent(data)?.trim() ?? null;
    } catch {
      toast.error(`Translation failed`);
      return null;
    }
  }

  return {
    fetchAvailableModels,
    lookupYouTubeVideo,
    translateText,
  };
}
