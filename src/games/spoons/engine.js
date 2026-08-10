import { createStandardDeck, shuffleCards, sortStandardHand } from "../../platform/standardDeck.js";

export const SPOONS_RULES = Object.freeze({ playersMin: 3, playersMax: 6, lettersToLose: 5 });

function activeMembers(members, eliminated = {}) {
  return members.filter((member) => !eliminated?.[member.uid]);
}

function replenish(drawPile, trash, random = Math.random) {
  if (drawPile.length) return { drawPile, trash };
  if (!trash.length) throw new Error("There are no cards left to pass.");
  return { drawPile: shuffleCards(trash, random), trash: [] };
}

function dealRound(members, roundNumber, previous = {}, random = Math.random) {
  const eliminated = { ...(previous.eliminated || {}) };
  const active = activeMembers(members, eliminated);
  if (active.length < 2) {
    const winner = active[0];
    return { ...previous, phase: "game-over", winnerUid: winner?.uid || null, message: winner ? `${winner.nickname} wins Spoons!` : "Game over." };
  }
  const deck = shuffleCards(createStandardDeck(`spoons-${roundNumber}`), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  for (let cardIndex = 0; cardIndex < 4; cardIndex += 1) {
    active.forEach((member) => hands[member.uid].push(deck.shift()));
  }
  active.forEach((member) => { hands[member.uid] = sortStandardHand(hands[member.uid]); });
  const dealerOffset = previous.dealerOffset == null ? 0 : (Number(previous.dealerOffset) + 1) % active.length;
  const flowOrder = [...active.slice(dealerOffset), ...active.slice(0, dealerOffset)].map((member) => member.uid);
  const incomingCard = deck.shift();
  return {
    phase: "passing",
    roundNumber,
    hands,
    drawPile: deck,
    trash: [],
    flowOrder,
    passPosition: 0,
    currentPlayerIndex: members.findIndex((member) => member.uid === flowOrder[0]),
    incomingCard,
    spoonsRemaining: Math.max(1, active.length - 1),
    grabbed: {},
    letters: { ...(previous.letters || {}) },
    eliminated,
    dealerOffset,
    winnerUid: null,
    roundLoserUid: null,
    message: `${members.find((member) => member.uid === flowOrder[0])?.nickname} chooses a card to pass.`,
  };
}

export function createSpoonsGame(members, rules = {}, random = Math.random) {
  if (members.length < SPOONS_RULES.playersMin || members.length > SPOONS_RULES.playersMax) throw new Error("Spoons supports three to six players at this table.");
  return { ...dealRound(members, 1, {}, random), lettersToLose: Number(rules.lettersToLose || SPOONS_RULES.lettersToLose) };
}

export function hasFourOfAKind(cards) {
  if (!cards || cards.length !== 4) return false;
  return cards.every((card) => card.rank === cards[0].rank);
}

function passCard(state, actorUid, cardId, members, random = Math.random) {
  if (state.phase !== "passing") throw new Error("Cards are not being passed right now.");
  const currentUid = state.flowOrder?.[Number(state.passPosition || 0)];
  if (currentUid !== actorUid) throw new Error("Wait for the card to reach you.");
  const hand = [...(state.hands?.[actorUid] || [])];
  const incoming = state.incomingCard;
  if (!incoming) throw new Error("No incoming card is available.");
  const five = [...hand, incoming];
  const chosen = five.find((card) => card.id === cardId);
  if (!chosen) throw new Error("Choose one of your five available cards to pass.");
  const kept = five.filter((card) => card.id !== cardId);
  if (kept.length !== 4) throw new Error("You must keep exactly four cards.");
  const hands = { ...(state.hands || {}), [actorUid]: sortStandardHand(kept) };

  if (hasFourOfAKind(kept)) {
    return {
      ...state,
      hands,
      phase: "grabbing",
      triggerUid: actorUid,
      message: `${members.find((member) => member.uid === actorUid)?.nickname} made four of a kind — grab a spoon!`,
    };
  }

  const nextPosition = Number(state.passPosition || 0) + 1;
  if (nextPosition < state.flowOrder.length) {
    const nextUid = state.flowOrder[nextPosition];
    return {
      ...state,
      hands,
      incomingCard: chosen,
      passPosition: nextPosition,
      currentPlayerIndex: members.findIndex((member) => member.uid === nextUid),
      message: `${members.find((member) => member.uid === nextUid)?.nickname} chooses a card to pass.`,
    };
  }

  let drawPile = [...(state.drawPile || [])];
  let trash = [...(state.trash || []), chosen];
  ({ drawPile, trash } = replenish(drawPile, trash, random));
  const nextIncoming = drawPile.shift();
  const firstUid = state.flowOrder[0];
  return {
    ...state,
    hands,
    drawPile,
    trash,
    incomingCard: nextIncoming,
    passPosition: 0,
    currentPlayerIndex: members.findIndex((member) => member.uid === firstUid),
    message: `${members.find((member) => member.uid === firstUid)?.nickname} starts the next pass.`,
  };
}

function grabSpoon(state, actorUid, members) {
  if (state.phase !== "grabbing") throw new Error("Nobody has started the spoon scramble yet.");
  if (state.eliminated?.[actorUid]) throw new Error("You are out of this game.");
  if (state.grabbed?.[actorUid]) throw new Error("You already have a spoon.");
  if (Number(state.spoonsRemaining || 0) <= 0) throw new Error("All spoons are gone.");
  const grabbed = { ...(state.grabbed || {}), [actorUid]: true };
  const spoonsRemaining = Number(state.spoonsRemaining) - 1;
  if (spoonsRemaining > 0) return { ...state, grabbed, spoonsRemaining, message: `${members.find((member) => member.uid === actorUid)?.nickname} grabbed a spoon!` };

  const active = activeMembers(members, state.eliminated);
  const loser = active.find((member) => !grabbed[member.uid]);
  const letters = { ...(state.letters || {}) };
  letters[loser.uid] = Number(letters[loser.uid] || 0) + 1;
  const eliminated = { ...(state.eliminated || {}) };
  if (letters[loser.uid] >= Number(state.lettersToLose || SPOONS_RULES.lettersToLose)) eliminated[loser.uid] = true;
  const survivors = activeMembers(members, eliminated);
  if (survivors.length === 1) {
    return { ...state, grabbed, spoonsRemaining: 0, letters, eliminated, phase: "game-over", winnerUid: survivors[0].uid, roundLoserUid: loser.uid, message: `${survivors[0].nickname} is the last player standing and wins Spoons!` };
  }
  return { ...state, grabbed, spoonsRemaining: 0, letters, eliminated, phase: "round-end", roundLoserUid: loser.uid, message: `${loser.nickname} missed a spoon and gets a letter.` };
}

export function reduceSpoons(state, actorUid, action, members, rules = {}) {
  if (action.type === "pass") return passCard(state, actorUid, action.cardId, members);
  if (action.type === "grab") return grabSpoon(state, actorUid, members);
  if (action.type === "next-round") {
    if (state.phase !== "round-end") throw new Error("This round is not finished.");
    return { ...dealRound(members, Number(state.roundNumber || 1) + 1, state), lettersToLose: Number(rules.lettersToLose || state.lettersToLose || SPOONS_RULES.lettersToLose) };
  }
  throw new Error("Unknown Spoons action.");
}

export function chooseSpoonsRobotMove(state, members) {
  if (state.phase === "grabbing") {
    const robot = members.find((member) => member.isRobot && !state.eliminated?.[member.uid] && !state.grabbed?.[member.uid]);
    return robot ? { uid: robot.uid, action: { type: "grab" }, key: `grab:${state.roundNumber}:${state.spoonsRemaining}:${robot.uid}` } : null;
  }
  if (state.phase !== "passing") return null;
  const uid = state.flowOrder?.[Number(state.passPosition || 0)];
  const robot = members.find((member) => member.uid === uid && member.isRobot);
  if (!robot) return null;
  const five = [...(state.hands?.[uid] || []), state.incomingCard].filter(Boolean);
  const counts = five.reduce((map, card) => ({ ...map, [card.rank]: Number(map[card.rank] || 0) + 1 }), {});
  const bestRank = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const pass = [...five].reverse().find((card) => card.rank !== bestRank) || five.at(-1);
  return pass ? { uid, action: { type: "pass", cardId: pass.id }, key: `pass:${state.roundNumber}:${state.passPosition}:${state.incomingCard?.id}` } : null;
}
