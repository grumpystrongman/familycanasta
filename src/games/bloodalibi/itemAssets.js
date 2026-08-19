export const BLACKGLASS_ITEM_ROOT = "/games/bloodalibi/items";

// The SVG files are lightweight crop windows into the canonical Blackglass atlases, so the same
// character, weapon, and room art is reused in the notebook, theory cards, player dock, and board.
export const BLACKGLASS_ITEM_ASSETS = Object.freeze({
  suspects: Object.freeze({
    "mara-voss": `${BLACKGLASS_ITEM_ROOT}/suspects/mara-voss.webp`,
    "dex-vale": `${BLACKGLASS_ITEM_ROOT}/suspects/dex-vale.svg`,
    "imani-cross": `${BLACKGLASS_ITEM_ROOT}/suspects/imani-cross.svg`,
    "theo-rook": `${BLACKGLASS_ITEM_ROOT}/suspects/theo-rook.svg`,
    "june-mercer": `${BLACKGLASS_ITEM_ROOT}/suspects/june-mercer.svg`,
    "elias-flint": `${BLACKGLASS_ITEM_ROOT}/suspects/elias-flint.svg`,
  }),
  weapons: Object.freeze({
    "nail-gun": `${BLACKGLASS_ITEM_ROOT}/weapons/nail-gun.svg`,
    cleaver: `${BLACKGLASS_ITEM_ROOT}/weapons/cleaver.svg`,
    garrote: `${BLACKGLASS_ITEM_ROOT}/weapons/garrote.svg`,
    revolver: `${BLACKGLASS_ITEM_ROOT}/weapons/revolver.svg`,
    poison: `${BLACKGLASS_ITEM_ROOT}/weapons/poison.svg`,
    "fire-axe": `${BLACKGLASS_ITEM_ROOT}/weapons/fire-axe.svg`,
  }),
  rooms: Object.freeze({
    greenhouse: `${BLACKGLASS_ITEM_ROOT}/rooms/greenhouse.svg`,
    penthouse: `${BLACKGLASS_ITEM_ROOT}/rooms/penthouse.svg`,
    security: `${BLACKGLASS_ITEM_ROOT}/rooms/security.svg`,
    laundry: `${BLACKGLASS_ITEM_ROOT}/rooms/laundry.svg`,
    atrium: `${BLACKGLASS_ITEM_ROOT}/rooms/atrium.svg`,
    kitchen: `${BLACKGLASS_ITEM_ROOT}/rooms/kitchen.svg`,
    garage: `${BLACKGLASS_ITEM_ROOT}/rooms/garage.svg`,
    nightclub: `${BLACKGLASS_ITEM_ROOT}/rooms/nightclub.svg`,
    boiler: `${BLACKGLASS_ITEM_ROOT}/rooms/boiler.svg`,
  }),
});

const KIND_ALIASES = Object.freeze({
  suspect: "suspects",
  killer: "suspects",
  person: "suspects",
  suspects: "suspects",
  method: "weapons",
  weapon: "weapons",
  weapons: "weapons",
  location: "rooms",
  room: "rooms",
  rooms: "rooms",
});

export function itemAssetUrl(kind, id) {
  const bucket = KIND_ALIASES[String(kind || "").toLowerCase()];
  if (!bucket || !id) return null;
  return BLACKGLASS_ITEM_ASSETS[bucket]?.[id] || null;
}

export function theoryAssetUrls({ suspectId, methodId, locationId } = {}) {
  return Object.freeze({
    suspect: itemAssetUrl("suspect", suspectId),
    weapon: itemAssetUrl("weapon", methodId),
    room: itemAssetUrl("room", locationId),
  });
}
