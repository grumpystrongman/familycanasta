import { cardPoints, isBlackThree, isRedThree, isWild, openingRequirement } from "./engine";

const rankOrder = ["4","5","6","7","8","9","10","J","Q","K","A","2","JOKER","3"];

function groupNaturals(hand) {
  return hand.reduce((groups, card) => {
    if (!isWild(card) && card.rank !== "3") {
      (groups[card.rank] ||= []).push(card);
    }
    return groups;
  }, {});
}

function getTeamMelds(state, team) {
  return [...(state.publicState.teamBoards?.[team] || state.publicState.teamMelds?.[team] || [])]
    .map((meld) => ({ ...meld, cards: [...(meld.cards || [])] }));
}

function isPileFrozen(state, rules) {
  const pile = state.publicState.discardPile || [];
  return (rules.freezeOnWild && pile.some(isWild)) ||
    (rules.freezeOnBlackThree && pile.some(isBlackThree));
}

function canTakePile(state, player, hand, rules) {
  const pile = state.publicState.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top || isWild(top) || isRedThree(top) || isBlackThree(top)) return false;

  const naturalMatches = hand.filter((card) => !isWild(card) && card.rank === top.rank);
  const existing = getTeamMelds(state, player.team).some((meld) => meld.rank === top.rank);
  return isPileFrozen(state, rules)
    ? naturalMatches.length >= 2
    : naturalMatches.length >= 2 || (existing && naturalMatches.length >= 1);
}

function pileValue(state, player, hand) {
  const pile = state.publicState.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top) return -Infinity;
  const matches = hand.filter((card) => card.rank === top.rank).length;
  return pile.length * 2 + matches * 12 + cardPoints(top);
}

function drawForRobot(state, player, rules) {
  let hand = [...(state.privateHands[player.uid] || [])];
  const pile = [...(state.publicState.discardPile || [])];
  const stock = [...(state.stock || [])];
  let source = "stock";

  if (canTakePile(state, player, hand, rules) && pileValue(state, player, hand) >= 18) {
    hand.push(...pile);
    state.publicState.discardPile = [];
    source = "discard pile";
  } else {
    const drawCount = Math.max(1, Number(rules.drawCount || 1));
    for (let draw = 0; draw < drawCount && stock.length; draw += 1) {
      hand.push(stock.pop());
    }
    state.stock = stock;
    state.publicState.stockCount = stock.length;
  }

  state.privateHands[player.uid] = hand;
  return source;
}

function candidateMelds(hand, currentMelds, rules) {
  const naturals = groupNaturals(hand);
  const wilds = hand.filter(isWild).sort((a, b) => cardPoints(a) - cardPoints(b));
  const candidates = [];

  for (const meld of currentMelds) {
    const matching = naturals[meld.rank] || [];
    if (matching.length) {
      candidates.push({ rank: meld.rank, cards: [...matching], existing: true, score: matching.reduce((s, c) => s + cardPoints(c), 0) + 25 });
    }
  }

  for (const [rank, cards] of Object.entries(naturals)) {
    if (currentMelds.some((meld) => meld.rank === rank)) continue;
    if (cards.length >= 3) {
      const selected = [...cards];
      const maxWilds = Math.min(Number(rules.maxWildsPerMeld || 3), selected.length - 1, wilds.length);
      const usefulWilds = maxWilds > 0 && selected.length < 7 ? wilds.slice(0, Math.min(maxWilds, 7 - selected.length)) : [];
      candidates.push({
        rank,
        cards: [...selected, ...usefulWilds],
        existing: false,
        score: selected.reduce((s, c) => s + cardPoints(c), 0) + usefulWilds.reduce((s, c) => s + cardPoints(c), 0),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function applyMelds(state, player, rules) {
  let hand = [...(state.privateHands[player.uid] || [])];
  const team = player.team;
  const currentMelds = getTeamMelds(state, team);
  const opened = Boolean(state.publicState.opened?.[team]);
  const teamScore = Number(state.publicState.teamScores?.[team] || 0);
  const requirement = openingRequirement(teamScore);
  const candidates = candidateMelds(hand, currentMelds, rules);

  let selected = [];
  if (opened) {
    selected = candidates;
  } else {
    let running = 0;
    for (const candidate of candidates) {
      selected.push(candidate);
      running += candidate.cards.reduce((sum, card) => sum + cardPoints(card), 0);
      if (running >= requirement) break;
    }
    if (running < requirement) selected = [];
  }

  if (!selected.length) return { count: 0, ranks: [] };

  const used = new Set();
  for (const candidate of selected) {
    const availableCards = candidate.cards.filter((card) => !used.has(card.id) && hand.some((held) => held.id === card.id));
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

function discardForRobot(state, player) {
  const hand = [...(state.privateHands[player.uid] || [])];
  if (!hand.length) return null;
  const melds = getTeamMelds(state, player.team);
  const candidates = hand.filter((card) => !isRedThree(card));
  const discard = (candidates.length ? candidates : hand)
    .sort((a, b) => discardScore(a, hand, melds) - discardScore(b, hand, melds))[0];
  state.privateHands[player.uid] = hand.filter((card) => card.id !== discard.id);
  state.publicState.discardPile ||= [];
  state.publicState.discardPile.push(discard);
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
  state.publicState.redThrees[player.team] ||= [];
  state.publicState.redThrees[player.team].push(...redThrees);
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
  state.publicState.turnPhase = "meld";
  const meldResult = applyMelds(state, player, state.rules || {});
  state.publicState.turnPhase = "discard";
  const discarded = discardForRobot(state, player);
  const hand = state.privateHands[player.uid] || [];

  state.publicState.handCounts ||= {};
  state.publicState.handCounts[player.uid] = hand.length;
  state.publicState.botThinkingUid = null;
  state.publicState.lastAction = `${player.nickname} drew from the ${source}${redCount ? `, laid down ${redCount} red three${redCount === 1 ? "" : "s"}` : ""}${meldResult.count ? `, melded ${meldResult.count} card${meldResult.count === 1 ? "" : "s"}` : ""}${discarded ? `, and discarded ${discarded.rank}${discarded.suit}` : ""}.`;

  if (!hand.length) {
    state.publicState.phase = "handOver";
    state.publicState.turnPhase = "complete";
    state.publicState.wentOutUid = player.uid;
    state.publicState.lastAction = `${player.nickname} went out.`;
    return state;
  }

  state.publicState.currentPlayerIndex = (index + 1) % players.length;
  state.publicState.turnPhase = "draw";
  return state;
}
