import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const component = fs.readFileSync("src/platform/AdaptiveCanastaNavigation.jsx", "utf8");
const css = fs.readFileSync("src/platform/adaptiveCanastaPlaySurface.css", "utf8");
const index = fs.readFileSync("index.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));

test("Hand view keeps My Board visible above the playable hand", () => {
  assert.match(component, /function clickMyBoard\(game\)/);
  assert.match(component, /view === "hand"/);
  assert.match(css, /data-adaptive-view="hand"\] \.shared-boards\s*\{[\s\S]*?display:\s*flex !important;/);
  assert.match(css, /data-adaptive-view="hand"\] \.shared-board\.board-collapsed\s*\{\s*display:\s*none !important;/);
  assert.match(css, /data-adaptive-view="hand"\] \.shared-board\.board-expanded\s*\{[\s\S]*?height:\s*100% !important;/);
});

test("completed draw controls collapse so cards receive the viewport", () => {
  assert.match(component, /game\.dataset\.adaptiveDrawState = drawAvailable \? "available" : "complete"/);
  assert.match(css, /data-adaptive-draw-state="complete"\] \.table\s*\{\s*grid-template-rows:\s*44px 118px minmax\(0, 1fr\) !important;/);
  assert.match(css, /data-adaptive-draw-state="complete"\] \.center > \.pile-action\s*\{\s*display:\s*none !important;/);
});

test("tablet cards are fully visible and touch selectable", () => {
  assert.match(css, /\.hand \.cards\s*\{[\s\S]*?min-height:\s*170px !important;[\s\S]*?touch-action:\s*pan-x;/);
  assert.match(css, /\.hand \.real-card\s*\{\s*width:\s*98px !important;\s*height:\s*140px !important;\s*touch-action:\s*manipulation;/);
  assert.match(css, /\.hand \.real-card\.selected\s*\{\s*transform:\s*translateY\(-18px\) !important;/);
});

test("fullscreen control keeps the complete adaptive app and iPad guidance available", () => {
  assert.match(component, /const target = document\.documentElement/);
  assert.match(component, /target\.requestFullscreen \|\| target\.webkitRequestFullscreen/);
  assert.match(component, /Add to Home Screen/);
  assert.match(component, /adaptive-fullscreen-button/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
});

test("the site is configured for standalone iPad launch", () => {
  assert.match(index, /apple-mobile-web-app-capable" content="yes"/);
  assert.match(index, /viewport-fit=cover/);
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.display_override, ["fullscreen", "standalone"]);
});
