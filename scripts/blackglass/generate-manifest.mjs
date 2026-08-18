import path from "node:path";
import { cardsRoot, locations, scenarios } from "./config.mjs";
import { ensureDir, writeJson } from "./utils.mjs";

ensureDir(cardsRoot);
const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  total: scenarios.length,
  expectedPerRoom: 180,
  rooms: Object.fromEntries(locations.map((room) => [room.id, scenarios.filter((item) => item.locationId === room.id).length])),
  cards: scenarios.map((item) => ({
    id: item.id,
    suspectId: item.suspectId,
    victimId: item.victimId,
    methodId: item.methodId,
    locationId: item.locationId,
    file: `${item.locationId}/${item.id}.webp`,
  })),
};
writeJson(path.join(cardsRoot, "manifest.json"), manifest);
console.log(`Blackglass manifest: ${manifest.total} cards (${manifest.expectedPerRoom} per room).`);
