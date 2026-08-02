import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const gameFiles = [
  "src/games/hearts/HeartsGame.jsx",
  "src/games/spades/SpadesGame.jsx",
  "src/games/rummy/RummyGame.jsx",
];

test("configured Firebase does not display the missing-configuration warning", () => {
  for (const file of gameFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /firebaseMissing\.length > 0/);
    assert.doesNotMatch(source, /\{firebaseMissing \?/);
  }
});
