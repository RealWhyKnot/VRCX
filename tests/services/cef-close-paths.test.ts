import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

const MAIN_FORM = readSource("src/VRCX-Cef/Cef/MainForm.cs");
const APP_API = readSource("src/VRCX-Cef/AppApi/Cef/AppApiCef.cs");
const PROGRAM = readSource("src/VRCX-Cef/Program.cs");
const UPDATE = readSource("src/VRCX-Shared/Update.cs");
const STARTUP_ARGS = readSource("src/VRCX-Shared/StartupArgs.cs");
const INSTALLER = readSource("Installer/installer.nsi");

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

function nsisFunction(source: string, name: string): string {
  const start = source.indexOf(`Function ${name}`);
  expect(start, `Function ${name} is missing`).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("FunctionEnd", start));
}

function nsisSection(source: string, name: string): string {
  const start = source.indexOf(`Section "${name}"`);
  expect(start, `Section ${name} is missing`).toBeGreaterThanOrEqual(0);
  return source.slice(start, source.indexOf("SectionEnd", start));
}

function sourceFiles(directory: string, extensions: string[]): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (entry === "obj" || entry === "bin" || entry === "node_modules") {
      continue;
    }
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...sourceFiles(fullPath, extensions));
    } else if (extensions.includes(path.extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("closing the main window from outside", () => {
  test("marks only the window's own close command as the user closing it", () => {
    const body = memberBody(MAIN_FORM, "protected override void WndProc(ref Message m)");
    expect(MAIN_FORM).toContain("private const int WmSysCommand = 0x0112;");
    expect(MAIN_FORM).toContain("private const int ScClose = 0xF060;");
    expect(MAIN_FORM).toContain("private const int SysCommandMask = 0xFFF0;");
    expect(body).toMatch(/if \(m\.Msg != WmSysCommand \|\| \(\(int\)m\.WParam & SysCommandMask\) != ScClose\)\s*\{\s*base\.WndProc\(ref m\);\s*return;\s*\}/);
    expect(body).toMatch(/_isUserCloseRequested = true;\s*try\s*\{\s*base\.WndProc\(ref m\);\s*\}\s*finally\s*\{\s*_isUserCloseRequested = false;\s*\}/);
  });

  test("hides to the tray only for that close command, so a WM_CLOSE from the installer or Task Manager quits", () => {
    const body = memberBody(MAIN_FORM, "private void MainForm_FormClosing(object sender, FormClosingEventArgs e)");
    expect(body).toMatch(
      /if \(_isUserCloseRequested &&\s*e\.CloseReason == CloseReason\.UserClosing &&\s*string\.Equals\("true", VRCXStorage\.Instance\.Get\("VRCX_CloseToTray"\), StringComparison\.Ordinal\)\)\s*\{\s*e\.Cancel = true;\s*Hide\(\);\s*\}/
    );
  });

  test("keeps the main window a top-level window with its handle made in the constructor", () => {
    const constructor = memberBody(MAIN_FORM, "public MainForm()");
    expect(constructor).toContain("MainNativeWindow = NativeWindow.FromHandle(Handle);");
    expect(MAIN_FORM).not.toMatch(/HWND_MESSAGE|TopLevel\s*=\s*false|\bParent\s*=/);
  });

  test("saves and exits through one Quit path shared by the tray menu and restarts", () => {
    expect(MAIN_FORM).toContain("private void TrayMenu_Quit_Click(object sender, EventArgs e) => Quit();");
    const quit = memberBody(MAIN_FORM, "public void Quit()");
    expect(quit).toMatch(/^\{\s*SaveWindowState\(\);\s*Application\.Exit\(\);\s*\}$/);
  });
});

describe("restarting for an update", () => {
  test("quits through the main window before starting the new process, and only falls back without one", () => {
    const restart = memberBody(APP_API, "public override void RestartApplication(bool isUpgrade)");
    const quit = restart.indexOf("if (TryQuitForRestart(startInfo))");
    expect(quit).toBeGreaterThanOrEqual(0);
    expect(quit).toBeLessThan(restart.indexOf("vrcxProcess.Start();"));
    expect(restart).toMatch(/if \(TryQuitForRestart\(startInfo\)\)\s*\{\s*return;\s*\}/);
    expect(restart).toMatch(/vrcxProcess\.Start\(\);\s*Environment\.Exit\(0\);/);
  });

  test("hands the restart to Program and posts Quit to the UI thread, once", () => {
    const body = memberBody(APP_API, "private static bool TryQuitForRestart(ProcessStartInfo startInfo)");
    expect(body).toContain("MainForm.Instance is not { IsHandleCreated: true, IsDisposed: false } mainForm");
    expect(body).toMatch(/if \(!Program\.TryRequestRestart\(startInfo\)\)\s*\{\s*return true;\s*\}/);
    expect(body).toContain("mainForm.BeginInvoke(mainForm.Quit);");
    expect(body).toMatch(/catch \(InvalidOperationException ex\)[\s\S]*Program\.CancelRestartRequest\(\);\s*return false;/);
    expect(PROGRAM).toContain("Interlocked.CompareExchange(ref RestartStartInfo, startInfo, comparand: null) is null;");
  });

  test("starts the new process only after the database is closed and settings are saved", () => {
    const run = memberBody(PROGRAM, "private static void Run()");
    const restart = run.indexOf("StartRequestedRestart();");
    expect(restart).toBeGreaterThan(run.indexOf("VRCXStorage.Instance.Save();"));
    expect(restart).toBeGreaterThan(run.indexOf("SQLiteDatabase.Instance.Exit();"));
    expect(restart).toBeGreaterThan(run.indexOf("WebApi.Instance.SaveCookies();"));
    expect(restart).toBeGreaterThan(run.indexOf("CefService.Exit();"));
    expect(run.slice(restart)).toMatch(/^StartRequestedRestart\(\);\s*\}$/);
    const start = memberBody(PROGRAM, "private static void StartRequestedRestart()");
    expect(start).toMatch(/using var process = Process\.Start\(startInfo\);[\s\S]*Environment\.Exit\(0\);/);
  });

  test("waits a bounded time for the previous VRCX to exit before launching the installer", () => {
    const install = memberBody(UPDATE, "private static void InstallUpdate()");
    const wait = install.indexOf("WaitForOtherInstancesToExit(OtherInstanceExitTimeout);");
    expect(wait).toBeGreaterThan(install.indexOf("File.Move(UpdateExecutable, VrcxSetupExecutable);"));
    expect(wait).toBeLessThan(install.indexOf("vrcxProcess.Start();"));
    expect(UPDATE).toContain("OtherInstanceExitTimeout = TimeSpan.FromSeconds(15);");
    const waitBody = memberBody(UPDATE, "private static void WaitForOtherInstancesToExit(TimeSpan timeout)");
    expect(waitBody).toMatch(/if \(Environment\.TickCount64 >= deadline\)\s*\{[\s\S]*return;\s*\}/);
    const other = memberBody(UPDATE, "private static bool IsOtherInstanceRunning()");
    expect(other).toContain('Process.GetProcessesByName("VRCX")');
    expect(other).toContain("process.Id != Environment.ProcessId");
    expect(other).toContain("process.Dispose();");
  });
});

describe("finding a running VRCX without its window", () => {
  test("the second launch finds the first by process and command line, then talks over the named pipe", () => {
    const duplicate = memberBody(STARTUP_ARGS, "private static bool IsDuplicateProcessRunning(VrcxLaunchArguments launchArguments)");
    expect(duplicate).toContain('Process.GetProcessesByName("VRCX")');
    expect(duplicate).toContain("SELECT CommandLine FROM Win32_Process");
    const ipc = memberBody(STARTUP_ARGS, "private static void IPCToMain()");
    expect(ipc).toContain("new NamedPipeClientStream(");
  });

  test("no code looks VRCX up by its main window handle or title", () => {
    const files = [
      ...sourceFiles(path.join(ROOT, "src"), [".cs", ".ts"]),
      ...sourceFiles(path.join(ROOT, "build-scripts"), [".ts", ".ps1", ".mjs"]),
      path.join(ROOT, "Installer/installer.nsi"),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/MainWindowHandle|CloseMainWindow|\bFindWindow(?:Ex)?\b/);
    }
  });
});

