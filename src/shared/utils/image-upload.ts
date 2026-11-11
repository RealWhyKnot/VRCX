const UPLOAD_TIMEOUT_MS = 30_000;

export function withUploadTimeout<T>(promise: Promise<T>) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Upload timed out")), UPLOAD_TIMEOUT_MS))]);
}

export function readFileAsBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onabort = reject;
    r.onload = () => {
      const result = r.result;
      if (!(result instanceof ArrayBuffer)) {
        reject(new Error("File read did not produce an ArrayBuffer"));
        return;
      }
      const bytes = new Uint8Array(result);
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      resolve(btoa(binary));
    };
    r.readAsArrayBuffer(blob);
  });
}
