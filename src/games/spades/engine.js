import { createStandardDeck, shuffleCards, sortStandardHand } from "../../platform/standardDeck.js";

export const SPADES_RULES = Object.freeze({
  players: 4,
  targetScore: 500,
  nilBonus: 100,
  bagPenalty: 100,
  bagsPerPenalty: 10,
});

function teamForIndex(index) { return index % 2; }
function copyHands(hands) { return Object.fromEntries(Object.entries(hands || {}).map(([uid, cards]) => [uid, [...cards]])); }

function dealRound(members, roundNumber, previous = {}, random = Math.random) {
  if (members.length !== 4) throw new Error("Spades requires exactly four players.");
  const deck = shuffleCards(createStandardDeck(`spades-${roundNumber}`), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  deck.forEach((card, index) => hands[members[index % 4].uid].push(card));
  for (const uid of Object.keys(hands)) hands[uid] = sortStandardHand(hands[uid]);
  const dealerIndex = previous.dealerIndex == null ? 0 : (Number(previous.dealerIndex) + 1) % 4;
  return {
    phase: "bidding",
    roundNumber,
    dealerIndex,
    currentPlayerIndex: (dealerIndex + 1) % 4,
    hands,
    bids: {},
    playerTricks: Object.fromEntries(members.map((member) => [member.uid, 0])),
    currentTrick: [],
    completedTricks: 0,
    spadesBroken: false,
    teamScores: { 0: Number(previous.teamScores?.[0] || 0), 1: Number(previous.teamScores?.[1] || 0) },
    teamBags: { 0: Number(previous.teamBags?.[0] || 0), 1: Number(previous.teamBags?.[1] || 0) },
    roundScore: { 0: 0, 1: 0 },
    message: `${members[(dealerIndex + 1) % 4].nickname} bids first.`,
    winnerTeam: null,
  };
}

export function createSpadesGame(members, rules = {}, random = Math.random) {
  return { ...dealRound(members, 1, {}, random), targetScore: Number(rules.targetScore || SPADES_RULES.targetScore) };
}

export function legalSpadesCards(state, actorUid, members) {
  if (state.phase !== "playing") return [];
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) return [];
  const hand = state.hands?.[actorUid] || [];
  const trick = state.currentTrick || [];
  if (!trick.length) {
    if (!state.spadesBroken && hand.some((card) => card.suit !== "spades")) return hand.filter((card) => card.suit !== "spades");
    return hand;
  }
  const leadSuit = trick[0].card.suit;
  const following = hand.filter((card) => card.suit === leadSuit);
  return following.length ? following : hand;
}

export function spadesTrickWinnerIndex(trick, members) {
  if (!trick?.length) return -1;
  const leadSuit = trick[0].card.suit;
  const spades = trick.filter((play) => play.card.suit === "spades");
  const eligible = spades.length ? spades : trick.filter((play) => play.card.suit === leadSuit);
  const winner = eligible.reduce((best, play) => play.card.value > best.card.value ? play : best);
  return members.findIndex((member) => member.uid === winner.uid);
}

export function scoreSpadesRound(state, members) {
  const roundScore = { 0: 0, 1: 0 };
  const teamBags = { 0: Number(state.teamBags?.[0] || 0), 1: Number(state.teamBags?.[1] || 0) };

  for (let team = 0; team < 2; team += 1) {
    const teamMembers = members.filter((_, index) => teamForIndex(index) === team);
    const contract = teamMembers.reduce((sum, member) => sum + Math.max(0, Number(state.bids?.[member.uid] || 0)), 0);
    const tricks = teamMembers.reduce((sum, member) => sum + Number(state.playerTricks?.[member.uid] || 0), 0);
    if (tricks >= contract) {
      const bags = tricks - contract;
      roundScore[team] += contract * 10 + bags;
      teamBags[team] += bags;
      while (teamBags[team] >= SPADES_RULES.bagsPerPenalty) {
        teamBags[team] -= SPADES_RULES.bagsPerPenalty;
        roundScore[team] -= SPADES_RULES.bagPenalty;
      }
    } else {
      roundScore[team] -= contract * 10;
    }

    for (const member of teamMembers) {
      if (Number(state.bids?.[member.uid]) === 0) {
        roundScore[team] += Number(state.playerTricks?.[member.uid] || 0) === 0 ? SPADES_RULES.nilBonus : -SPADES_RULES.nilBonus;
      }
    }
  }
  return { roundScore, teamBags };
}

