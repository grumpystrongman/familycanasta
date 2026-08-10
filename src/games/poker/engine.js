import { createStandardDeck, shuffleCards, sortStandardHand } from "../../platform/standardDeck.js";

export const POKER_RULES = Object.freeze({ playersMin: 2, playersMax: 6, startingPoints: 30, ante: 1, firstRaise: 1, secondRaise: 2, maxRaises: 3, maxDraw: 3 });

function activeUids(state, members) { return members.map((member) => member.uid).filter((uid) => state.inHand?.[uid] && !state.folded?.[uid]); }
function nextActiveIndex(state, members, startIndex) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (startIndex + offset) % members.length;
    const uid = members[index].uid;
    if (state.inHand?.[uid] && !state.folded?.[uid]) return index;
  }
  return startIndex;
}
function nextDrawIndex(state, members, startIndex, drawn) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (startIndex + offset) % members.length;
    const uid = members[index].uid;
    if (state.inHand?.[uid] && !state.folded?.[uid] && drawn?.[uid] == null) return index;
  }
  return startIndex;
}

export function evaluatePokerHand(cards) {
  const values = cards.map((card) => card.value).sort((a, b) => a - b);
  const counts = values.reduce((map, value) => ({ ...map, [value]: Number(map[value] || 0) + 1 }), {});
  const groups = Object.entries(counts).map(([value, count]) => ({ value: Number(value), count })).sort((a, b) => b.count - a.count || b.value - a.value);
  const flush = cards.length === 5 && cards.every((card) => card.suit === cards[0]?.suit);
  const unique = [...new Set(values)];
  const wheel = JSON.stringify(unique) === JSON.stringify([2,3,4,5,14]);
  const straight = unique.length === 5 && (wheel || unique[4] - unique[0] === 4);
  const straightHigh = wheel ? 5 : unique[4];
  if (straight && flush) return { category: 8, name: "Straight flush", tie: [straightHigh] };
  if (groups[0]?.count === 4) return { category: 7, name: "Four of a kind", tie: [groups[0].value, groups[1].value] };
  if (groups[0]?.count === 3 && groups[1]?.count === 2) return { category: 6, name: "Full house", tie: [groups[0].value, groups[1].value] };
  if (flush) return { category: 5, name: "Flush", tie: [...values].sort((a, b) => b - a) };
  if (straight) return { category: 4, name: "Straight", tie: [straightHigh] };
  if (groups[0]?.count === 3) return { category: 3, name: "Three of a kind", tie: [groups[0].value, ...groups.slice(1).map((group) => group.value).sort((a, b) => b - a)] };
  if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    const pairs = [groups[0].value, groups[1].value].sort((a, b) => b - a);
    return { category: 2, name: "Two pair", tie: [...pairs, groups[2].value] };
  }
  if (groups[0]?.count === 2) return { category: 1, name: "One pair", tie: [groups[0].value, ...groups.slice(1).map((group) => group.value).sort((a, b) => b - a)] };
  return { category: 0, name: "High card", tie: [...values].sort((a, b) => b - a) };
}

export function comparePokerHands(left, right) {
  const a = evaluatePokerHand(left); const b = evaluatePokerHand(right);
  if (a.category !== b.category) return a.category - b.category;
  for (let index = 0; index < Math.max(a.tie.length, b.tie.length); index += 1) {
    if ((a.tie[index] || 0) !== (b.tie[index] || 0)) return (a.tie[index] || 0) - (b.tie[index] || 0);
  }
  return 0;
}

function beginBetting(state, phase, members) {
  const base = { ...state, phase, currentBet: 0, bettingContrib: Object.fromEntries(members.map((member) => [member.uid, 0])), acted: {}, raises: 0 };
  const first = nextActiveIndex(base, members, Number(state.dealerIndex || 0));
  return { ...base, currentPlayerIndex: first, message: `${members[first].nickname} acts first.` };
}

