import test from "node:test";
import assert from "node:assert/strict";
import {
  SESSION_COMPATIBILITY_VERSION,
  resetIncompatibleSession,
} from "./sessionCompatibility.js";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    values,
  };
}

test("clears a room saved by an incompatible build", () => {
  const storage = memoryStorage({ canastaRoomCode: "H7QNNH" });

  assert.equal(resetIncompatibleSession(storage), true);
  assert.equal(storage.getItem("canastaRoomCode"), null);
  assert.equal(
    storage.getItem("canastaSessionCompatibility"),
    SESSION_COMPATIBILITY_VERSION,
  );
});

test("preserves rooms created by the current compatible build", () => {
  const storage = memoryStorage({
    canastaRoomCode: "NEW123",
    canastaSessionCompatibility: SESSION_COMPATIBILITY_VERSION,
  });

  assert.equal(resetIncompatibleSession(storage), false);
  assert.equal(storage.getItem("canastaRoomCode"), "NEW123");
});
