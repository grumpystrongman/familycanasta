import "../../platform/standardCards.css";
import "../../platform/goFishStyles.css";
import React from "react";
import GoFishModule from "../../platform/GoFishModule";

const theme = Object.freeze({
  gameId: "gofyourself",
  title: "Go F' Yourself",
  adult: true,
  homeKicker: "Go Fish after dark · 18+",
  tableKicker: "Adult Go Fish · bad decisions score points",
  summary: "The Go Fish you learned as a kid, except the table has profanity, terrible dating choices, crude innuendo, and absolutely no dignity. Adults only.",
  startLabel: "Deal the bad decisions",
  askButton: "ASK THE DAMN QUESTION",
  openingLine: "Pick one of your terrible life choices, pick a victim, and ask. If they have none, expect the only correct answer: Go F' Yourself.",
  rankLabels: Object.freeze({
    "2": "Bad Decisions",
    "3": "Booty Calls",
    "4": "Walks of Shame",
    "5": "Red Flags",
    "6": "Drunk Texts",
    "7": "Kinky Secrets",
    "8": "Hot Messes",
    "9": "Toxic Exes",
    "10": "Morning-After Alibis",
    J: "Questionable DMs",
    Q: "Thirst Traps",
    K: "One-Night Disasters",
    A: "Regrets",
  }),
});

export default function GoFYourselfGame() { return <GoFishModule theme={theme} />; }
export const gameInfo = Object.freeze({ id: "gofyourself", name: "Go F' Yourself", players: "2–6 · 18+" });
