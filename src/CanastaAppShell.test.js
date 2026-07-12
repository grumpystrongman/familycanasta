import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("application shell keeps gameplay controllers while excluding the retired responsive enhancer", async () => {
  const source = await readFile(new URL("./CanastaAppShell.jsx", import.meta.url), "utf8");
  const requiredControllers = [
    "GameStateEnhancer",
    "GameCelebration",
    "MultiMeldEnhancer",
    "RedThreeBoard",
    "RedThreeTurnControl",
    "BlackThreeRuleFix",
    "SafeDiscardRule",
    "HomeRulesOptions",
    "ScoringDisplayFix",
    "HouseRulesLobbyController",
  ];

  for (const controller of requiredControllers) {
    assert.match(source, new RegExp(`<${controller}\\s*/>`), `${controller} must remain mounted`);
  }
  assert.doesNotMatch(source, /ResponsiveBoardEnhancer/);
});
