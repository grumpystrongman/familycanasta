const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const SORT_RANKS = ["A","4","5","6","7","8","9","10","J","Q","K","3","2","JOKER"];

export const TEAM_NAMES = ["North", "South", "West", "East"];
export const SUIT_SYMBOLS = { S: "♠", H: "♥", D: "♦", C: "♣", J: "★" };

export const DEFAULT_RULES = {
  teamCount: 2,
  playersPerTeam: 1,
  playMode: "solo",
  deckCount: 2,
  cardsPerPlayer: 15,
  targetScore: 5000,
  canastasToGoOut: 1,
  drawCount: 2,
  partnerPermission: true,
  allowWildCanasta: false,
  freezeOnWild: true,
  freezeOnBlackThree: false,
  unprotectedRedThreesPenalty: false,
  maxWildsPerMeld: 3,
  cleanCanastaBonus: 500,
  dirtyCanastaBonus: 300,
  redThreeBonus: 100,
  unprotectedRedThreePenalty: 200,
  goingOutBonus: 100,
};

export function makeCardId(deck, suit, rank, copy = 0) {
  return `${deck}-${suit}-${rank}-${copy}`;
}

export function createDeck(deckCount = 2) {
  const cards = [];
  for (let deck = 0; deck < deckCount; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: makeCardId(deck, suit, rank),
          deck,
          suit,
          rank,
          color: suit === "H" || suit === "D" ? "red" : "black",
        });
      }
    }
    cards.push({ id: makeCardId(deck, "J", "JOKER", 0), deck, suit: "J", rank: "JOKER", color: "black" });
    cards.push({ id: makeCardId(deck, "J", "JOKER", 1), deck, suit: "J", rank: "JOKER", color: "red" });
  }
  return cards;
}

