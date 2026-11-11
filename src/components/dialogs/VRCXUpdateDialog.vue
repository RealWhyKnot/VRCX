<template>
  <Dialog v-model:open="VRCXUpdateDialog.visible">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ t("dialog.vrcx_updater.header") }}</DialogTitle>
      </DialogHeader>
      <div class="mt-4">
        <template v-if="updateInProgress">
          <Progress :model-value="updateProgress" class="w-full" />
          <div class="mt-2 text-xs" v-text="updateProgressText()"></div>
          <br />
        </template>
        <template v-else>
          <div v-if="VRCXUpdateDialog.updatePending" style="margin-bottom: 16px">
            <span>{{ pendingVRCXInstall }}</span>
            <br />
            <span>{{ t("dialog.vrcx_updater.ready_for_update") }}</span>
          </div>
          <Tabs :model-value="branch" class="w-full" @update:model-value="handleBranchChange">
            <TabsList class="grid w-full grid-cols-2">
              <TabsTrigger value="Stable">{{ t("dialog.vrcx_updater.branch_stable") }}</TabsTrigger>
              <TabsTrigger value="Nightly">{{ t("dialog.vrcx_updater.branch_nightly") }}</TabsTrigger>
            </TabsList>
            <TabsContent value="Nightly">
              <Alert variant="destructive">
                <AlertCircle class="text-muted-foreground" />
                <AlertTitle>{{ t("dialog.vrcx_updater.nightly_title") }}</AlertTitle>
                <AlertDescription>
                  {{ t("dialog.vrcx_updater.nightly_notice") }}
                </AlertDescription>
              </Alert>
            </TabsContent>
          </Tabs>
          <FieldGroup class="mt-3">
            <Field>
              <FieldLabel>{{ t("dialog.vrcx_updater.release") }}</FieldLabel>
              <FieldContent>
                <Select :model-value="VRCXUpdateDialog.release" @update:model-value="(v) => (VRCXUpdateDialog.release = v)">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="item in VRCXUpdateDialog.releases" :key="item.name" :value="item.name">
                      {{ item.tag_name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>
          </FieldGroup>
          <div v-if="!VRCXUpdateDialog.updatePending && VRCXUpdateDialog.release === appVersion" class="mt-3 text-xs text-muted-foreground">
            <span>{{ t("dialog.vrcx_updater.latest_version") }}</span>
          </div>
        </template>
      </div>

      <DialogFooter>
        <Button v-if="updateInProgress" variant="secondary" class="mr-2" @click="cancelUpdate">
          {{ t("dialog.vrcx_updater.cancel") }}
        </Button>
        <Button v-if="VRCXUpdateDialog.release !== pendingVRCXInstall" variant="default" :disabled="updateInProgress" @click="installVRCXUpdate">
          {{ t("dialog.vrcx_updater.download") }}
        </Button>
        <Button v-if="!updateInProgress && pendingVRCXInstall" variant="default" @click="restartVRCX(true)">
          {{ t("dialog.vrcx_updater.install") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from "@/components/ui/dialog/Dialog.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";
import DialogFooter from "@/components/ui/dialog/DialogFooter.vue";
import DialogHeader from "@/components/ui/dialog/DialogHeader.vue";
import DialogTitle from "@/components/ui/dialog/DialogTitle.vue";
import Field from "@/components/ui/field/Field.vue";
import FieldContent from "@/components/ui/field/FieldContent.vue";
import FieldGroup from "@/components/ui/field/FieldGroup.vue";
import FieldLabel from "@/components/ui/field/FieldLabel.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import Alert from "@/components/ui/alert/Alert.vue";
import AlertDescription from "@/components/ui/alert/AlertDescription.vue";
import AlertTitle from "@/components/ui/alert/AlertTitle.vue";
import { AlertCircle } from "lucide-vue-next";
import Button from "@/components/ui/button/Button.vue";
import Progress from "@/components/ui/progress/Progress.vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import Select from "../ui/select/Select.vue";
import SelectContent from "../ui/select/SelectContent.vue";
import SelectItem from "../ui/select/SelectItem.vue";
import SelectTrigger from "../ui/select/SelectTrigger.vue";
import SelectValue from "../ui/select/SelectValue.vue";
import { useVRCXUpdaterStore } from "../../stores/vrcx-updater";

const VRCXUpdaterStore = useVRCXUpdaterStore();

const { appVersion, branch, checkingForVRCXUpdate, VRCXUpdateDialog, pendingVRCXInstall, updateInProgress, updateProgress } = storeToRefs(VRCXUpdaterStore);
const { installVRCXUpdate, loadBranchVersions, restartVRCX, updateProgressText, cancelUpdate } = VRCXUpdaterStore;

const { t } = useI18n();

const handleBranchChange = (value) => {
  if (!value || value === branch.value) {
    return;
  }
  branch.value = value;
  loadBranchVersions();
};
</script>
