import { createStandardDeck, shuffleCards } from "../../platform/standardDeck.js";

export const ERS_RULES = Object.freeze({
  playersMin: 2,
  playersMax: 6,
  incorrectSlapPenalty: 1,
  onlineAwardDelayMs: 1100,
});

const FACE_CHANCES = Object.freeze({ J: 1, Q: 2, K: 3, A: 4 });
const RANKS = Object.freeze(["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]);

function copyHands(hands) {
  return Object.fromEntries(Object.entries(hands || {}).map(([uid, cards]) => [uid, [...cards]]));
}

function memberName(members, uid, fallback = "Player") {
  return members.find((member) => member.uid === uid)?.nickname || fallback;
}

function nextPlayableIndex(state, members, start) {
  for (let offset = 1; offset < members.length; offset += 1) {
    const index = (start + offset) % members.length;
    const uid = members[index].uid;
    if (!state.out?.[uid] && (state.hands?.[uid]?.length || 0) > 0) return index;
  }
  return -1;
}

function numericValue(rank) {
  if (rank === "A") return 1;
  const value = Number(rank);
  return Number.isFinite(value) ? value : null;
}

function sequenceDirection(a, b) {
  const ai = RANKS.indexOf(a);
  const bi = RANKS.indexOf(b);
  if (ai < 0 || bi < 0) return 0;
  if ((ai + 1) % RANKS.length === bi) return 1;
  if ((ai - 1 + RANKS.length) % RANKS.length === bi) return -1;
  return 0;
}

function observedPileMatches(state, observedTopCardId) {
  if (!observedTopCardId) return true;
  return state.pile?.at(-1)?.id === observedTopCardId;
}

export function ersSlapReasons(pile = []) {
  if (!pile.length) return [];
  const top = pile.at(-1);
  const reasons = [];

  if (pile.length >= 2) {
    const previous = pile.at(-2);
    if (top.rank === previous.rank) reasons.push("double");
    if ((top.rank === "K" && previous.rank === "Q") || (top.rank === "Q" && previous.rank === "K")) reasons.push("marriage");
    if (top.rank === pile[0].rank) reasons.push("top-bottom");
    const sum = numericValue(top.rank) + numericValue(previous.rank);
    if (Number.isFinite(sum) && sum === 10) reasons.push("tens");
  }

  if (pile.length >= 3) {
    const middle = pile.at(-2);
    const third = pile.at(-3);
    if (top.rank === third.rank) reasons.push("sandwich");
    const sum = numericValue(top.rank) + numericValue(third.rank);
    if (["J", "Q", "K"].includes(middle.rank) && Number.isFinite(sum) && sum === 10) reasons.push("tens-around-face");
  }

  if (pile.length >= 4) {
    const four = pile.slice(-4).map((card) => card.rank);
    const steps = [
      sequenceDirection(four[0], four[1]),
      sequenceDirection(four[1], four[2]),
      sequenceDirection(four[2], four[3]),
    ];
    if (steps.every((value) => value === 1) || steps.every((value) => value === -1)) reasons.push("four-in-a-row");
  }

  return [...new Set(reasons)];
}

export function createERSGame(members, rules = {}, random = Math.random) {
  if (members.length < 2 || members.length > 6) throw new Error("This table supports two to six players.");
  const deck = shuffleCards(createStandardDeck("ers"), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  deck.forEach((card, index) => hands[members[index % members.length].uid].push(card));

  return {
    phase: "playing",
    roundNumber: 1,
    hands,
    pile: [],
    burnPile: [],
    currentPlayerIndex: 0,
    challenge: null,
    pendingClaimUid: null,
    out: {},
    winnerUid: null,
    incorrectSlapPenalty: Number(rules.incorrectSlapPenalty || ERS_RULES.incorrectSlapPenalty),
    message: `${members[0].nickname} flips first.`,
  };
}

function checkWinner(state, members) {
  const winner = members.find((member) => (state.hands?.[member.uid]?.length || 0) === 52 && !(state.pile?.length) && !(state.burnPile?.length));
  return winner
    ? { ...state, phase: "game-over", winnerUid: winner.uid, message: `${winner.nickname} has all 52 cards and wins!` }
    : state;
}

function collect(state, uid, members, message) {
  const hands = copyHands(state.hands);
  hands[uid] = [...(hands[uid] || []), ...(state.burnPile || []), ...(state.pile || [])];
  const index = members.findIndex((member) => member.uid === uid);
  return checkWinner({
    ...state,
    hands,
    pile: [],
    burnPile: [],
    challenge: null,
    pendingClaimUid: null,
    out: { ...(state.out || {}), [uid]: false },
    currentPlayerIndex: Math.max(index, 0),
    message,
  }, members);
}

function doSlap(state, actorUid, action, members) {
  if (state.out?.[actorUid]) throw new Error("You were eliminated by an incorrect empty-handed slap.");
  if (!observedPileMatches(state, action.observedTopCardId)) {
    throw new Error("The pile changed before your slap arrived. No penalty was applied.");
  }
  if (!state.pile?.length) throw new Error("There is no center pile yet.");

  const reasons = ersSlapReasons(state.pile);
  if (reasons.length) {
    return collect(state, actorUid, members, `${memberName(members, actorUid)} wins the pile with ${reasons[0]}.`);
  }

  const hands = copyHands(state.hands);
  const penaltyCards = [];
  const count = Math.max(1, Number(state.incorrectSlapPenalty || 1));
  for (let index = 0; index < count && hands[actorUid]?.length; index += 1) {
    penaltyCards.push(hands[actorUid].shift());
  }

  const out = { ...(state.out || {}) };
  if (!penaltyCards.length) out[actorUid] = true;

  return {
    ...state,
    hands,
    // Burn cards are dead cards under the live pile. Keep them separate so they
    // cannot accidentally create doubles, sandwiches, or top-bottom matches.
    burnPile: [...(state.burnPile || []), ...penaltyCards],
    out,
    message: penaltyCards.length
      ? `${memberName(members, actorUid)} false-slapped and burns one card under the pile.`
      : `${memberName(members, actorUid)} false-slapped with no cards left and is out.`,
  };
}

function startFaceChallenge(state, actorUid, card, hands, pile, members, actorIndex) {
  const limit = FACE_CHANCES[card.rank];
  const base = {
    ...state,
    hands,
    pile,
    challenge: { ownerUid: actorUid, chancesRemaining: limit, limit, faceRank: card.rank },
    pendingClaimUid: null,
  };
  const next = nextPlayableIndex(base, members, actorIndex);

  if (next < 0) {
    return {
      ...base,
      challenge: { ...base.challenge, chancesRemaining: 0 },
      pendingClaimUid: actorUid,
      currentPlayerIndex: actorIndex,
      message: `${memberName(members, actorUid)} played ${card.rank}. No opponent has a card to answer, so the pile will be awarded after the online slap window.`,
    };
  }

  return {
    ...base,
    currentPlayerIndex: next,
    message: `${card.rank} challenge: ${memberName(members, members[next].uid)} gets ${limit} chance${limit === 1 ? "" : "s"} to answer.`,
  };
}

function doFlip(state, actorUid, members) {
  if (state.pendingClaimUid) throw new Error("The face-card challenge is resolving. Watch for a slap.");
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (current?.uid !== actorUid) throw new Error("It is not your turn to flip.");
  if (state.out?.[actorUid]) throw new Error("You are out of this game.");

  const hands = copyHands(state.hands);
  const card = hands[actorUid]?.shift();
  if (!card) throw new Error("You have no cards to flip. Watch for a valid slap to return.");

  const pile = [...(state.pile || []), card];
  const actorIndex = members.findIndex((member) => member.uid === actorUid);
  const faceChances = FACE_CHANCES[card.rank] || 0;

  if (faceChances) return startFaceChallenge(state, actorUid, card, hands, pile, members, actorIndex);

  if (state.challenge) {
    const remaining = Number(state.challenge.chancesRemaining || 0) - 1;
    if (remaining <= 0) {
      const ownerUid = state.challenge.ownerUid;
      return {
        ...state,
        hands,
        pile,
        challenge: { ...state.challenge, chancesRemaining: 0 },
        pendingClaimUid: ownerUid,
        currentPlayerIndex: Math.max(members.findIndex((member) => member.uid === ownerUid), 0),
        message: `${memberName(members, ownerUid, "The challenger")} wins the face-card challenge unless someone lands a valid slap during the online reaction window.`,
      };
    }

    if ((hands[actorUid]?.length || 0) === 0) {
      const next = nextPlayableIndex({ ...state, hands, pile }, members, actorIndex);
      if (next < 0) {
        const ownerUid = state.challenge.ownerUid;
        return {
          ...state,
          hands,
          pile,
          challenge: { ...state.challenge, chancesRemaining: 0 },
          pendingClaimUid: ownerUid,
          currentPlayerIndex: Math.max(members.findIndex((member) => member.uid === ownerUid), 0),
          message: `${memberName(members, actorUid)} ran out of cards. No one else can continue the challenge, so ${memberName(members, ownerUid)} will take the pile after the online slap window.`,
        };
      }

      return {
        ...state,
        hands,
        pile,
        challenge: { ...state.challenge, chancesRemaining: remaining },
        currentPlayerIndex: next,
        message: `${remaining} challenge chance${remaining === 1 ? "" : "s"} left. ${memberName(members, members[next].uid)} continues because ${memberName(members, actorUid)} ran out of cards.`,
      };
    }

    return {
      ...state,
      hands,
      pile,
      challenge: { ...state.challenge, chancesRemaining: remaining },
      currentPlayerIndex: actorIndex,
      message: `${memberName(members, actorUid)} has ${remaining} challenge chance${remaining === 1 ? "" : "s"} left.`,
    };
  }

  const base = { ...state, hands, pile };
  const next = nextPlayableIndex(base, members, actorIndex);
  if (next < 0) {
    return {
      ...base,
      currentPlayerIndex: actorIndex,
      message: `${memberName(members, actorUid)} flips again. Players without cards can still slap back in.`,
    };
  }

  return {
    ...base,
    currentPlayerIndex: next,
    message: `${memberName(members, members[next].uid)} flips next.`,
  };
}

export function reduceERS(state, actorUid, action, members) {
  if (state.phase === "game-over") throw new Error("This game is complete.");

  if (action.type === "slap") return doSlap(state, actorUid, action, members);

  if (action.type === "settle") {
    if (!state.pendingClaimUid) throw new Error("There is no challenge pile to settle.");
    if (!observedPileMatches(state, action.observedTopCardId)) {
      throw new Error("The pile changed before the challenge could settle.");
    }
    const ownerUid = state.pendingClaimUid;
    return collect(state, ownerUid, members, `${memberName(members, ownerUid)} wins the face-card challenge and collects the pile.`);
  }

  // Keep the explicit claim action for compatibility, but the online table auto-settles.
  if (action.type === "claim") {
    if (state.pendingClaimUid !== actorUid) throw new Error("You cannot claim this pile.");
    return collect(state, actorUid, members, `${memberName(members, actorUid)} wins the face-card challenge.`);
  }

  if (action.type === "flip") return doFlip(state, actorUid, members);
  throw new Error("Unknown ERS action.");
}

function stableIndex(value, length) {
  if (!length) return 0;
  const text = String(value || "ers");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = ((hash * 31) + text.charCodeAt(index)) >>> 0;
  return hash % length;
}

export function chooseERSRobotMove(state, members) {
  if (state.phase !== "playing") return null;

  const topCard = state.pile?.at(-1);
  if (topCard && ersSlapReasons(state.pile || []).length) {
    const robots = members.filter((member) => member.isRobot && !state.out?.[member.uid]);
    if (robots.length) {
      const robot = robots[stableIndex(topCard.id, robots.length)];
      return {
        uid: robot.uid,
        action: { type: "slap", observedTopCardId: topCard.id },
        key: `slap:${state.pile.length}:${topCard.id}:${robot.uid}`,
        delayMs: 850 + (stableIndex(`${topCard.id}:reaction`, 5) * 90),
      };
    }
  }

  // Human clients auto-settle challenge awards after a short network-friendly slap window.
  if (state.pendingClaimUid) return null;

  const current = members[Number(state.currentPlayerIndex || 0)];
  return current?.isRobot
    ? {
        uid: current.uid,
        action: { type: "flip" },
        key: `flip:${state.pile?.length || 0}:${current.uid}:${state.hands?.[current.uid]?.length || 0}`,
        delayMs: 900,
      }
    : null;
}
