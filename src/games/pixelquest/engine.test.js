import assert from "node:assert/strict";
import test from "node:test";
import { ADVENTURES, ENEMIES, HEROES, MAPS } from "./data.js";
import {
  castPartyVote,
  completeAdventure,
  createCampaign,
  currentCombatActor,
  currentScene,
  deserializeCampaign,
  evaluateCombat,
  finishCombat,
  isWalkable,
  moveCombatActor,
  moveToScene,
  normalizeSeed,
  parseDice,
  reachableCells,
  recoverFromDefeat,
  resolvePartyVote,
  resolveSkillScene,
  rollDieFromState,
  rollExpression,
  runAutomaticTurns,
  serializeCampaign,
  startCombat,
  useAbility,
  validateGameData,
} from "./engine.js";
import { createPixelQuestGameState, reducePixelQuest } from "./network.js";
import { useTileAbility } from "./specialActions.js";

const human = (uid, seat, nickname = uid, isHost = false) => ({ uid, seat, nickname, avatar: "🦊", isHost, isRobot: false, connected: true });
const robot = (uid, seat, nickname = uid) => ({ uid, seat, nickname, avatar: "🤖", isHost: false, isRobot: true, connected: true });

function setCurrentActor(campaign, actorId) {
  const state = structuredClone(campaign);
  const index = state.combat.order.indexOf(actorId);
  assert.notEqual(index, -1, `actor ${actorId} must be in initiative order`);
  state.combat.turnIndex = index;
  return state;
}

function firstCombatCampaign(heroIds = [HEROES[0].id], controllers = ["human"], sceneId = "orchard-fight") {
  let campaign = createCampaign({ adventureId: "bells-blackhollow", heroIds, controllers, seed: "combat-test" });
  campaign = moveToScene(campaign, sceneId);
  return startCombat(campaign);
}

function reachableSceneIds(adventure) {
  const byId = new Map(adventure.scenes.map((scene) => [scene.id, scene]));
  const seen = new Set();
  const queue = [adventure.scenes[0]?.id];
  while (queue.length) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const scene = byId.get(id);
    if (!scene) continue;
    const refs = [scene.next, scene.successNext, scene.failNext, ...(scene.choices || []).map((choice) => choice.next)].filter(Boolean);
    for (const ref of refs) if (!seen.has(ref)) queue.push(ref);
  }
  return seen;
}

test("PixelQuest ships twelve complete pregenerated heroes and twenty playable cartridges", () => {
  assert.equal(HEROES.length, 12);
  assert.equal(ADVENTURES.length, 20);
  assert.equal(validateGameData().length, 0, validateGameData().join("\n"));

  for (const hero of HEROES) {
    assert.ok(hero.maxHp > 0, `${hero.name} needs HP`);
    assert.ok(hero.defense >= 10, `${hero.name} needs Defense`);
    assert.ok(hero.move >= 3, `${hero.name} needs movement`);
    assert.ok(hero.abilities.length >= 5, `${hero.name} needs at least five abilities`);
    assert.ok(hero.utility.length > 20, `${hero.name} needs noncombat identity`);
  }

  const ids = new Set(ADVENTURES.map((adventure) => adventure.id));
  assert.equal(ids.size, 20, "adventure ids must be unique");
  for (const adventure of ADVENTURES) {
    const reachable = reachableSceneIds(adventure);
    const endings = adventure.scenes.filter((scene) => scene.type === "ending");
    assert.ok(endings.length >= 1, `${adventure.title} needs an ending`);
    assert.ok(endings.some((ending) => reachable.has(ending.id)), `${adventure.title} ending must be reachable from its opening scene`);
  }
});

test("Blackhollow is a deeper end-to-end showcase rather than a placeholder", () => {
  const blackhollow = ADVENTURES.find((adventure) => adventure.id === "bells-blackhollow");
  assert.ok(blackhollow);
  assert.ok(blackhollow.scenes.length >= 15);
  assert.ok(blackhollow.scenes.filter((scene) => scene.type === "combat").length >= 3);
  assert.ok(blackhollow.scenes.filter((scene) => scene.type === "party-choice").length >= 3);
  assert.ok(blackhollow.scenes.filter((scene) => scene.type === "private").length >= 2);
  assert.ok(blackhollow.scenes.some((scene) => scene.enemies?.includes("bellWarden")));
});

