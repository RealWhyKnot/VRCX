import type { ApiConfig, CurrentUser, Permission, Success, TwoFactorAuthCode, TwoFactorEmailCode, Verify2FaEmailCodeResult, Verify2FaResult } from "vrchat";
import type { Json, RequestOptions } from "../types/vrcx";
import { request } from "../services/request";
import { handleConfig } from "../coordinators/current-user-apply";

function requestObject<T extends object>(endpoint: string, options: RequestOptions): Promise<T> {
  const isResponseObject = (value: unknown): value is T => typeof value === "object" && value !== null;
  return request(endpoint, options).then((response) => {
    if (!isResponseObject(response)) {
      throw new Error(`Auth response is not an object: ${endpoint}`);
    }
    return response;
  });
}

const authRequest = {
  verifyOTP(params: TwoFactorAuthCode): Promise<{ json: Json<Verify2FaResult>; params: TwoFactorAuthCode }> {
    return requestObject<Json<Verify2FaResult>>("auth/twofactorauth/otp/verify", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  verifyTOTP(params: TwoFactorAuthCode): Promise<{ json: Json<Verify2FaResult>; params: TwoFactorAuthCode }> {
    return requestObject<Json<Verify2FaResult>>("auth/twofactorauth/totp/verify", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  verifyEmailOTP(params: TwoFactorEmailCode): Promise<{ json: Json<Verify2FaEmailCodeResult>; params: TwoFactorEmailCode }> {
    return requestObject<Json<Verify2FaEmailCodeResult>>("auth/twofactorauth/emailotp/verify", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getConfig(): Promise<{ json: Json<ApiConfig> }> {
    return requestObject<Json<ApiConfig>>("config", {
      method: "GET",
    }).then((json) => {
      const args = {
        json,
      };
      handleConfig(args);
      return args;
    });
  },

  getDeviceCode(): Promise<{
    json: { deviceCode: string; verificationUrlComplete: string; interval: number; expiresIn: number };
  }> {
    return requestObject<{ deviceCode: string; verificationUrlComplete: string; interval: number; expiresIn: number }>("auth/device/code", {
      method: "POST",
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },

  getDeviceStatus(params: { deviceCode: string }): Promise<{ json: { user?: Json<CurrentUser> }; params: { deviceCode: string } }> {
    return requestObject<{ user?: Json<CurrentUser> }>("auth/device/status", {
      method: "POST",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  resetPassword(params: { email: string }): Promise<{ json: Json<Success>; params: { email: string } }> {
    return requestObject<Json<Success>>("auth/password", {
      method: "PUT",
      params,
    }).then((json) => {
      const args = {
        json,
        params,
      };
      return args;
    });
  },

  getPermissions(): Promise<{ json: Json<Permission[]> }> {
    return requestObject<Json<Permission[]>>("auth/permissions", {
      method: "GET",
      params: { condensed: true },
    }).then((json) => {
      const args = {
        json,
      };
      return args;
    });
  },
};

export { authRequest };
