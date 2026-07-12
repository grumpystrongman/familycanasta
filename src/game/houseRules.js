import { isWild } from "./engine.js";

export const GAME_VARIANTS = ["Classic", "HandAndFoot", "TriplePlay"];

export const DEFAULT_HOUSE_RULES = Object.freeze({
  drawAndDiscard: {
    drawCount: 2,
    discardTakeLimit: "entirePack",
    requiresNaturalPairForPack: true,
  },
  meldConstraints: {
    ruleOfFiveActive: false,
    pureSevensMandatory: false,
    pureAcesRule: false,
  },
  winConditions: {
    canastasRequiredToGoOut: { clean: 0, dirty: 0, wild: 0 },
    allowFinalDiscardToGoOut: true,
  },
  deckVariation: { variant: "Classic" },
});

function integer(value, fallback, minimum = 0, maximum = 20) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function normalizeHouseRules(value = {}) {
  const draw = value.drawAndDiscard || {};
  const meld = value.meldConstraints || {};
  const win = value.winConditions || {};
  const required = win.canastasRequiredToGoOut || {};
  const deck = value.deckVariation || {};
  const variant = GAME_VARIANTS.includes(deck.variant) ? deck.variant : "Classic";

  return {
    drawAndDiscard: {
      drawCount: Number(draw.drawCount) === 1 ? 1 : 2,
      discardTakeLimit: Number(draw.discardTakeLimit) === 7 ? 7 : "entirePack",
      requiresNaturalPairForPack: draw.requiresNaturalPairForPack !== false,
    },
    meldConstraints: {
      ruleOfFiveActive: Boolean(meld.ruleOfFiveActive),
      pureSevensMandatory: Boolean(meld.pureSevensMandatory),
      pureAcesRule: Boolean(meld.pureAcesRule),
    },
    winConditions: {
      canastasRequiredToGoOut: {
        clean: integer(required.clean, 0),
        dirty: integer(required.dirty, 0),
        wild: integer(required.wild, 0),
      },
      allowFinalDiscardToGoOut: win.allowFinalDiscardToGoOut !== false,
    },
    deckVariation: { variant },
  };
}

export function variantProfile(variant) {
  if (variant === "HandAndFoot") {
    return { deckCount: 4, handSize: 11, footSize: 11, kneeSize: 0, sequence: ["hand", "foot"] };
  }
  if (variant === "TriplePlay") {
    return { deckCount: 6, handSize: 11, footSize: 11, kneeSize: 11, sequence: ["hand", "foot", "knee"] };
  }
  return { deckCount: null, handSize: null, footSize: 0, kneeSize: 0, sequence: ["hand"] };
}

export function activeHouseRules(room) {
  return normalizeHouseRules(
    room?.activeRules
      || room?.houseRules
      || room?.rules?.houseRules
      || DEFAULT_HOUSE_RULES,
  );
}

export function validateDrawAction(room, player, source = "stock") {
  const rules = activeHouseRules(room).drawAndDiscard;
  if (source === "stock") {
    if ((room.stock || []).length < rules.drawCount) {
      throw new Error(`The stock does not contain ${rules.drawCount} cards.`);
    }
    return { drawCount: rules.drawCount };
  }

  const pile = room.publicState?.discardPile || [];
  const top = pile[pile.length - 1];
  if (!top) throw new Error("The discard pile is empty.");
  if (isWild(top)) throw new Error("A wild top discard cannot be matched by a natural pair.");

  if (rules.requiresNaturalPairForPack) {
    const matching = (room.privateHands?.[player.uid] || []).filter(
      (card) => !isWild(card) && card.rank === top.rank,
    );
    if (matching.length < 2) throw new Error(`Two natural ${top.rank}s are required to take the discard pile.`);
  }

  return {
    discardTakeCount: rules.discardTakeLimit === "entirePack"
      ? pile.length
      : Math.min(7, pile.length),
  };
}

export function validateMeldAction(room, targetMeld, cardsToPlay) {
  const rules = activeHouseRules(room).meldConstraints;
  const combined = [...(targetMeld?.cards || []), ...(cardsToPlay || [])];
  const naturals = combined.filter((card) => !isWild(card));
  const wilds = combined.filter(isWild);
  const rank = targetMeld?.rank || naturals[0]?.rank;

  if (rules.pureSevensMandatory && rank === "7" && wilds.length) {
    throw new Error("Seven melds must remain pure; wild cards are not allowed.");
  }
  if (rules.pureAcesRule && rank === "A" && wilds.length) {
    throw new Error("Ace melds must remain pure; wild cards are not allowed.");
  }
  if (rules.ruleOfFiveActive && wilds.length && naturals.length < 5) {
    throw new Error("Rule of Five: a meld needs five natural cards before wild cards may be added.");
  }
  return true;
}

export function countCanastas(board = []) {
  return board.reduce((counts, meld) => {
    const cards = meld.cards || [];
    if (cards.length < 7) return counts;
    const wildCount = cards.filter(isWild).length;
    if (wildCount === cards.length) counts.wild += 1;
    else if (wildCount) counts.dirty += 1;
    else counts.clean += 1;
    return counts;
  }, { clean: 0, dirty: 0, wild: 0 });
}

export function goOutRequirementStatus(room, team) {
  const rules = activeHouseRules(room).winConditions;
  const board = room?.publicState?.teamBoards?.[team] || [];
  const actual = countCanastas(board);
  const required = rules.canastasRequiredToGoOut;
  const missing = Object.fromEntries(
    ["clean", "dirty", "wild"].map((type) => [type, Math.max(0, required[type] - actual[type])]),
  );
  const totalActual = actual.clean + actual.dirty + actual.wild;
  const totalRequired = Math.max(1, Number(room?.rules?.canastasToGoOut || 1));
  const totalMissing = Math.max(0, totalRequired - totalActual);
  const typedMissing = Object.values(missing).reduce((sum, value) => sum + value, 0);
  const missingParts = Object.entries(missing)
    .filter(([, value]) => value)
    .map(([type, value]) => `${value} ${type}`);
  if (totalMissing) missingParts.unshift(`${totalMissing} completed`);

  let message = "Your team is eligible to go out.";
  if (missingParts.length) {
    const canastaLabel = Math.max(totalMissing, typedMissing) === 1 ? "canasta" : "canastas";
    message = `Your team still needs ${missingParts.join(", ")} ${canastaLabel} to go out.`;
  }

  return {
    eligible: totalMissing === 0 && typedMissing === 0,
    actual,
    required,
    missing,
    totalActual,
    totalRequired,
    totalMissing,
    message,
  };
}

export function validateGoOutAction(room, player, method = "meld") {
  const rules = activeHouseRules(room).winConditions;
  const status = goOutRequirementStatus(room, player.team);
  if (!status.eligible) throw new Error(status.message);
  if (method === "discard" && !rules.allowFinalDiscardToGoOut) {
    throw new Error("Going out with a final discard is disabled by the house rules.");
  }

  const variant = activeHouseRules(room).deckVariation.variant;
  const privateState = room.privatePlayerState?.[player.uid];
  if (variant === "HandAndFoot" && privateState?.activePile !== "foot") {
    throw new Error("You must enter and finish your Foot before going out.");
  }
  if (variant === "TriplePlay" && privateState?.activePile !== "knee") {
    throw new Error("You must enter and finish your Knee before going out.");
  }
  return true;
}
