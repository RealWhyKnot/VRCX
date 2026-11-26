import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const OVERLAY_MANAGER = readSource("src/VRCX-Cef/OverlayWebSocket/OverlayManager.cs");
const STARTUP_ARGS = readSource("src/VRCX-Shared/StartupArgs.cs");
const OFF_SCREEN_BROWSER = readSource("src/VRCX-Cef/Overlay/Cef/OffScreenBrowser.cs");
const VR_CEF = readSource("src/VRCX-Cef/Overlay/Cef/VRCXVRCef.cs");
const OVERLAY_PROGRAM = readSource("src/VRCX-Cef/Overlay/Cef/OverlayProgram.cs");
const CEF_SERVICE = readSource("src/VRCX-Cef/Cef/CefService.cs");
const PROGRAM = readSource("src/VRCX-Cef/Program.cs");

function memberBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `${signature} is missing`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
    } else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(open, index + 1);
      }
    }
  }
  throw new Error(`${signature} has no closing brace`);
}

function windowsOnlyBlocks(source: string): string[] {
  const blocks: string[] = [];
  const pattern = /#if !LINUX\r?\n([\s\S]*?)#endif/g;
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}

describe("starting the overlay process from the main window", () => {
  test("checks for a running overlay and spawns one under a single lock", () => {
    expect(OVERLAY_MANAGER).toContain("private static readonly Lock StartLock = new();");
    const body = memberBody(OVERLAY_MANAGER, "public static void StartOverlay()");
    const locked = memberBody(body, "lock (StartLock)");
    expect(locked).toMatch(/OverlayServer\.IsConnected\(\) \|\|\s*\(OverlayProcess != null && !OverlayProcess\.HasExited\)/);
    expect(locked).toContain("StartOverlayProcess();");
    expect(body.replace(locked, "")).not.toContain("StartOverlayProcess();");
  });

  test("treats a second start request as routine, logged at debug", () => {
    const body = memberBody(OVERLAY_MANAGER, "public static void StartOverlay()");
    expect(body).toContain('Logger.Debug(System.Globalization.CultureInfo.InvariantCulture, "Overlay process is already running or still starting");');
    expect(OVERLAY_MANAGER).not.toContain("Overlay server already started");
  });

  test("releases the previous process handle before replacing it", () => {
    expect(memberBody(OVERLAY_MANAGER, "private static void StartOverlayProcess()")).toMatch(
      /OverlayProcess\?\.Dispose\(\);\s*OverlayProcess = Process\.Start\(startInfo\);/
    );
  });
});

