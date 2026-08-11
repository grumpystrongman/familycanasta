import { BOARD, GROUPS, MAX_UPGRADES, groupSpaces } from "./data.js";
import {
  calculateNetWorth,
  calculateRent,
  createGame,
  currentPlayer,
  endTurn,
  getPlayerProperties,
  rollDice,
} from "./engine.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const money = (value) => `$${Math.max(0, Math.round(value)).toLocaleString()}`;

export const GOALS = {
  bankruptcy: {
    label: "Last Landlord Standing",
    description: "No clock. Keep buying until everybody else is broke, condemned, or crying in Housing Court.",
  },
  empire: {
    label: "Build an Empire",
    description: "First landlord to reach $6,000 net worth and hold at least 8 deeds wins.",
  },
  takeover: {
    label: "Own the Block",
    description: "First landlord to control 3 complete color groups wins.",
  },
};

export const SCHEMES = [
  {
    id: "rat-patrol",
    name: "Rat Patrol Deluxe",
    cost: 90,
    rentMultiplier: 1.08,
    flatRent: 8,
    heat: 0,
    crackdownShield: 55,
    description: "Tiny uniforms not included. Cuts inspection pain and makes the place look almost intentional.",
  },
  {
    id: "landlord-special",
    name: "Landlord Special",
    cost: 125,
    rentMultiplier: 1.25,
    flatRent: 10,
    heat: 1,
    crackdownShield: 0,
    description: "Paint the outlet covers, caulk the windows shut, call it renovated, raise rent immediately.",
  },
  {
    id: "vice-motel",
    name: "Vice Motel Conversion",
    cost: 200,
    rentMultiplier: 1.45,
    flatRent: 20,
    heat: 2,
    crackdownShield: 0,
    description: "Hourly rooms, cash bookkeeping, and a vacancy sign that never technically turns off.",
  },
  {
    id: "drug-lord-lease",
    name: "Drug Lord Executive Lease",
    cost: 150,
    rentMultiplier: 1.6,
    flatRent: 25,
    heat: 3,
    crackdownShield: 0,
    description: "Six months cash up front, no maintenance calls, and a tenant who keeps asking about camera angles.",
  },
  {
    id: "gang-protection",
    name: "Gang Protection Contract",
    cost: 175,
    rentMultiplier: 1.3,
    flatRent: 15,
    heat: 2,
    crackdownShield: 25,
    description: "The local crew promises security. The invoice simply says: nice boiler you got there.",
  },
  {
    id: "luxury-rebrand",
    name: "Luxury Rebrand Package",
    cost: 250,
    rentMultiplier: 1.38,
    flatRent: 18,
    heat: 0,
    crackdownShield: 0,
    description: "Add Edison bulbs, rename the hallway, and charge people for exposed brick that was already exposed.",
  },
];

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId) || null;
}

function ownershipFor(state, spaceId) {
  return state.ownership[String(spaceId)] || null;
}

function appendLog(state, text, kind = "info") {
  state.log.unshift({ id: `${state.turnCount}-${state.logSequence}`, text, kind });
  state.logSequence += 1;
  state.log = state.log.slice(0, 80);
}

function charge(state, playerId, amount, { recipientId = null, toPot = false, reason = "Bad decisions" } = {}) {
  if (!amount || amount <= 0) return;
  const player = playerById(state, playerId);
  if (!player || player.bankrupt) return;
  player.cash -= amount;
  if (recipientId) {
    const recipient = playerById(state, recipientId);
    if (recipient && !recipient.bankrupt) recipient.cash += amount;
  }
  if (toPot) state.pot += amount;
  if (player.cash < 0 && !state.debt) {
    state.debt = { playerId, creditorId: recipientId, reason };
    appendLog(state, `${player.name} is ${money(-player.cash)} underwater after ${reason}.`, "danger");
  }
}

function ownsWholeGroup(state, playerId, groupId) {
  const spaces = groupSpaces(groupId);
  return spaces.length > 0 && spaces.every((space) => ownershipFor(state, space.id)?.ownerId === playerId);
}

function groupHasMortgage(state, groupId) {
  return groupSpaces(groupId).some((space) => ownershipFor(state, space.id)?.mortgaged);
}

function completedGroups(state, playerId) {
  return Object.keys(GROUPS).filter((groupId) => ownsWholeGroup(state, playerId, groupId)).length;
}

