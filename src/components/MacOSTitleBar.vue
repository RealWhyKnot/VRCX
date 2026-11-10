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

<script setup>
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
  z-index: 9999;
  user-select: none;
  backdrop-filter: blur(20px);
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
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
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  transition: all 0.2s ease;
}

.title-bar-right {
  width: 78px;
  flex-shrink: 0;
}

:global(html:not(.dark)) .macos-title-bar {
  border-bottom-color: rgb(0 0 0 / 6%);
}

:global(html:not(.dark)) .macos-title-bar .app-title {
  color: rgb(29 29 31 / 90%);
}

:global(html.dark) .macos-title-bar {
  border-bottom-color: rgb(255 255 255 / 6%);
}

:global(html.dark) .macos-title-bar .app-title {
  color: rgb(245 245 247 / 90%);
}

.macos-title-bar:hover {
  backdrop-filter: blur(30px);
}

:global(html:not(.dark)) .macos-title-bar:hover {
  background-color: rgb(248 248 248 / 95%);
}

:global(html.dark) .macos-title-bar:hover {
  background-color: rgb(30 30 30 / 95%);
}
</style>
