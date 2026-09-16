/**
 * Money Lock proof-of-concept.
 * Financial payloads are encrypted in the browser before storage.
 * The passphrase/PIN is never stored by Finn OS.
 *
 * NOTE: for production, prefer a strong passphrase over a short PIN.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 310_000;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function deriveKey(secret: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(secret), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMoney(payload: unknown, secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(secret, salt);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(payload)));
  return JSON.stringify({
    v: 1,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
  });
}

export async function decryptMoney<T>(ciphertext: string, secret: string): Promise<T> {
  const box = JSON.parse(ciphertext) as { v: number; salt: string; iv: string; data: string };
  if (box.v !== 1) throw new Error("Onbekende Money Lock-versie");
  const salt = base64ToBytes(box.salt);
  const iv = base64ToBytes(box.iv);
  const key = await deriveKey(secret, salt);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(box.data));
  return JSON.parse(decoder.decode(decrypted)) as T;
}
