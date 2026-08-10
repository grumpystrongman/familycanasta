import { createStandardDeck, shuffleCards } from "../../platform/standardDeck.js";

export const ERS_RULES = Object.freeze({ playersMin: 2, playersMax: 6, incorrectSlapPenalty: 1 });
const FACE_CHANCES = Object.freeze({ J: 1, Q: 2, K: 3, A: 4 });
const RANKS = Object.freeze(["2","3","4","5","6","7","8","9","10","J","Q","K","A"]);

function copyHands(hands) { return Object.fromEntries(Object.entries(hands || {}).map(([uid, cards]) => [uid, [...cards]])); }
function nextIndex(state, members, start) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (start + offset) % members.length;
    const uid = members[index].uid;
    if (!state.out?.[uid] && (state.hands?.[uid]?.length || 0) > 0) return index;
  }
  return start;
}
function numericValue(rank) { if (rank === "A") return 1; const value = Number(rank); return Number.isFinite(value) ? value : null; }
function sequenceDirection(a, b) {
  const ai = RANKS.indexOf(a); const bi = RANKS.indexOf(b);
  if (ai < 0 || bi < 0) return 0;
  if ((ai + 1) % RANKS.length === bi) return 1;
  if ((ai - 1 + RANKS.length) % RANKS.length === bi) return -1;
  return 0;
}

export function ersSlapReasons(pile = []) {
  if (!pile.length) return [];
  const top = pile.at(-1); const reasons = [];
  if (pile.length >= 2) {
    const previous = pile.at(-2);
    if (top.rank === previous.rank) reasons.push("double");
    if ((top.rank === "K" && previous.rank === "Q") || (top.rank === "Q" && previous.rank === "K")) reasons.push("marriage");
    if (top.rank === pile[0].rank) reasons.push("top-bottom");
    const sum = numericValue(top.rank) + numericValue(previous.rank);
    if (Number.isFinite(sum) && sum === 10) reasons.push("tens");
  }
  if (pile.length >= 3) {
    const middle = pile.at(-2); const third = pile.at(-3);
    if (top.rank === third.rank) reasons.push("sandwich");
    const sum = numericValue(top.rank) + numericValue(third.rank);
    if (["J","Q","K"].includes(middle.rank) && Number.isFinite(sum) && sum === 10) reasons.push("tens-around-face");
  }
  if (pile.length >= 4) {
    const four = pile.slice(-4).map((card) => card.rank);
    const steps = [sequenceDirection(four[0], four[1]), sequenceDirection(four[1], four[2]), sequenceDirection(four[2], four[3])];
    if (steps.every((value) => value === 1) || steps.every((value) => value === -1)) reasons.push("four-in-a-row");
  }
  return [...new Set(reasons)];
}

export function createERSGame(members, rules = {}, random = Math.random) {
  if (members.length < 2 || members.length > 6) throw new Error("This table supports two to six players.");
  const deck = shuffleCards(createStandardDeck("ers"), random);
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  deck.forEach((card, index) => hands[members[index % members.length].uid].push(card));
  return { phase: "playing", roundNumber: 1, hands, pile: [], currentPlayerIndex: 0, challenge: null, pendingClaimUid: null, out: {}, winnerUid: null, incorrectSlapPenalty: Number(rules.incorrectSlapPenalty || ERS_RULES.incorrectSlapPenalty), message: `${members[0].nickname} flips first.` };
}

function checkWinner(state, members) {
  const winner = members.find((member) => (state.hands?.[member.uid]?.length || 0) === 52 && !(state.pile?.length));
  return winner ? { ...state, phase: "game-over", winnerUid: winner.uid, message: `${winner.nickname} has all 52 cards and wins!` } : state;
}

function collect(state, uid, members, message) {
  const hands = copyHands(state.hands);
  hands[uid] = [...(hands[uid] || []), ...(state.pile || [])];
  const index = members.findIndex((member) => member.uid === uid);
  return checkWinner({ ...state, hands, pile: [], challenge: null, pendingClaimUid: null, out: { ...(state.out || {}), [uid]: false }, currentPlayerIndex: Math.max(index, 0), message }, members);
}

