import "../../platform/standardCards.css";
import "../../platform/goFishStyles.css";
import React from "react";
import GoFishModule from "../../platform/GoFishModule";
import { cardLabelForDeck, DEFAULT_ADULT_DECK, rankLabelsForDeck } from "./deckPacks";

const theme = Object.freeze({
  gameId: "gofyourself",
  title: "Go F' Yourself",
  adult: true,
  homeKicker: "Go Fish after dark · 18+",
  tableKicker: `${DEFAULT_ADULT_DECK.name} · bad decisions score points`,
  summary: "Real Go Fish matching, except every four-card set is a category of adult humiliation and every card is its own filthy little punchline. Adults only.",
  startLabel: "Deal the bad decisions",
  askButton: "ASK THE DAMN QUESTION",
  openingLine: "Pick a matching set you already hold, pick a victim, and ask. If they have none, there is only one respectable answer: Go F' Yourself.",
  rankLabels: rankLabelsForDeck(DEFAULT_ADULT_DECK),
  cardLabel: (card) => cardLabelForDeck(DEFAULT_ADULT_DECK, card),
  deckName: DEFAULT_ADULT_DECK.name,
  deckTagline: DEFAULT_ADULT_DECK.tagline,
  missLines: Object.freeze([
    "Take the L and fish from the pile of consequences.",
    "Congratulations. You asked confidently and were wrong in public.",
    "Nothing. Just like your ex promised you would amount to.",
    "Denied. Somewhere, a therapist just felt a disturbance in the Force.",
    "Nope. Reach into the deck like you reach for your phone after three drinks.",
    "Absolutely not. The table has reviewed your request and chosen violence.",
    "Strikeout. Even the cards think your standards are too low.",
    "Rejected harder than a shirtless bathroom-mirror selfie on LinkedIn.",
  ]),
});

export default function GoFYourselfGame() { return <GoFishModule theme={theme} />; }
export const gameInfo = Object.freeze({ id: "gofyourself", name: "Go F' Yourself", players: "2–6 · 18+" });
