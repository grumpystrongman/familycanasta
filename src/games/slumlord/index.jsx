import React, { useEffect, useState } from "react";
import GameBoard from "./GameBoard.jsx";
import "./themes.css";

const THEMES = [
  { id: "concrete", name: "Concrete Jungle" },
  { id: "sunset", name: "Sunset Motel" },
  { id: "toxic", name: "Toxic Tenement" },
];

export const metadata = {
  id: "slumlord",
  name: "Slum Lord",
  players: "18+ · 1 human + CPU by default · 2–4 local/CPU players",
};

export default function SlumLordEntry() {
  const [theme, setTheme] = useState(() => {
    const saved = window.localStorage.getItem("slumLordTheme");
    return THEMES.some((candidate) => candidate.id === saved) ? saved : "concrete";
  });

  useEffect(() => {
    window.localStorage.setItem("slumLordTheme", theme);
  }, [theme]);

  return (
    <div className={`sl-theme-root sl-theme-${theme}`}>
      <GameBoard />
      <label className="sl-theme-dock">
        <span>Board theme</span>
        <select aria-label="Slum Lord board theme" value={theme} onChange={(event) => setTheme(event.target.value)}>
          {THEMES.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
      </label>
    </div>
  );
}
