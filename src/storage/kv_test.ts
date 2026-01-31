import { assertEquals, assertExists } from "@std/assert";
import { KvSessionStore } from "./kv.ts";

// テスト用KVインスタンス（インメモリ）
async function createTestKv(): Promise<Deno.Kv> {
  return await Deno.openKv(":memory:");
}

Deno.test("KvSessionStore: load with undefined cookie creates new session", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    const result = await store.load(undefined);

    assertExists(result.sessionId);
    assertEquals(result.data, {});
    assertEquals(result.isNew, true);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: load with non-existent sessionId creates new session", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    const result = await store.load("non-existent-session");

    assertExists(result.sessionId);
    assertEquals(result.data, {});
    assertEquals(result.isNew, true);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: save and load session data", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    // 新規セッション作成
    const { sessionId } = await store.load(undefined);
    const data = { userId: "user123", role: "admin" };

    // データ保存
    const cookieValue = await store.save(sessionId, data);
    assertEquals(cookieValue, sessionId); // KvStoreはsessionIdをそのまま返す

    // データ読み込み
    const result = await store.load(sessionId);
    assertEquals(result.sessionId, sessionId);
    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: destroy removes session", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    // セッション作成と保存
    const { sessionId } = await store.load(undefined);
    await store.save(sessionId, { foo: "bar" });

    // 破棄
    await store.destroy(sessionId);

    // 破棄後は新規セッション扱い
    const result = await store.load(sessionId);
    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: expired session returns new session", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    const sessionId = "expired-session";
    const data = { temp: "data" };
    const pastDate = new Date(Date.now() - 10000); // 10秒前

    await store.save(sessionId, data, pastDate);
    const result = await store.load(sessionId);

    // 期限切れなので新規セッション扱い
    assertEquals(result.isNew, true);
    assertEquals(result.data, {});
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: non-expired session returns data", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    const sessionId = "valid-session";
    const data = { active: true };
    const futureDate = new Date(Date.now() + 60000); // 1分後

    await store.save(sessionId, data, futureDate);
    const result = await store.load(sessionId);

    assertEquals(result.sessionId, sessionId);
    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: update existing session", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    const sessionId = "update-session";

    await store.save(sessionId, { count: 1 });
    await store.save(sessionId, { count: 2 });

    const result = await store.load(sessionId);
    assertEquals(result.data, { count: 2 });
    assertEquals(result.isNew, false);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: session with no expiry persists", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
    const sessionId = "persistent-session";
    const data = { persistent: true };

    await store.save(sessionId, data);
    const result = await store.load(sessionId);

    assertEquals(result.data, data);
    assertEquals(result.isNew, false);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: custom key prefix", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv, keyPrefix: ["custom", "prefix"] });

  try {
    const sessionId = "test-session";
    const data = { custom: "prefix" };

    await store.save(sessionId, data);

    // カスタムプレフィックスで保存されていることを確認
    const entry = await kv.get(["custom", "prefix", sessionId]);
    assertExists(entry.value);

    const result = await store.load(sessionId);
    assertEquals(result.data, data);
  } finally {
    kv.close();
  }
});

Deno.test("KvSessionStore: complex data types", async () => {
  const kv = await createTestKv();
  const store = new KvSessionStore({ kv });

  try {
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

    await store.save(sessionId, complexData);
    const result = await store.load(sessionId);

    assertEquals(result.data, complexData);
    assertEquals(result.isNew, false);
  } finally {
    kv.close();
  }
});
