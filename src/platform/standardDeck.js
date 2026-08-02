export const SUIT_SYMBOLS = Object.freeze({ clubs: "♣", diamonds: "♦", hearts: "♥", spades: "♠" });
export const SUITS = Object.freeze(Object.keys(SUIT_SYMBOLS));
export const RANKS = Object.freeze(["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]);

export function createStandardDeck(prefix = "card") {
  return SUITS.flatMap((suit) => RANKS.map((rank, index) => ({
    id: `${prefix}-${suit}-${rank}`,
    suit,
    rank,
    value: index + 2,
    color: suit === "hearts" || suit === "diamonds" ? "red" : "black",
  })));
}

export function shuffleCards(cards, random = Math.random) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function sortStandardHand(cards) {
  const suitOrder = { clubs: 0, diamonds: 1, spades: 2, hearts: 3 };
  return [...cards].sort((a, b) => suitOrder[a.suit] - suitOrder[b.suit] || a.value - b.value);
}
