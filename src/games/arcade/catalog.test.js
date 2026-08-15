import test from "node:test";
import assert from "node:assert/strict";
import { LEGAL_ARCADE_GAMES, arcadeDecades, findArcadeGameForFile } from "./catalog.js";

test("arcade catalog includes authorized 1980s and 1990s titles", () => {
  assert.ok(LEGAL_ARCADE_GAMES.length >= 12);
  assert.deepEqual(arcadeDecades(), [1980, 1990]);
  assert.ok(LEGAL_ARCADE_GAMES.every((game) => game.sourceUrl.startsWith("https://www.mamedev.org/")));
  assert.equal(LEGAL_ARCADE_GAMES.some((game) => game.genre === "Video poker"), false);
});

test("arcade catalog recognizes downloaded MAME set filenames", () => {
  assert.equal(findArcadeGameForFile("gridlee.zip")?.title, "Gridlee");
  assert.equal(findArcadeGameForFile("WRALLY.ZIP")?.title, "World Rally");
  assert.equal(findArcadeGameForFile("my-own-legal-rom.zip"), null);
});
