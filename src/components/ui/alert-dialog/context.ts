import type { InjectionKey, Ref } from "vue";

export const ALERT_DIALOG_OPEN_INJECTION_KEY: InjectionKey<Ref<boolean>> = Symbol("vrcx-alert-dialog-open");
