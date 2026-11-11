import { computed, ref, type Ref } from "vue";
import { useIntervalFn } from "@vueuse/core";
import { wsState } from "@/services/websocket";

const GRAPH_POINTS = 60;
const WS_CANVAS_WIDTH = 48;
const WS_CANVAS_HEIGHT = 12;

export function useStatusBarSparkline(wsCanvasRef: Ref<HTMLCanvasElement | null>) {
  const msgHistory = ref<number[]>(new Array<number>(GRAPH_POINTS).fill(0));
  const msgsLastMinute = ref(0);
  let lastMsgCount = wsState.messageCount;

  useIntervalFn(() => {
    const delta = wsState.messageCount - lastMsgCount;
    lastMsgCount = wsState.messageCount;

    const arr = msgHistory.value;
    arr.shift();
    arr.push(delta);
    msgHistory.value = arr;

    msgsLastMinute.value = arr.reduce((a, b) => a + b, 0);

    drawSparkline();
  }, 1000);

  const msgsPerMinuteAvg = computed(() => Math.round(msgsLastMinute.value));

  function drawSparkline() {
    const canvas = wsCanvasRef.value;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(WS_CANVAS_WIDTH * dpr);
    canvas.height = Math.floor(WS_CANVAS_HEIGHT * dpr);
    canvas.style.width = `${WS_CANVAS_WIDTH}px`;
    canvas.style.height = `${WS_CANVAS_HEIGHT}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = WS_CANVAS_WIDTH;
    const h = WS_CANVAS_HEIGHT;
    const data = msgHistory.value;

    const fg = resolveCssColor("--foreground", "#cfd3dc");
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(...data, 1);
    const step = w / (data.length - 1);

    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - ((data[i] ?? 0) / max) * (h - 2);
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function resolveCssColor(variableName: string, fallback: string) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
    if (!value) return fallback;
    if (value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl") || value.startsWith("oklch")) {
      return value;
    }
    return `hsl(${value})`;
  }

  return { msgsPerMinuteAvg, drawSparkline };
}
