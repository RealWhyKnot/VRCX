const registeredFrameCounts = new Set<number>();

function getFramesPerLine(frameCount: number): number {
  if (frameCount > 16) return 8;
  if (frameCount > 4) return 4;
  return 2;
}

function formatOffset(value: number): string {
  return value === 0 ? "-0" : `-${value}px`;
}

function buildEmojiKeyframes(frameCount: number): string {
  const framesPerLine = getFramesPerLine(frameCount);
  const frameSize = 1024 / framesPerLine;
  const steps: string[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const column = frame % framesPerLine;
    const row = Math.floor(frame / framesPerLine);
    steps.push(`  ${frame * (100 / frameCount)}% {\n    background-position: ${formatOffset(column * frameSize)} ${formatOffset(row * frameSize)};\n  }`);
  }
  return `@keyframes animated-emoji-${frameCount} {\n${steps.join("\n\n")}\n}\n`;
}

function ensureEmojiKeyframes(frameCount: number): void {
  if (typeof document === "undefined" || !Number.isInteger(frameCount) || frameCount < 1 || frameCount > 64 || registeredFrameCounts.has(frameCount)) {
    return;
  }
  const sheet = document.createElement("style");
  sheet.dataset["emojiKeyframes"] = String(frameCount);
  sheet.textContent = buildEmojiKeyframes(frameCount);
  document.head.append(sheet);
  registeredFrameCounts.add(frameCount);
}

export { buildEmojiKeyframes, ensureEmojiKeyframes };
