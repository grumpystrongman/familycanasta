import test from "node:test";
import assert from "node:assert/strict";
import { buildArcadeFrame } from "./runtime.js";

test("arcade frame reconstructs a named File instead of launching a blob URL", () => {
  const html = buildArcadeFrame({
    sessionKey: "session-1",
    setName: "20pacgal",
    core: "arcade",
  });

  assert.match(html, /new File\(\[payload\.blob\], payload\.name/);
  assert.match(html, /window\.EJS_gameName = "20pacgal"/);
  assert.match(html, /window\.EJS_core = "arcade"/);
  assert.doesNotMatch(html, /EJS_gameUrl = "blob:/);
});

test("arcade frame keeps MAME 2003-Plus as a selectable concrete core", () => {
  const html = buildArcadeFrame({
    sessionKey: "session-2",
    setName: "005",
    core: "mame2003_plus",
  });

  assert.match(html, /window\.EJS_core = "mame2003_plus"/);
  assert.match(html, /window\.EJS_gameName = "005"/);
});
