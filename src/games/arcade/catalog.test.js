import test from "node:test";
import assert from "node:assert/strict";
import { ARCADE_GAMES, CURATED_ARCADE_GAMES, PERSONAL_ARCADE_GAMES, arcadeDecades, findArcadeGameForFile } from "./catalog.js";

test("arcade catalog contains only metadata for the uploaded personal collection", () => {
  assert.equal(CURATED_ARCADE_GAMES.length, 0);
  assert.equal(ARCADE_GAMES, PERSONAL_ARCADE_GAMES);
  assert.equal(PERSONAL_ARCADE_GAMES.length, 30);
  assert.deepEqual(arcadeDecades(), [1970, 1980, 1990, 2000]);
  assert.equal(ARCADE_GAMES.some((game) => game.downloadUrl || game.sourceUrl), false);
});

test("starter/default games are no longer part of the arcade catalog", () => {
  assert.equal(findArcadeGameForFile("gridlee.zip"), null);
  assert.equal(findArcadeGameForFile("targ.zip"), null);
  assert.equal(findArcadeGameForFile("wrally.zip"), null);
});

test("personal ROM metadata recognizes ZIP and 7-Zip set filenames", () => {
  assert.equal(findArcadeGameForFile("3WONDERS.7z")?.title, "Three Wonders");
  assert.equal(findArcadeGameForFile("20pacgal.7Z")?.title, "Ms. Pac-Man/Galaga: 20th Anniversary");
  assert.equal(findArcadeGameForFile("005.7z")?.preferredCore, "mame2003_plus");
  assert.equal(findArcadeGameForFile("my-own-rom.7z"), null);
});

test("personal metadata includes key sets found in the uploaded ROMS folder", () => {
  const ids = new Set(PERSONAL_ARCADE_GAMES.map((game) => game.id));
  for (const id of ["1942", "19xx", "20pacgal", "3countb", "3in1semi", "3kokushi", "3on3dunk", "3wonders", "64street", "720", "7jigen", "88games", "10yard"]) {
    assert.ok(ids.has(id), `${id} should be recognized from the uploaded ROMS folder`);
  }
});
