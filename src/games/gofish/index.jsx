import "../../platform/standardCards.css";
import "../../platform/goFishStyles.css";
import React from "react";
import GoFishModule from "../../platform/GoFishModule";

const theme = Object.freeze({
  gameId: "gofish",
  title: "Go Fish",
  homeKicker: "Ask, draw, collect",
  tableKicker: "Classic family card game · most books wins",
  summary: "Ask other players for ranks you already hold, collect four-of-a-kind books, and draw from the pond when they tell you to go fish.",
  startLabel: "Deal the pond",
  openingLine: "Ask another player for a rank you already hold. If they have it, they hand over every card of that rank.",
});

export default function GoFishGame() { return <GoFishModule theme={theme} />; }
export const gameInfo = Object.freeze({ id: "gofish", name: "Go Fish", players: "2–6" });