function doSlap(state, actorUid, members) {
  if (state.out?.[actorUid]) throw new Error("You were eliminated by an incorrect empty-handed slap.");
  if (!state.pile?.length) throw new Error("There is no center pile yet.");
  const reasons = ersSlapReasons(state.pile);
  if (reasons.length) return collect(state, actorUid, members, `${members.find((member) => member.uid === actorUid)?.nickname} wins the pile with ${reasons[0]}.`);
  const hands = copyHands(state.hands);
  const penaltyCards = [];
  const count = Math.max(1, Number(state.incorrectSlapPenalty || 1));
  for (let index = 0; index < count && hands[actorUid]?.length; index += 1) penaltyCards.push(hands[actorUid].shift());
  const out = { ...(state.out || {}) };
  if (!penaltyCards.length) out[actorUid] = true;
  return { ...state, hands, pile: [...(state.pile || []), ...penaltyCards], out, message: penaltyCards.length ? "Incorrect slap: one card goes to the center pile." : "Incorrect slap with no cards left: that player is out." };
}

function doFlip(state, actorUid, members) {
  if (state.pendingClaimUid) throw new Error("The challenge has ended. Claim the pile or make a valid slap.");
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (current?.uid !== actorUid) throw new Error("It is not your turn to flip.");
  const hands = copyHands(state.hands);
  const card = hands[actorUid]?.shift();
  if (!card) throw new Error("You have no cards to flip. Watch for a valid slap to return.");
  const pile = [...(state.pile || []), card];
  const actorIndex = members.findIndex((member) => member.uid === actorUid);
  const faceChances = FACE_CHANCES[card.rank] || 0;
  if (faceChances) {
    const base = { ...state, hands, pile, challenge: { ownerUid: actorUid, chancesRemaining: faceChances }, pendingClaimUid: null };
    return { ...base, currentPlayerIndex: nextIndex(base, members, actorIndex), message: `${card.rank} challenge: ${faceChances} chance${faceChances === 1 ? "" : "s"} to answer.` };
  }
  if (state.challenge) {
    const remaining = Number(state.challenge.chancesRemaining || 0) - 1;
    if (remaining <= 0) {
      const owner = members.find((member) => member.uid === state.challenge.ownerUid);
      return { ...state, hands, pile, challenge: { ...state.challenge, chancesRemaining: 0 }, pendingClaimUid: state.challenge.ownerUid, currentPlayerIndex: members.findIndex((member) => member.uid === state.challenge.ownerUid), message: `${owner?.nickname || "The challenger"} may claim the pile unless someone makes a valid slap first.` };
    }
    return { ...state, hands, pile, challenge: { ...state.challenge, chancesRemaining: remaining }, message: `${remaining} challenge chance${remaining === 1 ? "" : "s"} left.` };
  }
  const base = { ...state, hands, pile };
  return { ...base, currentPlayerIndex: nextIndex(base, members, actorIndex), message: "Next card." };
}

export function reduceERS(state, actorUid, action, members) {
  if (state.phase === "game-over") throw new Error("This game is complete.");
  if (action.type === "slap") return doSlap(state, actorUid, members);
  if (action.type === "claim") {
    if (state.pendingClaimUid !== actorUid) throw new Error("You cannot claim this pile.");
    return collect(state, actorUid, members, `${members.find((member) => member.uid === actorUid)?.nickname} wins the face-card challenge.`);
  }
  if (action.type === "flip") return doFlip(state, actorUid, members);
  throw new Error("Unknown ERS action.");
}

export function chooseERSRobotMove(state, members) {
  if (state.phase !== "playing") return null;
  if (ersSlapReasons(state.pile || []).length) {
    const robot = members.find((member) => member.isRobot && !state.out?.[member.uid]);
    if (robot) return { uid: robot.uid, action: { type: "slap" }, key: `slap:${state.pile.length}:${state.pile.at(-1)?.id}` };
  }
  if (state.pendingClaimUid) {
    const owner = members.find((member) => member.uid === state.pendingClaimUid);
    return owner?.isRobot ? { uid: owner.uid, action: { type: "claim" }, key: `claim:${state.pile.length}:${owner.uid}` } : null;
  }
  const current = members[Number(state.currentPlayerIndex || 0)];
  return current?.isRobot ? { uid: current.uid, action: { type: "flip" }, key: `flip:${state.pile.length}:${current.uid}:${state.hands?.[current.uid]?.length || 0}` } : null;
}
