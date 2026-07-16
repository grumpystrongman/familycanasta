const VALID_DECK_COUNTS = new Set([2, 3]);
const VALID_CARD_COUNTS = new Set([11, 13, 15]);

function integerOr(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeRoomSetup(input = {}) {
  const explicitMode = input.playMode === "partners" || input.playMode === "solo"
    ? input.playMode
    : null;
  const playMode = explicitMode || (Number(input.playersPerTeam) === 2 ? "partners" : "solo");
  const playersPerTeam = playMode === "partners" ? 2 : 1;
  const maxTeams = playersPerTeam === 2 ? 3 : 4;

  let requestedTeams = integerOr(input.teamCount, 2);
  const requestedSeats = integerOr(input.seatCount, 0);
  if ((input.teamCount === undefined || input.teamCount === null || input.teamCount === "")
    && requestedSeats >= 2
    && requestedSeats % playersPerTeam === 0) {
    requestedTeams = requestedSeats / playersPerTeam;
  }

  const teamCount = clamp(requestedTeams, 2, maxTeams);
  const seatCount = teamCount * playersPerTeam;
  const requestedDeckCount = integerOr(input.deckCount, seatCount > 4 ? 3 : 2);
  const requestedCardsPerPlayer = integerOr(input.cardsPerPlayer, seatCount === 2 ? 15 : 11);

  const setup = {
    playMode,
    playersPerTeam,
    teamCount,
    seatCount,
    deckCount: VALID_DECK_COUNTS.has(requestedDeckCount) ? requestedDeckCount : (seatCount > 4 ? 3 : 2),
    cardsPerPlayer: VALID_CARD_COUNTS.has(requestedCardsPerPlayer) ? requestedCardsPerPlayer : (seatCount === 2 ? 15 : 11),
    discardPickupRule: input.discardPickupRule === "modern" ? "modern" : "classic",
  };

  if (typeof input.cardBack === "string" && input.cardBack.trim()) {
    setup.cardBack = input.cardBack.trim();
  }

  return setup;
}

export function roomSetupMatches(roomRules = {}, requestedSetup = {}) {
  const current = normalizeRoomSetup(roomRules);
  const requested = normalizeRoomSetup(requestedSetup);
  const fields = [
    "playMode",
    "playersPerTeam",
    "teamCount",
    "seatCount",
    "deckCount",
    "cardsPerPlayer",
    "discardPickupRule",
  ];

  if (!fields.every((field) => current[field] === requested[field])) return false;
  if (requested.cardBack && current.cardBack !== requested.cardBack) return false;
  return true;
}
