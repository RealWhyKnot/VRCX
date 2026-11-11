export type Translate = (key: string, named?: Record<string, string>) => string;

export type ToastFn = {
  (message: string): unknown;
  success: (message: string) => unknown;
  error: (message: string) => unknown;
};

export type ConfirmDescriptor = {
  title: string;
  description: string;
  destructive?: boolean;
};

export type ConfirmedCommand = {
  confirm: () => ConfirmDescriptor;
  handler: (userId: string) => void | Promise<void>;
};

export type CommandEntry = string | (() => void) | ConfirmedCommand;
