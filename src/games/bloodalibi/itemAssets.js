export const BLACKGLASS_ITEM_ROOT = "/games/bloodalibi/items/direct";
export const BLACKGLASS_ART_CARRIER = `${BLACKGLASS_ITEM_ROOT}/blank.svg`;

const SUSPECT_IDS = Object.freeze(["mara-voss", "dex-vale", "imani-cross", "theo-rook", "june-mercer", "elias-flint"]);
const WEAPON_IDS = Object.freeze(["nail-gun", "cleaver", "garrote", "revolver", "poison", "fire-axe"]);
const ROOM_IDS = Object.freeze(["greenhouse", "penthouse", "security", "laundry", "atrium", "kitchen", "garage", "nightclub", "boiler"]);

const KIND_ALIASES = Object.freeze({
  suspect: "suspects", killer: "suspects", person: "suspects", suspects: "suspects",
  method: "weapons", weapon: "weapons", weapons: "weapons",
  location: "rooms", room: "rooms", rooms: "rooms",
});

const SUSPECT_POSITION = Object.freeze({
  "elias-flint": "0% 50%",
  "dex-vale": "20% 50%",
  "imani-cross": "40% 50%",
  "theo-rook": "60% 50%",
  "june-mercer": "80% 50%",
  "mara-voss": "100% 50%",
});
const WEAPON_POSITION = Object.freeze({
  "nail-gun": "0% 0%", cleaver: "50% 0%", garrote: "100% 0%",
  revolver: "0% 100%", poison: "50% 100%", "fire-axe": "100% 100%",
});
const ROOM_POSITION = Object.freeze({
  greenhouse: "0% 0%", penthouse: "50% 0%", security: "100% 0%",
  laundry: "0% 50%", atrium: "50% 50%", kitchen: "100% 50%",
  garage: "0% 100%", nightclub: "50% 100%", boiler: "100% 100%",
});

export const BLACKGLASS_ITEM_ASSETS = Object.freeze({
  suspects: Object.freeze(Object.fromEntries(SUSPECT_IDS.map((id) => [id, `${BLACKGLASS_ART_CARRIER}#suspects-${id}`]))),
  weapons: Object.freeze(Object.fromEntries(WEAPON_IDS.map((id) => [id, `${BLACKGLASS_ART_CARRIER}#weapons-${id}`]))),
  rooms: Object.freeze(Object.fromEntries(ROOM_IDS.map((id) => [id, `${BLACKGLASS_ART_CARRIER}#rooms-${id}`]))),
});

export function itemAssetUrl(kind, id) {
  const bucket = KIND_ALIASES[String(kind || "").toLowerCase()];
  if (!bucket || !id) return null;
  return BLACKGLASS_ITEM_ASSETS[bucket]?.[id] || null;
}

export function itemAssetStyle(kind, id) {
  const bucket = KIND_ALIASES[String(kind || "").toLowerCase()];
  if (!bucket || !id) return {};
  if (bucket === "suspects" && SUSPECT_POSITION[id]) return {
    backgroundImage: 'url("/blackglass/cast-atlas-polished.webp")',
    backgroundSize: "600% 100%",
    backgroundPosition: SUSPECT_POSITION[id],
    backgroundRepeat: "no-repeat",
    backgroundColor: "#07090a",
  };
  if (bucket === "weapons" && WEAPON_POSITION[id]) return {
    backgroundImage: 'url("/blackglass/weapon-atlas-polished.webp")',
    backgroundSize: "300% 200%",
    backgroundPosition: WEAPON_POSITION[id],
    backgroundRepeat: "no-repeat",
    backgroundColor: "#07090a",
  };
  if (bucket === "rooms" && ROOM_POSITION[id]) return {
    backgroundImage: 'url("/blackglass/room-atlas-polished.webp")',
    backgroundSize: "300% 300%",
    backgroundPosition: ROOM_POSITION[id],
    backgroundRepeat: "no-repeat",
    backgroundColor: "#07090a",
  };
  return {};
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
