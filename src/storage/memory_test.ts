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

  // 新規セッション作成
  const { sessionId } = await store.load(undefined);
  const data = { userId: "user123", role: "admin" };

  // データ保存
  const cookieValue = await store.save(sessionId, data);
  assertEquals(cookieValue, sessionId); // MemoryStoreはsessionIdをそのまま返す

  // データ読み込み
  const result = await store.load(sessionId);
  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("MemorySessionStore: destroy removes session", async () => {
  const store = new MemorySessionStore();

  // セッション作成と保存
  const { sessionId } = await store.load(undefined);
  await store.save(sessionId, { foo: "bar" });

  // 破棄
  await store.destroy(sessionId);

  // 破棄後は新規セッション扱い
  const result = await store.load(sessionId);
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("MemorySessionStore: expired session returns new session", async () => {
  const store = new MemorySessionStore();
  const sessionId = "expired-session";
  const data = { temp: "data" };
  const pastDate = new Date(Date.now() - 10000); // 10秒前

  await store.save(sessionId, data, pastDate);
  const result = await store.load(sessionId);

  // 期限切れなので新規セッション扱い
  assertEquals(result.isNew, true);
  assertEquals(result.data, {});
});

Deno.test("MemorySessionStore: non-expired session returns data", async () => {
  const store = new MemorySessionStore();
  const sessionId = "valid-session";
  const data = { active: true };
  const futureDate = new Date(Date.now() + 60000); // 1分後

  await store.save(sessionId, data, futureDate);
  const result = await store.load(sessionId);

  assertEquals(result.sessionId, sessionId);
  assertEquals(result.data, data);
  assertEquals(result.isNew, false);
});

Deno.test("MemorySessionStore: cleanup removes expired sessions", async () => {
  const store = new MemorySessionStore();

  // 期限切れセッション
  await store.save("expired-1", { a: 1 }, new Date(Date.now() - 10000));
  await store.save("expired-2", { b: 2 }, new Date(Date.now() - 5000));

  // 有効なセッション
  await store.save("valid-1", { c: 3 }, new Date(Date.now() + 60000));
  await store.save("no-expiry", { d: 4 }); // 期限なし

  store.cleanup();

  // 期限切れセッションは削除されている（新規扱い）
  const expired1 = await store.load("expired-1");
  assertEquals(expired1.isNew, true);

  const expired2 = await store.load("expired-2");
  assertEquals(expired2.isNew, true);

  // 有効なセッションは残っている
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
