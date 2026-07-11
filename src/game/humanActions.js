import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import {
  cardPoints,
  finishRound,
  isBlackThree,
  isRedThree,
  isWild,
  openingRequirement,
  sortHand,
} from "./engine";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

function activePlayer(room) {
  const players = orderedPlayers(room);
  return { players, player: players[Number(room.publicState?.currentPlayerIndex || 0)] };
}

function assertTurn(room, uid, phase) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") {
    throw new Error("The game is not ready for a move.");
  }
  const { player } = activePlayer(room);
  if (player?.uid !== uid) throw new Error("It is not your turn.");
  if (room.publicState?.turnPhase !== phase) {
    throw new Error(phase === "draw" ? "You have already drawn. Play cards or discard." : "Draw cards first.");
  }
  return player;
}

function drawOneReplacingRedThrees(room, uid) {
  room.privateHands ||= {};
  room.privateHands[uid] ||= [];
  room.stock ||= [];
  room.publicState.redThrees ||= {};
  room.publicState.redThrees[uid] ||= [];
  let card = room.stock.pop();
  while (card && isRedThree(card)) {
    room.publicState.redThrees[uid].push(card);
    card = room.stock.pop();
  }
  if (card) room.privateHands[uid].push(card);
  room.privateHands[uid] = sortHand(room.privateHands[uid]);
  room.publicState.handCounts[uid] = room.privateHands[uid].length;
  room.publicState.stockCount = room.stock.length;
  return card;
}

export async function drawFromStock(code, uid) {
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    const player = assertTurn(room, uid, "draw");
    if (!room.stock?.length) return room;
    const requested = Math.max(1, Number(room.rules?.drawCount || 2));
    let drawn = 0;
    for (let index = 0; index < requested && room.stock.length; index += 1) {
      if (drawOneReplacingRedThrees(room, uid)) drawn += 1;
    }
    room.publicState.turnPhase = "play";
    room.publicState.lastAction = `${player.nickname} drew ${drawn} card${drawn === 1 ? "" : "s"} from the stock.`;
    return room;
  }, { applyLocally: false });
  if (!result.committed) throw new Error("The draw could not be completed.");
}

function validateCombinedMeld(cards, rules) {
  if (cards.some((card) => card.rank === "3")) throw new Error("Threes cannot be used in a normal meld.");
  const naturals = cards.filter((card) => !isWild(card));
  const wilds = cards.filter(isWild);
  if (!naturals.length) throw new Error("A meld needs natural cards.");
  if (new Set(naturals.map((card) => card.rank)).size !== 1) throw new Error("All natural cards must have the same rank.");
  if (wilds.length > Number(rules?.maxWildsPerMeld || 3)) throw new Error("Too many wild cards in that meld.");
  if (wilds.length >= naturals.length) throw new Error("A meld must contain more natural cards than wild cards.");
  return naturals[0].rank;
}

function buildOpeningPickupPlan(room, player, top, matchingNaturals) {
  const hand = room.privateHands?.[player.uid] || [];
  const requirement = openingRequirement(Number(room.publicState?.teamScores?.[player.team] || 0));
  const maxWilds = Number(room.rules?.maxWildsPerMeld || 3);
  const used = new Set();
  const melds = [];

  const forcedCards = [top, ...matchingNaturals];
  matchingNaturals.forEach((card) => used.add(card.id));
  melds.push({ rank: top.rank, cards: forcedCards });

  const grouped = hand.reduce((groups, card) => {
    if (!used.has(card.id) && !isWild(card) && card.rank !== "3") (groups[card.rank] ||= []).push(card);
    return groups;
  }, {});
  for (const [rank, cards] of Object.entries(grouped)) {
    if (cards.length >= 3) {
      cards.forEach((card) => used.add(card.id));
      melds.push({ rank, cards: [...cards] });
    }
  }

  const wildCards = hand.filter((card) => isWild(card) && !used.has(card.id));
  let points = melds.flatMap((meld) => meld.cards).reduce((sum, card) => sum + cardPoints(card), 0);
  for (const wild of wildCards) {
    if (points >= requirement) break;
    const target = melds.find((meld) => {
      const naturals = meld.cards.filter((card) => !isWild(card)).length;
      const wilds = meld.cards.filter(isWild).length;
      return wilds < maxWilds && wilds + 1 < naturals;
    });
    if (!target) break;
    target.cards.push(wild);
    used.add(wild.id);
    points += cardPoints(wild);
  }

  if (points < requirement) {
    throw new Error(`The pile is frozen and your pickup play must open for ${requirement} points. The available legal melds total ${points}.`);
  }
  return { melds, used, points };
}

function pickupPlan(room, player) {
  const pile = room.publicState?.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top || isWild(top) || isRedThree(top) || isBlackThree(top)) {
    throw new Error("The top discard cannot be used to take the pile.");
  }

  const hand = room.privateHands?.[player.uid] || [];
  const board = room.publicState?.teamBoards?.[player.team] || [];
  const existing = board.find((meld) => meld.rank === top.rank);
  const matchingNaturals = hand.filter((card) => !isWild(card) && card.rank === top.rank);
  const frozen = room.publicState?.discardFrozen !== false;
  const opened = Boolean(room.publicState?.opened?.[player.team]);

  if (frozen && matchingNaturals.length < 2) {
    throw new Error("The discard pile is frozen. You need two natural cards matching the top discard.");
  }
  if (!frozen && !existing && matchingNaturals.length < 2) {
    throw new Error("You need two natural matches unless that rank is already on your board.");
  }

  if (!opened) {
    if (matchingNaturals.length < 2) throw new Error("Before opening, the top discard must be combined with two natural matches from your hand.");
    return { type: "opening", top, ...buildOpeningPickupPlan(room, player, top, matchingNaturals) };
  }

  if (existing && !frozen) return { type: "existing", top, existing, used: new Set() };

  const cards = [top, ...matchingNaturals];
  validateCombinedMeld(existing ? [...(existing.cards || []), ...cards] : cards, room.rules);
  return { type: existing ? "existing-with-matches" : "new", top, existing, cards, used: new Set(matchingNaturals.map((card) => card.id)) };
}

