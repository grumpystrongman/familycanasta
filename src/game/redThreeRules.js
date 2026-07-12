import { DEFAULT_RULES, isRedThree, isWild, sortHand } from "./engine.js";

export function expectedRedThreeCount(deckCount) {
  const decks = Number(deckCount);
  if (decks === 2) return 4;
  if (decks === 3) return 6;
  throw new Error(`Unsupported deck count ${deckCount}. Canasta requires 2 or 3 decks.`);
}

export function validateConfiguredRedThreeCount(cards, deckCount) {
  const expected = expectedRedThreeCount(deckCount);
  const actual = (cards || []).filter(isRedThree).length;
  if (actual !== expected) {
    throw new Error(`Expected ${expected} red threes for ${deckCount} decks, found ${actual}.`);
  }
  return true;
}

function ensureRedThreeState(room, uid) {
  room.privateHands ||= {};
  room.privateHands[uid] ||= [];
  room.stock ||= [];
  room.publicState ||= {};
  room.publicState.redThrees ||= {};
  room.publicState.redThrees[uid] ||= [];
  room.publicState.handCounts ||= {};
}

function exposeRedThree(room, uid, card) {
  if (!isRedThree(card)) throw new Error("Only a red three can be exposed as a red three.");
  ensureRedThreeState(room, uid);
  const alreadyTracked = room.publicState.redThrees[uid].some((item) => item.id === card.id);
  if (alreadyTracked) throw new Error(`Red three ${card.id} is already exposed.`);
  room.publicState.redThrees[uid].push(card);
}

export function drawOneWithRedThreeReplacement(room, uid) {
  ensureRedThreeState(room, uid);
  const exposed = [];
  let replacementCard = null;
  let exhaustedOnRedThree = false;

  while (room.stock.length > 0) {
    const card = room.stock.pop();
    if (!card) break;

    if (isRedThree(card)) {
      exposeRedThree(room, uid, card);
      exposed.push(card);
      if (room.stock.length === 0) exhaustedOnRedThree = true;
      continue;
    }

    room.privateHands[uid].push(card);
    replacementCard = card;
    break;
  }

  room.privateHands[uid] = sortHand(room.privateHands[uid]);
  room.publicState.handCounts[uid] = room.privateHands[uid].length;
  room.publicState.stockCount = room.stock.length;

  return {
    card: replacementCard,
    exposed,
    stockExhausted: room.stock.length === 0,
    exhaustedOnRedThree,
  };
}

export function resolveRedThreesInHand(room, uid) {
  ensureRedThreeState(room, uid);
  const exposed = [];
  let replacements = 0;
  let exhaustedOnRedThree = false;

  while (true) {
    const hand = room.privateHands[uid];
    const index = hand.findIndex(isRedThree);
    if (index < 0) break;

    const [redThree] = hand.splice(index, 1);
    exposeRedThree(room, uid, redThree);
    exposed.push(redThree);

    if (!room.stock.length) {
      exhaustedOnRedThree = true;
      break;
    }

    const result = drawOneWithRedThreeReplacement(room, uid);
    exposed.push(...result.exposed);
    if (result.card) replacements += 1;
    if (result.exhaustedOnRedThree) {
      exhaustedOnRedThree = true;
      break;
    }
  }

  room.privateHands[uid] = sortHand(room.privateHands[uid]);
  room.publicState.handCounts[uid] = room.privateHands[uid].length;
  room.publicState.stockCount = room.stock.length;

  return { exposed, replacements, exhaustedOnRedThree };
}

export function extractRedThreesFromClaimedPile(room, uid, cards) {
  ensureRedThreeState(room, uid);
  const handCards = [];
  const exposed = [];

  for (const card of cards || []) {
    if (isRedThree(card)) {
      exposeRedThree(room, uid, card);
      exposed.push(card);
    } else {
      handCards.push(card);
    }
  }

  return { handCards, exposed };
}

export function initialDiscardIsFrozen(card, rules = {}) {
  const merged = { ...DEFAULT_RULES, ...rules };
  return Boolean(
    isRedThree(card)
    || (isWild(card) && merged.freezeOnWild !== false)
    || card?.rank === "3"
  );
}

export function redThreeScoreForTeam(room, team) {
  const rules = { ...DEFAULT_RULES, ...(room.rules || {}) };
  const cards = Object.entries(room.publicState?.redThrees || {})
    .filter(([uid]) => Number(room.members?.[uid]?.team) === Number(team))
    .flatMap(([, redThrees]) => redThrees || []);
  const count = cards.length;
  const expected = expectedRedThreeCount(Number(rules.deckCount || 2));
  if (count > expected) throw new Error(`Team ${team} has more red threes than the configured deck allows.`);

  const opened = Boolean(room.publicState?.opened?.[team]);
  const hasAll = count === expected;
  const allBonus = expected === 4
    ? Number(rules.twoDeckAllRedThreesScore || 800)
    : Number(rules.threeDeckAllRedThreesScore || 1000);
  const base = Number(rules.redThreeBonus || 100);
  const exposedPoints = hasAll ? allBonus : count * base;

  return {
    count,
    hasAll,
    opened,
    points: opened ? exposedPoints : -Math.abs(exposedPoints),
  };
}

export function hiddenRedThreePenalty(room, team) {
  const rules = { ...DEFAULT_RULES, ...(room.rules || {}) };
  const penaltyPerCard = Math.abs(Number(rules.redThreeInHandPenalty || 200));
  const players = Object.values(room.members || {})
    .filter((member) => Number(member.team) === Number(team));
  const count = players
    .flatMap((member) => room.privateHands?.[member.uid] || [])
    .filter(isRedThree)
    .length;
  return { count, points: -(count * penaltyPerCard) };
}