test("all tactical maps are exactly 12 by 8 and use supported terrain", () => {
  const allowed = new Set(["#", ".", "~", "F", "C"]);
  for (const [name, map] of Object.entries(MAPS)) {
    assert.equal(map.length, 8, `${name} must have eight rows`);
    for (const row of map) {
      assert.equal(row.length, 12, `${name} rows must be twelve tiles wide`);
      for (const tile of row) assert.ok(allowed.has(tile), `${name} contains unsupported tile ${tile}`);
    }
  }
});

test("seeded dice are deterministic and every supported die stays in bounds", () => {
  const seed = normalizeSeed("same-seed");
  assert.equal(seed, normalizeSeed("same-seed"));
  for (const sides of [4, 6, 8, 10, 12, 20, 100]) {
    const first = rollDieFromState(seed, sides);
    const second = rollDieFromState(seed, sides);
    assert.deepEqual(first, second);
    assert.ok(first.raw >= 1 && first.raw <= sides, `d${sides} out of range`);
  }
  assert.throws(() => rollDieFromState(seed, 7), /Unsupported die/);
});

test("damage and healing dice expressions parse and roll transparently", () => {
  assert.deepEqual(parseDice("2d6+3"), { count: 2, sides: 6, modifier: 3 });
  assert.deepEqual(parseDice("1d8-2"), { count: 1, sides: 8, modifier: -2 });
  assert.throws(() => parseDice("fireball"), /Invalid dice expression/);
  const rolled = rollExpression(normalizeSeed("dice-expression"), "2d6+3");
  assert.equal(rolled.rolls.length, 2);
  assert.equal(rolled.total, rolled.rolls[0] + rolled.rolls[1] + 3);
});

test("campaign creation supports solo through eight heroes and rejects an empty party", () => {
  const solo = createCampaign({ adventureId: "bells-blackhollow", heroIds: [HEROES[0].id], seed: 1 });
  assert.equal(solo.heroes.length, 1);
  assert.equal(solo.sceneId, "arrival");

  const eight = createCampaign({ adventureId: "bells-blackhollow", heroIds: HEROES.slice(0, 8).map((hero) => hero.id), seed: 2 });
  assert.equal(eight.heroes.length, 8);
  assert.throws(() => createCampaign({ adventureId: "bells-blackhollow", heroIds: [], seed: 3 }), /at least one hero/);
});

test("party decisions require every human, auto-fill AI votes, and use visible fate rolls for ties", () => {
  let campaign = createCampaign({ adventureId: "bells-blackhollow", heroIds: [HEROES[0].id, HEROES[1].id, HEROES[2].id], controllers: ["human", "human", "ai"], seed: "vote" });
  campaign = moveToScene(campaign, "gate-choice");
  campaign = castPartyVote(campaign, HEROES[0].id, "gate");
  let result = resolvePartyVote(campaign);
  assert.equal(result.resolved, false);
  assert.deepEqual(result.missingHeroIds, [HEROES[1].id]);

  campaign = castPartyVote(campaign, HEROES[1].id, "mill");
  result = resolvePartyVote(campaign);
  assert.equal(result.resolved, true);
  assert.ok(["gate", "mill"].includes(result.choiceId));
  assert.ok(result.state.rollHistory.some((roll) => roll.kind === "Fate Roll"), "a 1-1 human tie plus AI behavior should expose the fate mechanic when tied");
});