export function getScheme(ownership) {
  return SCHEMES.find((scheme) => scheme.id === ownership?.schemeId) || null;
}

export function portfolioHeat(state, playerId) {
  return getPlayerProperties(state, playerId).reduce((sum, { ownership }) => sum + (getScheme(ownership)?.heat || 0), 0);
}

export function crackdownShield(state, playerId) {
  return getPlayerProperties(state, playerId).reduce((sum, { ownership }) => sum + (getScheme(ownership)?.crackdownShield || 0), 0);
}

export function cityPressure(state) {
  return Math.max(0, Math.floor(((state?.round || 1) - 1) / 4));
}

export function calculateChaosNetWorth(state, playerId) {
  const schemeValue = getPlayerProperties(state, playerId).reduce((sum, { ownership }) => sum + Math.floor((getScheme(ownership)?.cost || 0) / 2), 0);
  return calculateNetWorth(state, playerId) + schemeValue;
}

export function goalProgress(state, playerId) {
  const player = playerById(state, playerId);
  if (!player) return "";
  if (state.goalMode === "empire") {
    return `${money(calculateChaosNetWorth(state, playerId))} / $6,000 · ${getPlayerProperties(state, playerId).length}/8 deeds`;
  }
  if (state.goalMode === "takeover") {
    return `${completedGroups(state, playerId)}/3 complete blocks`;
  }
  const rivals = state.players.filter((candidate) => candidate.id !== playerId && !candidate.bankrupt).length;
  return `${rivals} rival${rivals === 1 ? "" : "s"} left`;
}

export function createChaosGame(setupPlayers, options = {}) {
  const state = createGame(setupPlayers, { rng: options.rng, roundLimit: null });
  state.goalMode = GOALS[options.goalMode] ? options.goalMode : "bankruptcy";
  state.roundLimit = null;
  state.chaosActionTurn = null;
  appendLog(state, `Goal: ${GOALS[state.goalMode].label}. The city has been notified and immediately made everything worse.`, "warning");
  return state;
}

export function canChaosUpgrade(state, playerId, spaceId) {
  const space = BOARD[spaceId];
  const ownership = ownershipFor(state, spaceId);
  const player = playerById(state, playerId);
  if (!space || space.type !== "property" || !ownership || ownership.ownerId !== playerId || !player) return false;
  if (ownership.mortgaged || ownership.upgrades >= MAX_UPGRADES || player.cash < space.upgradeCost || state.debt) return false;
  if ((ownership.upgrades || 0) < 2) return true;
  return ownsWholeGroup(state, playerId, space.group) && !groupHasMortgage(state, space.group);
}

