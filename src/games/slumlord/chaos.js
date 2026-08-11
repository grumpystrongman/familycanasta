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
import {
  DISTRICTS,
  districtForSpace,
  districtSchemeMultiplier,
  districtShieldBonus,
  pickDistrictIncident,
} from "./districts.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const money = (value) => `$${Math.max(0, Math.round(value)).toLocaleString()}`;
const clampPressure = (value) => Math.max(0, Math.min(5, Number(value) || 0));

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
    pressureDelta: -1,
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
    pressureDelta: 1,
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
    pressureDelta: 1,
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
    pressureDelta: 2,
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
    pressureDelta: 1,
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
    pressureDelta: 1,
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

function credit(state, playerId, amount, reason = "Neighborhood miracle") {
  if (!amount || amount <= 0) return;
  const player = playerById(state, playerId);
  if (!player || player.bankrupt) return;
  player.cash += amount;
  appendLog(state, `${player.name} collects ${money(amount)} — ${reason}.`, "good");
  if (player.cash >= 0 && state.debt?.playerId === playerId) state.debt = null;
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

export function tenantPressure(ownership) {
  return clampPressure(ownership?.tenantPressure);
}

function setTenantPressure(ownership, value) {
  if (!ownership) return 0;
  ownership.tenantPressure = clampPressure(value);
  return ownership.tenantPressure;
}

export function districtUpgradeCost(state, spaceId) {
  const space = BOARD[spaceId];
  if (!space || space.type !== "property") return 0;
  const multiplier = districtForSpace(space)?.upgradeCostMultiplier || 1;
  return Math.max(10, Math.round((space.upgradeCost * multiplier) / 10) * 10);
}

export function propertyHeat(state, spaceId) {
  const ownership = ownershipFor(state, spaceId);
  if (!ownership) return 0;
  return (getScheme(ownership)?.heat || 0) + Math.ceil(tenantPressure(ownership) / 2);
}

export function portfolioHeat(state, playerId) {
  return getPlayerProperties(state, playerId).reduce((sum, { space }) => sum + propertyHeat(state, space.id), 0);
}

export function portfolioInspectionExposure(state, playerId) {
  return getPlayerProperties(state, playerId).reduce((sum, { space, ownership }) => {
    const district = districtForSpace(space);
    const rawHeat = (getScheme(ownership)?.heat || 0) + tenantPressure(ownership) * 0.5;
    return sum + rawHeat * (district?.inspectionMultiplier || 1);
  }, 0);
}

export function crackdownShield(state, playerId) {
  return getPlayerProperties(state, playerId).reduce((sum, { space, ownership }) => {
    const scheme = getScheme(ownership);
    if (!scheme) return sum;
    return sum + scheme.crackdownShield + districtShieldBonus(space.group, scheme.id);
  }, 0);
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
  state.lastNeighborhoodIncident = null;
  appendLog(state, `Goal: ${GOALS[state.goalMode].label}. Every neighborhood now has its own personality, tax problem, and reason to call the city.`, "warning");
  return state;
}

export function canChaosUpgrade(state, playerId, spaceId) {
  const space = BOARD[spaceId];
  const ownership = ownershipFor(state, spaceId);
  const player = playerById(state, playerId);
  const cost = districtUpgradeCost(state, spaceId);
  if (!space || space.type !== "property" || !ownership || ownership.ownerId !== playerId || !player) return false;
  if (ownership.mortgaged || ownership.upgrades >= MAX_UPGRADES || player.cash < cost || state.debt) return false;
  if ((ownership.upgrades || 0) < 2) return true;
  return ownsWholeGroup(state, playerId, space.group) && !groupHasMortgage(state, space.group);
}

export function upgradePropertyChaos(state, playerId, spaceId) {
  if (!canChaosUpgrade(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = BOARD[spaceId];
  const player = playerById(next, playerId);
  const ownership = ownershipFor(next, spaceId);
  const cost = districtUpgradeCost(next, spaceId);
  player.cash -= cost;
  ownership.upgrades = (ownership.upgrades || 0) + 1;
  const beforePressure = tenantPressure(ownership);
  setTenantPressure(ownership, beforePressure - 1);
  const label = ownership.upgrades <= 2 ? "questionable improvement" : "full-block improvement";
  const district = districtForSpace(space);
  appendLog(next, `${player.name} spends ${money(cost)} on a ${label} at ${space.name}. ${district?.name || "The block"} gives the work a cautious nod; tenant pressure drops to ${tenantPressure(ownership)}/5.`, "good");
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
  const refund = Math.floor(districtUpgradeCost(next, spaceId) / 2);
  player.cash += refund;
  setTenantPressure(ownership, tenantPressure(ownership) + 1);
  appendLog(next, `${player.name} removes an improvement from ${space.name}, sells the fixtures on Marketplace, pockets ${money(refund)}, and adds one point of tenant pressure.`, "warning");
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
  setTenantPressure(ownership, tenantPressure(ownership) + (scheme.pressureDelta || 0));
  const district = districtForSpace(space);
  const localBoost = districtSchemeMultiplier(space.group, scheme.id);
  appendLog(next, `${player.name} installs “${scheme.name}” at ${space.name} for ${money(scheme.cost)}. ${district?.name || "The neighborhood"} gives it a ×${localBoost.toFixed(2)} local fit; tenant pressure is ${tenantPressure(ownership)}/5.`, scheme.heat || scheme.pressureDelta > 0 ? "warning" : "good");
  return next;
}

export function removeScheme(state, playerId, spaceId) {
  const ownership = ownershipFor(state, spaceId);
  if (ownership?.ownerId !== playerId || !ownership.schemeId || state.debt) return state;
  const next = clone(state);
  const space = BOARD[spaceId];
  const old = getScheme(ownershipFor(next, spaceId));
  ownershipFor(next, spaceId).schemeId = null;
  setTenantPressure(ownershipFor(next, spaceId), tenantPressure(ownershipFor(next, spaceId)) - 1);
  charge(next, playerId, 50, { reason: `${old?.name || "scheme"} cleanup` });
  appendLog(next, `${playerById(next, playerId).name} removes ${old?.name || "the scheme"} from ${space.name}. Cleanup costs $50, several awkward explanations, and drops tenant pressure to ${tenantPressure(ownershipFor(next, spaceId))}/5.`, "info");
  return next;
}

function diceForCab(total) {
  const value = Math.max(3, Math.min(11, Number(total) || 3));
  if (value <= 7) return [1, value - 1];
  return [value - 6, 6];
}

function applyDistrictRent(state, playerId) {
  const player = playerById(state, playerId);
  const space = BOARD[player?.position];
  const ownership = ownershipFor(state, space?.id);
  if (!player || space?.type !== "property" || !ownership || ownership.ownerId === playerId || ownership.mortgaged) return;
  const district = districtForSpace(space);
  const multiplier = district?.rentMultiplier || 1;
  if (multiplier <= 1) return;
  const baseRent = calculateRent(state, space.id, state.lastRollTotal);
  const premium = Math.max(0, Math.round(baseRent * (multiplier - 1)));
  if (!premium) return;
  const owner = playerById(state, ownership.ownerId);
  charge(state, playerId, premium, { recipientId: ownership.ownerId, reason: `${district.name} neighborhood premium` });
  appendLog(state, `${player.name} pays ${money(premium)} extra to ${owner?.name || "the owner"} because ${district.badge} ${district.name} runs at ×${multiplier.toFixed(2)} neighborhood rent.`, "warning");
}

function applySchemeRent(state, playerId) {
  const player = playerById(state, playerId);
  const space = BOARD[player?.position];
  const ownership = ownershipFor(state, space?.id);
  if (!player || !space || !ownership || ownership.ownerId === playerId || ownership.mortgaged) return;
  const scheme = getScheme(ownership);
  if (!scheme) return;
  const baseRent = calculateRent(state, space.id, state.lastRollTotal);
  const localFit = districtSchemeMultiplier(space.group, scheme.id);
  const effectiveMultiplier = scheme.rentMultiplier * localFit;
  const premium = Math.max(0, Math.round(baseRent * (effectiveMultiplier - 1) + scheme.flatRent));
  if (!premium) return;
  const owner = playerById(state, ownership.ownerId);
  charge(state, playerId, premium, { recipientId: ownership.ownerId, reason: `${scheme.name} premium` });
  appendLog(state, `${player.name} pays an extra ${money(premium)} to ${owner?.name || "the owner"} because ${space.name} is running “${scheme.name}” with a ×${localFit.toFixed(2)} neighborhood fit.`, "warning");
}

function applyTenantBacklash(state, playerId) {
  const properties = getPlayerProperties(state, playerId).filter(({ space, ownership }) => space.type === "property" && tenantPressure(ownership) >= 4);
  if (!properties.length) return;
  const pressure = cityPressure(state);
  for (const { space, ownership } of properties) {
    const level = tenantPressure(ownership);
    const fee = 30 + level * 15 + pressure * 5;
    charge(state, playerId, fee, { toPot: true, reason: `tenant pushback at ${space.name}` });
    setTenantPressure(ownership, level - 2);
    appendLog(state, `${space.name} hits tenant pressure ${level}/5. A tenant association, escrow threat, and very organized email cost ${money(fee)}. Pressure cools to ${tenantPressure(ownership)}/5.`, "danger");
  }
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
  const assessment = Math.round(properties.reduce((sum, { space, ownership }) => {
    const district = districtForSpace(space);
    const localMultiplier = district?.assessmentMultiplier || 1;
    const improvements = (ownership.upgrades || 0) * 4;
    return sum + (deedTax + improvements) * localMultiplier;
  }, 0) + portfolioHeat(state, playerId) * 6);
  charge(state, playerId, assessment, { toPot: true, reason: "the city's Blight Improvement Assessment" });
  appendLog(state, `${player.name} passes Rent Day, collects rent money, then pays ${money(assessment)} in district-adjusted taxes, fees, assessments, and whatever the city invented this month.`, "warning");
  applyTenantBacklash(state, playerId);
}

function applyInspectionCrackdown(state, playerId, landedSpaceId) {
  const player = playerById(state, playerId);
  const landedSpace = BOARD[landedSpaceId];
  if (!player || landedSpace?.type !== "inspection") return;
  const heat = portfolioHeat(state, playerId);
  const exposure = portfolioInspectionExposure(state, playerId);
  if (!heat && !exposure) return;
  const pressure = cityPressure(state);
  const shield = crackdownShield(state, playerId);
  const fine = Math.max(0, Math.round(exposure * (22 + pressure * 5) - shield));
  if (!fine) {
    appendLog(state, `${player.name}'s portfolio Heat is ${heat}, but local shields and Rat Patrol paperwork somehow absorb the crackdown.`, "good");
    return;
  }
  charge(state, playerId, fine, { toPot: true, reason: "a district-weighted inspection crackdown" });
  appendLog(state, `Heat ${heat} / exposure ${exposure.toFixed(1)}: inspectors tack on another ${money(fine)} because Neon Strip and Midnight Towers do not get the same clipboard treatment as Vinyl Heights.`, "danger");
}

function applyNeighborhoodIncident(state, landedSpaceId, rng) {
  const space = BOARD[landedSpaceId];
  const ownership = ownershipFor(state, landedSpaceId);
  if (space?.type !== "property" || !ownership || ownership.mortgaged) return;
  const district = districtForSpace(space);
  const incident = pickDistrictIncident(space.group, rng);
  if (!district || !incident) return;
  const owner = playerById(state, ownership.ownerId);
  if (!owner || owner.bankrupt) return;

  if (incident.ownerCash < 0) charge(state, owner.id, Math.abs(incident.ownerCash), { reason: `${district.name}: ${incident.title}` });
  if (incident.ownerCash > 0) credit(state, owner.id, incident.ownerCash, `${district.name}: ${incident.title}`);
  if (incident.pressure) setTenantPressure(ownership, tenantPressure(ownership) + incident.pressure);

  state.lastNeighborhoodIncident = {
    ...incident,
    deckType: "district",
    districtName: district.name,
    badge: district.badge,
    pressureAfter: tenantPressure(ownership),
    spaceName: space.name,
  };
  appendLog(state, `${district.badge} ${district.name} — ${incident.title}: ${incident.text} Tenant pressure at ${space.name}: ${tenantPressure(ownership)}/5.`, incident.ownerCash < 0 || incident.pressure > 0 ? "warning" : "good");
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

  applyDistrictRent(next, playerId);
  applySchemeRent(next, playerId);
  applyCityAssessment(next, playerId, beforePosition, beforeInCourt);
  applyInspectionCrackdown(next, playerId, landedSpaceId);
  applyNeighborhoodIncident(next, landedSpaceId, rng);
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

function botSchemePreference(space, botLevel) {
  if (botLevel === "easy") return "rat-patrol";
  if (botLevel === "hard") {
    if (space.group === "neon" || space.group === "midnight") return "drug-lord-lease";
    if (space.group === "concrete") return "gang-protection";
    if (space.group === "gold") return "luxury-rebrand";
    return "landlord-special";
  }
  if (space.group === "neon") return "vice-motel";
  if (space.group === "concrete") return "gang-protection";
  if (space.group === "gold" || space.group === "vinyl") return "luxury-rebrand";
  return "landlord-special";
}

export function botChaosAction(state, playerId) {
  if (state.chaosActionTurn === state.turnCount) return null;
  const next = clone(state);
  next.chaosActionTurn = state.turnCount;
  const player = playerById(next, playerId);
  if (!player || player.bankrupt || player.cash < 350) return next;

  const upgradable = getPlayerProperties(next, playerId)
    .filter(({ space }) => canChaosUpgrade(next, playerId, space.id))
    .sort((a, b) => districtUpgradeCost(next, a.space.id) - districtUpgradeCost(next, b.space.id));
  if (upgradable.length && player.cash > districtUpgradeCost(next, upgradable[0].space.id) + 300) {
    return Object.assign(upgradePropertyChaos(next, playerId, upgradable[0].space.id), { chaosActionTurn: state.turnCount });
  }

  const unschemed = getPlayerProperties(next, playerId).filter(({ space, ownership }) => space.type === "property" && !ownership.schemeId && !ownership.mortgaged);
  if (!unschemed.length) return next;
  const target = [...unschemed].sort((a, b) => (DISTRICTS[b.space.group]?.rentMultiplier || 1) - (DISTRICTS[a.space.group]?.rentMultiplier || 1))[0];
  const preference = botSchemePreference(target.space, player.botLevel);
  const scheme = SCHEMES.find((item) => item.id === preference);
  if (!scheme || player.cash < scheme.cost + 250) return next;
  return Object.assign(installScheme(next, playerId, target.space.id, scheme.id), { chaosActionTurn: state.turnCount });
}

export function goalLabel(state) {
  return GOALS[state?.goalMode]?.label || GOALS.bankruptcy.label;
}

export function goalDescription(mode) {
  return GOALS[mode]?.description || GOALS.bankruptcy.description;
}
