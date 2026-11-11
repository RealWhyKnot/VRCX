<template>
  <span class="cursor-pointer" @click="openUserDialog">{{ username }}</span>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

import { queryRequest } from "../api/query-request";
import { showUserDialog } from "../coordinators/user-coordinator";

const props = withDefaults(
  defineProps<{
    userid?: string | undefined;
    location?: string | undefined;
    forceUpdateKey?: number | undefined;
    hint?: string;
  }>(),
  {
    userid: undefined,
    location: undefined,
    forceUpdateKey: undefined,
    hint: "",
  }
);

const username = ref(props.userid);

async function parse() {
  username.value = props.userid;
  if (props.hint) {
    username.value = props.hint;
  } else if (props.userid) {
    const args = await queryRequest.fetch("user.dialog", { userId: props.userid });
    if (args.json.displayName) {
      username.value = args.json.displayName;
    }
  }
}

function openUserDialog() {
  showUserDialog(props.userid);
}

watch([() => props.userid, () => props.location, () => props.forceUpdateKey], parse, { immediate: true });
</script>
