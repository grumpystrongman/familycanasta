export const CHOMP_ONLINE_MAX_SEATS = 4;

export function chompOnlinePlayers(room) {
  return Object.values(room?.members || {}).sort((a, b) => Number(a.seat) - Number(b.seat));
}

export function firstOpenChompSeat(room) {
  const taken = new Set(chompOnlinePlayers(room).map((player) => Number(player.seat)));
  for (let seat = 0; seat < CHOMP_ONLINE_MAX_SEATS; seat += 1) if (!taken.has(seat)) return seat;
  return -1;
}