test("individual private decisions are locked per human and the group waits for everyone", () => {
  const members = [human("host", 0, "Host", true), human("guest", 1, "Guest")];
  let state = createPixelQuestGameState(members, { adventureId: "bells-blackhollow" });
  state = reducePixelQuest(state, "host", { type: "select-hero", heroId: HEROES[0].id }, members);
  state = reducePixelQuest(state, "guest", { type: "select-hero", heroId: HEROES[1].id }, members);
  state = reducePixelQuest(state, "host", { type: "begin-adventure" }, members);
  state.campaign = moveToScene(state.campaign, "mill-private");

  state = reducePixelQuest(state, "host", { type: "private-choice", choiceId: "take-key" }, members);
  assert.equal(currentScene(state.campaign).id, "mill-private", "first private action must not steal the decision from the other human");
  assert.equal(state.campaign.privateChoices[`mill-private:${HEROES[0].id}`], "take-key");
  assert.throws(() => reducePixelQuest(state, "host", { type: "private-choice", choiceId: "share-key" }, members), /already locked/);

  state = reducePixelQuest(state, "guest", { type: "private-choice", choiceId: "share-key" }, members);
  assert.equal(currentScene(state.campaign).id, "square");
  assert.equal(state.campaign.privateChoices[`mill-private:${HEROES[1].id}`], "share-key");
});

test("skill scenes always produce an immutable d20 record and advance on success or failure", () => {
  let campaign = createCampaign({ adventureId: "bells-blackhollow", heroIds: [HEROES[4].id], seed: "skill" });
  campaign = moveToScene(campaign, "ridge-check");
  const next = resolveSkillScene(campaign, HEROES[4].id);
  assert.ok(["square", "orchard-fight"].includes(currentScene(next).id));
  assert.equal(next.rollHistory.length, 1);
  assert.equal(next.rollHistory[0].die, "d20");
  assert.equal(next.stats.checksPassed + next.stats.checksFailed, 1);
});

test("combat creates initiative, legal board positions, and a complete actor roster", () => {
  const campaign = firstCombatCampaign([HEROES[0].id, HEROES[4].id]);
  assert.equal(campaign.combat.map.length, 8);
  assert.equal(campaign.combat.order.length, 5);
  assert.equal(campaign.combat.actors.filter((actor) => actor.type === "hero").length, 2);
  assert.equal(campaign.combat.actors.filter((actor) => actor.type === "enemy").length, 3);
  for (const actor of campaign.combat.actors) {
    assert.ok(isWalkable(campaign.combat.map, actor.x, actor.y), `${actor.name} spawned inside a wall`);
    assert.ok(actor.initiativeRoll >= 1);
  }
});

test("movement range never includes walls or occupied cells and rejects illegal movement", () => {
  let campaign = firstCombatCampaign();
  const hero = campaign.combat.actors.find((actor) => actor.type === "hero");
  campaign = setCurrentActor(campaign, hero.id);
  const cells = reachableCells(campaign, hero.id);
  assert.ok(cells.length > 0);
  for (const cell of cells) {
    assert.ok(isWalkable(campaign.combat.map, cell.x, cell.y));
    assert.equal(campaign.combat.actors.some((actor) => actor.id !== hero.id && !actor.downed && actor.x === cell.x && actor.y === cell.y), false);
  }
  const wallMove = moveCombatActor(campaign, hero.id, 0, 0);
  assert.equal(wallMove.ok, false);
  const legal = cells[0];
  const moved = moveCombatActor(campaign, hero.id, legal.x, legal.y);
  assert.equal(moved.ok, true);
  assert.equal(currentCombatActor(moved.state).id, hero.id, "movement alone should not consume the hero's action/turn");
});

test("attacks reject impossible targets, then record a real d20 when a target is legal", () => {
  let campaign = firstCombatCampaign([HEROES[0].id]);
  const hero = campaign.combat.actors.find((actor) => actor.type === "hero");
  const enemy = campaign.combat.actors.find((actor) => actor.type === "enemy");
  campaign = setCurrentActor(campaign, hero.id);

  const tooFar = useAbility(campaign, hero.id, "steel-swing", enemy.id);
  assert.equal(tooFar.ok, false);
  assert.match(tooFar.reason, /out of range|legal/i);

  campaign.combat.actors.find((actor) => actor.id === hero.id).x = enemy.x - 1;
  campaign.combat.actors.find((actor) => actor.id === hero.id).y = enemy.y;
  const attack = useAbility(campaign, hero.id, "steel-swing", enemy.id);
  assert.equal(attack.ok, true);
  assert.ok(attack.state.rollHistory.length >= 1);
  const attackRoll = attack.state.rollHistory.find((roll) => roll.kind === "Steel Swing");
  assert.ok(attackRoll);
  assert.ok(attackRoll.raw >= 1 && attackRoll.raw <= 20);
  assert.equal(attackRoll.target, enemy.defense);
});