export function upgradePropertyChaos(state, playerId, spaceId) {
  if (!canChaosUpgrade(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = BOARD[spaceId];
  const player = playerById(next, playerId);
  const ownership = ownershipFor(next, spaceId);
  player.cash -= space.upgradeCost;
  ownership.upgrades = (ownership.upgrades || 0) + 1;
  const label = ownership.upgrades <= 2 ? "questionable improvement" : "full-block improvement";
  appendLog(next, `${player.name} spends ${money(space.upgradeCost)} on a ${label} at ${space.name}. Rent immediately becomes more ambitious.`, "good");
  return next;
}

export function canSellUpgradeChaos(state, playerId, spaceId) {
  const space = BOARD[spaceId];
  const ownership = ownershipFor(state, spaceId);
  return Boolean(space?.type === "property" && ownership?.ownerId === playerId && ownership.upgrades > 0);
}

export function sellUpgradeChaos(state, playerId, spaceId) {
  if (!canSellUpgradeChaos(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = BOARD[spaceId];
  const player = playerById(next, playerId);
  const ownership = ownershipFor(next, spaceId);
  ownership.upgrades -= 1;
  const refund = Math.floor(space.upgradeCost / 2);
  player.cash += refund;
  appendLog(next, `${player.name} removes an improvement from ${space.name}, sells the fixtures on Marketplace, and pockets ${money(refund)}.`, "warning");
  if (player.cash >= 0 && next.debt?.playerId === playerId) next.debt = null;
  return next;
}

export function canInstallScheme(state, playerId, spaceId, schemeId) {
  const space = BOARD[spaceId];
  const ownership = ownershipFor(state, spaceId);
  const player = playerById(state, playerId);
  const scheme = SCHEMES.find((candidate) => candidate.id === schemeId);
  if (!space || space.type !== "property" || ownership?.ownerId !== playerId || !player || !scheme) return false;
  return !ownership.mortgaged && !state.debt && player.cash >= scheme.cost && ownership.schemeId !== scheme.id;
}

export function installScheme(state, playerId, spaceId, schemeId) {
  if (!canInstallScheme(state, playerId, spaceId, schemeId)) return state;
  const next = clone(state);
  const space = BOARD[spaceId];
  const player = playerById(next, playerId);
  const ownership = ownershipFor(next, spaceId);
  const scheme = SCHEMES.find((candidate) => candidate.id === schemeId);
  player.cash -= scheme.cost;
  ownership.schemeId = scheme.id;
  appendLog(next, `${player.name} installs “${scheme.name}” at ${space.name} for ${money(scheme.cost)}. The neighborhood group chat is already typing.`, scheme.heat ? "warning" : "good");
  return next;
}

export function removeScheme(state, playerId, spaceId) {
  const ownership = ownershipFor(state, spaceId);
  if (ownership?.ownerId !== playerId || !ownership.schemeId || state.debt) return state;
  const next = clone(state);
  const space = BOARD[spaceId];
  const old = getScheme(ownershipFor(next, spaceId));
  ownershipFor(next, spaceId).schemeId = null;
  charge(next, playerId, 50, { reason: `${old?.name || "scheme"} cleanup` });
  appendLog(next, `${playerById(next, playerId).name} removes ${old?.name || "the scheme"} from ${space.name}. Cleanup costs $50 and several awkward explanations.`, "info");
  return next;
}

function diceForCab(total) {
  const value = Math.max(3, Math.min(11, Number(total) || 3));
  if (value <= 7) return [1, value - 1];
  return [value - 6, 6];
}

function applySchemeRent(state, playerId) {
  const player = playerById(state, playerId);
  const space = BOARD[player?.position];
  const ownership = ownershipFor(state, space?.id);
  if (!player || !space || !ownership || ownership.ownerId === playerId || ownership.mortgaged) return;
  const scheme = getScheme(ownership);
  if (!scheme) return;
  const baseRent = calculateRent(state, space.id, state.lastRollTotal);
  const premium = Math.max(0, Math.round(baseRent * (scheme.rentMultiplier - 1) + scheme.flatRent));
  if (!premium) return;
  const owner = playerById(state, ownership.ownerId);
  charge(state, playerId, premium, { recipientId: ownership.ownerId, reason: `${scheme.name} premium` });
  appendLog(state, `${player.name} pays an extra ${money(premium)} to ${owner?.name || "the owner"} because ${space.name} is running “${scheme.name}.”`, "warning");
}

function applyCityAssessment(state, playerId, beforePosition, beforeInCourt) {
  const player = playerById(state, playerId);
  if (!player || beforeInCourt || !state.rolled) return;
  const passedStart = beforePosition + state.lastRollTotal >= BOARD.length;
  if (!passedStart) return;
  const properties = getPlayerProperties(state, playerId);
  if (!properties.length) return;
  const pressure = cityPressure(state);
  const deedTax = 8 + pressure * 4;
  const upgrades = properties.reduce((sum, item) => sum + (item.ownership.upgrades || 0), 0);
  const heat = portfolioHeat(state, playerId);
  const assessment = properties.length * deedTax + upgrades * 4 + heat * 6;
  charge(state, playerId, assessment, { toPot: true, reason: "the city's Blight Improvement Assessment" });
  appendLog(state, `${player.name} passes Rent Day, collects rent money, then pays ${money(assessment)} in taxes, fees, assessments, and whatever the city invented this month.`, "warning");
}

function applyInspectionCrackdown(state, playerId, landedSpaceId) {
  const player = playerById(state, playerId);
  const landedSpace = BOARD[landedSpaceId];
  if (!player || landedSpace?.type !== "inspection") return;
  const heat = portfolioHeat(state, playerId);
  if (!heat) return;
  const pressure = cityPressure(state);
  const shield = crackdownShield(state, playerId);
  const fine = Math.max(0, heat * (22 + pressure * 5) - shield);
  if (!fine) {
    appendLog(state, `${player.name}'s Heat is ${heat}, but Rat Patrol paperwork somehow absorbs the crackdown.`, "good");
    return;
  }
  charge(state, playerId, fine, { toPot: true, reason: "a Heat-driven inspection crackdown" });
  appendLog(state, `Heat ${heat}: inspectors tack on another ${money(fine)} because apparently the vice squad, tax office, and Rat Police share a spreadsheet.`, "danger");
}

export function rollStreetDice(state, mode = "normal", cabSteps = null, rng = Math.random) {
  if (state.status !== "playing" || state.rolled || state.pendingAction || state.auction || state.pendingTrade || state.debt) return state;
  const active = currentPlayer(state);
  if (!active) return state;
  const playerId = active.id;
  const beforePosition = active.position;
  const beforeInCourt = active.inCourt;
  const beforeCourtTurns = active.courtTurns || 0;
  const beforeDoublesStreak = state.doublesStreak || 0;
  let prepared = state;
  let forcedDice = null;

  if (mode === "cruise" && !active.inCourt) {
    forcedDice = [1, 2 + Math.floor(rng() * 5)];
  } else if (mode === "cab" && !active.inCourt) {
    if (active.cash < 60) return state;
    prepared = clone(state);
    playerById(prepared, playerId).cash -= 60;
    appendLog(prepared, `${active.name} pays $60 for a sketchy cab and gives extremely specific directions.`, "info");
    forcedDice = diceForCab(cabSteps);
  }

  const next = rollDice(prepared, forcedDice, rng);
  if (next === state || !next.rolled) return next;

  const isDouble = next.dice[0] === next.dice[1];
  const movedFromCourt = !beforeInCourt || isDouble || beforeCourtTurns >= 2;
  const jailedForTripleDoubles = !beforeInCourt && isDouble && beforeDoublesStreak >= 2;
  const landedSpaceId = movedFromCourt && !jailedForTripleDoubles
    ? (beforePosition + next.lastRollTotal) % BOARD.length
    : beforePosition;

  applySchemeRent(next, playerId);
  applyCityAssessment(next, playerId, beforePosition, beforeInCourt);
  applyInspectionCrackdown(next, playerId, landedSpaceId);
  return next;
}

function objectiveWinner(state) {
  if (state.goalMode === "empire") {
    return state.players.find((player) => !player.bankrupt && calculateChaosNetWorth(state, player.id) >= 6000 && getPlayerProperties(state, player.id).length >= 8) || null;
  }
  if (state.goalMode === "takeover") {
    return state.players.find((player) => !player.bankrupt && completedGroups(state, player.id) >= 3) || null;
  }
  return null;
}

export function finishChaosTurn(state) {
  const next = endTurn(state);
  if (next.status !== "playing" || next.goalMode === "bankruptcy") return next;
  const winner = objectiveWinner(next);
  if (!winner) return next;
  next.status = "finished";
  next.winnerId = winner.id;
  next.winReason = GOALS[next.goalMode].description;
  appendLog(next, `${winner.name} wins: ${GOALS[next.goalMode].label}. City Hall sends a fruit basket and a tax lien.`, "good");
  return next;
}

export function botChaosAction(state, playerId) {
  if (state.chaosActionTurn === state.turnCount) return null;
  const next = clone(state);
  next.chaosActionTurn = state.turnCount;
  const player = playerById(next, playerId);
  if (!player || player.bankrupt || player.cash < 350) return next;

  const upgradable = getPlayerProperties(next, playerId)
    .filter(({ space }) => canChaosUpgrade(next, playerId, space.id))
    .sort((a, b) => a.space.upgradeCost - b.space.upgradeCost);
  if (upgradable.length && player.cash > upgradable[0].space.upgradeCost + 300) {
    return Object.assign(upgradePropertyChaos(next, playerId, upgradable[0].space.id), { chaosActionTurn: state.turnCount });
  }

  const unschemed = getPlayerProperties(next, playerId).filter(({ space, ownership }) => space.type === "property" && !ownership.schemeId && !ownership.mortgaged);
  if (!unschemed.length) return next;
  const preference = player.botLevel === "hard" ? "drug-lord-lease" : player.botLevel === "easy" ? "rat-patrol" : "landlord-special";
  const scheme = SCHEMES.find((item) => item.id === preference);
  if (!scheme || player.cash < scheme.cost + 250) return next;
  return Object.assign(installScheme(next, playerId, unschemed[0].space.id, scheme.id), { chaosActionTurn: state.turnCount });
}

export function goalLabel(state) {
  return GOALS[state?.goalMode]?.label || GOALS.bankruptcy.label;
}

export function goalDescription(mode) {
  return GOALS[mode]?.description || GOALS.bankruptcy.description;
}
