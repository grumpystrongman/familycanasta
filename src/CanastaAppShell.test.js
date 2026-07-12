import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("application shell mounts one authoritative lobby path and keeps gameplay recovery", async () => {
  const source = await readFile(new URL("./CanastaAppShell.jsx", import.meta.url), "utf8");
  const requiredControllers = [
    "DealRecoveryController",
    "GameStateEnhancer",
    "GameCelebration",
    "MultiMeldEnhancer",
    "RedThreeBoard",
    "RedThreeTurnControl",
    "BlackThreeRuleFix",
    "SafeDiscardRule",
    "HomeRulesOptions",
    "ScoringDisplayFix",
  ];

  for (const controller of requiredControllers) {
    assert.match(source, new RegExp(`<${controller}\\s*/>`), `${controller} must remain mounted`);
  }

  assert.match(source, /resetIncompatibleSession\(window\.localStorage\)/);
  assert.doesNotMatch(source, /HouseRulesLobbyController/);
  assert.doesNotMatch(source, /ResponsiveBoardEnhancer/);
});
