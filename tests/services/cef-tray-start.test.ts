import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const MAIN_FORM = readFileSync(path.join(ROOT, "src/VRCX-Cef/Cef/MainForm.cs"), "utf8");
const THEMER = readFileSync(path.join(ROOT, "src/VRCX-Cef/Cef/WinformThemer.cs"), "utf8");
const SHOWING_CALLS = [/\bShow\(\)/, /\bActivate\(\)/, /\bFocus\(\)/, /Visible\s*=\s*true/, /\bWindowState\s*=/, /BringToFront\(\)/];

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

function trayStartBlock(): string {
  return memberBody(memberBody(MAIN_FORM, "public MainForm()"), "if (_startsInTray)");
}

describe("starting to the tray", () => {
  test("only holds the window back for a --startup launch with start minimized and close to tray both on", () => {
    expect(MAIN_FORM).toMatch(
      /_startsInTray = StartupArgs\.LaunchArguments\.IsStartup &&\s*ReadStoredFlag\("VRCX_StartAsMinimizedState"\) &&\s*ReadStoredFlag\("VRCX_CloseToTray"\);/
    );
    expect(MAIN_FORM).toContain("private bool IsHeldInTray => _startsInTray && !_isShowRequested;");
  });

  test("refuses the show from Application.Run while held, and passes every other visibility change through", () => {
    const body = memberBody(MAIN_FORM, "protected override void SetVisibleCore(bool value)");
    expect(body).toMatch(/if \(value && IsHeldInTray\)\s*\{\s*return;\s*\}\s*base\.SetVisibleCore\(value\);/);
  });

  test("creates the browser handle while hidden so CEF, IPC and the page run before the window is opened", () => {
    expect(trayStartBlock()).toContain("_ = Browser.Handle;");
  });

  test("never shows, activates, focuses or resizes the window before the user asks", () => {
    const constructor = memberBody(MAIN_FORM, "public MainForm()");
    for (const call of SHOWING_CALLS) {
      expect(constructor).not.toMatch(call);
    }
    const load = memberBody(MAIN_FORM, "private void MainForm_Load(object sender, EventArgs e)");
    expect(load).not.toMatch(/\bHide\b/);
    expect(load).not.toContain("BeginInvoke");
  });

  test("shows and activates the window only from Focus_Window, after marking the show as requested", () => {
    const focusWindow = memberBody(MAIN_FORM, "public void Focus_Window()");
    const requested = focusWindow.indexOf("_isShowRequested = true;");
    expect(requested).toBeGreaterThanOrEqual(0);
    expect(requested).toBeLessThan(focusWindow.indexOf("Show();"));
    expect(focusWindow).toContain("Activate();");
    expect(focusWindow).toContain("_requestHandler.ResumeIfReloadingStopped(Browser);");
    const outsideFocusWindow = MAIN_FORM.replace(focusWindow, "");
    expect(outsideFocusWindow).not.toMatch(/\bShow\(\)/);
    expect(outsideFocusWindow).not.toMatch(/\bActivate\(\)/);
    expect(outsideFocusWindow).not.toContain("_isShowRequested = true");
  });

  test("restores the saved bounds and window state on the first open through the normal Load path", () => {
    const load = memberBody(MAIN_FORM, "private void MainForm_Load(object sender, EventArgs e)");
    expect(load).toContain("ReadStoredBounds();");
    expect(load).toMatch(/FormWindowState state = ReadStoredWindowState\(\);\s*WindowState = state;\s*_lastWindowStateToRestore = state;/);
    expect(load).toContain("Browser.Invalidate();");
  });

  test("still minimizes a --startup launch with start minimized on and close to tray off", () => {
    const load = memberBody(MAIN_FORM, "private void MainForm_Load(object sender, EventArgs e)");
    expect(load).toMatch(
      /if \(!_startsInTray && StartupArgs\.LaunchArguments\.IsStartup && ReadStoredFlag\("VRCX_StartAsMinimizedState"\)\)\s*\{\s*WindowState = FormWindowState\.Minimized;\s*\}/
    );
  });
});

describe("saved window state while held in the tray", () => {
  test("is read at startup, so quitting from the tray saves the stored values back unchanged", () => {
    const block = trayStartBlock();
    expect(block).toContain("ReadStoredBounds();");
    expect(block).toMatch(
      /FormWindowState storedState = ReadStoredWindowState\(\);\s*if \(Enum\.IsDefined\(storedState\)\)\s*\{\s*_lastWindowStateToRestore = storedState;/
    );
  });

  test("never reads minimized back as the state to restore", () => {
    const body = memberBody(MAIN_FORM, "private FormWindowState ReadStoredWindowState()");
    expect(body).toContain("return state == FormWindowState.Minimized ? FormWindowState.Normal : state;");
  });

  test("ignores resize and move events until the window is opened", () => {
    const resize = memberBody(MAIN_FORM, "private void MainForm_Resize(object sender, EventArgs e)");
    expect(resize).toMatch(/^\{\s*if \(IsHeldInTray\)\s*\{\s*return;\s*\}/);
    const move = memberBody(MAIN_FORM, "private void MainForm_Move(object sender, EventArgs e)");
    expect(move).toMatch(/^\{\s*if \(IsHeldInTray \|\| WindowState != FormWindowState\.Normal\)\s*\{\s*return;\s*\}/);
  });
});

describe("theme while held in the tray", () => {
  test("still reaches the main window, which is not in Application.OpenForms until its first Load", () => {
    const body = memberBody(THEMER, "public static void SetGlobalTheme(int theme)");
    const added = body.indexOf("if (MainForm.Instance is { } mainForm && !forms.Contains(mainForm))");
    expect(added).toBeGreaterThanOrEqual(0);
    expect(added).toBeLessThan(body.indexOf("SetThemeToGlobal(forms);"));
  });
});
