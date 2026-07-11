const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

export const TEAM_NAMES = ["North", "South", "West"];

export const DEFAULT_RULES = {
  teamCount: 2,
  playersPerTeam: 2,
  deckCount: 2,
  cardsPerPlayer: 11,
  targetScore: 5000,
  canastasToGoOut: 1,
  drawCount: 1,
  partnerPermission: true,
  allowWildCanasta: false,
  freezeOnWild: true,
  freezeOnBlackThree: true,
  maxWildsPerMeld: 3,
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

export function randomDealer(playerIds, random = Math.random) {
  if (!playerIds.length) throw new Error("Cannot choose a dealer without players.");
  return Math.floor(random() * playerIds.length);
}

export function nextDealer(currentDealerIndex, playerCount) {
  if (!playerCount) return 0;
  return (currentDealerIndex + 1) % playerCount;
}

export function openingRequirement(score) {
  if (score < 0) return 15;
  if (score < 1500) return 50;
  if (score < 3000) return 90;
  return 120;
}

export function cardPoints(card) {
  if (card.rank === "JOKER") return 50;
  if (card.rank === "2" || card.rank === "A") return 20;
  if (["K","Q","J","10","9","8"].includes(card.rank)) return 10;
  if (["7","6","5","4"].includes(card.rank)) return 5;
  return 0;
}

export const isWild = (card) => card?.rank === "2" || card?.rank === "JOKER";
export const isRedThree = (card) => card?.rank === "3" && card?.color === "red";
export const isBlackThree = (card) => card?.rank === "3" && card?.color === "black";

export function teamRecord(teamCount, valueFactory) {
  return Object.fromEntries(Array.from({ length: teamCount }, (_, team) => [team, valueFactory(team)]));
}

export function dealHand({ players, rules, dealerIndex, existingScores }) {
  const teamCount = Number(rules.teamCount || 2);
  const stock = shuffle(createDeck(Number(rules.deckCount || (teamCount === 3 ? 3 : 2))));
  const hands = Object.fromEntries(players.map((player) => [player.uid, []]));
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

  const firstDiscard = stock.pop();
  const scores = existingScores || Array.from({ length: teamCount }, () => 0);

  return {
    publicState: {
      phase: "dealing",
      dealerIndex,
      currentPlayerIndex: (dealerIndex + 1) % players.length,
      turnPhase: "draw",
      stockCount: stock.length,
      discardPile: [firstDiscard],
      teamMelds: teamRecord(teamCount, () => []),
      teamBoards: teamRecord(teamCount, () => []),
      teamScores: scores,
      opened: teamRecord(teamCount, () => false),
      handCounts: Object.fromEntries(players.map((p) => [p.uid, Number(rules.cardsPerPlayer || 11)])),
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
