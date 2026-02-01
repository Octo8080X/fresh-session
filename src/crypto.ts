// Security features (encryption)
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * AES-GCM encryption
 */
export async function encrypt(data: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data),
  );
  // Return iv + encrypted as base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * AES-GCM decryption
 */
export async function decrypt(
  encoded: string,
  key: CryptoKey,
): Promise<string> {
  const combined = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return decoder.decode(decrypted);
}

/**
 * Generate encryption key (AES-GCM, 256bit)
 */
export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Import key from secret string
 * @param secret String with at least 32 characters (required)
 * @throws Error if secret is less than 32 characters
 */
export async function importKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error("Secret must be at least 32 characters long");
  }
  const keyData = encoder.encode(secret.slice(0, 32));
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}
