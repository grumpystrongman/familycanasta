import "../../platform/standardCards.css";
import "./styles.css";

export { default } from "./RummyGame";
export { RUMMY_RULES } from "./engine";

export const gameInfo = Object.freeze({ id: "rummy", name: "Rummy", players: "2-6" });
