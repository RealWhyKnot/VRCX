<template>
  <div class="cursor-pointer align-top flex min-w-0 items-center" @click="confirm">
    <span v-if="avatarName" class="flex items-center mr-1">{{ avatarName }} <Lock v-if="avatarType && avatarType === '(own)'" class="h-4 w-4 ml-1" /></span>
    <span v-else class="flex items-center mr-1 text-muted-foreground">{{ t("dialog.user.info.unknown_avatar") }}</span>
    <TooltipWrapper v-if="avatarTags" class="min-w-0 flex-1">
      <template #content>
        <span class="block max-w-80 truncate">{{ avatarTags }}</span>
      </template>
      <span class="block truncate text-xs text-muted-foreground">{{ avatarTags }}</span>
    </TooltipWrapper>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { Lock } from "lucide-vue-next";
import { useI18n } from "vue-i18n";

import TooltipWrapper from "./ui/tooltip/TooltipWrapper.vue";
import { getAvatarName, showAvatarAuthorDialog } from "../coordinators/avatar-coordinator";
import { logFailure } from "../stores/log-failure";

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    imageurl?: string | undefined;
    userid?: string | undefined;
    hintownerid?: string | undefined;
    hintavatarname?: string | Record<string, unknown> | undefined;
    avatartags?: string[] | undefined;
  }>(),
  {
    imageurl: undefined,
    userid: undefined,
    hintownerid: undefined,
    hintavatarname: undefined,
    avatartags: undefined,
  }
);

const avatarName = ref("");
const avatarType = ref("");
const avatarTags = ref("");
let ownerId = "";

const parse = async () => {
  ownerId = "";
  avatarName.value = "";
  avatarType.value = "";
  avatarTags.value = "";

  if (!props.imageurl) {
    avatarName.value = "";
  } else if (props.hintownerid) {
    if (typeof props.hintavatarname === "string") {
      avatarName.value = props.hintavatarname;
    }
    ownerId = props.hintownerid;
  } else {
    try {
      const info = await getAvatarName(props.imageurl);
      avatarName.value = info.avatarName;
      ownerId = info.ownerId;
    } catch {
      console.error("Failed to fetch avatar name");
    }
  }

  if (typeof props.userid === "undefined" || !ownerId) {
    avatarType.value = "";
  } else if (ownerId === props.userid) {
    avatarType.value = "(own)";
  } else {
    avatarType.value = "(public)";
  }

  if (Array.isArray(props.avatartags)) {
    avatarTags.value = props.avatartags.map((tag) => tag.replace("content_", "")).join(", ");
  }
};

const confirm = () => {
  if (!props.imageurl) return;
  void showAvatarAuthorDialog(props.userid, ownerId, props.imageurl).catch(logFailure("Failed to show avatar author:"));
};

watch([() => props.imageurl, () => props.userid, () => props.avatartags], parse, { immediate: true });
</script>
