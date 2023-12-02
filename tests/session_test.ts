import { createSession } from "../src/session.ts";
import { assertEquals } from "https://deno.land/std@0.208.0/testing/asserts.ts";

Deno.test("Session", async (t) => {
  type SessionValueKeys = "KEY_A" | "KEY_B" | "KEY_C";
  type FlashValueKeys = "error" | "success";

  await t.step("get", () => {
    const { session } = createSession<SessionValueKeys, FlashValueKeys>(
      JSON.parse('{"session": {"KEY_A": 1, "KEY_B": 2, "KEY_C":"3"}}'),
    );

    assertEquals(session.get("KEY_A"), 1);
    assertEquals(session.get("KEY_B"), 2);
    assertEquals(session.get("KEY_C"), "3");
  });

  await t.step("delete", () => {
    const { session } = createSession<SessionValueKeys, FlashValueKeys>(
      JSON.parse('{"session": {"KEY_A": 1, "KEY_B": 2, "KEY_C":"3"}}'),
    );
    assertEquals(session.get("KEY_A"), 1);
    session.delete("KEY_A");
    assertEquals(session.get("KEY_A"), undefined);
  });

  await t.step("list", () => {
    const { session } = createSession<SessionValueKeys, FlashValueKeys>(
      JSON.parse('{"session": {"KEY_A": 1, "KEY_B": 2, "KEY_C":"3"}}'),
    );
    assertEquals(session.list(), { KEY_A: 1, KEY_B: 2, KEY_C: "3" });
  });

  await t.step("has", () => {
    const { session } = createSession<SessionValueKeys, FlashValueKeys>(
      JSON.parse('{"session": {"KEY_A": 1, "KEY_B": 2, "KEY_C":"3"}}'),
    );
    assertEquals(session.has("KEY_A"), true);
    session.delete("KEY_A");
    assertEquals(session.has("KEY_A"), false);
  });

  await t.step("destroy", () => {
    const { session, getDuplicateDataFunction } = createSession<
      SessionValueKeys,
      FlashValueKeys
    >(JSON.parse('{"session": {}}'));

    assertEquals(getDuplicateDataFunction().operations.doDestroy, false);
    session.destroy();
    assertEquals(getDuplicateDataFunction().operations.doDestroy, true);
  });

  await t.step("rotateKey", () => {
    const { session, getDuplicateDataFunction } = createSession<
      SessionValueKeys,
      FlashValueKeys
    >(JSON.parse('{"session": {}}'));

    assertEquals(getDuplicateDataFunction().operations.doRotateKey, false);
    session.rotateKey();
    assertEquals(getDuplicateDataFunction().operations.doRotateKey, true);
  });

  await t.step("flash", () => {
    const { session, getDuplicateDataFunction } = createSession<
      SessionValueKeys,
      FlashValueKeys
    >(JSON.parse('{"session": {}}'));

    assertEquals(session.flash("error"), undefined);
    session.flash("error", "ERROR MESSAGE");
    assertEquals(session.flash("error"), undefined);
    assertEquals(getDuplicateDataFunction().flash.error, "ERROR MESSAGE");
  });

  await t.step("flash", () => {
    const { session, getDuplicateDataFunction } = createSession<
      SessionValueKeys,
      FlashValueKeys
    >(JSON.parse('{"session": {}}'));

    assertEquals(session.flash("error"), undefined);
    session.flash("error", "ERROR MESSAGE");
    assertEquals(session.flashNow("error"), "ERROR MESSAGE");
    assertEquals(getDuplicateDataFunction().flash.error, undefined);
  });

  await t.step("clear", () => {
    const { session, getDuplicateDataFunction } = createSession<
      SessionValueKeys,
      FlashValueKeys
    >(JSON.parse('{"session": {"KEY_A": 1, "KEY_B": 2, "KEY_C":"3"}}'));

    assertEquals(getDuplicateDataFunction(), {
      session: { KEY_A: 1, KEY_B: 2, KEY_C: "3" },
      flash: {},
      operations: { doDestroy: false, doRotateKey: false },
    });

    session.clear();

    // session.set の内容が、getDuplicateDataFunction() に反映されていることを確認する
    assertEquals(getDuplicateDataFunction(), {
      session: {},
      flash: {},
      operations: { doDestroy: false, doRotateKey: false },
    });
  });

  await t.step("getDuplicateDataFunction", async () => {
    const { session, getDuplicateDataFunction } = createSession<
      SessionValueKeys,
      FlashValueKeys
    >(JSON.parse('{"session": {"KEY_A": 1, "KEY_B": 2, "KEY_C":"3"}}'));

    assertEquals(getDuplicateDataFunction(), {
      session: { KEY_A: 1, KEY_B: 2, KEY_C: "3" },
      flash: {},
      operations: { doDestroy: false, doRotateKey: false },
    });

    session.set("KEY_A", 30);

    // session.set の内容が、getDuplicateDataFunction() に反映されていることを確認する
    assertEquals(getDuplicateDataFunction(), {
      session: { KEY_A: 30, KEY_B: 2, KEY_C: "3" },
      flash: {},
      operations: { doDestroy: false, doRotateKey: false },
    });
  });
});
