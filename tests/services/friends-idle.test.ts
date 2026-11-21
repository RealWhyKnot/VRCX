import { effectScope, nextTick, reactive } from "vue";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const state = reactive({ isLoggedIn: false, isFriendsLoaded: false });
vi.mock("../../src/services/watch-state", () => ({ watchState: state }));
const { prefetchAfterFriendsLoaded } = await import("../../src/services/friends-idle");
let scope: ReturnType<typeof effectScope>;

beforeEach(() => {
  scope = effectScope();
  state.isLoggedIn = false;
  state.isFriendsLoaded = false;
});

afterEach(() => {
  scope.stop();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("cancels stale idle work on logout and disposal", async () => {
  const callbacks: IdleRequestCallback[] = [];
  const cancel = vi.fn();
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn((callback: IdleRequestCallback) => callbacks.push(callback))
  );
  vi.stubGlobal("cancelIdleCallback", cancel);
  const load = vi.fn(() => Promise.resolve());
  scope.run(() => prefetchAfterFriendsLoaded(load, vi.fn()));
  state.isLoggedIn = true;
  state.isFriendsLoaded = true;
  await nextTick();
  expect(load).not.toHaveBeenCalled();
  state.isLoggedIn = false;
  await nextTick();
  callbacks[0]?.({ didTimeout: false, timeRemaining: () => 50 });
  expect(cancel).toHaveBeenCalledWith(1);
  expect(load).not.toHaveBeenCalled();
  state.isLoggedIn = true;
  await nextTick();
  scope.stop();
  callbacks[1]?.({ didTimeout: false, timeRemaining: () => 50 });
  expect(load).not.toHaveBeenCalled();
});

test("yields to a timer when idle callbacks are unavailable and reports failure", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("requestIdleCallback", undefined);
  const error = new Error("read failed");
  const load = vi.fn(() => Promise.reject(error));
  const onError = vi.fn();
  scope.run(() => prefetchAfterFriendsLoaded(load, onError));
  state.isLoggedIn = true;
  await nextTick();
  await vi.runAllTimersAsync();
  expect(load).not.toHaveBeenCalled();
  state.isFriendsLoaded = true;
  await nextTick();
  expect(load).not.toHaveBeenCalled();
  await vi.runAllTimersAsync();
  expect(load).toHaveBeenCalledOnce();
  expect(onError).toHaveBeenCalledWith(error);
});
