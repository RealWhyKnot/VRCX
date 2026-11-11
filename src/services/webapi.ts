type WebApiOptions = {
  url: string;
  method?: string;
  uploadFilePUT?: boolean;
  fileData?: string;
  fileMIME?: string;
  fileMD5?: string;
  headers?: Record<string, string>;
  data?: unknown;
};

type LinuxWebApiResponse = {
  status: number;
  message: string;
};

function isLinuxWebApiResponse(value: unknown): value is LinuxWebApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof value.status === "number" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

class WebApiService {
  clearCookies() {
    return WebApi.ClearCookies();
  }

  getCookies() {
    return WebApi.GetCookies();
  }

  setCookies(cookie: string) {
    return WebApi.SetCookies(cookie);
  }

  async execute(options: WebApiOptions | undefined): Promise<{ status: number; data: string }> {
    if (!options) {
      throw new Error("options is required");
    }
    if (isHostLinux) {
      const requestJson = JSON.stringify(options);
      const json = await WebApi.ExecuteJson(requestJson);
      const data: unknown = JSON.parse(json);
      if (!isLinuxWebApiResponse(data)) {
        throw new Error("WebApi returned an unexpected response");
      }
      if (data.status === -1) {
        throw new Error(data.message);
      }
      return {
        status: data.status,
        data: data.message,
      };
    }

    const item = await WebApi.Execute(options);
    if (item.Item1 === -1) {
      const failure: unknown = item.Item2;
      throw failure;
    }
    return {
      status: item.Item1,
      data: item.Item2,
    };
  }
}

const self = new WebApiService();
window.webApiService = self;

export { self as webApiService, WebApiService };
