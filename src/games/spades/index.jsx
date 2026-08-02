import "../../platform/standardCards.css";
import "./styles.css";

export { default } from "./SpadesGame";
export { SPADES_RULES } from "./engine";

export const gameInfo = Object.freeze({ id: "spades", name: "Spades", players: 4 });
