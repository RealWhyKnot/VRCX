import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const CEF_ROOT = path.join(ROOT, "src/VRCX-Cef");

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function parseIni(text: string): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  let current: Map<string, string> | undefined;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const header = /^\[(.+)\]$/.exec(line);
    if (header?.[1]) {
      current = new Map();
      sections.set(header[1], current);
      continue;
    }
    const separator = line.indexOf("=");
    if (!current || separator < 0) {
      throw new Error(`crash_reporter.cfg line outside a section or without a value: ${line}`);
    }
    current.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return sections;
}

describe("Crashpad config", () => {
  const configText = readFileSync(path.join(CEF_ROOT, "crash_reporter.cfg"), "utf8");
  const config = parseIni(configText).get("Config");

  test("stores dumps under a VRCX folder in local app data", () => {
    expect(config?.get("AppName")).toBe("VRCX");
    expect(config?.get("ProductName")).toBe("VRCX");
  });

  test("never uploads, because it has no server URL or upload limits", () => {
    const keys = [...(config?.keys() ?? [])].map((key) => key.toLowerCase());
    expect(keys).not.toContain("serverurl");
    expect(keys).not.toContain("maxuploadsperday");
    expect(configText).not.toMatch(/https?:\/\//i);
  });

  test("keeps the local dump database bounded", () => {
    expect(Number(config?.get("MaxDatabaseSizeInMb"))).toBeGreaterThan(0);
    expect(Number(config?.get("MaxDatabaseAgeInDays"))).toBeGreaterThan(0);
  });

  test("is copied next to VRCX.exe, which the installer and zip package whole", () => {
    const project = readSource("src/VRCX-Cef/VRCX-Cef.csproj");
    expect(project).toMatch(/<None Include="crash_reporter\.cfg">\s*<CopyToOutputDirectory>(?:PreserveNewest|Always)<\/CopyToOutputDirectory>/);
    expect(project).toMatch(/<OutputPath>\.\.\\\.\.\\build\\Cef\\<\/OutputPath>/);
    expect(readSource("Installer/installer.nsi")).toMatch(/File \/r [^\n]*"\.\.\\build\\Cef\\\*\.\*"/);
  });
});

describe("VRCX.exe stack reserve", () => {
  const project = readSource("src/VRCX-Cef/VRCX-Cef.csproj");

  test("matches the 8 MB reserve of CefSharp.BrowserSubprocess.exe", () => {
    expect(project).toMatch(/<MainThreadStackReserve>8388608<\/MainThreadStackReserve>/);
  });

  test("is patched after nvpatch rewrites the executable", () => {
    const postBuild = /<Target Name="PostBuild"[\s\S]*?<\/Target>/.exec(project)?.[0] ?? "";
    const nvpatch = postBuild.indexOf("$(NvPatchAssembly)");
    const stackPatch = postBuild.indexOf(
      '<SetPeStackReserve ExecutablePath="$(ProjectDir)..\\..\\build\\Cef\\VRCX.exe" StackReserve="$(MainThreadStackReserve)" />'
    );
    expect(nvpatch).toBeGreaterThanOrEqual(0);
    expect(stackPatch).toBeGreaterThan(nvpatch);
  });
});

describe("render process crash recovery", () => {
  const handler = readSource("src/VRCX-Cef/Cef/CefCustomRequestHandler.cs");
  const policy = readSource("src/VRCX-Cef/Cef/RenderProcessCrashPolicy.cs");

  function terminatedBody(): string {
    const start = handler.indexOf("public void OnRenderProcessTerminated(");
    const end = handler.indexOf("public void ResumeIfReloadingStopped(");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    return handler.slice(start, end);
  }

  test("asks the policy before every recovery instead of reloading unconditionally", () => {
    const body = terminatedBody();
    expect(body).toContain("_crashPolicy.RecordCrash()");
    expect(body).not.toContain(".Reload()");
    expect(body).toMatch(/RenderProcessRecoveryAction\.StopReloading[\s\S]*?return;/);
  });

  test("logs the status, error code, route and crash count of each termination", () => {
    const body = terminatedBody();
    for (const field of ["{Status}", "{ErrorCode}", "{Url}", "{CrashCount}"]) {
      expect(body).toContain(field);
    }
    expect(body).toContain("RenderProcessCrashPolicy.GetLoggableUrl(currentUrl)");
  });

  test("backs off with growing delays and stops after the last one", () => {
    const delays = /RecoveryDelays =\s*\[([\s\S]*?)\];/.exec(policy)?.[1] ?? "";
    const seconds = [...delays.matchAll(/TimeSpan\.(Zero|FromSeconds\((\d+)\)|FromMinutes\((\d+)\))/g)].map((match) =>
      match[1] === "Zero" ? 0 : match[2] ? Number(match[2]) : Number(match[3]) * 60
    );
    expect(seconds[0]).toBe(0);
    expect(seconds.length).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < seconds.length; index += 1) {
      expect(seconds[index]).toBeGreaterThan(seconds[index - 1] ?? 0);
    }
    expect(policy).toMatch(/crashCount > RecoveryDelays\.Length\)\s*\{\s*return new RenderProcessRecovery\(RenderProcessRecoveryAction\.StopReloading/);
  });

  test("reloads the crashed page only once, then falls back to the feed", () => {
    expect(policy).toMatch(/crashCount == 1\s*\?\s*RenderProcessRecoveryAction\.ReloadCurrentPage\s*:\s*RenderProcessRecoveryAction\.LoadSafeRoute/);
    expect(policy).toContain('SafeRoute = "#/feed"');
  });

  test("leaves the main window and crash count alone when a popup renderer dies", () => {
    const body = terminatedBody();
    const popupGuard = body.indexOf("if (browser.IsPopup)");
    expect(popupGuard).toBeGreaterThanOrEqual(0);
    expect(popupGuard).toBeLessThan(body.indexOf("_crashPolicy.RecordCrash()"));
    expect(body.slice(popupGuard, body.indexOf("_crashPolicy.RecordCrash()"))).toMatch(/return;/);
  });

  test("brings the window back when the user opens it after reloading stopped", () => {
    const mainForm = readSource("src/VRCX-Cef/Cef/MainForm.cs");
    expect(mainForm).toContain("Activated += (_, _) => _requestHandler.ResumeIfReloadingStopped(Browser);");
    const focusWindow = /public void Focus_Window\(\)[\s\S]*?\n {4}\}/.exec(mainForm)?.[0] ?? "";
    expect(focusWindow).toContain("_requestHandler.ResumeIfReloadingStopped(Browser);");
  });
});
