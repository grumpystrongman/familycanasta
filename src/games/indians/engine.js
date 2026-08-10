import { createStandardDeck, shuffleCards, sortStandardHand } from "../../platform/standardDeck.js";

export const INDIANS_RULES = Object.freeze({ players: 4, maxRemovedRanks: 8, nilBonus: 100, bagPenalty: 100, bagsPerPenalty: 10 });
const REMOVAL_ORDER = Object.freeze(["2","3","4","5","6","7","8","9"]);

function teamForIndex(index) { return index % 2; }
function copyHands(hands) { return Object.fromEntries(Object.entries(hands || {}).map(([uid, cards]) => [uid, [...cards]])); }
export function removedRanksForRound(roundNumber) { return REMOVAL_ORDER.slice(0, Math.min(INDIANS_RULES.maxRemovedRanks, Math.max(0, Number(roundNumber || 1) - 1))); }
export function cardsPerPlayerForRound(roundNumber) { return 13 - removedRanksForRound(roundNumber).length; }

function dealRound(members, roundNumber, previous = {}, random = Math.random) {
  if (members.length !== 4) throw new Error("Indians requires exactly four players.");
  const removedRanks = removedRanksForRound(roundNumber);
  const deck = shuffleCards(createStandardDeck(`indians-${roundNumber}`).filter((card) => !removedRanks.includes(card.rank)), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  deck.forEach((card, index) => hands[members[index % 4].uid].push(card));
  Object.keys(hands).forEach((uid) => { hands[uid] = sortStandardHand(hands[uid]); });
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
    removedRanks,
    cardsPerPlayer: cardsPerPlayerForRound(roundNumber),
    winnerTeam: null,
    message: `${members[(dealerIndex + 1) % 4].nickname} bids first.`,
  };
}

export function createIndiansGame(members, rules = {}, random = Math.random) { return dealRound(members, 1, {}, random); }

export function legalIndiansCards(state, actorUid, members) {
  if (state.phase !== "playing") return [];
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) return [];
  const hand = state.hands?.[actorUid] || [];
  const trick = state.currentTrick || [];
  if (!trick.length) {
    if (!state.spadesBroken && hand.some((card) => card.suit !== "spades")) return hand.filter((card) => card.suit !== "spades");
    return hand;
  }
  const leadSuit = trick[0].card.suit;
  const matching = hand.filter((card) => card.suit === leadSuit);
  return matching.length ? matching : hand;
}

export function indiansTrickWinnerIndex(trick, members) {
  const leadSuit = trick[0].card.suit;
  const spades = trick.filter((play) => play.card.suit === "spades");
  const eligible = spades.length ? spades : trick.filter((play) => play.card.suit === leadSuit);
  const winner = eligible.reduce((best, play) => play.card.value > best.card.value ? play : best);
  return members.findIndex((member) => member.uid === winner.uid);
}

function scoreRound(state, members) {
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
      while (teamBags[team] >= INDIANS_RULES.bagsPerPenalty) { teamBags[team] -= INDIANS_RULES.bagsPerPenalty; roundScore[team] -= INDIANS_RULES.bagPenalty; }
    } else roundScore[team] -= contract * 10;
    teamMembers.forEach((member) => {
      if (Number(state.bids?.[member.uid]) === 0) roundScore[team] += Number(state.playerTricks?.[member.uid] || 0) === 0 ? INDIANS_RULES.nilBonus : -INDIANS_RULES.nilBonus;
    });
  }
  return { roundScore, teamBags };
}

function finishRound(state, members) {
  const scored = scoreRound(state, members);
  const teamScores = { 0: Number(state.teamScores?.[0] || 0) + scored.roundScore[0], 1: Number(state.teamScores?.[1] || 0) + scored.roundScore[1] };
  const progressionComplete = Number(state.roundNumber || 1) >= 9;
  const tied = teamScores[0] === teamScores[1];
  const winnerTeam = progressionComplete && !tied ? (teamScores[0] > teamScores[1] ? 0 : 1) : null;
  return {
    ...state,
    phase: winnerTeam == null ? "round-end" : "game-over",
    roundScore: scored.roundScore,
    teamBags: scored.teamBags,
    teamScores,
    winnerTeam,
    message: winnerTeam == null ? (progressionComplete && tied ? "Scores are tied. Another five-card sudden-death hand will decide it." : "Hand complete. The deck gets smaller next hand.") : `Team ${winnerTeam + 1} wins Indians.`,
  };
}

