import {
  cardPoints,
  finishRound,
  isBlackThree,
  isRedThree,
  isWild,
  openingRequirementForTeam,
} from "./engine";
import { planDiscardPickup } from "./discardPickupPlanner";

const rankOrder = ["4","5","6","7","8","9","10","J","Q","K","A","2","JOKER","3"];

function groupNaturals(hand) {
  return hand.reduce((groups, card) => {
    if (!isWild(card) && card.rank !== "3") (groups[card.rank] ||= []).push(card);
    return groups;
  }, {});
}

function getTeamMelds(state, team) {
  return [...(state.publicState.teamBoards?.[team] || state.publicState.teamMelds?.[team] || [])]
    .map((meld) => ({ ...meld, cards: [...(meld.cards || [])] }));
}

function pickupPlanOrNull(state, player) {
  try {
    return planDiscardPickup(state, player);
  } catch {
    return null;
  }
}

function pileValue(state, player, hand) {
  const pile = state.publicState.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top) return -Infinity;
  const matches = hand.filter((card) => card.rank === top.rank).length;
  return pile.length * 2 + matches * 12 + cardPoints(top);
}

function takePileForRobot(state, player, hand, plan) {
  state.publicState.teamBoards ||= {};
  state.publicState.teamMelds ||= {};
  state.publicState.opened ||= {};

  if (plan.mode === "pending-opening") {
    state.privateHands[player.uid] = [...hand, ...plan.pile];
    state.publicState.pendingDiscardPickup = {
      uid: player.uid,
      team: player.team,
      rank: plan.rank,
      topCardId: plan.top.id,
      matchingNaturalIds: plan.matchingNaturalIds,
      requiredNaturalCount: plan.requiredNaturalCount,
      requirement: plan.requirement,
    };
  } else {
    const melds = getTeamMelds(state, player.team);
    const existing = melds.find((meld) => meld.rank === plan.top.rank);
    if (existing) existing.cards.push(...plan.forcedCards);
    else melds.push({ rank: plan.top.rank, cards: [...plan.forcedCards] });
    const used = new Set(plan.usedNaturalIds);
    state.privateHands[player.uid] = [
      ...hand.filter((card) => !used.has(card.id)),
      ...plan.lowerPile,
    ];
    state.publicState.teamBoards[player.team] = melds;
    state.publicState.teamMelds[player.team] = melds;
    state.publicState.pendingDiscardPickup = null;
  }

  state.publicState.discardPile = [];
  state.publicState.discardFrozen = false;
  state.publicState.discardPileHasBeenTaken = true;
  return state.privateHands[player.uid];
}

function drawForRobot(state, player, rules) {
  let hand = [...(state.privateHands[player.uid] || [])];
  const stock = [...(state.stock || [])];
  let source = "stock";
  const pickupPlan = pickupPlanOrNull(state, player);

  if (pickupPlan && pileValue(state, player, hand) >= 18) {
    hand = takePileForRobot(state, player, hand, pickupPlan);
    source = "discard pile";
  } else {
    const drawCount = Math.max(1, Number(rules.drawCount || 2));
    for (let draw = 0; draw < drawCount && stock.length; draw += 1) hand.push(stock.pop());
    state.stock = stock;
    state.publicState.stockCount = stock.length;
    state.privateHands[player.uid] = hand;
  }

  return source;
}

