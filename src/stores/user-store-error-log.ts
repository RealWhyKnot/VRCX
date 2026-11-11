export function logUserStoreError(message: string) {
  return (error: unknown) => {
    console.error(message, error);
  };
}
