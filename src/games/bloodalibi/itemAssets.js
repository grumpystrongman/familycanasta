export const BLACKGLASS_ITEM_ROOT = "/games/bloodalibi/items/direct";

const SUSPECT_IDS = Object.freeze(["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"]);
const WEAPON_IDS = Object.freeze(["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"]);
const ROOM_IDS = Object.freeze(["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"]);

const direct = (bucket, id) => `${BLACKGLASS_ITEM_ROOT}/${bucket}/${id}.svg`;

// Live UI art is always a real, independently-addressable image. Each SVG is a dedicated crop
// wrapper around the approved Blackglass source artwork, so the browser never receives a whole
// raster atlas as an <img> and never needs pseudo-element/URL-fragment crop tricks.
export const BLACKGLASS_ITEM_ASSETS = Object.freeze({
  suspects: Object.freeze(Object.fromEntries(SUSPECT_IDS.map((id) => [id, direct("suspects", id)]))),
  weapons: Object.freeze(Object.fromEntries(WEAPON_IDS.map((id) => [id, direct("weapons", id)]))),
  rooms: Object.freeze(Object.fromEntries(ROOM_IDS.map((id) => [id, direct("rooms", id)]))),
});

const KIND_ALIASES = Object.freeze({
  suspect: "suspects", killer: "suspects", person: "suspects", suspects: "suspects",
  method: "weapons", weapon: "weapons", weapons: "weapons",
  location: "rooms", room: "rooms", rooms: "rooms",
});

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
