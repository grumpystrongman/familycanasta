export const BLACKGLASS_ITEM_ROOT = "/games/bloodalibi/items";

export const BLACKGLASS_ITEM_ASSETS = Object.freeze({
  suspects: Object.freeze({
    "mara-voss": `${BLACKGLASS_ITEM_ROOT}/suspects/mara-voss.webp`,
    "dex-vale": `${BLACKGLASS_ITEM_ROOT}/suspects/dex-vale.webp`,
    "imani-cross": `${BLACKGLASS_ITEM_ROOT}/suspects/imani-cross.webp`,
    "theo-rook": `${BLACKGLASS_ITEM_ROOT}/suspects/theo-rook.webp`,
    "june-mercer": `${BLACKGLASS_ITEM_ROOT}/suspects/june-mercer.webp`,
    "elias-flint": `${BLACKGLASS_ITEM_ROOT}/suspects/elias-flint.webp`,
  }),
  weapons: Object.freeze({
    "nail-gun": `${BLACKGLASS_ITEM_ROOT}/weapons/nail-gun.webp`,
    cleaver: `${BLACKGLASS_ITEM_ROOT}/weapons/cleaver.webp`,
    garrote: `${BLACKGLASS_ITEM_ROOT}/weapons/garrote.webp`,
    revolver: `${BLACKGLASS_ITEM_ROOT}/weapons/revolver.webp`,
    poison: `${BLACKGLASS_ITEM_ROOT}/weapons/poison.webp`,
    "fire-axe": `${BLACKGLASS_ITEM_ROOT}/weapons/fire-axe.webp`,
  }),
  rooms: Object.freeze({
    greenhouse: `${BLACKGLASS_ITEM_ROOT}/rooms/greenhouse.webp`,
    penthouse: `${BLACKGLASS_ITEM_ROOT}/rooms/penthouse.webp`,
    security: `${BLACKGLASS_ITEM_ROOT}/rooms/security.webp`,
    laundry: `${BLACKGLASS_ITEM_ROOT}/rooms/laundry.webp`,
    atrium: `${BLACKGLASS_ITEM_ROOT}/rooms/atrium.webp`,
    kitchen: `${BLACKGLASS_ITEM_ROOT}/rooms/kitchen.webp`,
    garage: `${BLACKGLASS_ITEM_ROOT}/rooms/garage.webp`,
    nightclub: `${BLACKGLASS_ITEM_ROOT}/rooms/nightclub.webp`,
    boiler: `${BLACKGLASS_ITEM_ROOT}/rooms/boiler.webp`,
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
