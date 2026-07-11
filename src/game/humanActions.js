import { ref, runTransaction } from "firebase/database";
import { db } from "../firebase";
import { cardPoints, isBlackThree, isRedThree, isWild, openingRequirement, sortHand } from "./engine";

function orderedPlayers(room) {
  return Object.values(room.members || {}).sort((a, b) => a.seat - b.seat);
}

function activePlayer(room) {
  const players = orderedPlayers(room);
  return { players, player: players[Number(room.publicState?.currentPlayerIndex || 0)] };
}

function assertTurn(room, uid, phase) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") throw new Error("The game is not ready for a move.");
  const { player } = activePlayer(room);
  if (player?.uid !== uid) throw new Error("It is not your turn.");
  if (room.publicState?.turnPhase !== phase) throw new Error(phase === "draw" ? "You have already drawn. Meld or discard." : "Draw cards first.");
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
      const card = drawOneReplacingRedThrees(room, uid);
      if (card) drawn += 1;
    }

    room.publicState.turnPhase = "play";
    room.publicState.lastAction = `${player.nickname} drew ${drawn} card${drawn === 1 ? "" : "s"} from the stock.`;
    return room;
  }, { applyLocally: false });
  if (!result.committed) throw new Error("The draw could not be completed.");
}

function canTakePile(room, player) {
  const pile = room.publicState?.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top || isWild(top) || isRedThree(top) || isBlackThree(top)) return false;
  const hand = room.privateHands?.[player.uid] || [];
  const matches = hand.filter((card) => card.rank === top.rank && !isWild(card)).length;
  const frozen = pile.some(isWild) || (room.rules?.freezeOnBlackThree && pile.some(isBlackThree));
  const existing = (room.publicState?.teamBoards?.[player.team] || []).some((meld) => meld.rank === top.rank);
  return frozen ? matches >= 2 : matches >= 2 || (existing && matches >= 1);
}

export async function takeDiscardPile(code, uid) {
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    const player = assertTurn(room, uid, "draw");
    if (!canTakePile(room, player)) return room;
    const pile = room.publicState.discardPile || [];
    room.privateHands[uid] = sortHand([...(room.privateHands?.[uid] || []), ...pile]);
    room.publicState.discardPile = [];
    room.publicState.handCounts[uid] = room.privateHands[uid].length;
    room.publicState.turnPhase = "play";
    room.publicState.lastAction = `${player.nickname} picked up the discard pile.`;
    return room;
  }, { applyLocally: false });
  if (!result.committed) throw new Error("The discard pile cannot be taken with your current hand.");
}

function validateMeld(cards, rules) {
  if (cards.length < 3) throw new Error("Select at least three cards for a new meld.");
  if (cards.some((card) => card.rank === "3")) throw new Error("Threes cannot be used in a normal meld.");
  const naturals = cards.filter((card) => !isWild(card));
  const wilds = cards.filter(isWild);
  if (!naturals.length) throw new Error("A meld needs natural cards.");
  if (new Set(naturals.map((card) => card.rank)).size !== 1) throw new Error("All natural cards must have the same rank.");
  if (wilds.length > Number(rules?.maxWildsPerMeld || 3)) throw new Error("Too many wild cards in that meld.");
  if (wilds.length >= naturals.length) throw new Error("A meld must contain more natural cards than wild cards.");
  return naturals[0].rank;
}

export async function meldSelectedCards(code, uid, cardIds) {
  if (!cardIds?.length) throw new Error("Select cards to meld.");
  let actionError = "The meld could not be completed.";
  const result = await runTransaction(ref(db, `rooms/${code}`), (room) => {
    try {
      const player = assertTurn(room, uid, "play");
      const hand = room.privateHands?.[uid] || [];
      const selected = hand.filter((card) => cardIds.includes(card.id));
      if (selected.length !== cardIds.length) throw new Error("One of the selected cards is no longer in your hand.");
      const rank = validateMeld(selected, room.rules);
      room.publicState.teamBoards ||= {};
      room.publicState.teamBoards[player.team] ||= [];
      room.publicState.opened ||= {};
      const board = room.publicState.teamBoards[player.team];
      const existing = board.find((meld) => meld.rank === rank);
      const value = selected.reduce((sum, card) => sum + cardPoints(card), 0);
      if (!room.publicState.opened[player.team]) {
        const requirement = openingRequirement(Number(room.publicState.teamScores?.[player.team] || 0));
        if (value < requirement) throw new Error(`Your opening meld needs ${requirement} points; selected cards total ${value}.`);
      }
      if (existing) existing.cards = [...(existing.cards || []), ...selected];
      else board.push({ rank, cards: selected });
      room.publicState.opened[player.team] = true;
      room.privateHands[uid] = hand.filter((card) => !cardIds.includes(card.id));
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      room.publicState.lastAction = `${player.nickname} melded ${selected.length} cards on Team ${player.team + 1}'s board.`;
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
      room.publicState.handCounts[uid] = room.privateHands[uid].length;
      const { players } = activePlayer(room);
      room.publicState.currentPlayerIndex = (Number(room.publicState.currentPlayerIndex || 0) + 1) % players.length;
      room.publicState.turnPhase = "draw";
      room.publicState.lastAction = `${player.nickname} discarded ${card.rank}${card.suit}.`;
      return room;
    } catch (error) {
      actionError = error.message;
      return;
    }
  }, { applyLocally: false });
  if (!result.committed) throw new Error(actionError);
}
