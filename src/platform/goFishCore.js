import { createStandardDeck, RANKS, shuffleCards } from "./standardDeck.js";

export const GO_FISH_RULES = Object.freeze({ playersMin: 2, playersMax: 6 });
const SUIT_ORDER = Object.freeze({ clubs: 0, diamonds: 1, hearts: 2, spades: 3 });

export function groupGoFishHand(cards = []) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : Object.values(cards || {}).filter(Boolean);
  return RANKS.map((rank) => ({
    rank,
    cards: list
      .filter((card) => card.rank === rank)
      .sort((a, b) => (SUIT_ORDER[a.suit] ?? 99) - (SUIT_ORDER[b.suit] ?? 99)),
  })).filter((group) => group.cards.length > 0);
}

function cloneHands(hands = {}) {
  return Object.fromEntries(Object.entries(hands).map(([uid, cards]) => [uid, [...cards]]));
}

function cloneBooks(books = {}) {
  return Object.fromEntries(Object.entries(books).map(([uid, ranks]) => [uid, [...ranks]]));
}

function extractBooks(hand, existing = []) {
  let cards = [...hand];
  const books = [...existing];
  const completed = [];
  for (const rank of RANKS) {
    const matching = cards.filter((card) => card.rank === rank);
    if (matching.length === 4 && !books.includes(rank)) {
      cards = cards.filter((card) => card.rank !== rank);
      books.push(rank);
      completed.push(rank);
    }
  }
  return { hand: cards, books, completed };
}

function totalBooks(books) {
  return Object.values(books || {}).reduce((sum, ranks) => sum + ranks.length, 0);
}

function gameFinished(hands, stock, books) {
  return totalBooks(books) >= 13 || (stock.length === 0 && Object.values(hands).every((hand) => hand.length === 0));
}

function winnersFor(books, members) {
  const scores = members.map((member) => ({ uid: member.uid, score: books[member.uid]?.length || 0 }));
  const best = Math.max(...scores.map((entry) => entry.score));
  return scores.filter((entry) => entry.score === best).map((entry) => entry.uid);
}

function findNextIndex(currentIndex, members, hands, stock) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (currentIndex + offset) % members.length;
    const uid = members[index].uid;
    if ((hands[uid]?.length || 0) > 0 || stock.length > 0) return index;
  }
  return currentIndex;
}

function drawForEmptyCurrent(hands, stock, uid) {
  if ((hands[uid]?.length || 0) > 0 || stock.length === 0) return null;
  const card = stock.pop();
  hands[uid] = [card];
  return card;
}

export function createGoFishGame(members) {
  if (members.length < GO_FISH_RULES.playersMin || members.length > GO_FISH_RULES.playersMax) throw new Error("Go Fish supports two to six players.");
  const handSize = members.length === 2 ? 7 : 5;
  const deck = shuffleCards(createStandardDeck("fish"));
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  const books = Object.fromEntries(members.map((member) => [member.uid, []]));

  for (let round = 0; round < handSize; round += 1) {
    for (const member of members) hands[member.uid].push(deck.pop());
  }
  for (const member of members) {
    const extracted = extractBooks(hands[member.uid], books[member.uid]);
    hands[member.uid] = extracted.hand;
    books[member.uid] = extracted.books;
  }

  drawForEmptyCurrent(hands, deck, members[0].uid);
  return {
    phase: "playing",
    roundNumber: 1,
    hands,
    books,
    stock: deck,
    currentPlayerIndex: 0,
    winnerUids: [],
    lastAction: null,
    message: `${members[0].nickname} asks first.`,
  };
}

export function reduceGoFish(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This game is already over.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (action?.type !== "ask") throw new Error("Choose a rank and a player to ask.");

  const rank = String(action.rank || "");
  if (!RANKS.includes(rank)) throw new Error("Choose a rank from your hand.");
  const targetUid = String(action.targetUid || "");
  const target = members.find((member) => member.uid === targetUid);
  if (!target || targetUid === actorUid) throw new Error("Choose another player.");

  const hands = cloneHands(state.hands);
  const books = cloneBooks(state.books);
  const stock = [...(state.stock || [])];
  if (!hands[actorUid]?.some((card) => card.rank === rank)) throw new Error("You may only ask for a rank you already hold.");
  if (!(hands[targetUid]?.length > 0)) throw new Error("That player has no cards to give right now.");

  const matches = hands[targetUid].filter((card) => card.rank === rank);
  let drewCard = null;
  let keepTurn = false;
  let completedBooks = [];
  let result = "miss";

  if (matches.length) {
    result = "hit";
    hands[targetUid] = hands[targetUid].filter((card) => card.rank !== rank);
    hands[actorUid] = [...hands[actorUid], ...matches];
    keepTurn = true;
  } else if (stock.length) {
    drewCard = stock.pop();
    hands[actorUid] = [...hands[actorUid], drewCard];
    keepTurn = drewCard.rank === rank;
  }

  const extracted = extractBooks(hands[actorUid], books[actorUid]);
  hands[actorUid] = extracted.hand;
  books[actorUid] = extracted.books;
  completedBooks = extracted.completed;

  if (gameFinished(hands, stock, books)) {
    const winnerUids = winnersFor(books, members);
    return {
      ...state,
      phase: "game-over",
      hands,
      books,
      stock,
      winnerUids,
      lastAction: { uid: actorUid, targetUid, rank, result, count: matches.length, drewRank: drewCard?.rank || null, completedBooks },
      message: winnerUids.length === 1
        ? `${members.find((member) => member.uid === winnerUids[0])?.nickname || "Winner"} collected the most books.`
        : "The game ends in a tie for the most books.",
    };
  }

  let nextIndex = currentIndex;
  if (keepTurn) {
    drawForEmptyCurrent(hands, stock, actorUid);
  } else {
    nextIndex = findNextIndex(currentIndex, members, hands, stock);
    drawForEmptyCurrent(hands, stock, members[nextIndex].uid);
  }

  const nextPlayer = members[nextIndex];
  return {
    ...state,
    hands,
    books,
    stock,
    currentPlayerIndex: nextIndex,
    winnerUids: [],
    lastAction: { uid: actorUid, targetUid, rank, result, count: matches.length, drewRank: drewCard?.rank || null, completedBooks },
    message: keepTurn ? `${current.nickname} gets to ask again.` : `${nextPlayer.nickname}'s turn.`,
  };
}

export function chooseGoFishRobotMove(state, members) {
  if (state?.phase !== "playing") return null;
  const current = members[Number(state.currentPlayerIndex || 0)];
  if (!current?.isRobot) return null;
  const hand = state.hands?.[current.uid] || [];
  if (!hand.length) return null;
  const counts = RANKS.map((rank) => ({ rank, count: hand.filter((card) => card.rank === rank).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const rank = counts[0]?.rank;
  const targets = members.filter((member) => member.uid !== current.uid && (state.hands?.[member.uid]?.length || 0) > 0)
    .sort((a, b) => (state.hands?.[b.uid]?.length || 0) - (state.hands?.[a.uid]?.length || 0));
  if (!rank || !targets.length) return null;
  const target = targets[Math.floor(Math.random() * Math.min(2, targets.length))];
  return {
    uid: current.uid,
    action: { type: "ask", rank, targetUid: target.uid },
    key: `${state.stock?.length || 0}:${current.uid}:${rank}:${target.uid}:${state.lastAction?.uid || "start"}`,
  };
}

export { extractBooks };
