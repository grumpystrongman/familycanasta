export function canastaDisplayType(statusText = "") {
  const normalized = String(statusText).toUpperCase();
  if (normalized.includes("CLEAN BOOK")) return "clean";
  if (normalized.includes("DIRTY BOOK")) return "dirty";
  return null;
}

export function meldCardCount(statusText = "") {
  const match = String(statusText).match(/(\d+)\s+cards?/i);
  return match ? Number(match[1]) : 0;
}
