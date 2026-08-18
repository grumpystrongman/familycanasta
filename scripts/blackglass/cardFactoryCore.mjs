export const CARD_WIDTH = 1122;
export const CARD_HEIGHT = 1402;
export const CARD_FORMAT = "webp";
export const DEFAULT_SCENE_MODEL = "gpt-image-1-mini";
export const ESCALATION_SCENE_MODEL = "gpt-image-1";
export const DEFAULT_QA_MODEL = "gpt-5-nano";
export const DEFAULT_SCENE_QUALITY = "medium";
export const DEFAULT_ESCALATION_QUALITY = "high";
export const DEFAULT_CONCURRENCY = 2;

export const CAST_ATLAS = Object.freeze({
  "dex-vale": { col: 1, row: 0, cols: 7, rows: 1 },
  "imani-cross": { col: 2, row: 0, cols: 7, rows: 1 },
  "theo-rook": { col: 3, row: 0, cols: 7, rows: 1 },
  "june-mercer": { col: 4, row: 0, cols: 7, rows: 1 },
  "elias-flint": { col: 5, row: 0, cols: 7, rows: 1 },
  "ruby-ash": { col: 6, row: 0, cols: 7, rows: 1 },
});

export const ROOM_ATLAS = Object.freeze({
  greenhouse: { col: 0, row: 0, cols: 3, rows: 3 },
  penthouse: { col: 1, row: 0, cols: 3, rows: 3 },
  security: { col: 2, row: 0, cols: 3, rows: 3 },
  laundry: { col: 0, row: 1, cols: 3, rows: 3 },
  atrium: { col: 1, row: 1, cols: 3, rows: 3 },
  kitchen: { col: 2, row: 1, cols: 3, rows: 3 },
  garage: { col: 0, row: 2, cols: 3, rows: 3 },
  nightclub: { col: 1, row: 2, cols: 3, rows: 3 },
  boiler: { col: 2, row: 2, cols: 3, rows: 3 },
});

export const WEAPON_ATLAS = Object.freeze({
  "nail-gun": { col: 0, row: 0, cols: 3, rows: 2 },
  cleaver: { col: 1, row: 0, cols: 3, rows: 2 },
  garrote: { col: 2, row: 0, cols: 3, rows: 2 },
  revolver: { col: 0, row: 1, cols: 3, rows: 2 },
  poison: { col: 1, row: 1, cols: 3, rows: 2 },
  "fire-axe": { col: 2, row: 1, cols: 3, rows: 2 },
});

function safeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function scenarioCardStem({ locationId, suspectId, victimId, methodId }) {
  if (!locationId || !suspectId || !victimId || !methodId) throw new Error("Blackglass scenario is missing an id.");
  if (suspectId === victimId) throw new Error("Blackglass killer and victim must be different characters.");
  return [locationId, suspectId, victimId, methodId].map(safeId).join("__");
}

export function scenarioCardRelativePath(scenario, format = CARD_FORMAT) {
  return `${safeId(scenario.locationId)}/${scenarioCardStem(scenario)}.${safeId(format)}`;
}

export function buildScenePrompt({ killerName, victimName, roomName, weaponName, escalation = false }) {
  return [
    "Create only the cinematic reconstruction artwork for the family mystery game BLACKGLASS HOTEL. Do not add text, borders, labels, logos, card UI, watermarks, captions, or typography.",
    `Reference image 1 is the canonical adult character ${killerName}. Preserve that person's face, age, complexion, hair, body type, and established wardrobe.`,
    `Reference image 2 is the canonical adult character ${victimName}. Preserve that person's face, age, complexion, hair, body type, and established wardrobe.`,
    `Reference image 3 is the canonical ${roomName}. The scene must unmistakably take place in that room.`,
    `Reference image 4 is the canonical ${weaponName}. Show that prop clearly as evidence in the scene, but never touching or striking a person.`,
    `${killerName} is standing or kneeling in the room as the suspicious figure. ${victimName} is fully clothed, motionless and apparently unconscious, posed naturally and non-graphically.`,
    "This is an implied whodunit reconstruction, not an act of violence. Show no attack, no impact, no wound, no injury detail, no blood, no gore, no bodily damage, no distress, and no sexual content.",
    "Visual style: luxurious modern neo-noir hotel, cinematic realistic board-game key art, warm amber practical lighting, deep black shadows, subtle gold highlights, elegant adult mystery atmosphere, detailed environment, premium photography-like finish.",
    "Composition: landscape 3:2, both characters clearly readable, room identity visible, weapon readable as a separate evidence prop, uncluttered foreground, dramatic but family-game appropriate.",
    escalation ? "Identity accuracy is the highest priority. Match both canonical character references closely and avoid changing facial structure, hair, age, skin tone, or wardrobe." : "Keep the canonical identities recognizable and stable across the full card library.",
  ].join("\n");
}

