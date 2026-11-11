import { ensureEmojiKeyframes, getEmojiFrameSize } from "./emoji-keyframes";

type PrintFileInfo = {
  id: string;
  authorName: string;
  createdAt?: string | number | Date | null;
  timestamp?: string | number | Date | null;
};

type EmojiFileInfo = {
  name: string;
  animationStyle: string;
  frames?: number | null;
  framesOverTime?: number | null;
  loopStyle?: string | null;
};

function getPrintFileName(print: Partial<PrintFileInfo>): string {
  const authorName = String(print.authorName);

  const createdAt = getPrintLocalDate(print);
  const fileNameDate = createdAt.toISOString().replace(/:/g, "-").replace(/T/g, "_").replace(/Z/g, "");
  const fileName = `${authorName}_${fileNameDate}_${String(print.id)}.png`;
  return fileName;
}

function getPrintLocalDate(print: Pick<PrintFileInfo, "createdAt" | "timestamp">): Date {
  if (print.createdAt) {
    const createdAt = new Date(print.createdAt);

    createdAt.setMinutes(createdAt.getMinutes() - createdAt.getTimezoneOffset());
    return createdAt;
  }
  if (print.timestamp) {
    return new Date(print.timestamp);
  }

  const createdAt = new Date();

  createdAt.setMinutes(createdAt.getMinutes() - createdAt.getTimezoneOffset());
  return createdAt;
}

function getEmojiFileName(emoji: Partial<EmojiFileInfo>): string {
  const name = String(emoji.name);
  const animationStyle = String(emoji.animationStyle);
  if (emoji.frames) {
    const loopStyle = emoji.loopStyle ?? "linear";
    return `${name}_${animationStyle}animationStyle_${emoji.frames}frames_${emoji.framesOverTime}fps_${loopStyle}loopStyle.png`;
  } else {
    return `${name}_${animationStyle}animationStyle.png`;
  }
}

function generateEmojiStyle(url: string, fps: number, frameCount: number, loopStyle: string | null | undefined, size: number): string {
  const animationDurationMs = (1000 / fps) * frameCount;
  const frameSize = getEmojiFrameSize(frameCount);
  const scale = 100 / (frameSize / size);
  const animStyle = loopStyle === "pingpong" ? "alternate" : "none";
  ensureEmojiKeyframes(frameCount);
  const style = `
            transform: scale(${scale / 100});
            transform-origin: top left;
            width: ${frameSize}px;
            height: ${frameSize}px;
            background: url('${url}') 0 0;
            animation: ${animationDurationMs}ms steps(1) 0s infinite ${animStyle} running animated-emoji-${frameCount};
        `;
  return style;
}

export { getPrintLocalDate, getPrintFileName, getEmojiFileName, generateEmojiStyle };
