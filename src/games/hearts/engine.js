import { createStandardDeck, shuffleCards, sortStandardHand } from "../../platform/StandardCard";

export const HEARTS_RULES = Object.freeze({
  players: 4,
  targetScore: 100,
  passCycle: ["left", "right", "across", "hold"],
  heartPoints: 1,
  queenOfSpadesPoints: 13,
  shootTheMoonPoints: 26,
});

function copyHands(hands) {
  return Object.fromEntries(Object.entries(hands || {}).map(([uid, cards]) => [uid, [...cards]]));
}

function cardIs(card, rank, suit) {
  return card?.rank === rank && card?.suit === suit;
}

export function passDirection(roundNumber) {
  return HEARTS_RULES.passCycle[(Number(roundNumber || 1) - 1) % HEARTS_RULES.passCycle.length];
}

export function passRecipientIndex(playerIndex, direction, playerCount = 4) {
  if (direction === "left") return (playerIndex + 1) % playerCount;
  if (direction === "right") return (playerIndex - 1 + playerCount) % playerCount;
  if (direction === "across") return (playerIndex + 2) % playerCount;
  return playerIndex;
}

function dealRound(members, roundNumber, previousScores = {}, random = Math.random) {
  if (members.length !== HEARTS_RULES.players) throw new Error("Hearts requires exactly four players.");
  const deck = shuffleCards(createStandardDeck(`hearts-${roundNumber}`), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  deck.forEach((card, index) => hands[members[index % members.length].uid].push(card));
  for (const uid of Object.keys(hands)) hands[uid] = sortStandardHand(hands[uid]);

  const direction = passDirection(roundNumber);
  const openingIndex = members.findIndex((member) => hands[member.uid].some((card) => cardIs(card, "2", "clubs")));
  return {
    phase: direction === "hold" ? "playing" : "passing",
    roundNumber,
    passDirection: direction,
    pendingPasses: {},
    hands,
    captured: Object.fromEntries(members.map((member) => [member.uid, []])),
    scores: Object.fromEntries(members.map((member) => [member.uid, Number(previousScores[member.uid] || 0)])),
    roundPoints: Object.fromEntries(members.map((member) => [member.uid, 0])),
    currentPlayerIndex: openingIndex,
    currentTrick: [],
    completedTricks: 0,
    heartsBroken: false,
    message: direction === "hold" ? `${members[openingIndex].nickname} leads the 2♣.` : `Pass three cards ${direction}.`,
    winnerUid: null,
  };
}

export function createHeartsGame(members, rules = {}, random = Math.random) {
  return { ...dealRound(members, 1, {}, random), targetScore: Number(rules.targetScore || HEARTS_RULES.targetScore) };
}

export function legalHeartsCards(state, actorUid, members) {
  const hand = state.hands?.[actorUid] || [];
  if (state.phase !== "playing") return [];
  const active = members[Number(state.currentPlayerIndex || 0)];
  if (active?.uid !== actorUid) return [];

  const trick = state.currentTrick || [];
  if (!trick.length) {
    if (Number(state.completedTricks || 0) === 0) return hand.filter((card) => cardIs(card, "2", "clubs"));
    if (!state.heartsBroken && hand.some((card) => card.suit !== "hearts")) return hand.filter((card) => card.suit !== "hearts");
    return hand;
  }

  const leadSuit = trick[0].card.suit;
  const following = hand.filter((card) => card.suit === leadSuit);
  if (following.length) return following;

  if (Number(state.completedTricks || 0) === 0) {
    const safe = hand.filter((card) => card.suit !== "hearts" && !cardIs(card, "Q", "spades"));
    if (safe.length) return safe;
  }
  return hand;
}

export function trickWinnerIndex(trick, members) {
  if (!trick?.length) return -1;
  const leadSuit = trick[0].card.suit;
  const winningPlay = trick
    .filter((play) => play.card.suit === leadSuit)
    .reduce((best, play) => (play.card.value > best.card.value ? play : best));
  return members.findIndex((member) => member.uid === winningPlay.uid);
}

export function heartsRoundScore(captured, memberUids) {
  const points = Object.fromEntries(memberUids.map((uid) => [uid, 0]));
  for (const uid of memberUids) {
    for (const card of captured?.[uid] || []) {
      if (card.suit === "hearts") points[uid] += HEARTS_RULES.heartPoints;
      if (cardIs(card, "Q", "spades")) points[uid] += HEARTS_RULES.queenOfSpadesPoints;
    }
  }
  const shooter = memberUids.find((uid) => points[uid] === HEARTS_RULES.shootTheMoonPoints);
  if (shooter) {
    for (const uid of memberUids) points[uid] = uid === shooter ? 0 : HEARTS_RULES.shootTheMoonPoints;
  }
  return { points, shooterUid: shooter || null };
}

function finishRound(state, members) {
  const uids = members.map((member) => member.uid);
  const scored = heartsRoundScore(state.captured, uids);
  const scores = Object.fromEntries(uids.map((uid) => [uid, Number(state.scores?.[uid] || 0) + scored.points[uid]]));
  const target = Number(state.targetScore || HEARTS_RULES.targetScore);
  const gameOver = Object.values(scores).some((score) => score >= target);
  const winnerUid = gameOver
    ? [...uids].sort((a, b) => scores[a] - scores[b])[0]
    : null;
  const shooterName = members.find((member) => member.uid === scored.shooterUid)?.nickname;
  return {
    ...state,
    phase: gameOver ? "game-over" : "round-end",
    scores,
    roundPoints: scored.points,
    winnerUid,
    message: shooterName
      ? `${shooterName} shot the moon!`
      : gameOver
        ? `${members.find((member) => member.uid === winnerUid)?.nickname} wins Hearts.`
        : "The hand is complete.",
  };
}

function submitPass(state, actorUid, cardIds, members) {
  if (state.phase !== "passing") throw new Error("Card passing is not active.");
  if (state.pendingPasses?.[actorUid]) throw new Error("You already submitted your pass.");
  if (!Array.isArray(cardIds) || cardIds.length !== 3 || new Set(cardIds).size !== 3) throw new Error("Select exactly three cards.");
  const hand = state.hands?.[actorUid] || [];
  if (cardIds.some((id) => !hand.some((card) => card.id === id))) throw new Error("A selected card is no longer in your hand.");

  const pendingPasses = { ...(state.pendingPasses || {}), [actorUid]: [...cardIds] };
  if (Object.keys(pendingPasses).length < members.length) {
    return { ...state, pendingPasses, message: "Waiting for the remaining passes." };
  }

  const hands = copyHands(state.hands);
  const incoming = Object.fromEntries(members.map((member) => [member.uid, []]));
  members.forEach((member, index) => {
    const outgoingIds = new Set(pendingPasses[member.uid]);
    const outgoing = hands[member.uid].filter((card) => outgoingIds.has(card.id));
    hands[member.uid] = hands[member.uid].filter((card) => !outgoingIds.has(card.id));
    const recipient = members[passRecipientIndex(index, state.passDirection, members.length)].uid;
    incoming[recipient].push(...outgoing);
  });
  for (const member of members) hands[member.uid] = sortStandardHand([...hands[member.uid], ...incoming[member.uid]]);
  const openingIndex = members.findIndex((member) => hands[member.uid].some((card) => cardIs(card, "2", "clubs")));
  return {
    ...state,
    phase: "playing",
    pendingPasses,
    hands,
    currentPlayerIndex: openingIndex,
    message: `${members[openingIndex].nickname} leads the 2♣.`,
  };
}

function playCard(state, actorUid, cardId, members) {
  const legal = legalHeartsCards(state, actorUid, members);
  const card = legal.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error("That card is not legal for this trick.");

  const hands = copyHands(state.hands);
  hands[actorUid] = hands[actorUid].filter((candidate) => candidate.id !== cardId);
  const currentTrick = [...(state.currentTrick || []), { uid: actorUid, card }];
  const heartsBroken = state.heartsBroken || card.suit === "hearts";
  if (currentTrick.length < members.length) {
    return {
      ...state,
      hands,
      currentTrick,
      heartsBroken,
      currentPlayerIndex: (Number(state.currentPlayerIndex || 0) + 1) % members.length,
      message: `${members.find((member) => member.uid === actorUid)?.nickname} played ${card.rank}${card.suit[0].toUpperCase()}.`,
    };
  }

  const winnerIndex = trickWinnerIndex(currentTrick, members);
  const winnerUid = members[winnerIndex].uid;
  const captured = { ...(state.captured || {}), [winnerUid]: [...(state.captured?.[winnerUid] || []), ...currentTrick.map((play) => play.card)] };
  const next = {
    ...state,
    hands,
    captured,
    currentTrick: [],
    currentPlayerIndex: winnerIndex,
    completedTricks: Number(state.completedTricks || 0) + 1,
    heartsBroken,
    message: `${members[winnerIndex].nickname} takes the trick.`,
  };
  return Object.values(hands).every((hand) => hand.length === 0) ? finishRound(next, members) : next;
}

export function reduceHearts(state, actorUid, action, members, rules = {}) {
  if (!state) throw new Error("The Hearts table is not ready.");
  if (action.type === "pass") return submitPass(state, actorUid, action.cardIds, members);
  if (action.type === "play") return playCard(state, actorUid, action.cardId, members);
  if (action.type === "next-round") {
    if (state.phase !== "round-end") throw new Error("The current round is not finished.");
    return { ...dealRound(members, Number(state.roundNumber || 1) + 1, state.scores), targetScore: Number(rules.targetScore || state.targetScore || HEARTS_RULES.targetScore) };
  }
  throw new Error("Unknown Hearts action.");
}

function cardRisk(card) {
  if (cardIs(card, "Q", "spades")) return 100;
  if (card.suit === "hearts") return 40 + card.value;
  if (card.suit === "spades" && card.value >= 13) return 30 + card.value;
  return card.value;
}

export function chooseHeartsRobotAction(state, robotUid, members) {
  if (state.phase === "passing" && !state.pendingPasses?.[robotUid]) {
    const cards = [...(state.hands?.[robotUid] || [])].sort((a, b) => cardRisk(b) - cardRisk(a)).slice(0, 3);
    return { type: "pass", cardIds: cards.map((card) => card.id) };
  }
  if (state.phase !== "playing" || members[Number(state.currentPlayerIndex || 0)]?.uid !== robotUid) return null;
  const legal = legalHeartsCards(state, robotUid, members);
  if (!legal.length) return null;
  const trickHasPenalty = (state.currentTrick || []).some((play) => play.card.suit === "hearts" || cardIs(play.card, "Q", "spades"));
  const ordered = [...legal].sort((a, b) => trickHasPenalty ? cardRisk(b) - cardRisk(a) : cardRisk(a) - cardRisk(b));
  return { type: "play", cardId: ordered[0].id };
}
