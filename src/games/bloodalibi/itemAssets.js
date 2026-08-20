import { NOIR_ITEM_ASSETS } from "./noirArtwork.js";

const KIND_ALIASES = Object.freeze({
  suspect: "suspects", killer: "suspects", person: "suspects", suspects: "suspects",
  method: "weapons", weapon: "weapons", weapons: "weapons",
  location: "rooms", room: "rooms", rooms: "rooms",
});

export const BLACKGLASS_ITEM_ASSETS = NOIR_ITEM_ASSETS;

export function itemAssetUrl(kind, id) {
  const bucket = KIND_ALIASES[String(kind || "").toLowerCase()];
  if (!bucket || !id) return null;
  return BLACKGLASS_ITEM_ASSETS[bucket]?.[id] || null;
}

export function itemAssetStyle(kind, id) {
  const src = itemAssetUrl(kind, id);
  return src ? {
    backgroundImage: `url("${src}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundColor: "#07090a",
  } : {};
}

export function theoryAssetUrls({ suspectId, methodId, locationId } = {}) {
  return Object.freeze({
    suspect: itemAssetUrl("suspect", suspectId),
    weapon: itemAssetUrl("weapon", methodId),
    room: itemAssetUrl("room", locationId),
  });
}

export function theoryAssetStyles({ suspectId, methodId, locationId } = {}) {
  return Object.freeze({
    suspect: itemAssetStyle("suspect", suspectId),
    weapon: itemAssetStyle("weapon", methodId),
    room: itemAssetStyle("room", locationId),
  });
}