export function shuffle(cards, random = Math.random) {
  const output = [...cards];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function sortHand(cards) {
  return [...cards].sort((a, b) => {
    const rank = SORT_RANKS.indexOf(a.rank) - SORT_RANKS.indexOf(b.rank);
    return rank || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
  });
}

export function randomDealer(playerIds, random = Math.random) {
  if (!playerIds.length) throw new Error("Cannot choose a dealer without players.");
  return Math.floor(random() * playerIds.length);
}

export function nextDealer(currentDealerIndex, playerCount) {
  return playerCount ? (currentDealerIndex + 1) % playerCount : 0;
}

export function openingRequirement(score) {
  if (score < 0) return 15;
  if (score < 1500) return 50;
  if (score < 3000) return 90;
  return 120;
}

export const isWild = (card) => card?.rank === "2" || card?.rank === "JOKER";
export const isRedThree = (card) => card?.rank === "3" && card?.color === "red";
export const isBlackThree = (card) => card?.rank === "3" && card?.color === "black";

export function cardPoints(card) {
  if (isRedThree(card)) return 100;
  if (card?.rank === "JOKER") return 50;
  if (card?.rank === "2" || card?.rank === "A") return 20;
  if (["K","Q","J","10","9","8"].includes(card?.rank)) return 10;
  if (["7","6","5","4"].includes(card?.rank)) return 5;
  return 0;
}

export function teamRecord(teamCount, valueFactory) {
  return Object.fromEntries(Array.from({ length: teamCount }, (_, team) => [team, valueFactory(team)]));
}

export function scoreTeamBoard(room, team, wentOutTeam = null) {
  const rules = { ...DEFAULT_RULES, ...(room.rules || {}) };
  const melds = room.publicState?.teamBoards?.[team] || [];
  const boardCardPoints = melds
    .flatMap((meld) => meld.cards || [])
    .reduce((sum, card) => sum + cardPoints(card), 0);

  let cleanCanastas = 0;
  let dirtyCanastas = 0;
  for (const meld of melds) {
    if ((meld.cards || []).length < 7) continue;
    if ((meld.cards || []).some(isWild)) dirtyCanastas += 1;
    else cleanCanastas += 1;
  }

  const redThreeCards = Object.entries(room.publicState?.redThrees || {})
    .filter(([uid]) => Number(room.members?.[uid]?.team) === Number(team))
    .flatMap(([, cards]) => cards || []);
  const redThreeCount = redThreeCards.length;
  const hasCanasta = cleanCanastas + dirtyCanastas > 0;
  const redThreesUnprotected = Boolean(rules.unprotectedRedThreesPenalty && redThreeCount > 0 && !hasCanasta);
  const redThreePoints = redThreesUnprotected
    ? -(redThreeCount * Number(rules.unprotectedRedThreePenalty || 200))
    : redThreeCount * Number(rules.redThreeBonus || 100);

  const canastaBonus = cleanCanastas * Number(rules.cleanCanastaBonus || 500)
    + dirtyCanastas * Number(rules.dirtyCanastaBonus || 300);
  const goingOutPoints = Number(wentOutTeam) === Number(team) ? Number(rules.goingOutBonus || 100) : 0;
  const handPenalty = Object.values(room.members || {})
    .filter((member) => Number(member.team) === Number(team))
    .flatMap((member) => room.privateHands?.[member.uid] || [])
    .reduce((sum, card) => sum + cardPoints(card), 0);

  return {
    boardCardPoints,
    cleanCanastas,
    dirtyCanastas,
    canastaBonus,
    redThreeCount,
    redThreePoints,
    redThreesUnprotected,
    goingOutPoints,
    handPenalty,
    bonusPoints: canastaBonus + redThreePoints + goingOutPoints,
    roundTotal: boardCardPoints + canastaBonus + redThreePoints + goingOutPoints - handPenalty,
  };
}

export function finishRound(room, wentOutUid) {
  const state = structuredClone(room);
  const wentOutTeam = Number(state.members?.[wentOutUid]?.team);
  const teamCount = Number(state.rules?.teamCount || 2);
  const breakdowns = teamRecord(teamCount, (team) => scoreTeamBoard(state, team, wentOutTeam));
  const currentScores = state.publicState?.teamScores || Array.from({ length: teamCount }, () => 0);
  state.publicState.teamScores = Array.from(
    { length: teamCount },
    (_, team) => Number(currentScores[team] || 0) + breakdowns[team].roundTotal,
  );
  state.publicState.roundBreakdowns = breakdowns;
  state.publicState.wentOutUid = wentOutUid;
  state.publicState.wentOutTeam = wentOutTeam;

  const targetScore = Number(state.rules?.targetScore || 5000);
  const winningScore = Math.max(...state.publicState.teamScores);
  const winnerTeam = state.publicState.teamScores.findIndex((score) => Number(score) === winningScore);
  const gameIsOver = winningScore >= targetScore;

  if (gameIsOver) {
    state.status = "gameOver";
    state.publicState.phase = "gameOver";
    state.publicState.turnPhase = "complete";
    state.publicState.winnerTeam = winnerTeam;
    state.publicState.winningScore = winningScore;
    state.publicState.gameEndedAt = Date.now();
    state.publicState.lastAction = `Team ${TEAM_NAMES[winnerTeam]} wins the game with ${winningScore.toLocaleString()} points!`;
  } else {
    state.publicState.phase = "handOver";
    state.publicState.turnPhase = "complete";
    state.publicState.lastAction = `${state.members?.[wentOutUid]?.nickname || "A player"} went out. Round scoring is complete.`;
  }
  return state;
}

export function dealHand({ players, rules, dealerIndex, existingScores }) {
  const teamCount = Number(rules.teamCount || 2);
  const stock = shuffle(createDeck(Number(rules.deckCount || (players.length > 4 ? 3 : 2))));
  const hands = Object.fromEntries(players.map((player) => [player.uid, []]));
  const redThrees = Object.fromEntries(players.map((player) => [player.uid, []]));
  const order = [];

  for (let cardNumber = 0; cardNumber < Number(rules.cardsPerPlayer || 11); cardNumber += 1) {
    for (let offset = 1; offset <= players.length; offset += 1) {
      const playerIndex = (dealerIndex + offset) % players.length;
      const player = players[playerIndex];
      const card = stock.pop();
      hands[player.uid].push(card);
      order.push({ playerUid: player.uid, cardId: card.id });
    }
  }

  for (const player of players) hands[player.uid] = sortHand(hands[player.uid]);

  let firstDiscard = stock.pop();
  while (firstDiscard && isRedThree(firstDiscard)) {
    stock.unshift(firstDiscard);
    firstDiscard = stock.pop();
  }

  const scores = existingScores || Array.from({ length: teamCount }, () => 0);
  return {
    publicState: {
      phase: "dealing",
      dealerIndex,
      currentPlayerIndex: (dealerIndex + 1) % players.length,
      turnPhase: "draw",
      stockCount: stock.length,
      discardPile: firstDiscard ? [firstDiscard] : [],
      discardFrozen: true,
      teamMelds: teamRecord(teamCount, () => []),
      teamBoards: teamRecord(teamCount, () => []),
      teamScores: scores,
      opened: teamRecord(teamCount, () => false),
      redThrees,
      handCounts: Object.fromEntries(players.map((player) => [player.uid, hands[player.uid].length])),
      dealOrder: order,
      dealAnimationIndex: 0,
      handNumber: 1,
      lastAction: "Cards are being dealt.",
      botThinkingUid: null,
    },
    privateHands: hands,
    stock,
  };
}
