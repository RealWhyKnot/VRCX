const defaultAESKey = new TextEncoder().encode("https://github.com/pypy-vrc/VRCX");

const hexToUint8Array = (hexStr) => {
  const r = hexStr.match(/.{1,2}/g);
  if (!r) return null;
  return new Uint8Array(r.map((b) => parseInt(b, 16)));
};

const uint8ArrayToHex = (arr) => arr.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");

function stdAESKey(key) {
  const tKey = new TextEncoder().encode(key);
  let sk = tKey;
  if (tKey.length < 32) {
    sk = new Uint8Array(32);
    sk.set(tKey);
    sk.set(defaultAESKey.slice(key.length, 32), key.length);
  }
  return sk.slice(0, 32);
}

async function encrypt(plaintext, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const sharedKey = await window.crypto.subtle.importKey("raw", stdAESKey(key), { name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const cipher = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv }, sharedKey, new TextEncoder().encode(plaintext));
  const ciphertext = new Uint8Array(cipher);
  const encrypted = new Uint8Array(iv.length + ciphertext.byteLength);
  encrypted.set(iv, 0);
  encrypted.set(ciphertext, iv.length);
  return uint8ArrayToHex(encrypted);
}

async function decrypt(ciphertext, key) {
  const text = hexToUint8Array(ciphertext);
  if (!text) return "";
  const sharedKey = await window.crypto.subtle.importKey("raw", stdAESKey(key), { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
  const plaintext = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: text.slice(0, 12) }, sharedKey, text.slice(12));
  return new TextDecoder().decode(new Uint8Array(plaintext));
}

export default {
  decrypt,
  encrypt,
};

export { hexToUint8Array, uint8ArrayToHex, stdAESKey };
