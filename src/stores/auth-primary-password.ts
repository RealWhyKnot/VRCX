import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { CurrentUser } from "vrchat";
import type { Json } from "../types/vrcx";
import { configRepository } from "../services/config";
import { security } from "../services/security";
import type { useAdvancedSettingsStore } from "./settings/advanced";
import type { useModalStore } from "./modal";
import { logFailure } from "./log-failure";
import { getAllSavedCredentials, parseStoredCredentials, requireLoginParams, requireUser } from "./auth-credentials";
import { toCipherText, toPromptResult, type CredentialsToSave, type PrimaryPasswordDialog } from "./auth-types";

type Translate = ReturnType<typeof useI18n>["t"];

type PrimaryPasswordDeps = {
  advancedSettingsStore: ReturnType<typeof useAdvancedSettingsStore>;
  modalStore: ReturnType<typeof useModalStore>;
  t: Translate;
  credentialsToSave: Ref<CredentialsToSave | null>;
  enablePrimaryPasswordDialog: Ref<PrimaryPasswordDialog>;
  updateStoredUser: (user: Json<CurrentUser>) => Promise<void>;
};

export function createPrimaryPassword({
  advancedSettingsStore,
  modalStore,
  t,
  credentialsToSave,
  enablePrimaryPasswordDialog,
  updateStoredUser,
}: PrimaryPasswordDeps) {
  function enablePrimaryPasswordChange() {
    advancedSettingsStore.setEnablePrimaryPassword(!advancedSettingsStore.enablePrimaryPassword);

    enablePrimaryPasswordDialog.value.password = "";
    enablePrimaryPasswordDialog.value.rePassword = "";
    if (advancedSettingsStore.enablePrimaryPassword) {
      enablePrimaryPasswordDialog.value.visible = true;
    } else {
      modalStore
        .prompt({
          title: t("prompt.primary_password.header"),
          description: t("prompt.primary_password.description"),
          inputType: "password",
          pattern: /[\s\S]{1,32}/,
        })
        .then(async (result: unknown) => {
          const { ok, value } = toPromptResult(result);
          if (!ok) {
            advancedSettingsStore.setEnablePrimaryPassword(true);
            advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(true);
            return;
          }

          const savedCredentials = parseStoredCredentials(await configRepository.getString("savedCredentials", "{}"));
          for (const userId of Object.keys(savedCredentials)) {
            const entry = savedCredentials[userId];
            const loginParams = requireLoginParams(entry);
            if (!loginParams.password) continue;
            security
              .decrypt(loginParams.password, value)
              .then(async (pt) => {
                credentialsToSave.value = {
                  username: loginParams.username,
                  password: pt,
                };
                await updateStoredUser(requireUser(entry));
                await configRepository.setBool("enablePrimaryPassword", false);
              })
              .catch(() => {
                advancedSettingsStore.setEnablePrimaryPassword(true);
                advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(true);
              });
          }
        })
        .catch((err: unknown) => {
          console.error(err);
          advancedSettingsStore.setEnablePrimaryPassword(true);
          advancedSettingsStore.setEnablePrimaryPasswordConfigRepository(true);
        });
    }
  }

  async function setPrimaryPassword() {
    await configRepository.setBool("enablePrimaryPassword", advancedSettingsStore.enablePrimaryPassword);
    enablePrimaryPasswordDialog.value.visible = false;
    if (advancedSettingsStore.enablePrimaryPassword) {
      const key = enablePrimaryPasswordDialog.value.password;
      const savedCredentials = await getAllSavedCredentials();
      for (const userId of Object.keys(savedCredentials)) {
        const entry = savedCredentials[userId];
        const loginParams = requireLoginParams(entry);
        if (!loginParams.password) continue;
        security
          .encrypt(loginParams.password, key)
          .then((ct: unknown) => {
            credentialsToSave.value = {
              username: loginParams.username,
              password: toCipherText(ct),
            };
            return updateStoredUser(requireUser(entry));
          })
          .catch(logFailure("Saving the encrypted credential failed:"));
      }
    }
  }

  function checkPrimaryPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!advancedSettingsStore.enablePrimaryPassword) {
        resolve(password);
        return;
      }
      modalStore
        .prompt({
          title: t("prompt.primary_password.header"),
          description: t("prompt.primary_password.description"),
          inputType: "password",
          pattern: /[\s\S]{1,32}/,
        })
        .then((result: unknown) => {
          const { ok, value } = toPromptResult(result);
          if (!ok) {
            reject(new Error("primary password prompt cancelled"));
            return;
          }
          security.decrypt(password, value).then(resolve).catch(reject);
        })
        .catch(reject);
    });
  }

  return { enablePrimaryPasswordChange, setPrimaryPassword, checkPrimaryPassword };
}
