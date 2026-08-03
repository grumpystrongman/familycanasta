import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  ADAPTIVE_VIEWPORT_PROFILES,
  readAdaptiveViewportMetrics,
  resolveAdaptiveViewportProfile,
} from "./adaptiveViewportProfile.js";

const css = fs.readFileSync("src/platform/adaptiveCanastaIpadProfiles.css", "utf8");
const component = fs.readFileSync("src/platform/AdaptiveCanastaNavigation.jsx", "utf8");

test("current iPad landscape sizes resolve to mini, standard, and large profiles", () => {
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 1133, height: 744 }),
    ADAPTIVE_VIEWPORT_PROFILES.MINI_LANDSCAPE,
  );
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 1180, height: 820 }),
    ADAPTIVE_VIEWPORT_PROFILES.STANDARD_LANDSCAPE,
  );
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 1210, height: 834 }),
    ADAPTIVE_VIEWPORT_PROFILES.STANDARD_LANDSCAPE,
  );
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 1376, height: 1032 }),
    ADAPTIVE_VIEWPORT_PROFILES.LARGE_LANDSCAPE,
  );
});

test("portrait and constrained windows receive the matching available-space profile", () => {
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 744, height: 1133 }),
    ADAPTIVE_VIEWPORT_PROFILES.MINI_PORTRAIT,
  );
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 820, height: 1180 }),
    ADAPTIVE_VIEWPORT_PROFILES.STANDARD_PORTRAIT,
  );
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 1032, height: 1376 }),
    ADAPTIVE_VIEWPORT_PROFILES.LARGE_PORTRAIT,
  );
  assert.equal(
    resolveAdaptiveViewportProfile({ width: 900, height: 700 }),
    ADAPTIVE_VIEWPORT_PROFILES.MINI_LANDSCAPE,
  );
});

test("visualViewport controls the profile when browser chrome changes usable space", () => {
  const metrics = readAdaptiveViewportMetrics({
    innerWidth: 1376,
    innerHeight: 1032,
    visualViewport: { width: 1180, height: 790 },
  });

  assert.deepEqual(metrics, {
    width: 1180,
    height: 790,
    orientation: "landscape",
    profile: ADAPTIVE_VIEWPORT_PROFILES.STANDARD_LANDSCAPE,
  });
});

test("landscape composition puts actions beside cards instead of above them", () => {
  assert.match(
    css,
    /data-adaptive-viewport-orientation="landscape"[\s\S]*?\.hand\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) var\(--ipad-action-width\)/,
  );
  assert.match(
    css,
    /\.hand \.selection-advisor\s*\{[\s\S]*?grid-column:\s*2 !important;[\s\S]*?grid-row:\s*2 !important;/,
  );
  assert.match(
    css,
    /\.hand \.cards\s*\{[\s\S]*?grid-column:\s*1 !important;[\s\S]*?grid-row:\s*2 !important;[\s\S]*?align-self:\s*start !important;/,
  );
});

test("each iPad landscape profile defines its own board, action, and card dimensions", () => {
  for (const profile of ["ipad-mini-landscape", "ipad-standard-landscape", "ipad-large-landscape"]) {
    const block = new RegExp(`html\\[data-adaptive-viewport-profile="${profile}"\\] \\{[\\s\\S]*?--ipad-board-height:[\\s\\S]*?--ipad-action-width:[\\s\\S]*?--ipad-card-height:`);
    assert.match(css, block);
  }
});

test("fullscreen targets the document so portal navigation stays visible", () => {
  assert.match(component, /const target = document\.documentElement;/);
  assert.match(component, /target\.requestFullscreen \|\| target\.webkitRequestFullscreen/);
  assert.match(component, /window\.visualViewport\?\.addEventListener\?\.\("resize", scheduleRefresh\)/);
  assert.match(css, /html:fullscreen \.layout-mode-control/);
});
