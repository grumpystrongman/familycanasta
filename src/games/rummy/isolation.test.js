import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entry = readFileSync(new URL("./index.jsx", import.meta.url), "utf8");
const engine = readFileSync(new URL("./engine.js", import.meta.url), "utf8");

test("Rummy registers as a standalone game module", () => {
  assert.match(entry, /export \{ default \} from "\.\/RummyGame"/);
  assert.doesNotMatch(entry + engine, /\.\.\/\.\.\/game\//);
  assert.doesNotMatch(entry + engine, /roomService/);
});
