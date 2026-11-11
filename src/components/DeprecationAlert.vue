<template>
  <Alert variant="warning" class="mb-4">
    <MessageSquareWarning />
    <AlertTitle>{{ t("common.feature_relocated.title") }}</AlertTitle>
    <AlertDescription>
      <i18n-t keypath="common.feature_relocated.description" tag="span">
        <template #feature>
          <strong>{{ featureName }}</strong>
        </template>
      </i18n-t>
    </AlertDescription>
  </Alert>
</template>

<script setup lang="ts">
import { MessageSquareWarning } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

import Alert from "./ui/alert/Alert.vue";
import AlertDescription from "./ui/alert/AlertDescription.vue";
import AlertTitle from "./ui/alert/AlertTitle.vue";

const { t } = useI18n();

defineProps<{ featureName: string }>();
</script>