test("downed actors cannot use abilities and initiative skips them", () => {
  let campaign = firstCombatCampaign([HEROES[0].id]);
  const hero = campaign.combat.actors.find((actor) => actor.type === "hero");
  campaign = setCurrentActor(campaign, hero.id);
  campaign.combat.actors.find((actor) => actor.id === hero.id).hp = 0;
  campaign.combat.actors.find((actor) => actor.id === hero.id).downed = true;
  const attempted = useAbility(campaign, hero.id, "steel-swing", campaign.combat.actors.find((actor) => actor.type === "enemy").id);
  assert.equal(attempted.ok, false);
  assert.match(attempted.reason, /Downed/);
});

test("enemy and AI turns auto-resolve without hanging and stop for the next human", () => {
  let campaign = firstCombatCampaign([HEROES[0].id, HEROES[5].id], ["human", "ai"]);
  const nonHuman = campaign.combat.actors.find((actor) => actor.type === "enemy") || campaign.combat.actors.find((actor) => actor.controller === "ai");
  campaign = setCurrentActor(campaign, nonHuman.id);
  const next = runAutomaticTurns(campaign, 48);
  assert.ok(next.combat);
  if (!next.combat.victory) {
    const actor = currentCombatActor(next);
    assert.equal(actor.type, "hero");
    assert.equal(actor.controller, "human");
  }
  assert.ok(next.rollHistory.length < 49, "automatic turns must be bounded");
});

test("combat victory pays loot and returns the party to the authored scene graph", () => {
  let campaign = firstCombatCampaign();
  for (const actor of campaign.combat.actors) {
    if (actor.type === "enemy") { actor.hp = 0; actor.downed = true; }
  }
  campaign = evaluateCombat(campaign);
  assert.equal(campaign.combat.victory, "heroes");
  const after = finishCombat(campaign);
  assert.equal(after.combat, null);
  assert.equal(currentScene(after).id, "square");
  assert.equal(after.gold, 45);
  assert.equal(after.stats.combatsWon, 1);
});

test("defeat never eliminates a family member from game night", () => {
  let campaign = firstCombatCampaign();
  campaign.gold = 30;
  for (const actor of campaign.combat.actors) {
    if (actor.type === "hero") { actor.hp = 0; actor.downed = true; }
  }
  campaign = evaluateCombat(campaign);
  assert.equal(campaign.combat.victory, "enemies");
  const recovered = recoverFromDefeat(campaign);
  assert.equal(recovered.combat, null);
  assert.equal(recovered.gold, 0);
  assert.ok(recovered.heroes.every((hero) => hero.hp > 0 && !hero.downed));
});

test("Blink and Engineer gadgets are real tile actions rather than decorative buttons", () => {
  let blinkCampaign = firstCombatCampaign([HEROES[4].id]);
  const mage = blinkCampaign.combat.actors.find((actor) => actor.type === "hero");
  blinkCampaign = setCurrentActor(blinkCampaign, mage.id);
  const blinkTarget = reachableCells(blinkCampaign, mage.id).find((cell) => Math.abs(cell.x - mage.x) + Math.abs(cell.y - mage.y) <= 4);
  assert.ok(blinkTarget);
  const blinked = useTileAbility(blinkCampaign, mage.id, "blink", blinkTarget.x, blinkTarget.y);
  assert.equal(blinked.ok, true);
  assert.equal(blinked.state.combat.actors.find((actor) => actor.id === mage.id).x, blinkTarget.x);

  let tinkCampaign = firstCombatCampaign([HEROES[9].id]);
  const tink = tinkCampaign.combat.actors.find((actor) => actor.type === "hero");
  tinkCampaign = setCurrentActor(tinkCampaign, tink.id);
  const tile = reachableCells(tinkCampaign, tink.id).find((cell) => Math.abs(cell.x - tink.x) + Math.abs(cell.y - tink.y) <= 3);
  assert.ok(tile);
  const turret = useTileAbility(tinkCampaign, tink.id, "turret", tile.x, tile.y);
  assert.equal(turret.ok, true);
  assert.ok(turret.state.combat.objects.some((object) => object.type === "turret"));
});

