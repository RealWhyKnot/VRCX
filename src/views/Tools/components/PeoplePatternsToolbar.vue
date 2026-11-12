<template>
  <div class="flex min-w-0 flex-col" data-testid="people-toolbar">
    <div class="ml-2 flex items-center gap-2">
      <Button variant="ghost" size="sm" class="mr-3" @click="emit('back')">
        <ArrowLeft />
        {{ t("nav_tooltip.tools") }}
      </Button>
      <span class="header">{{ t("view.tools.user.people_patterns") }}</span>
    </div>
    <TabsUnderline :model-value="view" :items="tabs" @update:model-value="pick">
      <template v-for="entry in PEOPLE_VIEWS" :key="entry" #[`label-${entry}`]>
        <span :data-testid="`people-tab-${entry}`">{{ t(`view.tools.people_patterns.tab_${entry}`) }}</span>
      </template>
    </TabsUnderline>
    <div class="mb-2 flex min-w-0 items-center justify-end gap-2">
      <InputGroupField v-model="search" :maxlength="100" :placeholder="t('view.tools.people_patterns.search_placeholder')" class="w-[220px] min-w-0" />
      <TooltipWrapper side="bottom" :content="t('view.tools.people_patterns.refresh')">
        <Button
          class="shrink-0 rounded-full"
          size="icon-sm"
          variant="ghost"
          :aria-label="t('view.tools.people_patterns.refresh')"
          :disabled="isLoading"
          data-testid="people-refresh"
          @click="emit('refresh')"
        >
          <Spinner v-if="isLoading" />
          <RefreshCw v-else />
        </Button>
      </TooltipWrapper>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, RefreshCw } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import Button from "@/components/ui/button/Button.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import TabsUnderline from "@/components/ui/tabs/TabsUnderline.vue";
import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import { PEOPLE_VIEWS, isPeopleView, type PeopleView } from "@/shared/utils/people-patterns";

defineOptions({ name: "PeoplePatternsToolbar" });

defineProps<{ view: PeopleView; isLoading: boolean }>();
const emit = defineEmits<{ "update:view": [view: PeopleView]; refresh: []; back: [] }>();
const search = defineModel<string>("search", { required: true });

const { t } = useI18n();

const tabs = computed(() => PEOPLE_VIEWS.map((entry) => ({ value: entry, label: t(`view.tools.people_patterns.tab_${entry}`) })));

function pick(value: string | number) {
  if (isPeopleView(value)) {
    emit("update:view", value);
  }
}
</script>
