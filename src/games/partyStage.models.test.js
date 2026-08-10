import test from "node:test";
import assert from "node:assert/strict";
import { PUNCHLINE_PROMPTS, createPunchlineGameState, punchlineDefinition, reducePunchlineGameState } from "./punchline/model.js";
import { LAST_ONE_ALIVE_TRIVIA, MICRO_TYPES, createLastOneAliveState, lastOneAliveDefinition, reduceLastOneAliveState } from "./lastonealive/model.js";
import { DOODLE_CASES, createDoodleAlibiState, doodleAlibiDefinition, reduceDoodleAlibiState } from "./doodlealibi/model.js";

const players = Array.from({ length: 6 }, (_, index) => ({
  uid: `player-${index + 1}`,
  nickname: `Player ${index + 1}`,
  avatar: "🦊",
  seat: index,
}));
const host = { uid: "tv-host", isHost: true, displayOnly: true };

test("Punchline ships a full prompt library and balanced opening round", () => {
  assert.ok(PUNCHLINE_PROMPTS.length >= 80);
  const state = createPunchlineGameState(players);
  assert.equal(state.phase, "answer");
  assert.equal(state.matchups.length, players.length);
  for (const player of players) assert.equal(state.assignments[player.uid].length, 2);
  for (const matchup of state.matchups) assert.equal(matchup.authors.length, 2);
});

test("Punchline supports a two-player Duel Mode judged by the TV host", () => {
  const duelPlayers = players.slice(0, 2);
  let state = createPunchlineGameState(duelPlayers);
  assert.equal(punchlineDefinition.minPlayers, 2);
  assert.equal(state.matchups.length, 2);

  const submissions = {};
  for (const player of duelPlayers) {
    submissions[player.uid] = {};
    for (const promptId of state.assignments[player.uid]) submissions[player.uid][promptId] = `${player.nickname} answer`;
  }
  state = { ...state, phase: "vote", submissions, votes: {}, matchupIndex: 0 };
  const choice = state.matchups[0].authors[0];

  assert.throws(
    () => reducePunchlineGameState(state, duelPlayers[0], { type: "vote", choice }, duelPlayers, {}, host.uid),
    /TV host judges/,
  );

  state = reducePunchlineGameState(state, host, { type: "vote", choice }, duelPlayers, {}, host.uid);
  assert.equal(state.votes[host.uid], choice);
  state = reducePunchlineGameState(state, host, { type: "hostAdvance" }, duelPlayers, {}, host.uid);
  assert.equal(state.phase, "result");
  assert.equal(state.scores[choice].score, 100);
});

test("Last One Alive supports two players and solo Majority Grave remains fair", () => {
  const duelPlayers = players.slice(0, 2);
  assert.equal(lastOneAliveDefinition.minPlayers, 2);
  let state = createLastOneAliveState(duelPlayers);
  assert.equal(state.phase, "trivia");
  assert.equal(Object.keys(state.stats).length, 2);

  state = {
    ...state,
    phase: "triviaResult",
    round: 4,
    wrongUids: [duelPlayers[0].uid],
    deadline: Date.now() - 1,
  };
  state = reduceLastOneAliveState(state, host, { type: "hostAdvance", force: true }, duelPlayers, {}, host.uid);
  assert.equal(state.phase, "microgame");
  assert.equal(state.microType, "majorityGrave");
  assert.ok(["A", "B"].includes(state.soloSafeChoice));

  state = reduceLastOneAliveState(state, duelPlayers[0], { type: "microAnswer", payload: { choice: state.soloSafeChoice } }, duelPlayers, {}, host.uid);
  state = reduceLastOneAliveState(state, host, { type: "hostAdvance" }, duelPlayers, {}, host.uid);
  assert.equal(state.phase, "microResult");
  assert.equal(state.stats[duelPlayers[0].uid].hearts, 3);
});

test("Last One Alive ships a full trivia library and every promised trap", () => {
  assert.ok(LAST_ONE_ALIVE_TRIVIA.length >= 60);
  assert.deepEqual(MICRO_TYPES, ["deadButton", "safeDial", "oddOneOut", "majorityGrave", "memoryMorgue", "cutWire"]);
  const state = createLastOneAliveState(players);
  assert.equal(state.phase, "trivia");
  assert.equal(state.round, 1);
  for (const player of players) {
    assert.equal(state.stats[player.uid].hearts, 3);
    assert.equal(state.stats[player.uid].ghost, false);
  }
});

test("Doodle Alibi supports a two-player Detective Mode judged by the TV", () => {
  const duelPlayers = players.slice(0, 2);
  assert.equal(doodleAlibiDefinition.minPlayers, 2);
  let state = createDoodleAlibiState(duelPlayers);
  assert.equal(state.duelMode, true);
  assert.equal(state.suspectUids.length, 1);

  const suspectUid = state.suspectUids[0];
  const innocentUid = duelPlayers.find((p) => p.uid !== suspectUid).uid;
  state = { ...state, phase: "vote", votes: {}, deadline: Date.now() + 10000 };

  assert.throws(
    () => reduceDoodleAlibiState(state, duelPlayers[0], { type: "voteSuspect", targetUid: suspectUid }, duelPlayers, {}, host.uid),
    /TV host makes the accusation/,
  );

  state = reduceDoodleAlibiState(state, host, { type: "voteSuspect", targetUid: suspectUid }, duelPlayers, {}, host.uid);
  state = reduceDoodleAlibiState(state, host, { type: "hostAdvance" }, duelPlayers, {}, host.uid);
  assert.equal(state.phase, "suspectGuess");
  state = reduceDoodleAlibiState(state, { ...duelPlayers.find((p) => p.uid === suspectUid) }, { type: "guessCommon", guess: state.case.common }, duelPlayers, {}, host.uid);
  state = reduceDoodleAlibiState(state, host, { type: "hostAdvance" }, duelPlayers, {}, host.uid);
  assert.equal(state.phase, "result");
  assert.equal(state.duelJudgeCorrect, true);
  assert.equal(state.scores[innocentUid].score, 200);
  assert.equal(state.scores[suspectUid].score, 250);
});

test("Doodle Alibi ships at least 45 cases and supports a two-suspect large room", () => {
  assert.ok(DOODLE_CASES.length >= 45);
  const state = createDoodleAlibiState([...players, { uid: "player-7", nickname: "P7", avatar: "🐻", seat: 6 }, { uid: "player-8", nickname: "P8", avatar: "🐼", seat: 7 }]);
  assert.equal(state.phase, "draw");
  assert.equal(state.suspectUids.length, 2);
  assert.ok(state.case.common.startsWith("Draw a "));
  assert.ok(state.case.suspect.startsWith("Draw a "));
});
