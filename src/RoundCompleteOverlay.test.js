import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function zIndexFor(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{[^}]*z-index:(\\d+)`, "m"));
  return match ? Number(match[1]) : null;
}

test("round-complete overlay stays above the fixed hand and adaptive navigation", async () => {
  const [stateCss, playCss, adaptiveCss] = await Promise.all([
    readFile(new URL("./stateEnhancer.css", import.meta.url), "utf8"),
    readFile(new URL("./playSurfaceIsolation.css", import.meta.url), "utf8"),
    readFile(new URL("./platform/adaptiveCanastaNavigation.css", import.meta.url), "utf8"),
  ]);

  const overlayZ = zIndexFor(stateCss, ".round-complete-overlay");
  const handZ = zIndexFor(playCss, ".game-page.responsive-board-ready .hand");
  const navigationZ = zIndexFor(adaptiveCss, ".adaptive-canasta-navigation");

  assert.ok(Number.isFinite(overlayZ), "round overlay must define a z-index");
  assert.ok(Number.isFinite(handZ), "fixed hand must define a z-index");
  assert.ok(Number.isFinite(navigationZ), "adaptive navigation must define a z-index");
  assert.ok(overlayZ > handZ, `round overlay z-index ${overlayZ} must exceed hand z-index ${handZ}`);
  assert.ok(overlayZ > navigationZ, `round overlay z-index ${overlayZ} must exceed adaptive navigation z-index ${navigationZ}`);
});

test("round-complete results remain reachable on short screens", async () => {
  const css = await readFile(new URL("./stateEnhancer.css", import.meta.url), "utf8");
  assert.match(css, /\.round-complete-overlay\{[^}]*overflow-y:auto/);
  assert.match(css, /\.round-complete-card\{[^}]*max-height:calc\(100dvh - 40px\)[^}]*overflow-y:auto/);
});