function dealRound(members, roundNumber, previous = {}, random = Math.random) {
  if (members.length < 2 || members.length > 6) throw new Error("Family Five-Card Draw supports two to six players.");
  const startingPoints = Number(previous.startingPoints || POKER_RULES.startingPoints);
  const balances = { ...(previous.balances || Object.fromEntries(members.map((member) => [member.uid, startingPoints]))) };
  const inHand = Object.fromEntries(members.map((member) => [member.uid, Number(balances[member.uid] || 0) > 0]));
  const contenders = members.filter((member) => inHand[member.uid]);
  if (contenders.length < 2) {
    const winner = contenders[0];
    return { ...previous, phase: "game-over", winnerUid: winner?.uid || null, balances, message: winner ? `${winner.nickname} wins the point stack.` : "Game over." };
  }
  const dealerIndex = previous.dealerIndex == null ? 0 : (Number(previous.dealerIndex) + 1) % members.length;
  const ante = Number(previous.ante || POKER_RULES.ante);
  let pot = 0;
  contenders.forEach((member) => { const paid = Math.min(ante, balances[member.uid]); balances[member.uid] -= paid; pot += paid; });
  const deck = shuffleCards(createStandardDeck(`poker-${roundNumber}`), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  for (let cardIndex = 0; cardIndex < 5; cardIndex += 1) contenders.forEach((member) => hands[member.uid].push(deck.shift()));
  contenders.forEach((member) => { hands[member.uid] = sortStandardHand(hands[member.uid]); });
  return beginBetting({ roundNumber, dealerIndex, hands, deck, discards: [], balances, pot, inHand, folded: {}, drawn: {}, revealed: false, winners: [], winnerUid: null, startingPoints, ante, maxRaises: Number(previous.maxRaises || POKER_RULES.maxRaises) }, "betting-1", members);
}

export function createPokerGame(members, rules = {}, random = Math.random) {
  return dealRound(members, 1, { startingPoints: Number(rules.startingPoints || POKER_RULES.startingPoints), ante: Number(rules.ante || POKER_RULES.ante), maxRaises: Number(rules.maxRaises || POKER_RULES.maxRaises) }, random);
}

function payment(balances, uid, amount) {
  const next = { ...balances };
  const available = Math.max(0, Number(next[uid] || 0));
  if (available < amount) throw new Error("Not enough points to match that bet. Fold instead.");
  next[uid] = available - amount;
  return { balances: next, paid: amount };
}

function awardUncontested(state, members) {
  const remaining = activeUids(state, members);
  if (remaining.length !== 1) return null;
  const uid = remaining[0];
  const balances = { ...(state.balances || {}), [uid]: Number(state.balances?.[uid] || 0) + Number(state.pot || 0) };
  return { ...state, balances, pot: 0, phase: "round-end", winners: [uid], revealed: false, message: `${members.find((member) => member.uid === uid)?.nickname} wins because everyone else folded.` };
}

function bettingComplete(state, members) {
  return activeUids(state, members).every((uid) => state.acted?.[uid] && Number(state.bettingContrib?.[uid] || 0) === Number(state.currentBet || 0));
}

function startDraw(state, members) {
  const drawn = {};
  const first = nextDrawIndex(state, members, Number(state.dealerIndex || 0), drawn);
  return { ...state, phase: "drawing", currentPlayerIndex: first, drawn, message: `${members[first].nickname} chooses up to three cards to replace.` };
}

function showdown(state, members) {
  const uids = activeUids(state, members);
  let winners = [uids[0]];
  for (const uid of uids.slice(1)) {
    const comparison = comparePokerHands(state.hands[uid], state.hands[winners[0]]);
    if (comparison > 0) winners = [uid]; else if (comparison === 0) winners.push(uid);
  }
  const balances = { ...(state.balances || {}) };
  const share = Math.floor(Number(state.pot || 0) / winners.length);
  let remainder = Number(state.pot || 0) - share * winners.length;
  winners.forEach((uid) => { balances[uid] = Number(balances[uid] || 0) + share + (remainder-- > 0 ? 1 : 0); });
  const names = winners.map((uid) => members.find((member) => member.uid === uid)?.nickname).join(" + ");
  const handName = evaluatePokerHand(state.hands[winners[0]]).name;
  return { ...state, balances, pot: 0, phase: "round-end", revealed: true, winners, message: `${names} win${winners.length === 1 ? "s" : ""} with ${handName}.` };
}

function finishBetting(state, members) { return state.phase === "betting-1" ? startDraw(state, members) : showdown(state, members); }

function bet(state, actorUid, action, members) {
  if (!["betting-1","betting-2"].includes(state.phase)) throw new Error("Betting is closed.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your turn to act.");
  const folded = { ...(state.folded || {}) }; const acted = { ...(state.acted || {}) }; const bettingContrib = { ...(state.bettingContrib || {}) };
  let balances = { ...(state.balances || {}) }; let pot = Number(state.pot || 0); let currentBet = Number(state.currentBet || 0); let raises = Number(state.raises || 0);

  if (action.move === "fold") { folded[actorUid] = true; acted[actorUid] = true; }
  else if (action.move === "raise") {
    if (raises >= Number(state.maxRaises || POKER_RULES.maxRaises)) throw new Error("The raise limit has been reached for this betting round.");
    const increment = state.phase === "betting-1" ? POKER_RULES.firstRaise : POKER_RULES.secondRaise;
    const target = currentBet + increment; const needed = target - Number(bettingContrib[actorUid] || 0);
    const paid = payment(balances, actorUid, needed); balances = paid.balances; pot += paid.paid; bettingContrib[actorUid] = target; currentBet = target; raises += 1;
    Object.keys(acted).forEach((uid) => { acted[uid] = false; }); acted[actorUid] = true;
  } else {
    const needed = Math.max(0, currentBet - Number(bettingContrib[actorUid] || 0));
    const paid = payment(balances, actorUid, needed); balances = paid.balances; pot += paid.paid; bettingContrib[actorUid] = Number(bettingContrib[actorUid] || 0) + paid.paid; acted[actorUid] = true;
  }

  let next = { ...state, folded, acted, bettingContrib, balances, pot, currentBet, raises };
  const uncontested = awardUncontested(next, members); if (uncontested) return uncontested;
  if (bettingComplete(next, members)) return finishBetting(next, members);
  const nextIndex = nextActiveIndex(next, members, Number(state.currentPlayerIndex || 0));
  return { ...next, currentPlayerIndex: nextIndex, message: `${members[nextIndex].nickname} acts next.` };
}

function drawCards(state, actorUid, cardIds, members) {
  if (state.phase !== "drawing") throw new Error("It is not the draw round.");
  if (members[Number(state.currentPlayerIndex || 0)]?.uid !== actorUid) throw new Error("It is not your draw.");
  const selected = [...new Set(cardIds || [])];
  if (selected.length > POKER_RULES.maxDraw) throw new Error("This family table allows up to three replacement cards.");
  const hand = [...(state.hands?.[actorUid] || [])];
  if (selected.some((id) => !hand.some((card) => card.id === id))) throw new Error("One selected card is not in your hand.");
  const deck = [...(state.deck || [])];
  if (deck.length < selected.length) throw new Error("Not enough cards remain in the deck.");
  const discards = [...(state.discards || []), ...hand.filter((card) => selected.includes(card.id))];
  const kept = hand.filter((card) => !selected.includes(card.id)); while (kept.length < 5) kept.push(deck.shift());
  const hands = { ...(state.hands || {}), [actorUid]: sortStandardHand(kept) };
  const drawn = { ...(state.drawn || {}), [actorUid]: selected.length };
  const nextState = { ...state, hands, deck, discards, drawn };
  const remaining = activeUids(nextState, members).filter((uid) => drawn[uid] == null);
  if (!remaining.length) return beginBetting(nextState, "betting-2", members);
  const nextIndex = nextDrawIndex(nextState, members, Number(state.currentPlayerIndex || 0), drawn);
  return { ...nextState, currentPlayerIndex: nextIndex, message: `${members[nextIndex].nickname} chooses cards to replace.` };
}

export function reducePoker(state, actorUid, action, members, rules = {}) {
  if (action.type === "bet") return bet(state, actorUid, action, members);
  if (action.type === "draw") return drawCards(state, actorUid, action.cardIds, members);
  if (action.type === "next-round") {
    if (state.phase !== "round-end") throw new Error("The hand is not complete.");
    return dealRound(members, Number(state.roundNumber || 1) + 1, { ...state, startingPoints: Number(rules.startingPoints || state.startingPoints || POKER_RULES.startingPoints), ante: Number(rules.ante || state.ante || POKER_RULES.ante) });
  }
  throw new Error("Unknown Five-Card Draw action.");
}

function cardsToReplace(hand) {
  const counts = hand.reduce((map, card) => ({ ...map, [card.rank]: Number(map[card.rank] || 0) + 1 }), {});
  const keepRanks = new Set(Object.entries(counts).filter(([, count]) => count >= 2).map(([rank]) => rank));
  if (keepRanks.size) return hand.filter((card) => !keepRanks.has(card.rank)).slice(0, POKER_RULES.maxDraw).map((card) => card.id);
  return [...hand].sort((a, b) => a.value - b.value).slice(0, 3).map((card) => card.id);
}

export function choosePokerRobotMove(state, members) {
  if (["betting-1","betting-2"].includes(state.phase)) {
    const active = members[Number(state.currentPlayerIndex || 0)]; if (!active?.isRobot) return null;
    const hand = evaluatePokerHand(state.hands?.[active.uid] || []); const owed = Number(state.currentBet || 0) - Number(state.bettingContrib?.[active.uid] || 0);
    let move = "call";
    if (owed > Number(state.balances?.[active.uid] || 0)) move = "fold";
    else if (owed > 0 && hand.category === 0 && Number(state.balances?.[active.uid] || 0) > 5) move = "fold";
    else if (hand.category >= 2 && Number(state.raises || 0) < Number(state.maxRaises || POKER_RULES.maxRaises) && Number(state.balances?.[active.uid] || 0) >= owed + (state.phase === "betting-1" ? POKER_RULES.firstRaise : POKER_RULES.secondRaise)) move = "raise";
    return { uid: active.uid, action: { type: "bet", move }, key: `bet:${state.roundNumber}:${state.phase}:${active.uid}:${state.currentBet}:${state.raises}` };
  }
  if (state.phase === "drawing") {
    const active = members[Number(state.currentPlayerIndex || 0)]; if (!active?.isRobot) return null;
    return { uid: active.uid, action: { type: "draw", cardIds: cardsToReplace(state.hands?.[active.uid] || []) }, key: `draw:${state.roundNumber}:${active.uid}` };
  }
  return null;
}
