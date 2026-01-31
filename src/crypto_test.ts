import { assertEquals, assertRejects, assertNotEquals } from "@std/assert";
import { encrypt, decrypt, generateKey, importKey } from "./crypto.ts";

Deno.test("encrypt and decrypt: basic string", async () => {
  const key = await generateKey();
  const original = "Hello, World!";

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});

Deno.test("encrypt and decrypt: empty string", async () => {
  const key = await generateKey();
  const original = "";

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});

Deno.test("encrypt and decrypt: Japanese characters", async () => {
  const key = await generateKey();
  const original = "こんにちは世界！日本語テスト";

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});

Deno.test("encrypt and decrypt: JSON data", async () => {
  const key = await generateKey();
  const data = { userId: "user123", role: "admin", settings: { theme: "dark" } };
  const original = JSON.stringify(data);

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
  assertEquals(JSON.parse(decrypted), data);
});

Deno.test("encrypt and decrypt: long string", async () => {
  const key = await generateKey();
  const original = "a".repeat(10000);

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});

Deno.test("encrypt: produces different output each time (random IV)", async () => {
  const key = await generateKey();
  const original = "Same input";

  const encrypted1 = await encrypt(original, key);
  const encrypted2 = await encrypt(original, key);

  // 同じ入力でも異なる暗号文になる（IVがランダムなため）
  assertNotEquals(encrypted1, encrypted2);

  // どちらも正しく復号できる
  assertEquals(await decrypt(encrypted1, key), original);
  assertEquals(await decrypt(encrypted2, key), original);
});

Deno.test("encrypt: output is base64 encoded", async () => {
  const key = await generateKey();
  const encrypted = await encrypt("test", key);

  // base64の文字セットのみを含む
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  assertEquals(base64Regex.test(encrypted), true);
});

Deno.test("decrypt: fails with wrong key", async () => {
  const key1 = await generateKey();
  const key2 = await generateKey();
  const original = "Secret message";

  const encrypted = await encrypt(original, key1);

  await assertRejects(
    async () => await decrypt(encrypted, key2),
    Error,
  );
});

Deno.test("decrypt: fails with corrupted data", async () => {
  const key = await generateKey();
  const original = "Secret message";

  const encrypted = await encrypt(original, key);
  const corrupted = encrypted.slice(0, -5) + "XXXXX";

  await assertRejects(
    async () => await decrypt(corrupted, key),
    Error,
  );
});

Deno.test("decrypt: fails with invalid base64", async () => {
  const key = await generateKey();

  await assertRejects(
    async () => await decrypt("not-valid-base64!!!", key),
    Error,
  );
});

Deno.test("importKey: creates key from 32+ character secret", async () => {
  const secret = "this-is-a-test-secret-key-32chars!";
  const key = await importKey(secret);

  const original = "Test message";
  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});

Deno.test("importKey: same secret produces same key", async () => {
  const secret = "this-is-a-test-secret-key-32chars!";
  const key1 = await importKey(secret);
  const key2 = await importKey(secret);

  const original = "Test message";
  const encrypted = await encrypt(original, key1);
  const decrypted = await decrypt(encrypted, key2);

  assertEquals(decrypted, original);
});

Deno.test("importKey: different secrets produce different keys", async () => {
  const secret1 = "this-is-a-test-secret-key-32chars!";
  const secret2 = "another-test-secret-key-32-chars!";
  const key1 = await importKey(secret1);
  const key2 = await importKey(secret2);

  const original = "Test message";
  const encrypted = await encrypt(original, key1);

  await assertRejects(
    async () => await decrypt(encrypted, key2),
    Error,
  );
});

Deno.test("importKey: throws error for short secret", async () => {
  const shortSecret = "too-short";

  await assertRejects(
    async () => await importKey(shortSecret),
    Error,
    "Secret must be at least 32 characters long",
  );
});

Deno.test("importKey: uses only first 32 characters", async () => {
  const secret1 = "this-is-a-test-secret-key-32chars!-extra";
  const secret2 = "this-is-a-test-secret-key-32chars!-different";
  const key1 = await importKey(secret1);
  const key2 = await importKey(secret2);

  // 最初の32文字が同じなので同じキーになる
  const original = "Test message";
  const encrypted = await encrypt(original, key1);
  const decrypted = await decrypt(encrypted, key2);

  assertEquals(decrypted, original);
});

Deno.test("generateKey: creates unique keys", async () => {
  const key1 = await generateKey();
  const key2 = await generateKey();

  const original = "Test message";
  const encrypted = await encrypt(original, key1);

  // 異なるキーでは復号できない
  await assertRejects(
    async () => await decrypt(encrypted, key2),
    Error,
  );
});

Deno.test("encrypt and decrypt: special characters", async () => {
  const key = await generateKey();
  const original = "Special: !@#$%^&*()_+-=[]{}|;':\",./<>?`~";

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});

Deno.test("encrypt and decrypt: emoji", async () => {
  const key = await generateKey();
  const original = "🎉🔐💻🚀 Emoji test! 日本語+emoji: 🇯🇵";

  const encrypted = await encrypt(original, key);
  const decrypted = await decrypt(encrypted, key);

  assertEquals(decrypted, original);
});
