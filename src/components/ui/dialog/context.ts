import type { InjectionKey, Ref } from "vue";

export const DIALOG_OPEN_INJECTION_KEY: InjectionKey<Ref<boolean>> = Symbol("vrcx-dialog-open");
