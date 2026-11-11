export function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && "status" in error && error.status === 404;
}

export function logRejection(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}
