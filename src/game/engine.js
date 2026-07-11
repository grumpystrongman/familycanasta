
const SUITS = ["S", "H", "D", "C"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

export const DEFAULT_RULES = {
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

export function dealHand({ players, rules, dealerIndex, existingScores = [0, 0] }) {
  const stock = shuffle(createDeck(rules.deckCount));
  const hands = Object.fromEntries(players.map((player) => [player.uid, []]));
  const order = [];

  for (let cardNumber = 0; cardNumber < rules.cardsPerPlayer; cardNumber += 1) {
    for (let offset = 1; offset <= players.length; offset += 1) {
      const playerIndex = (dealerIndex + offset) % players.length;
      const player = players[playerIndex];
      const card = stock.pop();
      hands[player.uid].push(card);
      order.push({ playerUid: player.uid, cardId: card.id });
    }
  }

  const firstDiscard = stock.pop();

  return {
    publicState: {
      phase: "dealing",
      dealerIndex,
      currentPlayerIndex: (dealerIndex + 1) % players.length,
      turnPhase: "draw",
      stockCount: stock.length,
      discardPile: [firstDiscard],
      teamMelds: { 0: [], 1: [] },
      teamScores: existingScores,
      opened: { 0: false, 1: false },
      handCounts: Object.fromEntries(players.map((p) => [p.uid, rules.cardsPerPlayer])),
      dealOrder: order,
      dealAnimationIndex: 0,
      handNumber: 1,
      lastAction: "Cards are being dealt.",
    },
    privateHands: hands,
    stock,
  };
}