function finishRound(state, members) {
  const scored = scoreSpadesRound(state, members);
  const teamScores = {
    0: Number(state.teamScores?.[0] || 0) + scored.roundScore[0],
    1: Number(state.teamScores?.[1] || 0) + scored.roundScore[1],
  };
  const target = Number(state.targetScore || SPADES_RULES.targetScore);
  const reached = [0, 1].filter((team) => teamScores[team] >= target);
  let winnerTeam = null;
  if (reached.length) winnerTeam = teamScores[0] === teamScores[1] ? null : teamScores[0] > teamScores[1] ? 0 : 1;
  return {
    ...state,
    phase: winnerTeam == null ? "round-end" : "game-over",
    roundScore: scored.roundScore,
    teamBags: scored.teamBags,
    teamScores,
    winnerTeam,
    message: winnerTeam == null ? "The hand is complete." : `Team ${winnerTeam + 1} wins Spades.`,
  };
}

function submitBid(state, actorUid, bid, members) {
  if (state.phase !== "bidding") throw new Error("Bidding is closed.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your bid.");
  const value = Number(bid);
  if (!Number.isInteger(value) || value < 0 || value > 13) throw new Error("Bid from zero (nil) through thirteen.");
  const bids = { ...(state.bids || {}), [actorUid]: value };
  const allBid = Object.keys(bids).length === members.length;
  return {
    ...state,
    bids,
    phase: allBid ? "playing" : "bidding",
    currentPlayerIndex: allBid ? (Number(state.dealerIndex) + 1) % 4 : (Number(state.currentPlayerIndex) + 1) % 4,
    message: allBid ? `${members[(Number(state.dealerIndex) + 1) % 4].nickname} leads.` : `${members[(Number(state.currentPlayerIndex) + 1) % 4].nickname} bids next.`,
  };
}

function playCard(state, actorUid, cardId, members) {
  const legal = legalSpadesCards(state, actorUid, members);
  const card = legal.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error("That card is not legal for this trick.");
  const hands = copyHands(state.hands);
  hands[actorUid] = hands[actorUid].filter((candidate) => candidate.id !== cardId);
  const currentTrick = [...(state.currentTrick || []), { uid: actorUid, card }];
  const spadesBroken = state.spadesBroken || card.suit === "spades";
  if (currentTrick.length < 4) {
    return { ...state, hands, currentTrick, spadesBroken, currentPlayerIndex: (Number(state.currentPlayerIndex) + 1) % 4, message: `${members.find((member) => member.uid === actorUid)?.nickname} played.` };
  }
  const winnerIndex = spadesTrickWinnerIndex(currentTrick, members);
  const winnerUid = members[winnerIndex].uid;
  const playerTricks = { ...(state.playerTricks || {}), [winnerUid]: Number(state.playerTricks?.[winnerUid] || 0) + 1 };
  const next = { ...state, hands, currentTrick: [], spadesBroken, currentPlayerIndex: winnerIndex, playerTricks, completedTricks: Number(state.completedTricks || 0) + 1, message: `${members[winnerIndex].nickname} takes the trick.` };
  return Object.values(hands).every((hand) => hand.length === 0) ? finishRound(next, members) : next;
}

export function reduceSpades(state, actorUid, action, members, rules = {}) {
  if (action.type === "bid") return submitBid(state, actorUid, action.bid, members);
  if (action.type === "play") return playCard(state, actorUid, action.cardId, members);
  if (action.type === "next-round") {
    if (state.phase !== "round-end") throw new Error("The hand is not complete.");
    return { ...dealRound(members, Number(state.roundNumber || 1) + 1, state), targetScore: Number(rules.targetScore || state.targetScore || SPADES_RULES.targetScore) };
  }
  throw new Error("Unknown Spades action.");
}

export function chooseSpadesRobotAction(state, robotUid, members) {
  if (state.phase === "bidding" && members[Number(state.currentPlayerIndex || 0)]?.uid === robotUid) {
    const hand = state.hands?.[robotUid] || [];
    const likely = hand.filter((card) => card.value >= 12).length + Math.max(0, hand.filter((card) => card.suit === "spades").length - 3);
    return { type: "bid", bid: Math.max(1, Math.min(6, likely)) };
  }
  if (state.phase !== "playing" || members[Number(state.currentPlayerIndex || 0)]?.uid !== robotUid) return null;
  const legal = legalSpadesCards(state, robotUid, members);
  if (!legal.length) return null;
  const ordered = [...legal].sort((a, b) => a.value - b.value);
  return { type: "play", cardId: ordered[0].id };
}
