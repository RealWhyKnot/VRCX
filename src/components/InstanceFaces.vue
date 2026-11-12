<template>
  <div v-if="faces.length > 0" class="flex h-6 min-w-0 items-center -space-x-1.5 overflow-hidden" data-testid="instance-faces">
    <TooltipWrapper v-for="face in faces" :key="face.key" side="top" :content="label(face)" content-class="max-w-60 break-words">
      <button
        type="button"
        :class="['size-6 shrink-0 cursor-pointer overflow-hidden rounded-full border bg-muted p-0', face.isFriend ? 'border-green-500' : 'border-border']"
        :aria-label="label(face)"
        :data-testid="face.kind === 'known' ? 'face-known' : 'face-unknown'"
        @click="emit('pick', face)"
        @pointerenter="startPeek(face)"
        @pointerleave="stopPeek"
      >
        <img v-if="face.iconUrl" :src="face.iconUrl" alt="" loading="lazy" class="size-full object-cover" />
      </button>
    </TooltipWrapper>
    <span v-if="hiddenCount > 0" class="min-w-0 truncate pl-3 text-[11px] text-muted-foreground" data-testid="faces-hidden">+{{ hiddenCount }}</span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";

import TooltipWrapper from "@/components/ui/tooltip/TooltipWrapper.vue";
import type { FaceOwner, InstanceFace } from "@/shared/utils/instance-faces";

defineOptions({ name: "InstanceFaces" });

const PEEK_DELAY_MS = 350;

const props = defineProps<{ faces: InstanceFace[]; hiddenCount: number; owners: ReadonlyMap<string, FaceOwner> }>();
const emit = defineEmits<{ pick: [face: InstanceFace]; peek: [face: InstanceFace] }>();

const { t } = useI18n();

let peekTimer: ReturnType<typeof setTimeout> | null = null;

function stopPeek() {
  if (peekTimer !== null) {
    clearTimeout(peekTimer);
    peekTimer = null;
  }
}

function startPeek(face: InstanceFace) {
  stopPeek();
  if (face.kind === "unknown" && !props.owners.has(face.fileId)) {
    peekTimer = setTimeout(() => {
      peekTimer = null;
      emit("peek", face);
    }, PEEK_DELAY_MS);
  }
}

function label(face: InstanceFace): string {
  if (face.kind === "known") {
    return face.name || t("view.tools.instance_browser.face_open_profile");
  }
  const owner = props.owners.get(face.fileId);
  if (owner?.kind === "user") {
    return owner.name || t("view.tools.instance_browser.face_open_profile");
  }
  if (owner?.kind === "avatar") {
    return t("view.tools.instance_browser.face_is_avatar");
  }
  return t("view.tools.instance_browser.face_look_up");
}

onBeforeUnmount(stopPeek);
</script>
