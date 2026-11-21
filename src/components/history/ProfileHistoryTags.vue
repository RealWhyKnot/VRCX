<template>
  <div v-if="badges.length" class="@container flex min-w-0 items-center gap-1">
    <Badge
      v-for="(badge, index) in badges.slice(0, 3)"
      :key="badge.text"
      variant="outline"
      class="h-5 min-w-0 max-w-max flex-1 gap-1 border-muted-foreground/30 px-1.5 text-[11px] leading-none"
      :class="[badge.color, index === 2 && '@max-[12rem]:hidden']"
      :title="badge.text"
    >
      <span v-if="badge.language" class="flags inline-block shrink-0 self-center" :class="languageClass(badge.language)" />
      <Shield v-else-if="badge.isTrust" class="size-2.5 shrink-0" />
      <span class="truncate">{{ badge.text }}</span>
    </Badge>
    <template v-for="limit in [2, 3]" :key="limit">
      <span
        v-if="badges.length > limit"
        class="shrink-0 text-xs text-muted-foreground"
        :class="limit === 2 ? 'hidden @max-[12rem]:inline' : '@max-[12rem]:hidden'"
        :title="
          badges
            .slice(limit)
            .map((badge) => badge.text)
            .join(', ')
        "
        >+{{ badges.length - limit }}</span
      >
    </template>
  </div>
  <span v-else class="text-xs text-muted-foreground">{{ tags.length ? "—" : t("dialog.retained_history.cleared") }}</span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Shield } from "lucide-vue-next";
import Badge from "@/components/ui/badge/Badge.vue";
import { languageClass } from "@/shared/utils/user";
import { computeTrustLevel } from "@/shared/utils/user-transforms";
import { useUserStore } from "@/stores/user";
import type { LanguageEntry } from "@/stores/user-state";

const props = defineProps<{ tags: string[] }>();
const userStore = useUserStore();
const { t } = useI18n();
const badges = computed(() => {
  const languages: LanguageEntry[] = [];
  const snapshot = { tags: [...new Set(props.tags)], $languages: languages };
  userStore.applyUserLanguage(snapshot);
  const result: { text: string; color?: string; isTrust?: boolean; language?: string }[] = [];
  const trust = computeTrustLevel(snapshot.tags, null);
  if (trust.trustLevel !== "Visitor") result.push({ text: trust.trustLevel, color: trust.trustClass, isTrust: true });
  if (trust.isModerator) result.push({ text: t("dialog.user.tags.vrchat_team"), color: "x-tag-vip" });
  if (trust.isTroll) result.push({ text: t("view.settings.appearance.user_colors.trust_levels.nuisance"), color: "x-tag-troll" });
  if (trust.isProbableTroll) result.push({ text: t("view.favorite.avatars.almost_nuisance"), color: "x-tag-troll" });
  for (const { key, value } of snapshot.$languages) result.push({ text: `${value} (${key})`, language: key });
  return result;
});
</script>
