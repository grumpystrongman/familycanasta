import test from "node:test";
import assert from "node:assert/strict";
import { romIdForFile } from "./romVault.js";

test("ROM vault normalizes ZIP filenames into stable ids", () => {
  assert.equal(romIdForFile("GRIDLEE.ZIP"), "gridlee");
  assert.equal(romIdForFile(" MortalKombat.zip "), "mortalkombat");
  assert.equal(romIdForFile("custom-set"), "custom-set");
});
