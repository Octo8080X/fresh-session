import { assertEquals, assertExists } from "@std/assert";
import { MemorySessionStore } from "./memory.ts";

Deno.test("MemorySessionStore: load with undefined cookie creates new session", async () => {
  const store = new MemorySessionStore();

  const result = await store.load(undefined);

  assertExists(result.sessionId);
  assertEquals(result.data, {});
  assertEquals(result.isNew, true);
});

Deno.test("MemorySessionStore: load with non-existent sessionId creates new session", async () => {
  const store = new MemorySessionStore();

  const result = await store.load("non-existent-session");

  assertExists(result.sessionId);
  assertEquals(result.data, {});
  assertEquals(result.isNew, true);
});

Deno.test("MemorySessionStore: save and load session data", async () => {
  const store = new MemorySessionStore();

  // Create new session
  const { sessionId } = await store.load(undefined);
  const data = { userId: "user123", role: "admin" };

  // Save data
  const cookieValue = await store.save(sessionId, data);
  assertEquals(cookieValue, sessionId); // MemoryStore returns sessionId as-is

  // Load data
  const result = await store.load(sessionId);
  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("MemorySessionStore: destroy removes session", async () => {
  const store = new MemorySessionStore();

  // Create and save session
  const { sessionId } = await store.load(undefined);
  await store.save(sessionId, { foo: "bar" });

  // Destroy
  await store.destroy(sessionId);

  // After destruction, treated as new session
  const result = await store.load(sessionId);
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("MemorySessionStore: expired session returns new session", async () => {
  const store = new MemorySessionStore();
  const sessionId = "expired-session";
  const data = { temp: "data" };
  const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

  await store.save(sessionId, data, pastDate);
  const result = await store.load(sessionId);

  // Treated as new session because expired
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("MemorySessionStore: non-expired session returns data", async () => {
  const store = new MemorySessionStore();
  const sessionId = "valid-session";
  const data = { active: true };
  const futureDate = new Date(Date.now() + 60000); // 1 minute later

  await store.save(sessionId, data, futureDate);
  const result = await store.load(sessionId);

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("MemorySessionStore: cleanup removes expired sessions", async () => {
  const store = new MemorySessionStore();

  // Expired sessions
  await store.save("expired-1", { a: 1 }, new Date(Date.now() - 10000));
  await store.save("expired-2", { b: 2 }, new Date(Date.now() - 5000));

  // Valid sessions
  await store.save("valid-1", { c: 3 }, new Date(Date.now() + 60000));
  await store.save("no-expiry", { d: 4 }); // No expiry

  store.cleanup();

  // Expired sessions are deleted (treated as new)
  const expired1 = await store.load("expired-1");
  assertEquals(expired1.isNew, true);

  const expired2 = await store.load("expired-2");
  assertEquals(expired2.isNew, true);

  // Valid sessions remain
  const valid1 = await store.load("valid-1");
  assertEquals(valid1.data, { c: 3 });
  assertEquals(valid1.isNew, false);

  const noExpiry = await store.load("no-expiry");
  assertEquals(noExpiry.data, { d: 4 });
  assertEquals(noExpiry.isNew, false);
});

Deno.test("MemorySessionStore: update existing session", async () => {
  const store = new MemorySessionStore();
  const sessionId = "update-session";

  await store.save(sessionId, { count: 1 });
  await store.save(sessionId, { count: 2 });

  const result = await store.load(sessionId);
  assertEquals(result.data, { count: 2 });
  assertEquals(result.isNew, false);
});

Deno.test("MemorySessionStore: session with no expiry persists", async () => {
  const store = new MemorySessionStore();
  const sessionId = "persistent-session";
  const data = { persistent: true };

  await store.save(sessionId, data);
  const result = await store.load(sessionId);

  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});