export function qaThresholds() {
  return Object.freeze({
    killerIdentity: 0.82,
    victimIdentity: 0.82,
    roomMatch: 0.78,
    weaponMatch: 0.78,
    visualQuality: 0.80,
  });
}

export function evaluateQa(result) {
  const q = result || {};
  const t = qaThresholds();
  const numericPass = Number(q.killerIdentity || 0) >= t.killerIdentity
    && Number(q.victimIdentity || 0) >= t.victimIdentity
    && Number(q.roomMatch || 0) >= t.roomMatch
    && Number(q.weaponMatch || 0) >= t.weaponMatch
    && Number(q.visualQuality || 0) >= t.visualQuality;
  return Boolean(q.familySafe) && Boolean(q.noGraphicViolence) && Boolean(q.noText) && numericPass;
}

export function buildQaPrompt({ killerName, victimName, roomName, weaponName }) {
  return [
    "You are the automated art QA gate for a family-friendly mystery board game.",
    "Image 1 is the generated scene. Image 2 is the canonical killer reference. Image 3 is the canonical victim reference.",
    `Expected killer: ${killerName}. Expected victim: ${victimName}. Expected room: ${roomName}. Expected evidence prop: ${weaponName}.`,
    "Judge the generated scene strictly. Identity means the same adult person: facial structure, age, complexion, hair and recognizable wardrobe. The victim may be motionless/unconscious but must not show graphic injury.",
    "Return exactly one JSON object, no Markdown, with this schema:",
    '{"killerIdentity":0.0,"victimIdentity":0.0,"roomMatch":0.0,"weaponMatch":0.0,"visualQuality":0.0,"familySafe":true,"noGraphicViolence":true,"noText":true,"notes":"short reason"}',
    "Scores are 0 to 1. familySafe must be false for sexual content, exposed injury, disturbing body detail, or anything inappropriate for a mainstream family mystery game. noGraphicViolence is false for blood, wounds, impact, attack-in-progress, gore or visible bodily damage. noText is false if the generated scene contains accidental words, labels or watermarks.",
  ].join("\n");
}

export function parseCli(argv) {
  const options = {
    room: null,
    all: false,
    dryRun: false,
    force: false,
    limit: Infinity,
    concurrency: DEFAULT_CONCURRENCY,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--all") options.all = true;
    else if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--room") options.room = safeId(argv[++index]);
    else if (arg === "--limit") options.limit = Math.max(1, Number(argv[++index] || 1));
    else if (arg === "--concurrency") options.concurrency = Math.max(1, Math.min(6, Number(argv[++index] || DEFAULT_CONCURRENCY)));
    else if (arg === "--help" || arg === "-h") options.help = true;
    else throw new Error(`Unknown Blackglass card factory option: ${arg}`);
  }
  if (!options.all && !options.room && !options.help) throw new Error("Choose one room with --room <id> or explicitly choose the full library with --all.");
  if (options.all && options.room) throw new Error("Use either --room or --all, not both.");
  return options;
}

export function helpText() {
  return `Blackglass card factory\n\nUsage:\n  npm run blackglass:cards -- --room penthouse\n  npm run blackglass:cards -- --all\n  npm run blackglass:cards:dry -- --room penthouse\n\nOptions:\n  --room <id>       Generate one 180-card room batch\n  --all             Generate all 1,620 cards\n  --limit <n>       Stop after n selected scenarios\n  --concurrency <n> Concurrent image jobs (default ${DEFAULT_CONCURRENCY}, max 6)\n  --force           Regenerate cards already present\n  --dry-run         Enumerate work without calling OpenAI\n`;
}
