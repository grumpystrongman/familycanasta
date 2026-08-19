import * as base from "./engine.js";
import { matchingAlibiCards } from "./deduction.js";

export const BLOOD_ALIBI_RULES = base.BLOOD_ALIBI_RULES;
export const BOARD_SIZE = base.BOARD_SIZE;
export const CORRIDOR_SPACES = base.CORRIDOR_SPACES;
export const METHODS = base.METHODS;
export const LOCATIONS = base.LOCATIONS;
export const boardRoomId = base.boardRoomId;
export const getReachableBoardNodes = base.getReachableBoardNodes;
export const normalizeBoardPosition = base.normalizeBoardPosition;
export const roomNodeId = base.roomNodeId;

export const SUSPECTS = Object.freeze([
  { id: "mara-voss", name: "Mara Voss", role: "true-crime host", detail: "Built a career turning other people's worst nights into content." },
  { id: "dex-vale", name: "Dex Vale", role: "night manager", detail: "Knows every blind camera, master key, and off-book favor in the building." },
  { id: "imani-cross", name: "Dr. Imani Cross", role: "trauma surgeon", detail: "Calm under pressure, exact with a blade, and carrying a reason to hate the victim." },
  { id: "theo-rook", name: "Theo Rook", role: "political fixer", detail: "Makes scandals disappear before breakfast and people stop asking questions." },
  { id: "june-mercer", name: "June Mercer", role: "crime-scene cleaner", detail: "Professional discretion, industrial solvents, and a trunk nobody wants opened." },
  { id: "elias-flint", name: "Elias Flint", role: "tech founder", detail: "Rich enough to buy silence and reckless enough to think that makes him untouchable." },
]);

const LOCATION_MAP = Object.freeze(Object.fromEntries(LOCATIONS.map((item) => [item.id, item])));

function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function cardId(kind, id) { return `${kind}:${id}`; }

function shuffled(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

function dealEvidence(members, solution) {
  const cards = [
    ...SUSPECTS.filter((item) => item.id !== solution.suspectId).map((item) => cardId("suspect", item.id)),
    ...METHODS.filter((item) => item.id !== solution.methodId).map((item) => cardId("method", item.id)),
    ...LOCATIONS.filter((item) => item.id !== solution.locationId).map((item) => cardId("location", item.id)),
  ];
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  shuffled(cards).forEach((card, index) => hands[members[index % members.length].uid].push(card));
  return hands;
}

function validateChoice(action, key, collection, label) {
  const value = String(action?.[key] || "");
  if (!collection.some((item) => item.id === value)) throw new Error(`Choose a valid ${label}.`);
  return value;
}

function nextActiveIndex(state, members, fromIndex) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (fromIndex + offset) % members.length;
    const member = members[index];
    if (member && !state.eliminated?.[member.uid]) return index;
  }
  return -1;
}

function advanceTurn(state, members, currentIndex, message) {
  const nextIndex = nextActiveIndex(state, members, currentIndex);
  if (nextIndex < 0) return { ...state, phase: "game-over", winnerUid: null, message: "The case collapsed with nobody left to accuse." };
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    turnPhase: "roll",
    moveRemaining: 0,
    lastRoll: null,
    turnNumber: Number(state.turnNumber || 1) + 1,
    message: `${message} ${members[nextIndex].nickname}'s turn.`,
  };
}

function theoryCards(theory) {
  return [
    cardId("suspect", theory.suspectId),
    cardId("method", theory.methodId),
    cardId("location", theory.locationId),
  ];
}

function matchesFor(state, uid, theory) {
  return matchingAlibiCards(state.hands?.[uid] || [], theory);
}

export function evidenceLabel(id) {
  const [kind, value] = String(id || "").split(":");
  if (kind === "suspect") return SUSPECTS.find((item) => item.id === value)?.name || value;
  if (kind === "method") return METHODS.find((item) => item.id === value)?.name || value;
  if (kind === "location") return LOCATIONS.find((item) => item.id === value)?.name || value;
  return base.evidenceLabel?.(id) || id;
}

export function createBloodAlibiGame(members) {
  const state = base.createBloodAlibiGame(members);
  const solution = {
    suspectId: pick(SUSPECTS).id,
    methodId: pick(METHODS).id,
    locationId: pick(LOCATIONS).id,
  };
  const suspectPositions = Object.fromEntries(SUSPECTS.map((suspect, index) => [suspect.id, LOCATIONS[index % LOCATIONS.length].id]));
  return {
    ...state,
    solution,
    hands: dealEvidence(members, solution),
    suspectPositions,
    lastTheory: null,
    pendingRefutation: null,
    caseLog: [{ type: "opening", text: "A body was found before dawn. One suspect, one weapon, and one room form the hidden truth." }],
  };
}

