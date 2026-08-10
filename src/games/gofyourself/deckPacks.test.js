import assert from "node:assert/strict";
import test from "node:test";
import { BAD_DECISIONS_DECK, cardLabelForDeck, rankLabelsForDeck } from "./deckPacks.js";

const SUITS = ["clubs", "diamonds", "hearts", "spades"];

test("Go F' Yourself deck has thirteen matching sets of four unique cards", () => {
  const entries = Object.entries(BAD_DECISIONS_DECK.sets);
  assert.equal(entries.length, 13);

  const allCards = [];
  for (const [rank, set] of entries) {
    assert.ok(set.name);
    assert.ok(set.collection);
    assert.deepEqual(Object.keys(set.cards).sort(), [...SUITS].sort());
    const labels = Object.values(set.cards);
    assert.equal(new Set(labels).size, 4, `${set.name} should contain four different joke cards`);
    allCards.push(...labels);
    for (const suit of SUITS) {
      assert.equal(cardLabelForDeck(BAD_DECISIONS_DECK, { rank, suit }), set.cards[suit]);
    }
  }

  assert.equal(allCards.length, 52);
  assert.equal(new Set(allCards).size, 52);
});

test("rank labels expose the matching set name, not the individual punchline", () => {
  const labels = rankLabelsForDeck(BAD_DECISIONS_DECK);
  assert.equal(labels["2"], "Total Regrets");
  assert.equal(labels["10"], "Sexual Misadventures");
  assert.equal(labels.A, "High-Octane Bad Decisions");
});
