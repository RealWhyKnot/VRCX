<template>
  <div v-if="isMacOS" class="macos-title-bar">
    <div class="title-bar-content">
      <div class="traffic-lights-spacer"></div>
      <div class="title-bar-center">
        <span class="app-title">VRCX</span>
      </div>
      <div class="title-bar-right"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

const isMacOS = computed(() => {
  return navigator.platform.includes("Mac");
});

onMounted(() => {
  if (isMacOS.value) {
    const titleBar = document.querySelector(".macos-title-bar");
    if (titleBar) {
      titleBar.classList.add("draggable");
    }
  }
});
</script>

<style scoped>
.macos-title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 28px;
  z-index: var(--layer-title-bar);
  user-select: none;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid transparent;
  transition:
    background-color 0.2s ease,
    backdrop-filter 0.2s ease,
    border-bottom-color 0.2s ease;
}

.macos-title-bar.draggable {
  -webkit-app-region: drag;
}

.title-bar-content {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 12px;
}

.traffic-lights-spacer {
  width: 78px;
  flex-shrink: 0;
}

.title-bar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.app-title {
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1;
  transition: color 0.2s ease;
}

.title-bar-right {
  width: 78px;
  flex-shrink: 0;
}

.macos-title-bar:hover {
  backdrop-filter: blur(30px);
}

:root:not(.dark) .macos-title-bar {
  border-bottom-color: var(--color-title-bar-light-border);
}

:root:not(.dark) .macos-title-bar .app-title {
  color: var(--color-title-bar-light-text);
}

:root.dark .macos-title-bar {
  border-bottom-color: var(--color-title-bar-dark-border);
}

:root.dark .macos-title-bar .app-title {
  color: var(--color-title-bar-dark-text);
}

:root:not(.dark) .macos-title-bar:hover {
  background-color: var(--color-title-bar-light-hover);
}

:root.dark .macos-title-bar:hover {
  background-color: var(--color-title-bar-dark-hover);
}
</style>
