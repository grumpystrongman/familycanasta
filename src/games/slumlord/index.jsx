import React from "react";
import SlumLordGame from "./SlumLordGame.jsx";

export const metadata = {
  id: "slumlord",
  name: "Slum Lord",
  players: "2–4 local players",
};

export default function SlumLordEntry() {
  return <SlumLordGame />;
}
