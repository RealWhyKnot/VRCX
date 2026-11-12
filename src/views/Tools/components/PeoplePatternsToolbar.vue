<template>
  <div class="mb-2 flex min-w-0 flex-col gap-2" data-testid="people-toolbar">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <Button variant="ghost" size="sm" @click="emit('back')">
        <ArrowLeft />
        {{ t("nav_tooltip.tools") }}
      </Button>
      <span class="header">{{ t("view.tools.user.people_patterns") }}</span>
      <Tabs :model-value="view" class="min-w-0 shrink-0" @update:model-value="pick">
        <TabsList>
          <TabsTrigger v-for="entry in PEOPLE_VIEWS" :key="entry" :value="entry" :data-testid="`people-tab-${entry}`">
            {{ t(`view.tools.people_patterns.tab_${entry}`) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <span class="min-w-0 flex-1"></span>
      <InputGroupSearch v-model="search" :maxlength="100" :placeholder="t('view.tools.people_patterns.search_placeholder')" class="w-[220px] shrink-0" />
      <Button size="sm" variant="outline" class="shrink-0" :disabled="isLoading" data-testid="people-refresh" @click="emit('refresh')">
        <Spinner v-if="isLoading" />
        <RefreshCw v-else />
        {{ t("view.tools.people_patterns.refresh") }}
      </Button>
    </div>
    <span class="min-w-0 truncate text-xs text-muted-foreground" :title="hint" data-testid="people-hint">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, RefreshCw } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

import Button from "@/components/ui/button/Button.vue";
import InputGroupSearch from "@/components/ui/input-group/InputGroupSearch.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import { MIN_REPEAT_PLACES, PATTERN_WINDOW_DAYS, PEOPLE_VIEWS, isPeopleView, type PeopleView } from "@/shared/utils/people-patterns";

defineOptions({ name: "PeoplePatternsToolbar" });

const props = defineProps<{ view: PeopleView; isLoading: boolean }>();
const emit = defineEmits<{ "update:view": [view: PeopleView]; refresh: []; back: [] }>();
const search = defineModel<string>("search", { required: true });

const { t } = useI18n();

const hint = computed(() => t(`view.tools.people_patterns.hint_${props.view}`, { count: MIN_REPEAT_PLACES, days: PATTERN_WINDOW_DAYS }));

function pick(value: string | number) {
  if (isPeopleView(value)) {
    emit("update:view", value);
  }
}
</script>