test("campaign save data round-trips without changing deterministic game state", () => {
  let campaign = createCampaign({ adventureId: "bells-blackhollow", heroIds: [HEROES[0].id, HEROES[1].id], seed: "save" });
  campaign = moveToScene(campaign, "gate-choice");
  campaign = castPartyVote(campaign, HEROES[0].id, "gate");
  const restored = deserializeCampaign(serializeCampaign(campaign));
  assert.deepEqual(restored, campaign);
  assert.throws(() => deserializeCampaign('{"version":999}'), /Invalid PixelQuest save/);
});

test("ending scenes award campaign rewards and create Hall of Legends material", () => {
  let campaign = createCampaign({ adventureId: "bells-blackhollow", heroIds: [HEROES[0].id], seed: "ending" });
  campaign = moveToScene(campaign, "ending");
  campaign.stats.crits = 2;
  const completed = completeAdventure(campaign);
  assert.equal(completed.completed, true);
  assert.equal(completed.gold, 420);
  assert.equal(completed.xp, 300);
  assert.ok(completed.legends.length >= 2);
});

test("online room state gives robots unique heroes and prevents duplicate human picks", () => {
  const members = [human("host", 0, "Host", true), human("guest", 1, "Guest"), robot("bot1", 2), robot("bot2", 3)];
  let state = createPixelQuestGameState(members, { adventureId: "bells-blackhollow", difficulty: "classic" });
  assert.equal(state.phase, "hero-select");
  assert.equal(new Set([state.selections.bot1, state.selections.bot2]).size, 2);
  state = reducePixelQuest(state, "host", { type: "select-hero", heroId: HEROES[4].id }, members);
  assert.throws(() => reducePixelQuest(state, "guest", { type: "select-hero", heroId: HEROES[4].id }, members), /already chose/);
  state = reducePixelQuest(state, "guest", { type: "select-hero", heroId: HEROES[5].id }, members);
  state = reducePixelQuest(state, "host", { type: "begin-adventure" }, members);
  assert.equal(state.phase, "playing");
  assert.equal(state.campaign.heroes.length, 4);
  assert.equal(state.campaign.heroes.filter((hero) => hero.controller === "ai").length, 2);
});

test("room reducer enforces host-only global actions and hero ownership", () => {
  const members = [human("host", 0, "Host", true), human("guest", 1, "Guest")];
  let state = createPixelQuestGameState(members, { adventureId: "bells-blackhollow" });
  state = reducePixelQuest(state, "host", { type: "select-hero", heroId: HEROES[0].id }, members);
  state = reducePixelQuest(state, "guest", { type: "select-hero", heroId: HEROES[1].id }, members);
  state = reducePixelQuest(state, "host", { type: "begin-adventure" }, members);
  state.campaign = moveToScene(state.campaign, "orchard-fight");
  assert.throws(() => reducePixelQuest(state, "guest", { type: "start-combat" }, members), /Only the host/);
  state = reducePixelQuest(state, "host", { type: "start-combat" }, members);

  if (!state.campaign.combat.victory) {
    const current = currentCombatActor(state.campaign);
    if (current?.type === "hero" && current.controller === "human") {
      const ownerUid = Object.entries(state.seatHeroes).find(([, heroId]) => heroId === current.id)?.[0];
      const wrongUid = ownerUid === "host" ? "guest" : "host";
      assert.throws(() => reducePixelQuest(state, wrongUid, { type: "end-turn" }, members), /Wait for your hero/);
    }
  }
});

test("every enemy template has complete combat statistics and a valid damage die", () => {
  for (const enemy of Object.values(ENEMIES)) {
    assert.ok(enemy.maxHp > 0);
    assert.ok(enemy.defense >= 10);
    assert.ok(enemy.move > 0);
    assert.ok(enemy.attack?.name);
    assert.doesNotThrow(() => parseDice(enemy.attack.damage));
  }
});