function submitBid(state, actorUid, bid, members) {
  if (state.phase !== "bidding") throw new Error("Bidding is closed.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your bid.");
  const value = Number(bid);
  if (!Number.isInteger(value) || value < 0 || value > Number(state.cardsPerPlayer || 13)) throw new Error(`Bid from zero through ${state.cardsPerPlayer}.`);
  const bids = { ...(state.bids || {}), [actorUid]: value };
  const allBid = Object.keys(bids).length === members.length;
  return { ...state, bids, phase: allBid ? "playing" : "bidding", currentPlayerIndex: allBid ? (Number(state.dealerIndex) + 1) % 4 : (Number(state.currentPlayerIndex) + 1) % 4, message: allBid ? `${members[(Number(state.dealerIndex) + 1) % 4].nickname} leads.` : `${members[(Number(state.currentPlayerIndex) + 1) % 4].nickname} bids next.` };
}

function playCard(state, actorUid, cardId, members) {
  const legal = legalIndiansCards(state, actorUid, members);
  const card = legal.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error("That card is not legal for this trick.");
  const hands = copyHands(state.hands);
  hands[actorUid] = hands[actorUid].filter((candidate) => candidate.id !== cardId);
  const currentTrick = [...(state.currentTrick || []), { uid: actorUid, card }];
  const spadesBroken = state.spadesBroken || card.suit === "spades";
  if (currentTrick.length < 4) return { ...state, hands, currentTrick, spadesBroken, currentPlayerIndex: (Number(state.currentPlayerIndex) + 1) % 4, message: `${members.find((member) => member.uid === actorUid)?.nickname} played.` };
  const winnerIndex = indiansTrickWinnerIndex(currentTrick, members);
  const winnerUid = members[winnerIndex].uid;
  const playerTricks = { ...(state.playerTricks || {}), [winnerUid]: Number(state.playerTricks?.[winnerUid] || 0) + 1 };
  const next = { ...state, hands, currentTrick: [], spadesBroken, currentPlayerIndex: winnerIndex, playerTricks, completedTricks: Number(state.completedTricks || 0) + 1, message: `${members[winnerIndex].nickname} takes the trick.` };
  return Object.values(hands).every((hand) => hand.length === 0) ? finishRound(next, members) : next;
}

export function reduceIndians(state, actorUid, action, members) {
  if (action.type === "bid") return submitBid(state, actorUid, action.bid, members);
  if (action.type === "play") return playCard(state, actorUid, action.cardId, members);
  if (action.type === "next-round") {
    if (state.phase !== "round-end") throw new Error("The hand is not complete.");
    return dealRound(members, Number(state.roundNumber || 1) + 1, state);
  }
  throw new Error("Unknown Indians action.");
}

export function chooseIndiansRobotMove(state, members) {
  const active = members[Number(state.currentPlayerIndex || 0)];
  if (!active?.isRobot) return null;
  if (state.phase === "bidding") {
    const hand = state.hands?.[active.uid] || [];
    const likely = hand.filter((card) => card.value >= 12).length + Math.max(0, hand.filter((card) => card.suit === "spades").length - Math.max(1, Math.floor(hand.length / 4)));
    return { uid: active.uid, action: { type: "bid", bid: Math.max(0, Math.min(hand.length, likely)) }, key: `bid:${state.roundNumber}:${active.uid}` };
  }
  if (state.phase !== "playing") return null;
  const legal = legalIndiansCards(state, active.uid, members);
  const card = [...legal].sort((a, b) => a.value - b.value)[0];
  return card ? { uid: active.uid, action: { type: "play", cardId: card.id }, key: `play:${state.roundNumber}:${state.completedTricks}:${state.currentTrick?.length || 0}:${active.uid}` } : null;
}
