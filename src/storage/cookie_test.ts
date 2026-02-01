import { assertEquals, assertExists } from "@std/assert";
import { CookieSessionStore } from "./cookie.ts";

Deno.test("CookieSessionStore: load with undefined cookie creates new session", async () => {
  const store = new CookieSessionStore();

  const result = await store.load(undefined);

  assertExists(result.sessionId);
  assertEquals(result.data, {});
  assertEquals(result.isNew, true);
});

Deno.test("CookieSessionStore: save and load session data", async () => {
  const store = new CookieSessionStore();

  // Create new session
  const { sessionId } = await store.load(undefined);
  const data = { userId: "user123", role: "admin" };

  // Save data (get JSON string)
  const cookieValue = await store.save(sessionId, data);

  // Cookie value is JSON string
  const parsed = JSON.parse(cookieValue);
  assertEquals(parsed.sessionId, sessionId);
  assertEquals(parsed.data, data);

  // Load data
  const result = await store.load(cookieValue);
  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("CookieSessionStore: invalid cookie value creates new session", async () => {
  const store = new CookieSessionStore();

  // Invalid cookie value (JSON parse failure)
  const result = await store.load("invalid-cookie-value");

  assertExists(result.sessionId);
  assertEquals(result.data, {});
  assertEquals(result.isNew, true);
});

Deno.test("CookieSessionStore: expired session returns new session", async () => {
  const store = new CookieSessionStore();

  const { sessionId } = await store.load(undefined);
  const data = { temp: "data" };
  const pastDate = new Date(Date.now() - 10000); // 10 seconds ago

  const cookieValue = await store.save(sessionId, data, pastDate);
  const result = await store.load(cookieValue);

  // Treated as new session because expired
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("CookieSessionStore: non-expired session returns data", async () => {
  const store = new CookieSessionStore();

  const { sessionId } = await store.load(undefined);
  const data = { active: true };
  const futureDate = new Date(Date.now() + 60000); // 1 minute later

  const cookieValue = await store.save(sessionId, data, futureDate);
  const result = await store.load(cookieValue);

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("CookieSessionStore: update existing session", async () => {
  const store = new CookieSessionStore();

  const { sessionId } = await store.load(undefined);

  await store.save(sessionId, { count: 1 });
  const cookieValue2 = await store.save(sessionId, { count: 2 });

  const result = await store.load(cookieValue2);
  assertEquals(result.data, { count: 2 });
  assertEquals(result.isNew, false);
});

Deno.test("CookieSessionStore: destroy does nothing (cookie deletion handled by SessionManager)", async () => {
  const store = new CookieSessionStore();

  const { sessionId } = await store.load(undefined);

  // destroy does nothing (just verify no error occurs)
  await store.destroy(sessionId);
});

Deno.test("CookieSessionStore: complex data types", async () => {
  const store = new CookieSessionStore();

  const { sessionId } = await store.load(undefined);
  const complexData = {
    user: {
      id: 123,
      name: "Test User",
      roles: ["admin", "user"],
    },
    settings: {
      theme: "dark",
      notifications: true,
    },
    lastLogin: "2024-01-01T00:00:00.000Z",
  };

  const cookieValue = await store.save(sessionId, complexData);
  const result = await store.load(cookieValue);

  assertEquals(result.data, complexData);
  assertEquals(result.isNew, false);
});
