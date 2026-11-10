const UPLOAD_TIMEOUT_MS = 30_000;

export function withUploadTimeout(promise) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timed out")), UPLOAD_TIMEOUT_MS))]);
}

export function readFileAsBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = reject;
    r.onabort = reject;
    r.onload = () => {
      const bytes = new Uint8Array(r.result);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      resolve(btoa(binary));
    };
    r.readAsArrayBuffer(blob);
  });
}
