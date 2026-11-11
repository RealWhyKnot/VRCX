import { logFailure } from "../log-failure";

export const logSaveFailure = logFailure("Failed to save advanced setting:");
export const logActionFailure = logFailure("Advanced settings action failed:");
export const logDialogFailure = logFailure("Advanced settings dialog failed:");

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "undefined";
}
