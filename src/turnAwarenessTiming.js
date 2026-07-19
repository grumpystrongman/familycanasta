export const TURN_REMINDER_SECONDS = 60;
export const TURN_OVERLAY_MS = 5000;

export function remainingTurnSeconds(startedAt, now = Date.now()) {
  if (!Number.isFinite(Number(startedAt))) return TURN_REMINDER_SECONDS;
  const elapsed = Math.max(0, Number(now) - Number(startedAt));
  return Math.max(0, Math.ceil((TURN_REMINDER_SECONDS * 1000 - elapsed) / 1000));
}

export function formatTurnTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}
