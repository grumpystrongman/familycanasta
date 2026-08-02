import React from "react";
import { SUIT_SYMBOLS } from "./standardDeck.js";

export {
  createStandardDeck,
  RANKS,
  shuffleCards,
  sortStandardHand,
  SUITS,
  SUIT_SYMBOLS,
} from "./standardDeck.js";

export default function StandardCard({ card, hidden = false, selected = false, disabled = false, onClick, compact = false }) {
  if (hidden) {
    return <div className={`standard-card card-back ${compact ? "compact" : ""}`} aria-label="Hidden card"><span>◆</span></div>;
  }
  const suit = SUIT_SYMBOLS[card.suit] || "?";
  return (
    <button
      type="button"
      className={`standard-card ${card.color || "black"} ${selected ? "selected" : ""} ${compact ? "compact" : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="standard-card-corner"><b>{card.rank}</b><i>{suit}</i></span>
      <span className="standard-card-suit" aria-hidden="true">{suit}</span>
      <span className="standard-card-corner bottom"><b>{card.rank}</b><i>{suit}</i></span>
    </button>
  );
}