export function reduceBloodAlibi(state, actorUid, action, members) {
  if (action?.type === "showAlibi") {
    const pending = state.pendingRefutation;
    if (!pending) throw new Error("There is no alibi card waiting to be shown.");
    if (pending.refuterUid !== actorUid) throw new Error("Another investigator must choose the alibi card.");

    const refuter = members.find((member) => member.uid === actorUid);
    const suggester = members.find((member) => member.uid === pending.suggestorUid);
    const currentIndex = members.findIndex((member) => member.uid === pending.suggestorUid);
    const matches = matchesFor(state, actorUid, pending.theory);
    const shownCard = String(action.cardId || "");
    if (!matches.includes(shownCard)) throw new Error("Choose one of your matching alibi cards.");

    const reveals = Array.isArray(state.reveals) ? [...state.reveals] : [];
    const caseLog = Array.isArray(state.caseLog) ? [...state.caseLog] : [];
    reveals.push({ toUid: pending.suggestorUid, fromUid: actorUid, cardId: shownCard, turn: state.turnNumber });
    caseLog.push({
      type: "refutation",
      uid: actorUid,
      theory: pending.theory,
      text: `${refuter?.nickname || "An investigator"} showed ${suggester?.nickname || "the investigator"} one private alibi card.`,
    });

    return advanceTurn(
      { ...state, pendingRefutation: null, reveals: reveals.slice(-80), caseLog: caseLog.slice(-50) },
      members,
      currentIndex,
      `${refuter?.nickname || "An investigator"} produced an alibi card.`,
    );
  }

  if (state.pendingRefutation) {
    const refuter = members.find((member) => member.uid === state.pendingRefutation.refuterUid);
    throw new Error(`Waiting for ${refuter?.nickname || "another investigator"} to choose an alibi card.`);
  }

  if (action?.type !== "suggest" && action?.type !== "accuse") {
    return base.reduceBloodAlibi(state, actorUid, action, members);
  }

  if (state.phase !== "playing") throw new Error("This case is already closed.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (state.eliminated?.[actorUid]) throw new Error("Your accusation was wrong; you can no longer investigate.");
  if (state.turnPhase !== "investigate") throw new Error("Enter a room before proposing a scenario.");

  const positions = { ...(state.positions || {}) };
  positions[actorUid] = normalizeBoardPosition(positions[actorUid], current.seat);
  const investigationRoomId = boardRoomId(positions[actorUid]);
  if (!investigationRoomId) throw new Error("Enter a room before proposing a scenario.");

  const suspectId = validateChoice(action, "suspectId", SUSPECTS, "suspect");
  const methodId = validateChoice(action, "methodId", METHODS, "weapon");
  const caseLog = Array.isArray(state.caseLog) ? [...state.caseLog] : [];
  const reveals = Array.isArray(state.reveals) ? [...state.reveals] : [];

  if (action.type === "suggest") {
    const locationId = investigationRoomId;
    const candidates = theoryCards({ suspectId, methodId, locationId });
    const suspectPositions = { ...(state.suspectPositions || {}), [suspectId]: locationId };
    const methodPositions = { ...(state.methodPositions || {}), [methodId]: locationId };
    const lastTheory = { suspectId, methodId, locationId };
    let refuter = null;
    let matches = [];

    for (let offset = 1; offset < members.length; offset += 1) {
      const candidate = members[(currentIndex + offset) % members.length];
      const candidateMatches = (state.hands?.[candidate.uid] || []).filter((card) => candidates.includes(card)).sort();
      if (candidateMatches.length) {
        refuter = candidate;
        matches = candidateMatches;
        break;
      }
    }

    if (refuter) {
      if (!refuter.isRobot) {
        caseLog.push({
          type: "suggestion",
          uid: actorUid,
          theory: lastTheory,
          text: `${current.nickname} proposed ${SUSPECTS.find((item) => item.id === suspectId)?.name} with ${METHODS.find((item) => item.id === methodId)?.name} in ${LOCATION_MAP[locationId]?.name}; ${refuter.nickname} can refute it and must choose which alibi to show.`,
        });
        return {
          ...state,
          positions,
          suspectPositions,
          methodPositions,
          lastTheory,
          turnPhase: "refute",
          pendingRefutation: {
            suggestorUid: actorUid,
            refuterUid: refuter.uid,
            theory: lastTheory,
            turn: state.turnNumber,
          },
          caseLog: caseLog.slice(-50),
          message: `${refuter.nickname} can refute the theory. Waiting for a private alibi card.`,
        };
      }

      const shownCard = matches[0];
      reveals.push({ toUid: actorUid, fromUid: refuter.uid, cardId: shownCard, turn: state.turnNumber });
      caseLog.push({ type: "suggestion", uid: actorUid, theory: lastTheory, text: `${current.nickname} proposed ${SUSPECTS.find((item) => item.id === suspectId)?.name} with ${METHODS.find((item) => item.id === methodId)?.name} in ${LOCATION_MAP[locationId]?.name}; ${refuter.nickname} refuted it.` });
      return advanceTurn({ ...state, positions, suspectPositions, methodPositions, lastTheory, reveals: reveals.slice(-80), caseLog: caseLog.slice(-50) }, members, currentIndex, `${refuter.nickname} produced an alibi card.`);
    }

    caseLog.push({ type: "suggestion", uid: actorUid, theory: lastTheory, text: `${current.nickname}'s scenario — ${SUSPECTS.find((item) => item.id === suspectId)?.name}, ${METHODS.find((item) => item.id === methodId)?.name}, ${LOCATION_MAP[locationId]?.name} — could not be refuted.` });
    return advanceTurn({ ...state, positions, suspectPositions, methodPositions, lastTheory, reveals: reveals.slice(-80), caseLog: caseLog.slice(-50) }, members, currentIndex, "Nobody at the table could refute the scenario.");
  }

  const locationId = validateChoice(action, "locationId", LOCATIONS, "room");
  const solution = state.solution || {};
  const correct = suspectId === solution.suspectId && methodId === solution.methodId && locationId === solution.locationId;
  const lastTheory = { suspectId, methodId, locationId };

  if (correct) {
    caseLog.push({ type: "accusation", uid: actorUid, theory: lastTheory, text: `${current.nickname} named the suspect, weapon, and room correctly.` });
    return { ...state, positions, lastTheory, phase: "game-over", winnerUid: actorUid, caseLog: caseLog.slice(-50), message: `${current.nickname} solved the murder.` };
  }

  const eliminated = { ...(state.eliminated || {}), [actorUid]: true };
  caseLog.push({ type: "accusation", uid: actorUid, theory: lastTheory, text: `${current.nickname} made a final accusation and got it wrong.` });
  const survivors = members.filter((member) => !eliminated[member.uid]);
  if (survivors.length === 1) {
    return { ...state, positions, lastTheory, phase: "game-over", eliminated, winnerUid: survivors[0].uid, caseLog: caseLog.slice(-50), message: `${current.nickname}'s accusation failed. ${survivors[0].nickname} is the last investigator standing.` };
  }
  return advanceTurn({ ...state, positions, lastTheory, eliminated, caseLog: caseLog.slice(-50) }, members, currentIndex, `${current.nickname} is out of the investigation after a false accusation.`);
}

export function chooseBloodAlibiRobotMove(state, members) {
  if (state?.phase !== "playing") return null;

  if (state.pendingRefutation) {
    const refuter = members.find((member) => member.uid === state.pendingRefutation.refuterUid);
    if (!refuter?.isRobot) return null;
    const matches = matchesFor(state, refuter.uid, state.pendingRefutation.theory);
    if (!matches.length) return null;
    return {
      uid: refuter.uid,
      action: { type: "showAlibi", cardId: matches[0] },
      key: `${state.turnNumber}:${refuter.uid}:alibi:${matches[0]}`,
    };
  }

  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot || state.eliminated?.[current.uid]) return null;

  if (state.turnPhase !== "investigate") return base.chooseBloodAlibiRobotMove(state, members);
  const node = normalizeBoardPosition(state.positions?.[current.uid], current.seat);
  const locationId = boardRoomId(node);
  if (!locationId) return { uid: current.uid, action: { type: "end" }, key: `${state.turnNumber}:${current.uid}:end` };

  const suspect = SUSPECTS[(Number(state.turnNumber || 1) + Number(current.seat || 0)) % SUSPECTS.length];
  const method = METHODS[(Number(state.turnNumber || 1) + Number(current.seat || 0) + 2) % METHODS.length];
  return {
    uid: current.uid,
    action: { type: "suggest", suspectId: suspect.id, methodId: method.id },
    key: `${state.turnNumber}:${current.uid}:suggest:${suspect.id}:${method.id}:${locationId}`,
  };
}
