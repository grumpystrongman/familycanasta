export const BLACKGLASS_ITEM_ROOT = "/games/bloodalibi/items";
export const BLACKGLASS_ATLAS_ROOT = "/blackglass";

const CAST_ATLAS = `${BLACKGLASS_ATLAS_ROOT}/cast-atlas-polished.webp`;
const WEAPON_ATLAS = `${BLACKGLASS_ATLAS_ROOT}/weapon-atlas-polished.webp`;
const ROOM_ATLAS = `${BLACKGLASS_ATLAS_ROOT}/room-atlas-polished.webp`;

// These cells are cropped directly from the approved Blackglass concept art so the live game
// reuses the actual cast, weapon iconography and room art instead of placeholder thumbnails.
const SUSPECT_CELLS = Object.freeze({
  "elias-flint": 0,
  "dex-vale": 1,
  "imani-cross": 2,
  "theo-rook": 3,
  "june-mercer": 4,
  "mara-voss": 5,
});
const WEAPON_CELLS = Object.freeze({
  "nail-gun": [0, 0], cleaver: [1, 0], garrote: [2, 0],
  revolver: [0, 1], poison: [1, 1], "fire-axe": [2, 1],
});
const ROOM_CELLS = Object.freeze({
  greenhouse: [0, 0], penthouse: [1, 0], security: [2, 0],
  laundry: [0, 1], atrium: [1, 1], kitchen: [2, 1],
  garage: [0, 2], nightclub: [1, 2], boiler: [2, 2],
});

const tagged = (src, id) => `${src}#blackglass-${id}`;

export const BLACKGLASS_ITEM_ASSETS = Object.freeze({
  suspects: Object.freeze(Object.fromEntries(Object.keys(SUSPECT_CELLS).map((id) => [id, tagged(CAST_ATLAS, id)]))),
  weapons: Object.freeze(Object.fromEntries(Object.keys(WEAPON_CELLS).map((id) => [id, tagged(WEAPON_ATLAS, id)]))),
  rooms: Object.freeze(Object.fromEntries(Object.keys(ROOM_CELLS).map((id) => [id, tagged(ROOM_ATLAS, id)]))),
});

const KIND_ALIASES = Object.freeze({
  suspect: "suspects", killer: "suspects", person: "suspects", suspects: "suspects",
  method: "weapons", weapon: "weapons", weapons: "weapons",
  location: "rooms", room: "rooms", rooms: "rooms",
});

function gridStyle(src, col, row, cols, rows) {
  const x = cols <= 1 ? 50 : (col / (cols - 1)) * 100;
  const y = rows <= 1 ? 50 : (row / (rows - 1)) * 100;
  return {
    backgroundImage: `url("${src}")`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${x}% ${y}%`,
    backgroundRepeat: "no-repeat",
    backgroundColor: "#07090a",
  };
}

export function itemAssetUrl(kind, id) {
  const bucket = KIND_ALIASES[String(kind || "").toLowerCase()];
  if (!bucket || !id) return null;
  return BLACKGLASS_ITEM_ASSETS[bucket]?.[id] || null;
}

export function itemAssetStyle(kind, id) {
  const bucket = KIND_ALIASES[String(kind || "").toLowerCase()];
  if (bucket === "suspects") {
    const cell = SUSPECT_CELLS[id];
    return cell == null ? {} : gridStyle(CAST_ATLAS, cell, 0, 6, 1);
  }
  if (bucket === "weapons") {
    const cell = WEAPON_CELLS[id];
    return cell ? gridStyle(WEAPON_ATLAS, cell[0], cell[1], 3, 2) : {};
  }
  if (bucket === "rooms") {
    const cell = ROOM_CELLS[id];
    return cell ? gridStyle(ROOM_ATLAS, cell[0], cell[1], 3, 3) : {};
  }
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
