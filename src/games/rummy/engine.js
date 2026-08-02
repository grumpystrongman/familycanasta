import { createStandardDeck, shuffleCards, sortStandardHand } from "../../platform/standardDeck.js";

export const RUMMY_RULES = Object.freeze({
  minimumPlayers: 2,
  maximumPlayers: 6,
  targetScore: 100,
});

export function cardsPerPlayer(playerCount) {
  if (playerCount === 2) return 10;
  if (playerCount <= 4) return 7;
  return 6;
}

export function rummyCardPoints(card) {
  if (card.rank === "A") return 1;
  if (["J", "Q", "K"].includes(card.rank)) return 10;
  return Number(card.rank);
}

function copyHands(hands) {
  return Object.fromEntries(Object.entries(hands || {}).map(([uid, cards]) => [uid, [...cards]]));
}

function runValue(card) {
  return card.rank === "A" ? 1 : card.value;
}

function sortedRun(cards) {
  return [...cards].sort((a, b) => runValue(a) - runValue(b));
}

export function classifyMeld(cards) {
  if (!Array.isArray(cards) || cards.length < 3) return null;
  const ids = new Set(cards.map((card) => card.id));
  if (ids.size !== cards.length) return null;

  const sameRank = new Set(cards.map((card) => card.rank)).size === 1;
  if (sameRank && cards.length <= 4) return { type: "set", cards: [...cards] };

  const sameSuit = new Set(cards.map((card) => card.suit)).size === 1;
  if (!sameSuit) return null;
  const ordered = sortedRun(cards);
  const consecutive = ordered.every((card, index) => index === 0 || runValue(card) === runValue(ordered[index - 1]) + 1);
  if (!consecutive) return null;
  return { type: "run", cards: ordered };
}

export function canLayOff(existingMeld, cards) {
  if (!existingMeld || !Array.isArray(cards) || !cards.length) return false;
  const combined = [...(existingMeld.cards || []), ...cards];
  const classified = classifyMeld(combined);
  return Boolean(classified && classified.type === existingMeld.type);
}

function dealRound(members, roundNumber, previous = {}, random = Math.random) {
  if (members.length < RUMMY_RULES.minimumPlayers || members.length > RUMMY_RULES.maximumPlayers) {
    throw new Error("Rummy supports two through six players.");
  }
  const dealerIndex = previous.dealerIndex == null ? 0 : (Number(previous.dealerIndex) + 1) % members.length;
  const deck = shuffleCards(createStandardDeck(`rummy-${roundNumber}`), random);
  const handSize = cardsPerPlayer(members.length);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  let cursor = 0;
  for (let pass = 0; pass < handSize; pass += 1) {
    for (const member of members) hands[member.uid].push(deck[cursor++]);
  }
  for (const uid of Object.keys(hands)) hands[uid] = sortStandardHand(hands[uid]);
  const openingDiscard = deck[cursor++];
  return {
    phase: "playing",
    turnPhase: "draw",
    roundNumber,
    dealerIndex,
    currentPlayerIndex: (dealerIndex + 1) % members.length,
    hands,
    stock: deck.slice(cursor),
    discardPile: [openingDiscard],
    melds: [],
    hasMelded: Object.fromEntries(members.map((member) => [member.uid, false])),
    scores: Object.fromEntries(members.map((member) => [member.uid, Number(previous.scores?.[member.uid] || 0)])),
    roundPoints: Object.fromEntries(members.map((member) => [member.uid, 0])),
    winnerUid: null,
    message: `${members[(dealerIndex + 1) % members.length].nickname} draws first.`,
  };
}

export function createRummyGame(members, rules = {}, random = Math.random) {
  return {
    ...dealRound(members, 1, {}, random),
    targetScore: Number(rules.targetScore || RUMMY_RULES.targetScore),
  };
}

function activeMember(state, members) {
  return members[Number(state.currentPlayerIndex || 0)];
}

function assertTurn(state, actorUid, members, phase) {
  if (state.phase !== "playing") throw new Error("The round is not active.");
  if (activeMember(state, members)?.uid !== actorUid) throw new Error("It is not your turn.");
  if (state.turnPhase !== phase) throw new Error(phase === "draw" ? "Draw a card first." : "You must draw before playing cards.");
}

