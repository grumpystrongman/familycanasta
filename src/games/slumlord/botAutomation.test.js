import assert from "node:assert/strict";
import test from "node:test";
import { createGame, currentPlayer, placeAuctionBid, startAuction } from "./engine.js";
import { botActionActor, runBotStep } from "./botAutomation.js";

const players = [
  { id: "human", name: "You", token: "🛠️", isBot: false },
  { id: "cpu", name: "CPU Landlord", token: "🪠", isBot: true, botLevel: "normal" },
];

test("CPU advances an auction even when the normal turn still belongs to the human", () => {
  const state = createGame(players, { rng: () => 0.5 });
  state.pendingAction = { type: "purchase", playerId: "human", spaceId: 3 };
  const auction = startAuction(state);
  const afterHumanBid = placeAuctionBid(auction, "human", 10);

  assert.equal(currentPlayer(afterHumanBid).id, "human");
  assert.equal(afterHumanBid.auction.currentBidderId, "cpu");
  assert.equal(botActionActor(afterHumanBid)?.id, "cpu");

  const afterCpu = runBotStep(afterHumanBid);
  assert.ok(!afterCpu.auction || afterCpu.auction.currentBidderId === "human");
});

test("a human auction bidder blocks the CPU from taking its ordinary turn", () => {
  const state = createGame(players, { rng: () => 0.5 });
  state.currentPlayerIndex = 1;
  state.pendingAction = { type: "purchase", playerId: "cpu", spaceId: 3 };
  const auction = startAuction(state);

  assert.equal(auction.auction.currentBidderId, "human");
  assert.equal(currentPlayer(auction).id, "cpu");
  assert.equal(botActionActor(auction), null);
});

test("CPU trade responses are scheduled even during a human turn", () => {
  const state = createGame(players, { rng: () => 0.5 });
  state.pendingTrade = {
    fromId: "human",
    toId: "cpu",
    offerPropertyIds: [],
    requestPropertyIds: [],
    offerCash: 0,
    requestCash: 0,
  };

  assert.equal(currentPlayer(state).id, "human");
  assert.equal(botActionActor(state)?.id, "cpu");
});
