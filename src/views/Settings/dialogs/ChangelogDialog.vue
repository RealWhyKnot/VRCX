<template>
  <Dialog v-model:open="changeLogDialog.visible" class="p-4!">
    <DialogContent class="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{{ t("dialog.change_log.header") }}</DialogTitle>
      </DialogHeader>
      <div class="changelog-dialog">
        <h2 v-text="changeLogDialog.buildName"></h2>
        <VueShowdown
          class="changelog-markdown mt-2 h-[62vh] overflow-y-auto"
          :markdown="changeLogDialog.changeLog"
          flavor="github"
          :options="showdownOptions"
          @click="handleLinkClick"
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" class="mr-2" @click="openExternalLink('https://github.com/vrcx-team/VRCX/releases')">
          {{ t("dialog.change_log.github") }}
        </Button>
        <Button @click="closeDialog">
          {{ t("dialog.change_log.close") }}
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
import Button from "@/components/ui/button/Button.vue";
import { defineAsyncComponent } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";

import { openExternalLink } from "../../../shared/utils/app-actions";
import { useVRCXUpdaterStore } from "../../../stores/vrcx-updater";

const VueShowdown = defineAsyncComponent(() => import("vue-showdown").then((module) => module.VueShowdown));

const VRCXUpdaterStore = useVRCXUpdaterStore();

const { changeLogDialog } = storeToRefs(VRCXUpdaterStore);

const { t } = useI18n();

const showdownOptions = {
  emoji: true,
  openLinksInNewWindow: false,
  simplifiedAutoLink: true,
  excludeTrailingPunctuationFromURLs: true,
  literalMidWordUnderscores: true,
  strikethrough: true,
  tables: true,
  tablesHeaderId: false,
  ghCodeBlocks: true,
  tasklists: true,
};

function closeDialog() {
  changeLogDialog.value.visible = false;
}

function handleLinkClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) {
    return;
  }
  const link = event.target.closest("a");
  if (link?.href) {
    event.preventDefault();
    event.stopPropagation();

    openExternalLink(link.href);
  }
}
</script>

<style scoped>
.changelog-dialog :global(img) {
  width: 100%;
}

.changelog-markdown :global(ul),
.changelog-markdown :global(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0 1rem;
  list-style-position: outside;
}

.changelog-markdown :global(ul) {
  list-style-type: disc;
}

.changelog-markdown :global(ol) {
  list-style-type: decimal;
}

.changelog-markdown :global(li) {
  margin: 0.25rem 0;
}

.changelog-markdown :global(h1),
.changelog-markdown :global(h2),
.changelog-markdown :global(h3),
.changelog-markdown :global(h4),
.changelog-markdown :global(h5),
.changelog-markdown :global(h6) {
  font-weight: 600;
  line-height: 1.25;
  margin: 1.25rem 0 0.5rem;
}

.changelog-markdown :global(h1) {
  font-size: 1.5rem;
}

.changelog-markdown :global(h2) {
  font-size: 1.25rem;
}

.changelog-markdown :global(h3) {
  font-size: 1.125rem;
}

.changelog-markdown :global(h4) {
  font-size: 1rem;
}

.changelog-markdown :global(h5) {
  font-size: 0.95rem;
}

.changelog-markdown :global(h6) {
  font-size: 0.9rem;
}
</style>
