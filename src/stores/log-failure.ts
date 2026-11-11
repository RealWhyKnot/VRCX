export function logFailure(label: string) {
  return (error: unknown) => {
    console.error(label, error);
  };
}