function recycleStock(state, random = Math.random) {
  if (state.stock?.length) return { stock: [...state.stock], discardPile: [...state.discardPile] };
  if ((state.discardPile || []).length <= 1) throw new Error("No cards remain to draw.");
  const top = state.discardPile[state.discardPile.length - 1];
  const recycled = shuffleCards(state.discardPile.slice(0, -1), random);
  return { stock: recycled, discardPile: [top] };
}

function drawCard(state, actorUid, source, members) {
  assertTurn(state, actorUid, members, "draw");
  const hands = copyHands(state.hands);
  let stock = [...(state.stock || [])];
  let discardPile = [...(state.discardPile || [])];
  let card;

  if (source === "discard") {
    if (!discardPile.length) throw new Error("The discard pile is empty.");
    card = discardPile.pop();
  } else if (source === "stock") {
    ({ stock, discardPile } = recycleStock({ ...state, stock, discardPile }));
    card = stock.pop();
  } else {
    throw new Error("Choose the stock or discard pile.");
  }

  hands[actorUid] = sortStandardHand([...(hands[actorUid] || []), card]);
  return {
    ...state,
    hands,
    stock,
    discardPile,
    turnPhase: "action",
    message: `${activeMember(state, members).nickname} drew from the ${source}.`,
  };
}

function cardsFromHand(state, actorUid, cardIds) {
  const ids = new Set(cardIds || []);
  if (!ids.size || ids.size !== (cardIds || []).length) throw new Error("Select cards from your hand.");
  const hand = state.hands?.[actorUid] || [];
  const cards = hand.filter((card) => ids.has(card.id));
  if (cards.length !== ids.size) throw new Error("A selected card is no longer in your hand.");
  return cards;
}

function finishRound(state, winnerUid, members) {
  const roundPoints = Object.fromEntries(members.map((member) => [member.uid, 0]));
  const won = members.reduce((sum, member) => {
    if (member.uid === winnerUid) return sum;
    return sum + (state.hands?.[member.uid] || []).reduce((points, card) => points + rummyCardPoints(card), 0);
  }, 0);
  roundPoints[winnerUid] = won;
  const scores = { ...(state.scores || {}), [winnerUid]: Number(state.scores?.[winnerUid] || 0) + won };
  const gameOver = scores[winnerUid] >= Number(state.targetScore || RUMMY_RULES.targetScore);
  return {
    ...state,
    phase: gameOver ? "game-over" : "round-end",
    turnPhase: "complete",
    scores,
    roundPoints,
    winnerUid,
    message: gameOver
      ? `${members.find((member) => member.uid === winnerUid)?.nickname} wins Rummy.`
      : `${members.find((member) => member.uid === winnerUid)?.nickname} went out for ${won} points.`,
  };
}

function createMeld(state, actorUid, cardIds, members) {
  assertTurn(state, actorUid, members, "action");
  const cards = cardsFromHand(state, actorUid, cardIds);
  const classified = classifyMeld(cards);
  if (!classified) throw new Error("Choose at least three cards forming one set or run.");
  const hands = copyHands(state.hands);
  const ids = new Set(cardIds);
  hands[actorUid] = hands[actorUid].filter((card) => !ids.has(card.id));
  const melds = [...(state.melds || []), {
    id: `meld-${state.roundNumber}-${actorUid}-${state.melds?.length || 0}-${classified.cards.map((card) => card.id).join("-")}`,
    type: classified.type,
    cards: classified.cards,
    ownerUid: actorUid,
  }];
  const next = {
    ...state,
    hands,
    melds,
    hasMelded: { ...(state.hasMelded || {}), [actorUid]: true },
    message: `${activeMember(state, members).nickname} played a ${classified.type}.`,
  };
  return hands[actorUid].length === 0 ? finishRound(next, actorUid, members) : next;
}

function layOff(state, actorUid, meldId, cardIds, members) {
  assertTurn(state, actorUid, members, "action");
  if (!state.hasMelded?.[actorUid]) throw new Error("Play a meld of your own before laying off cards.");
  const cards = cardsFromHand(state, actorUid, cardIds);
  const target = (state.melds || []).find((meld) => meld.id === meldId);
  if (!target || !canLayOff(target, cards)) throw new Error("Those cards do not extend that meld.");
  const classified = classifyMeld([...(target.cards || []), ...cards]);
  const melds = (state.melds || []).map((meld) => meld.id === meldId ? { ...meld, cards: classified.cards } : meld);
  const ids = new Set(cardIds);
  const hands = copyHands(state.hands);
  hands[actorUid] = hands[actorUid].filter((card) => !ids.has(card.id));
  const next = { ...state, hands, melds, message: `${activeMember(state, members).nickname} laid off ${cards.length} card${cards.length === 1 ? "" : "s"}.` };
  return hands[actorUid].length === 0 ? finishRound(next, actorUid, members) : next;
}