function candidateMelds(hand, currentMelds, rules) {
  const naturals = groupNaturals(hand);
  const availableWilds = hand.filter(isWild).sort((a, b) => cardPoints(a) - cardPoints(b));
  const candidates = [];

  for (const meld of currentMelds) {
    const matching = naturals[meld.rank] || [];
    if (matching.length) {
      candidates.push({
        rank: meld.rank,
        cards: [...matching],
        existing: true,
        score: matching.reduce((sum, card) => sum + cardPoints(card), 0) + 25,
      });
    }
  }

  const newRanks = Object.entries(naturals)
    .filter(([rank]) => !currentMelds.some((meld) => meld.rank === rank));
  const pairs = newRanks
    .filter(([, cards]) => cards.length === 2)
    .sort(([, left], [, right]) => {
      const leftPoints = left.reduce((sum, card) => sum + cardPoints(card), 0);
      const rightPoints = right.reduce((sum, card) => sum + cardPoints(card), 0);
      return rightPoints - leftPoints;
    });
  const naturalMelds = newRanks
    .filter(([, cards]) => cards.length >= 3)
    .sort(([, left], [, right]) => {
      const leftPoints = left.reduce((sum, card) => sum + cardPoints(card), 0);
      const rightPoints = right.reduce((sum, card) => sum + cardPoints(card), 0);
      return rightPoints - leftPoints;
    });

  for (const [rank, cards] of pairs) {
    if (!availableWilds.length) break;
    const selected = [...cards, ...availableWilds.splice(0, 1)];
    candidates.push({
      rank,
      cards: selected,
      existing: false,
      score: selected.reduce((sum, card) => sum + cardPoints(card), 0),
    });
  }

  for (const [rank, cards] of naturalMelds) {
    const maxWilds = Math.min(
      Number(rules.maxWildsPerMeld || 3),
      cards.length - 1,
      availableWilds.length,
    );
    const usefulWilds = maxWilds > 0 && cards.length < 7
      ? availableWilds.splice(0, Math.min(maxWilds, 7 - cards.length))
      : [];
    const selected = [...cards, ...usefulWilds];
    candidates.push({
      rank,
      cards: selected,
      existing: false,
      score: selected.reduce((sum, card) => sum + cardPoints(card), 0),
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function candidateSatisfiesPending(candidate, pending) {
  if (!pending || candidate.rank !== pending.rank) return false;
  const ids = new Set(candidate.cards.map((card) => card.id));
  if (!ids.has(pending.topCardId)) return false;
  const matches = (pending.matchingNaturalIds || []).filter((id) => ids.has(id)).length;
  return matches >= Number(pending.requiredNaturalCount || 2);
}

function uniqueSelectedCards(selected, hand) {
  const handIds = new Set(hand.map((card) => card.id));
  const used = new Set();
  const cards = [];
  for (const candidate of selected) {
    for (const card of candidate.cards) {
      if (!handIds.has(card.id) || used.has(card.id)) continue;
      used.add(card.id);
      cards.push(card);
    }
  }
  return cards;
}

function applyMelds(state, player, rules) {
  let hand = [...(state.privateHands[player.uid] || [])];
  const team = player.team;
  const currentMelds = getTeamMelds(state, team);
  const opened = Boolean(state.publicState.opened?.[team]);
  const requirement = openingRequirementForTeam(state, team);
  const candidates = candidateMelds(hand, currentMelds, rules);
  const pending = state.publicState?.pendingDiscardPickup?.uid === player.uid
    ? state.publicState.pendingDiscardPickup
    : null;
  let selected = [];

  if (opened) {
    selected = candidates;
  } else {
    let running = 0;
    const remaining = [...candidates];
    if (pending) {
      const requiredIndex = remaining.findIndex((candidate) => candidateSatisfiesPending(candidate, pending));
      if (requiredIndex < 0) return { count: 0, ranks: [] };
      const [required] = remaining.splice(requiredIndex, 1);
      selected.push(required);
      running += required.cards.reduce((sum, card) => sum + cardPoints(card), 0);
    }
    for (const candidate of remaining) {
      if (running >= requirement) break;
      selected.push(candidate);
      running += candidate.cards.reduce((sum, card) => sum + cardPoints(card), 0);
    }
    const actualOpeningCards = uniqueSelectedCards(selected, hand);
    const actualOpeningPoints = actualOpeningCards.reduce((sum, card) => sum + cardPoints(card), 0);
    if (actualOpeningPoints < requirement) selected = [];
  }

  if (!selected.length) return { count: 0, ranks: [] };
  const used = new Set();
  for (const candidate of selected) {
    const availableCards = candidate.cards.filter(
      (card) => !used.has(card.id) && hand.some((held) => held.id === card.id),
    );
    if (!availableCards.length) continue;
    const existing = currentMelds.find((meld) => meld.rank === candidate.rank);
    if (existing) existing.cards.push(...availableCards);
    else currentMelds.push({ rank: candidate.rank, cards: availableCards });
    availableCards.forEach((card) => used.add(card.id));
  }

  hand = hand.filter((card) => !used.has(card.id));
  state.privateHands[player.uid] = hand;
  state.publicState.teamBoards ||= {};
  state.publicState.teamMelds ||= {};
  state.publicState.teamBoards[team] = currentMelds;
  state.publicState.teamMelds[team] = currentMelds;
  state.publicState.opened ||= {};
  state.publicState.opened[team] = true;
  state.publicState.pendingDiscardPickup = null;
  return { count: used.size, ranks: selected.map((candidate) => candidate.rank) };
}

function discardScore(card, hand, melds) {
  if (isWild(card)) return 1000 + cardPoints(card);
  if (isRedThree(card)) return 2000;
  if (isBlackThree(card)) return 45;
  if (melds.some((meld) => meld.rank === card.rank)) return 400;
  const sameRank = hand.filter((held) => held.rank === card.rank).length;
  const rankPenalty = rankOrder.indexOf(card.rank);
  return sameRank * 80 + cardPoints(card) * 3 + rankPenalty;
}

function discardForRobot(state, player, rules) {
  if (state.publicState?.pendingDiscardPickup?.uid === player.uid) return null;
  const hand = [...(state.privateHands[player.uid] || [])];
  if (!hand.length) return null;
  const melds = getTeamMelds(state, player.team);
  const candidates = hand.filter((card) => !isRedThree(card));
  const discard = (candidates.length ? candidates : hand)
    .sort((a, b) => discardScore(a, hand, melds) - discardScore(b, hand, melds))[0];
  state.privateHands[player.uid] = hand.filter((card) => card.id !== discard.id);
  state.publicState.discardPile ||= [];
  state.publicState.discardPile.push(discard);
  if (isWild(discard) && rules.freezeOnWild !== false) state.publicState.discardFrozen = true;
  return discard;
}

function replaceRedThrees(state, player) {
  let hand = [...(state.privateHands[player.uid] || [])];
  const stock = [...(state.stock || [])];
  const redThrees = [];
  let index = hand.findIndex(isRedThree);
  while (index >= 0) {
    redThrees.push(hand[index]);
    hand.splice(index, 1);
    if (stock.length) hand.push(stock.pop());
    index = hand.findIndex(isRedThree);
  }
  state.privateHands[player.uid] = hand;
  state.stock = stock;
  state.publicState.stockCount = stock.length;
  state.publicState.redThrees ||= {};
  state.publicState.redThrees[player.uid] ||= [];
  state.publicState.redThrees[player.uid].push(...redThrees);
  return redThrees.length;
}

export function executeRobotTurn(room) {
  const state = structuredClone(room);
  const players = Object.values(state.members || {}).sort((a, b) => a.seat - b.seat);
  const index = Number(state.publicState?.currentPlayerIndex || 0);
  const player = players[index];
  if (!player?.isRobot || state.status !== "playing" || state.publicState?.phase !== "playing") return room;

  state.publicState.turnPhase = "draw";
  const source = drawForRobot(state, player, state.rules || {});
  const redCount = replaceRedThrees(state, player);
  state.publicState.turnPhase = "play";
  const meldResult = applyMelds(state, player, state.rules || {});
  if (state.publicState?.pendingDiscardPickup?.uid === player.uid) return room;
  if (!(state.privateHands[player.uid] || []).length) return finishRound(state, player.uid);

  const discarded = discardForRobot(state, player, state.rules || {});
  const hand = state.privateHands[player.uid] || [];
  state.publicState.handCounts ||= {};
  state.publicState.handCounts[player.uid] = hand.length;
  state.publicState.botThinkingUid = null;
  state.publicState.lastAction = `${player.nickname} drew from the ${source}${redCount ? `, laid down ${redCount} red three${redCount === 1 ? "" : "s"}` : ""}${meldResult.count ? `, played ${meldResult.count} card${meldResult.count === 1 ? "" : "s"}` : ""}${discarded ? `, and discarded ${discarded.rank}${discarded.suit}` : ""}.`;
  if (!hand.length) return finishRound(state, player.uid);
  state.publicState.currentPlayerIndex = (index + 1) % players.length;
  state.publicState.turnPhase = "draw";
  return state;
}