describe("allowing one overlay process per user", () => {
  test("holds a per-user named mutex instead of scanning other processes", () => {
    const name = memberBody(STARTUP_ARGS, "private static string GetOverlayInstanceName()");
    expect(name).toContain("using var identity = WindowsIdentity.GetCurrent();");
    expect(name).toContain('return $"Local\\\\VRCX-Overlay-{identity.User?.Value ?? Environment.UserName}";');

    const acquire = memberBody(STARTUP_ARGS, "private static bool TryAcquireOverlayInstance()");
    expect(acquire).toContain("mutex = new Mutex(initiallyOwned: false, GetOverlayInstanceName());");
    expect(acquire).toMatch(
      /if \(!mutex\.WaitOne\(TimeSpan\.Zero\)\)\s*\{\s*return false;\s*\}\s*OverlayInstanceMutex = mutex;\s*mutex = null;\s*return true;/
    );
    expect(acquire).toMatch(/finally\s*\{\s*mutex\?\.Dispose\(\);\s*\}/);
  });

  test("treats a mutex it may not open, such as one an elevated overlay made, as held", () => {
    const acquire = memberBody(STARTUP_ARGS, "private static bool TryAcquireOverlayInstance()");
    expect(acquire).toMatch(/catch \(UnauthorizedAccessException\)\s*\{\s*return false;\s*\}/);
  });

  test("takes over a mutex left behind by an overlay that crashed", () => {
    const acquire = memberBody(STARTUP_ARGS, "private static bool TryAcquireOverlayInstance()");
    expect(acquire).toMatch(
      /catch \(AbandonedMutexException\)\s*\{\s*WasOverlayInstanceAbandoned = true;\s*OverlayInstanceMutex = mutex;\s*mutex = null;\s*return true;\s*\}/
    );
    expect(OVERLAY_PROGRAM).toMatch(/if \(StartupArgs\.WasOverlayInstanceAbandoned\)\s*\{\s*Logger\.Warn\(/);
  });

  test("exits the overlay that loses, and keeps the main instance check for everything else", () => {
    const argsCheck = memberBody(STARTUP_ARGS, "public static void ArgsCheck(string[] args)");
    expect(argsCheck).toMatch(
      /if \(!disableClosing && LaunchArguments\.IsOverlay\)\s*\{\s*if \(!TryAcquireOverlayInstance\(\)\)\s*\{[^}]*Environment\.Exit\(0\);\s*\}\s*\}\s*else if \(!disableClosing && IsDuplicateProcessRunning\(LaunchArguments\)\)\s*\{\s*IPCToMain\(\);/
    );
  });

  test("no longer looks for --overlay command lines to decide whether an overlay may run", () => {
    const scan = memberBody(STARTUP_ARGS, "private static bool IsDuplicateProcessRunning(VrcxLaunchArguments launchArguments)");
    expect(scan).not.toContain("launchArguments.IsOverlay");
    expect(scan).not.toContain("Environment.Exit");
    expect(scan).toMatch(/if \(commandLine\.Contains\(VrcxLaunchArguments\.Overlay, StringComparison\.Ordinal\)\)\s*\{\s*continue;\s*\}/);
    expect(scan).toContain("string.Equals(processArguments.ConfigDirectory, launchArguments.ConfigDirectory, StringComparison.Ordinal)");
  });

  test("releases the mutex on exit", () => {
    expect(memberBody(STARTUP_ARGS, "public static void ReleaseOverlayInstance()")).toMatch(
      /OverlayInstanceMutex\?\.Dispose\(\);\s*OverlayInstanceMutex = null;/
    );
    expect(memberBody(OVERLAY_PROGRAM, "private static void Exit()")).toMatch(/StartupArgs\.ReleaseOverlayInstance\(\);\s*Environment\.Exit\(0\);/);
  });

  test("keeps the Windows-only mutex code out of the Linux build", () => {
    const windowsOnly = windowsOnlyBlocks(STARTUP_ARGS).join("\n");
    for (const name of [
      "OverlayInstanceMutex;",
      "WasOverlayInstanceAbandoned {",
      "TryAcquireOverlayInstance()",
      "WindowsIdentity",
      "ReleaseOverlayInstance()",
    ]) {
      expect(windowsOnly, `${name} must sit inside #if !LINUX`).toContain(name);
    }
  });
});

describe("overlay logging", () => {
  test("logs overlay page console errors and warnings through NLog", () => {
    expect(OFF_SCREEN_BROWSER).toContain("private static readonly Logger Logger = LogManager.GetCurrentClassLogger();");
    const constructor = memberBody(OFF_SCREEN_BROWSER, "public OffScreenBrowser(");
    expect(constructor.indexOf("ConsoleMessage += LogConsoleMessage;")).toBeGreaterThanOrEqual(0);
    expect(constructor.indexOf("ConsoleMessage += LogConsoleMessage;")).toBeLessThan(constructor.indexOf("CreateBrowser("));

    const handler = memberBody(OFF_SCREEN_BROWSER, "private void LogConsoleMessage(object? sender, ConsoleMessageEventArgs consoleMessage)");
    expect(handler).toContain("LogSeverity.Fatal or LogSeverity.Error => LogLevel.Error,");
    expect(handler).toContain("LogSeverity.Warning => LogLevel.Warn,");
    expect(handler).toContain('Logger.Log(level, CultureInfo.InvariantCulture, "Overlay console: {0}", text);');
    expect(handler).toContain('$"{consoleMessage.Message} ({consoleMessage.Source}:{consoleMessage.Line})"');
  });

  test("collapses a console message repeated every frame into one line and a count", () => {
    const handler = memberBody(OFF_SCREEN_BROWSER, "private void LogConsoleMessage(object? sender, ConsoleMessageEventArgs consoleMessage)");
    expect(handler).toMatch(
      /if \(string\.Equals\(text, _lastConsoleMessage, StringComparison\.Ordinal\)\)\s*\{\s*_repeatedConsoleMessageCount\+\+;\s*return;\s*\}/
    );
    expect(handler).toMatch(/if \(repeatedCount > 0\)\s*\{\s*Logger\.Debug\(/);
  });

  test("guards the repeat state so console messages from several CEF threads stay consistent", () => {
    expect(OFF_SCREEN_BROWSER).toContain("private readonly Lock _consoleMessageLock = new();");
    const handler = memberBody(OFF_SCREEN_BROWSER, "private void LogConsoleMessage(object? sender, ConsoleMessageEventArgs consoleMessage)");
    const locked = memberBody(handler, "lock (_consoleMessageLock)");
    expect(locked).toContain("_repeatedConsoleMessageCount++;");
    expect(locked).toMatch(/repeatedCount = _repeatedConsoleMessageCount;\s*_lastConsoleMessage = text;\s*_repeatedConsoleMessageCount = 0;/);
    expect(locked).not.toContain("Logger.");
  });

  test("logs a failed OpenVR init once per error code, not on every retry", () => {
    const body = memberBody(VR_CEF, "private CVRSystem? InitOpenVr()");
    expect(body).toMatch(
      /if \(system == null\)\s*\{\s*if \(initError != _lastInitError\)\s*\{\s*Logger\.Warn\(CultureInfo\.InvariantCulture, "OpenVR init failed with \{0\} \(\{1\}\)[^"]*", initError, \(int\)initError\);\s*_lastInitError = initError;\s*\}\s*return null;\s*\}/
    );
    expect(body).toMatch(/_lastInitError = EVRInitError\.None;\s*_openVrActive = true;/);
  });

  test("writes the overlay CEF log next to the main cef.log in a folder that exists", () => {
    const settings = memberBody(CEF_SERVICE, "private static CefSettings CreateSettings(bool isOverlay, string userDataDir)");
    expect(settings).toMatch(/string logDirectory = Path\.Join\(Program\.AppDataDirectory, "logs"\);\s*Directory\.CreateDirectory\(logDirectory\);/);
    expect(settings).toContain('LogFile = Path.Join(logDirectory, isOverlay ? "cef.overlay.log" : "cef.log"),');
    expect(CEF_SERVICE).not.toContain("overlay/logs");
  });

  test("sends the overlay process NLog output to its own file in the same logs folder", () => {
    const configure = memberBody(PROGRAM, "private static void ConfigureLogger()");
    expect(configure).toMatch(/if \(StartupArgs\.LaunchArguments\.IsOverlay\)\s*\{\s*fileName = Path\.Join\(AppDataDirectory, "logs", "VRCX\.Overlay\.log"\);/);
    const run = memberBody(PROGRAM, "private static void Run()");
    expect(run.indexOf("ConfigureLogger();")).toBeLessThan(run.indexOf("OverlayProgram.OverlayMain();"));
  });
});
