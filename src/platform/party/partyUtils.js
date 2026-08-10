export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function initialScores(players, extra = {}) {
  return Object.fromEntries(players.map((player) => [player.uid, { score: 0, ...extra }]));
}

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function nowPlus(ms) { return Date.now() + ms; }
export function safeText(value, max = 90) { return String(value || "").trim().slice(0, max); }

const blocked = ["fuck", "shit", "cunt", "nigger", "faggot"];
export function cleanPartyText(value, enabled = true) {
  let text = safeText(value, 120);
  if (!enabled) return text;
  for (const word of blocked) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(pattern, "••••");
  }
  return text;
}

export function hostOnly(actor, hostUid) {
  if (!actor?.isHost || actor.uid !== hostUid) throw new Error("Only the TV host can advance the show.");
}
