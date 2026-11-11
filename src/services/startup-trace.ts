type StartupMark = { name: string; atMs: number };

const marks: StartupMark[] = [];
let isReported = false;

function markStartup(name: string): void {
  if (isReported || marks.some((mark) => mark.name === name)) {
    return;
  }
  marks.push({ name, atMs: performance.now() });
}

function startupSteps(): { name: string; atMs: number; stepMs: number }[] {
  return marks.map((mark, index) => ({
    name: mark.name,
    atMs: Math.round(mark.atMs),
    stepMs: Math.round(mark.atMs - (marks[index - 1]?.atMs ?? 0)),
  }));
}

function reportStartup(): void {
  if (isReported) {
    return;
  }
  isReported = true;
  console.info("Startup timing (ms since page load):");
  console.table(startupSteps());
}

function resetStartupTrace(): void {
  marks.length = 0;
  isReported = false;
}

export { markStartup, reportStartup, resetStartupTrace, startupSteps };
