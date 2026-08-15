import test from "node:test";
import assert from "node:assert/strict";
import { ARCADE_GAMES, CURATED_ARCADE_GAMES, PERSONAL_ARCADE_GAMES, arcadeDecades, findArcadeGameForFile } from "./catalog.js";

test("arcade catalog spans the uploaded collection decades", () => {
  assert.ok(ARCADE_GAMES.length >= 40);
  assert.deepEqual(arcadeDecades(), [1970, 1980, 1990, 2000]);
  assert.equal(PERSONAL_ARCADE_GAMES.length, 29);
  assert.equal(ARCADE_GAMES.some((game) => game.genre === "Video poker"), false);
});

test("MAME-hosted curated titles expose direct ZIP downloads", () => {
  const downloadable = CURATED_ARCADE_GAMES.filter((game) => game.downloadUrl);
  assert.ok(downloadable.length >= 12);
  for (const game of downloadable) {
    assert.equal(game.downloadUrl, `https://www.mamedev.org/roms/${game.id}/${game.id}.zip`);
  }
});

test("arcade catalog recognizes ZIP and 7-Zip set filenames", () => {
  assert.equal(findArcadeGameForFile("gridlee.zip")?.title, "Gridlee");
  assert.equal(findArcadeGameForFile("WRALLY.ZIP")?.title, "World Rally");
  assert.equal(findArcadeGameForFile("3WONDERS.7z")?.title, "Three Wonders");
  assert.equal(findArcadeGameForFile("20pacgal.7Z")?.preferredCore, "arcade");
  assert.equal(findArcadeGameForFile("005.7z")?.preferredCore, "mame2003_plus");
  assert.equal(findArcadeGameForFile("my-own-rom.7z"), null);
});

test("uploaded compatible collection includes key arcade sets", () => {
  const ids = new Set(PERSONAL_ARCADE_GAMES.map((game) => game.id));
  for (const id of ["1942", "19xx", "3countb", "3in1semi", "3kokushi", "3on3dunk", "3wonders", "64street", "720", "88games", "10yard"]) {
    assert.ok(ids.has(id), `${id} should be recognized from the uploaded ROMS folder`);
  }
});
