import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const componentUrl = new URL("./BoardScrollViewport.jsx", import.meta.url);
const cssUrl = new URL("./boardScrollViewport.css", import.meta.url);
const mainUrl = new URL("./main.jsx", import.meta.url);

test("mounts the dynamic board scroll viewport", async () => {
  const source = await readFile(mainUrl, "utf8");
  const component = await readFile(componentUrl, "utf8");

  assert.match(source, /\["BoardScrollViewport", \(\) => import\("\.\/BoardScrollViewport"\)\]/);
  assert.match(component, /import "\.\/boardScrollViewport\.css";/);
  assert.match(component, /handTop - boardTop - BOARD_GAP_PX/);
  assert.match(component, /new ResizeObserver\(scheduleUpdate\)/);
  assert.match(component, /--canasta-board-scroll-height/);
});

test("scrolls each team board inside the space above the hand", async () => {
  const styles = await readFile(cssUrl, "utf8");

  assert.match(styles, /\.shared-boards\s*\{[^}]*height:\s*var\(--canasta-board-scroll-height\) !important[^}]*overflow-y:\s*hidden !important/s);
  assert.match(styles, /\.shared-board\s*\{[^}]*height:\s*100% !important[^}]*overflow-y:\s*auto !important/s);
  assert.match(styles, /\.shared-board \.board-title\s*\{[^}]*position:\s*sticky !important/s);
  assert.match(styles, /\.red-three-board-rack/);
  assert.match(styles, /scrollbar-color:\s*#f0c85a #06231d/);
});

test("leaves mobile boards in the normal document flow", async () => {
  const styles = await readFile(cssUrl, "utf8");

  assert.match(styles, /@media \(max-width: 850px\)[\s\S]*\.shared-boards,[\s\S]*\.shared-board\s*\{[^}]*height:\s*auto !important[^}]*overflow:\s*visible !important/s);
});
