import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("./HouseRulesLobbyController.jsx", import.meta.url),
  "utf8",
);

test("lobby start calls the room service instead of clicking a hidden button", () => {
  assert.match(source, /startOnlineGame\(elements\.roomCode, uid\)/);
  assert.doesNotMatch(source, /originalStart\.click\(\)/);
});

test("lobby operations time out and leave normal saves editable", () => {
  assert.match(source, /withTimeout\(/);
  assert.match(source, /disabled=\{!host \|\| starting\}/);
  assert.match(source, /Starting game…/);
});