function discardCard(state, actorUid, cardId, members) {
  assertTurn(state, actorUid, members, "action");
  const cards = cardsFromHand(state, actorUid, [cardId]);
  const hands = copyHands(state.hands);
  hands[actorUid] = hands[actorUid].filter((card) => card.id !== cardId);
  const next = {
    ...state,
    hands,
    discardPile: [...(state.discardPile || []), cards[0]],
    turnPhase: "draw",
    currentPlayerIndex: (Number(state.currentPlayerIndex || 0) + 1) % members.length,
    message: `${members[(Number(state.currentPlayerIndex || 0) + 1) % members.length].nickname} draws next.`,
  };
  return hands[actorUid].length === 0 ? finishRound(next, actorUid, members) : next;
}

export function reduceRummy(state, actorUid, action, members, rules = {}) {
  if (!state) throw new Error("The Rummy table is not ready.");
  if (action.type === "draw") return drawCard(state, actorUid, action.source, members);
  if (action.type === "meld") return createMeld(state, actorUid, action.cardIds, members);
  if (action.type === "layoff") return layOff(state, actorUid, action.meldId, action.cardIds, members);
  if (action.type === "discard") return discardCard(state, actorUid, action.cardId, members);
  if (action.type === "next-round") {
    if (state.phase !== "round-end") throw new Error("The round is not complete.");
    return {
      ...dealRound(members, Number(state.roundNumber || 1) + 1, state),
      targetScore: Number(rules.targetScore || state.targetScore || RUMMY_RULES.targetScore),
    };
  }
  throw new Error("Unknown Rummy action.");
}

function combinations(cards, size) {
  const result = [];
  function visit(start, chosen) {
    if (chosen.length === size) { result.push(chosen); return; }
    for (let index = start; index < cards.length; index += 1) visit(index + 1, [...chosen, cards[index]]);
  }
  visit(0, []);
  return result;
}

export function findRummyMeld(hand) {
  for (const size of [4, 3]) {
    for (const group of combinations(hand, size)) if (classifyMeld(group)?.type === "set") return group;
  }
  const bySuit = Object.groupBy ? Object.groupBy(hand, (card) => card.suit) : hand.reduce((groups, card) => ({ ...groups, [card.suit]: [...(groups[card.suit] || []), card] }), {});
  for (const suitCards of Object.values(bySuit)) {
    const ordered = sortedRun(suitCards);
    for (let start = 0; start < ordered.length; start += 1) {
      const run = [ordered[start]];
      for (let index = start + 1; index < ordered.length; index += 1) {
        if (runValue(ordered[index]) === runValue(run[run.length - 1]) + 1) run.push(ordered[index]);
        else if (runValue(ordered[index]) > runValue(run[run.length - 1]) + 1) break;
      }
      if (run.length >= 3) return run;
    }
  }
  return null;
}

function discardHelpsHand(discard, hand) {
  return Boolean(findRummyMeld([...hand, discard]));
}

export function chooseRummyRobotAction(state, robotUid, members) {
  if (state.phase !== "playing" || activeMember(state, members)?.uid !== robotUid) return null;
  const hand = state.hands?.[robotUid] || [];
  if (state.turnPhase === "draw") {
    const top = state.discardPile?.[state.discardPile.length - 1];
    return { type: "draw", source: top && discardHelpsHand(top, hand) ? "discard" : "stock" };
  }

  const meld = findRummyMeld(hand);
  if (meld) return { type: "meld", cardIds: meld.map((card) => card.id) };
  if (state.hasMelded?.[robotUid]) {
    for (const card of hand) {
      const target = (state.melds || []).find((candidate) => canLayOff(candidate, [card]));
      if (target) return { type: "layoff", meldId: target.id, cardIds: [card.id] };
    }
  }
  const discard = [...hand].sort((a, b) => rummyCardPoints(b) - rummyCardPoints(a) || b.value - a.value)[0];
  return discard ? { type: "discard", cardId: discard.id } : null;
}
