import { finishRound } from "./engine.js";
import { teamCanGoOut } from "./goOutRules.js";

function orderedPlayers(room) {
  return Object.values(room?.members || {}).sort((a, b) => Number(a.seat || 0) - Number(b.seat || 0));
}

function playerHandIsEmpty(room, uid) {
  const publishedCount = room?.publicState?.handCounts?.[uid];
  if (publishedCount !== undefined && publishedCount !== null) {
    return Number(publishedCount) === 0;
  }

  const hand = room?.privateHands?.[uid];
  return Array.isArray(hand) && hand.length === 0;
}

export function findStrandedRoundFinisher(room) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") return null;

  return orderedPlayers(room).find((player) => (
    playerHandIsEmpty(room, player.uid)
    && teamCanGoOut(room, Number(player.team))
  )) || null;
}

export function reconcileStrandedRound(room) {
  const finisher = findStrandedRoundFinisher(room);
  if (!finisher) return room;

  return finishRound(room, finisher.uid, {
    reason: "went-out",
  });
}