describe("installer closing a running VRCX", () => {
  test("asks WM_CLOSE of every VRCX window with taskkill, never forcing it", () => {
    const onInit = nsisFunction(INSTALLER, ".onInit");
    expect(onInit).toContain('nsExec::ExecToStack "taskkill /IM VRCX.exe"');
    expect(onInit).not.toMatch(/taskkill[^"\n]*\/F|KillProcess|CloseProcess/i);
    expect(onInit).toMatch(/nsExec::ExecToStack "taskkill \/IM VRCX\.exe"\s*Pop \$0\s*Pop \$0/);
  });

  test("waits up to 15 seconds for VRCX to save and exit before asking again", () => {
    const onInit = nsisFunction(INSTALLER, ".onInit");
    expect(onInit).toMatch(
      /StrCpy \$2 0\s*waitForExit:\s*Sleep 500\s*nsProcess::_FindProcess "\$1"\s*Pop \$R1\s*IntOp \$2 \$2 \+ 1\s*\$\{If\} \$R1 = 0\s*\$\{AndIf\} \$2 < 30\s*Goto waitForExit\s*\$\{EndIf\}/
    );
    expect(onInit).toMatch(/\$\{EndIf\}\s*Goto loop/);
  });

  test("the uninstaller detects VRCX by process, so a window held in the tray still counts", () => {
    const uninstall = nsisSection(INSTALLER, "Uninstall");
    expect(uninstall).toMatch(/nsProcess::_FindProcess "\$1"\s*Pop \$R1\s*\$\{If\} \$R1 = 0/);
  });
});
