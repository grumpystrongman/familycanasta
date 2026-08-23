import { finishRound } from "./engine.js";
import { teamCanGoOut } from "./goOutRules.js";

function orderedPlayers(room) {
  return Object.values(room?.members || {}).sort((a, b) => Number(a.seat || 0) - Number(b.seat || 0));
}

export function findStrandedRoundFinisher(room) {
  if (!room || room.status !== "playing" || room.publicState?.phase !== "playing") return null;

  return orderedPlayers(room).find((player) => {
    const hand = room.privateHands?.[player.uid];
    if (!Array.isArray(hand) || hand.length !== 0) return false;
    return teamCanGoOut(room, Number(player.team));
  }) || null;
}

export function reconcileStrandedRound(room) {
  const finisher = findStrandedRoundFinisher(room);
  if (!finisher) return room;

  return finishRound(room, finisher.uid, {
    reason: "went-out",
  });
}
