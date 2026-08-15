import test from "node:test";
import assert from "node:assert/strict";
import { isSupportedRomArchiveName, romIdForFile } from "./romVault.js";

test("ROM vault normalizes ZIP and 7-Zip filenames into stable ids", () => {
  assert.equal(romIdForFile("GRIDLEE.ZIP"), "gridlee");
  assert.equal(romIdForFile(" 3WONDERS.7z "), "3wonders");
  assert.equal(romIdForFile(" MortalKombat.zip "), "mortalkombat");
  assert.equal(romIdForFile("custom-set"), "custom-set");
});

test("ROM vault accepts ZIP and 7-Zip archives only", () => {
  assert.equal(isSupportedRomArchiveName("1942.zip"), true);
  assert.equal(isSupportedRomArchiveName("1942.7Z"), true);
  assert.equal(isSupportedRomArchiveName("__MACOSX"), false);
  assert.equal(isSupportedRomArchiveName("notes.txt"), false);
});