export async function takeDiscardPile(code, uid) {
  let actionError = "The discard pile cannot be taken with your current hand.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "draw");
      const plan = pickupPlan(room, player);
      const pile = [...(room.publicState.discardPile || [])];
      const lowerPile = pile.slice(0, -1);
      const hand = [...(room.privateHands?.[uid] || [])];
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      const board = room.publicState.teamBoards[player.team];

      if (plan.type === "opening") {
        for (const meld of plan.melds) {
          const existing = board.find((item) => item.rank === meld.rank);
          if (existing) existing.cards = [...(existing.cards || []), ...meld.cards];
          else board.push(meld);
        }
        room.privateHands[uid] = sortHand([...hand.filter((card) => !plan.used.has(card.id)), ...lowerPile]);
        room.publicState.opened ||= {};
        room.publicState.opened[player.team] = true;
      } else if (plan.type === "existing") {
        plan.existing.cards = [...(plan.existing.cards || []), plan.top];
        room.privateHands[uid] = sortHand([...hand, ...lowerPile]);
      } else {
        if (plan.existing) plan.existing.cards = [...(plan.existing.cards || []), ...plan.cards];
        else board.push({ rank: plan.top.rank, cards: plan.cards });
        room.privateHands[uid] = sortHand([...hand.filter((card) => !plan.used.has(card.id)), ...lowerPile]);
      }

      room.publicState.discardPile = [];
      room.publicState.discardFrozen = false;
      room.publicState.discardPileHasBeenTaken = true;
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      room.publicState.lastAction = `${player.nickname} took the discard pile and played the top ${plan.top.rank}. The new discard pile is unfrozen.`;
      if (room.privateHands[uid].length === 0) return finishRound(room, uid);
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}

export async function meldSelectedCards(code, uid, cardIds, targetRank = null) {
  if (!cardIds?.length) throw new Error("Select cards to play.");
  let actionError = "The play could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "play");
      const hand = room.privateHands?.[uid] || [];
      const selected = hand.filter((card) => cardIds.includes(card.id));
      if (selected.length !== cardIds.length) throw new Error("One of the selected cards is no longer in your hand.");
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.opened ||= {};
      const board = room.publicState.teamBoards[player.team];
      const naturalRanks = [...new Set(selected.filter((card) => !isWild(card)).map((card) => card.rank))];
      let rank = targetRank || (naturalRanks.length === 1 ? naturalRanks[0] : null);
      let existing = rank ? board.find((meld) => meld.rank === rank) : null;

      if (selected.every(isWild)) {
        if (!targetRank) throw new Error("Choose which board meld receives the wild card.");
        existing = board.find((meld) => meld.rank === targetRank);
        if (!existing) throw new Error(`There is no ${targetRank} meld on your board.`);
        rank = targetRank;
      }

      if (existing) validateCombinedMeld([...(existing.cards || []), ...selected], room.rules);
      else {
        if (selected.length < 3) throw new Error("A new meld needs at least three cards. To add one or two cards, choose an existing board meld.");
        rank = validateCombinedMeld(selected, room.rules);
      }

      if (!room.publicState.opened[player.team]) {
        const value = selected.reduce((sum, card) => sum + cardPoints(card), 0);
        const requirement = openingRequirement(Number(room.publicState.teamScores?.[player.team] || 0));
        if (value < requirement) throw new Error(`Your opening play needs ${requirement} points; selected cards total ${value}.`);
      }

      if (existing) existing.cards = [...(existing.cards || []), ...selected];
      else board.push({ rank, cards: selected });
      room.publicState.opened[player.team] = true;
      room.privateHands[uid] = hand.filter((card) => !cardIds.includes(card.id));
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.turnPhase = "play";
      room.publicState.lastAction = `${player.nickname} played ${selected.length} card${selected.length === 1 ? "" : "s"} on ${rank}s.`;
      if (room.privateHands[uid].length === 0) return finishRound(room, uid);
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}

export async function discardSelectedCard(code, uid, cardId) {
  let actionError = "The discard could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "play");
      const hand = room.privateHands?.[uid] || [];
      const card = hand.find((item) => item.id === cardId);
      if (!card) throw new Error("That card is no longer in your hand.");
      if (isRedThree(card)) throw new Error("Red threes are laid down automatically and replaced.");
      room.privateHands[uid] = hand.filter((item) => item.id !== cardId);
      room.publicState.discardPile ||= [];
      room.publicState.discardPile.push(card);
      const freezesPile = (isWild(card) && room.rules?.freezeOnWild !== false)
        || (isBlackThree(card) && room.rules?.freezeOnBlackThree !== false);
      if (freezesPile) room.publicState.discardFrozen = true;
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.lastAction = `${player.nickname} discarded ${card.rank}${card.suit}${freezesPile ? " and froze the discard pile" : ""}.`;
      if (room.privateHands[uid].length === 0) return finishRound(room, uid);
      const { players } = activePlayer(room);
      room.publicState.currentPlayerIndex = (Number(room.publicState.currentPlayerIndex || 0) + 1) % players.length;
      room.publicState.turnPhase = "draw";
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}
