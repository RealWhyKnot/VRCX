<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <TooltipWrapper side="top" :content="t('view.login.proxy_settings')">
        <Button class="rounded-full mr-2 text-xs" size="icon-sm" variant="ghost"><Settings /></Button>
      </TooltipWrapper>
    </DialogTrigger>
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("view.login.settings") }}</DialogTitle>
      </DialogHeader>
      <FieldGroup class="gap-3">
        <template v-if="!isLinux">
          <Field>
            <FieldLabel for="login-settings-proxy">{{ t("view.login.proxy_settings") }}</FieldLabel>
            <FieldContent>
              <InputGroupField
                id="login-settings-proxy"
                v-model="proxyServerLocal"
                autocomplete="off"
                name="proxy"
                :placeholder="t('prompt.proxy_settings.description')"
                clearable
              />
            </FieldContent>
          </Field>
        </template>
        <label class="inline-flex items-center gap-2 text-sm">
          <Checkbox v-model="enableCustomEndpoint" @update:model-value="handleCustomEndpointToggle" />
          <span>{{ t("view.login.field.devEndpoint") }}</span>
        </label>
        <template v-if="enableCustomEndpoint">
          <Field>
            <FieldLabel for="login-settings-endpoint">{{ t("view.login.field.endpoint") }}</FieldLabel>
            <FieldContent>
              <InputGroupField
                id="login-settings-endpoint"
                v-model="loginForm.endpoint"
                autocomplete="off"
                name="endpoint"
                :placeholder="AppDebug.endpointDomainVrchat"
                clearable
              />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel for="login-settings-websocket">{{ t("view.login.field.websocket") }}</FieldLabel>
            <FieldContent>
              <InputGroupField
                id="login-settings-websocket"
                v-model="loginForm.websocket"
                autocomplete="off"
                name="websocket"
                :placeholder="AppDebug.websocketDomainVrchat"
                clearable
              />
            </FieldContent>
          </Field>
        </template>
      </FieldGroup>
      <DialogFooter>
        <Button variant="outline" @click="saveAndRestart">{{ t("prompt.proxy_settings.restart") }}</Button>
        <Button @click="saveAndClose">{{ t("prompt.proxy_settings.close") }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup>
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import DialogTrigger from "@/components/ui/dialog/DialogTrigger.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import { computed, ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Checkbox from "@/components/ui/checkbox/Checkbox.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import { Settings } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { useAuthStore } from "../../../stores/auth";
import { useVRCXUpdaterStore } from "../../../stores/vrcx-updater";
import { useVrcxStore } from "../../../stores/vrcx";
import { AppDebug } from "../../../services/app-config";

const { loginForm, enableCustomEndpoint } = storeToRefs(useAuthStore());
const { toggleCustomEndpoint } = useAuthStore();
const vrcxStore = useVrcxStore();

const { t } = useI18n();

const open = ref(false);
const proxyServerLocal = ref("");
const isLinux = computed(() => LINUX);

watch(open, (isOpen) => {
  if (isOpen) {
    proxyServerLocal.value = vrcxStore.proxyServer || "";
  }
});

async function handleCustomEndpointToggle() {
  await toggleCustomEndpoint();
}

async function saveProxy() {
  vrcxStore.setProxyServer(proxyServerLocal.value);
  await VRCXStorage.Set("VRCX_ProxyServer", vrcxStore.proxyServer);
  await VRCXStorage.Save();
}

async function saveAndRestart() {
  await saveProxy();
  open.value = false;
  const { restartVRCX } = useVRCXUpdaterStore();
  restartVRCX(false);
}

async function saveAndClose() {
  await saveProxy();
  open.value = false;
}
</script>
