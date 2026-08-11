import assert from "node:assert/strict";
import test from "node:test";
import { HEROES } from "./data.js";
import { currentCombatActor, currentScene, moveToScene } from "./engine.js";
import { createPixelQuestGameState, reducePixelQuest } from "./network.js";

const human = (uid, seat, nickname = uid, isHost = false) => ({
  uid,
  seat,
  nickname,
  avatar: "🦊",
  isHost,
  isRobot: false,
  connected: true,
});

function startTwoPlayerCampaign() {
  const members = [human("host", 0, "Host", true), human("guest", 1, "Guest")];
  let state = createPixelQuestGameState(members, { adventureId: "bells-blackhollow" });
  state = reducePixelQuest(state, "host", { type: "select-hero", heroId: HEROES[0].id }, members);
  state = reducePixelQuest(state, "guest", { type: "select-hero", heroId: HEROES[6].id }, members);
  state = reducePixelQuest(state, "host", { type: "begin-adventure" }, members);
  return { members, state };
}

test("each online human owns exactly one unique hero", () => {
  const { members, state } = startTwoPlayerCampaign();
  assert.equal(state.seatHeroes.host, HEROES[0].id);
  assert.equal(state.seatHeroes.guest, HEROES[6].id);
  assert.notEqual(state.seatHeroes.host, state.seatHeroes.guest);
  assert.equal(state.campaign.heroes.find((hero) => hero.id === state.seatHeroes.host)?.controller, "human");
  assert.equal(state.campaign.heroes.find((hero) => hero.id === state.seatHeroes.guest)?.controller, "human");
  assert.equal(members.length, 2);
});

test("party decisions require an independent vote from every online human and resolve on the final vote", () => {
  const { members, state: started } = startTwoPlayerCampaign();
  let state = structuredClone(started);
  state.campaign = moveToScene(state.campaign, "gate-choice");

  state = reducePixelQuest(state, "host", { type: "vote", choiceId: "mill" }, members);
  assert.equal(currentScene(state.campaign).id, "gate-choice");
  assert.equal(state.campaign.votes[HEROES[0].id], "mill");
  assert.equal(state.campaign.votes[HEROES[6].id], undefined);
  assert.throws(() => reducePixelQuest(state, "guest", { type: "resolve-vote" }, members), /Only the host/);
  assert.throws(() => reducePixelQuest(state, "host", { type: "resolve-vote" }, members), /Every human adventurer/);

  state = reducePixelQuest(state, "guest", { type: "vote", choiceId: "mill" }, members);
  assert.equal(currentScene(state.campaign).id, "mill-private", "the last human vote should advance the shared story without another host-only click");
  assert.equal(state.campaign.log.at(-1)?.type, "story");
});

test("private turns are independent, hidden in the public log, and preserve every hero's impact", () => {
  const { members, state: started } = startTwoPlayerCampaign();
  let state = structuredClone(started);
  state.campaign = moveToScene(state.campaign, "mill-private");

  state = reducePixelQuest(state, "host", { type: "private-choice", choiceId: "take-key" }, members);
  assert.equal(currentScene(state.campaign).id, "mill-private");
  assert.equal(state.campaign.privateChoices[`mill-private:${HEROES[0].id}`], "take-key");
  assert.deepEqual(state.campaign.flags["silver-key-secret"], [HEROES[0].id]);
  assert.equal(state.campaign.log.at(-1)?.private, true);
  assert.throws(() => reducePixelQuest(state, "host", { type: "private-choice", choiceId: "share-key" }, members), /already locked/);

  state = reducePixelQuest(state, "guest", { type: "private-choice", choiceId: "take-key" }, members);
  assert.equal(currentScene(state.campaign).id, "square");
  assert.equal(state.campaign.privateChoices[`mill-private:${HEROES[6].id}`], "take-key");
  assert.deepEqual(new Set(state.campaign.flags["silver-key-secret"]), new Set([HEROES[0].id, HEROES[6].id]));
});

test("skill challenges give every online human a separate d20 turn before resolving", () => {
  const { members, state: started } = startTwoPlayerCampaign();
  let state = structuredClone(started);
  state.campaign = moveToScene(state.campaign, "ridge-check");

  state = reducePixelQuest(state, "host", { type: "skill-check" }, members);
  assert.equal(currentScene(state.campaign).id, "ridge-check", "one player cannot consume the whole group skill scene");
  assert.ok(state.campaign.skillAttempts?.["ridge-check"]?.[HEROES[0].id]);
  assert.equal(state.campaign.skillAttempts?.["ridge-check"]?.[HEROES[6].id], undefined);
  assert.throws(() => reducePixelQuest(state, "host", { type: "skill-check" }, members), /already took this skill turn/);

  state = reducePixelQuest(state, "guest", { type: "skill-check" }, members);
  assert.ok(["square", "orchard-fight"].includes(currentScene(state.campaign).id));
  assert.ok(state.campaign.skillAttempts?.["ridge-check"]?.[HEROES[0].id]);
  assert.ok(state.campaign.skillAttempts?.["ridge-check"]?.[HEROES[6].id]);
  assert.equal(state.campaign.rollHistory.filter((roll) => roll.kind.includes("Counting towers")).length, 2);
});

test("combat controls belong only to the current online player's hero and pass to the other human", () => {
  const { members, state: started } = startTwoPlayerCampaign();
  let state = structuredClone(started);
  state.campaign = moveToScene(state.campaign, "chapel-fight");
  state = reducePixelQuest(state, "host", { type: "start-combat" }, members);

  for (const actor of state.campaign.combat.actors.filter((entry) => entry.type === "hero")) {
    actor.maxHp = 999;
    actor.hp = 999;
  }

  const first = currentCombatActor(state.campaign);
  assert.equal(first.type, "hero");
  assert.equal(first.controller, "human");
  const firstOwnerUid = state.seatHeroes.host === first.id ? "host" : "guest";
  const wrongUid = firstOwnerUid === "host" ? "guest" : "host";
  assert.throws(() => reducePixelQuest(state, wrongUid, { type: "end-turn" }, members), /Wait for your hero's turn/);

  state = reducePixelQuest(state, firstOwnerUid, { type: "end-turn" }, members);
  const second = currentCombatActor(state.campaign);
  assert.equal(second.type, "hero");
  assert.equal(second.controller, "human");
  assert.notEqual(second.id, first.id, "the next surviving human hero must receive their own turn before the round cycles back");
  const secondOwnerUid = state.seatHeroes.host === second.id ? "host" : "guest";
  assert.notEqual(secondOwnerUid, firstOwnerUid);
});
