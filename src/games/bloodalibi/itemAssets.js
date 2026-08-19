import "./noirArt.css";

export const BLACKGLASS_ITEM_ROOT = "/games/bloodalibi/items";
export const BLACKGLASS_ATLAS_ROOT = "/blackglass";

// Non-Mara items use a transparent pixel tagged with an item fragment. noirArt.css turns those
// tags into precise crop windows over the canonical cast/weapon/room atlases. This keeps every
// existing image call site intact while displaying the approved Blackglass artwork everywhere.
const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const cropRef = (id) => `${PIXEL}#blackglass-${id}`;

export const BLACKGLASS_ITEM_ASSETS = Object.freeze({
  suspects: Object.freeze({
    "mara-voss": `${BLACKGLASS_ITEM_ROOT}/suspects/mara-voss.webp`,
    "dex-vale": cropRef("dex-vale"),
    "imani-cross": cropRef("imani-cross"),
    "theo-rook": cropRef("theo-rook"),
    "june-mercer": cropRef("june-mercer"),
    "elias-flint": cropRef("elias-flint"),
  }),
  weapons: Object.freeze({
    "nail-gun": cropRef("nail-gun"),
    cleaver: cropRef("cleaver"),
    garrote: cropRef("garrote"),
    revolver: cropRef("revolver"),
    poison: cropRef("poison"),
    "fire-axe": cropRef("fire-axe"),
  }),
  rooms: Object.freeze({
    greenhouse: cropRef("greenhouse"),
    penthouse: cropRef("penthouse"),
    security: cropRef("security"),
    laundry: cropRef("laundry"),
    atrium: cropRef("atrium"),
    kitchen: cropRef("kitchen"),
    garage: cropRef("garage"),
    nightclub: cropRef("nightclub"),
    boiler: cropRef("boiler"),
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
