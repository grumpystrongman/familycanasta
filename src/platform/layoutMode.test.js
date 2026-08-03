import assert from "node:assert/strict";
import test from "node:test";
import {
  LAYOUT_MODES,
  readLayoutPreference,
  recommendLayoutMode,
  resolveLayoutMode,
  writeLayoutPreference,
} from "./layoutMode.js";

function memoryStorage(initialValue = null) {
  let value = initialValue;
  return {
    getItem() { return value; },
    setItem(_key, nextValue) { value = nextValue; },
  };
}

test("phones default to adaptive layout", () => {
  assert.equal(
    recommendLayoutMode({ width: 390, coarsePointer: true }),
    LAYOUT_MODES.ADAPTIVE,
  );
});

test("iPad-sized touch screens default to adaptive layout", () => {
  assert.equal(
    recommendLayoutMode({ width: 1024, coarsePointer: true }),
    LAYOUT_MODES.ADAPTIVE,
  );
  assert.equal(
    recommendLayoutMode({ width: 1366, coarsePointer: true }),
    LAYOUT_MODES.ADAPTIVE,
  );
});

test("large desktop screens preserve the classic layout", () => {
  assert.equal(
    recommendLayoutMode({ width: 1440, coarsePointer: false }),
    LAYOUT_MODES.CLASSIC,
  );
});

test("a saved player choice overrides automatic detection on usable screens", () => {
  assert.equal(
    resolveLayoutMode({ preference: LAYOUT_MODES.ADAPTIVE, width: 1440, coarsePointer: false }),
    LAYOUT_MODES.ADAPTIVE,
  );
  assert.equal(
    resolveLayoutMode({ preference: LAYOUT_MODES.CLASSIC, width: 1024, coarsePointer: true }),
    LAYOUT_MODES.CLASSIC,
  );
});

test("compact screens stay adaptive even when classic was saved elsewhere", () => {
  assert.equal(
    resolveLayoutMode({ preference: LAYOUT_MODES.CLASSIC, width: 390, coarsePointer: true }),
    LAYOUT_MODES.ADAPTIVE,
  );
});

test("layout preferences persist safely", () => {
  const storage = memoryStorage();
  assert.equal(writeLayoutPreference(LAYOUT_MODES.ADAPTIVE, storage), true);
  assert.equal(readLayoutPreference(storage), LAYOUT_MODES.ADAPTIVE);
});

test("invalid saved values are ignored", () => {
  assert.equal(readLayoutPreference(memoryStorage("wide-ish")), null);
});
