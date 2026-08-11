import { BOARD } from "./data.js";

export const DISTRICTS = {
  rust: {
    id: "rust",
    name: "Rust Belt",
    badge: "🔧",
    archetype: "Repair Trap",
    tagline: "Cheap deeds, expensive surprises, and boilers with emotional needs.",
    residents: "Shift workers · multigenerational families · one guy rebuilding a Camaro",
    rentMultiplier: 1.0,
    assessmentMultiplier: 0.75,
    inspectionMultiplier: 1.25,
    upgradeCostMultiplier: 0.8,
    volatility: 0.34,
    schemeBonuses: { "rat-patrol": 1.1, "landlord-special": 1.08 },
    shieldBonuses: { "rat-patrol": 20 },
  },
  brick: {
    id: "brick",
    name: "Brick Row",
    badge: "📣",
    archetype: "Complaint Corridor",
    tagline: "Everybody knows everybody, including the number for Code Enforcement.",
    residents: "Long-time renters · corner-store regulars · three competing neighborhood group chats",
    rentMultiplier: 1.03,
    assessmentMultiplier: 0.9,
    inspectionMultiplier: 1.15,
    upgradeCostMultiplier: 0.9,
    volatility: 0.3,
    schemeBonuses: { "landlord-special": 1.08 },
    shieldBonuses: {},
  },
  sunset: {
    id: "sunset",
    name: "Sunset Courts",
    badge: "🏘️",
    archetype: "Family Block",
    tagline: "Stable rent until somebody blocks the fire lane with a bounce house.",
    residents: "Families · nurses · school staff · cousins who are somehow always visiting",
    rentMultiplier: 1.08,
    assessmentMultiplier: 0.95,
    inspectionMultiplier: 0.9,
    upgradeCostMultiplier: 0.95,
    volatility: 0.22,
    schemeBonuses: { "rat-patrol": 1.08, "luxury-rebrand": 1.05 },
    shieldBonuses: { "rat-patrol": 10 },
  },
  neon: {
    id: "neon",
    name: "Neon Strip",
    badge: "💋",
    archetype: "Vice Economy",
    tagline: "The vacancy sign is on, the police scanner is louder, and cash has excellent occupancy.",
    residents: "Night-shift workers · motel lifers · bartenders · people using first names only",
    rentMultiplier: 1.15,
    assessmentMultiplier: 1.0,
    inspectionMultiplier: 1.35,
    upgradeCostMultiplier: 1.0,
    volatility: 0.38,
    schemeBonuses: { "vice-motel": 1.22, "drug-lord-lease": 1.12 },
    shieldBonuses: {},
  },
  concrete: {
    id: "concrete",
    name: "Concrete Jungle",
    badge: "🚧",
    archetype: "Crew Territory",
    tagline: "Dense, loud, profitable, and patrolled by at least three organizations with radios.",
    residents: "Tradespeople · extended families · street crews · cops circling for unrelated reasons",
    rentMultiplier: 1.12,
    assessmentMultiplier: 0.95,
    inspectionMultiplier: 1.15,
    upgradeCostMultiplier: 1.0,
    volatility: 0.32,
    schemeBonuses: { "gang-protection": 1.2, "drug-lord-lease": 1.06 },
    shieldBonuses: { "gang-protection": 35 },
  },
  vinyl: {
    id: "vinyl",
    name: "Vinyl Heights",
    badge: "👀",
    archetype: "Quiet Money",
    tagline: "Low drama, strong rent, and a neighborhood watch with binoculars and free time.",
    residents: "Working homeowners · retirees · commuters · one HOA refugee who documents everything",
    rentMultiplier: 1.16,
    assessmentMultiplier: 1.05,
    inspectionMultiplier: 0.78,
    upgradeCostMultiplier: 0.92,
    volatility: 0.18,
    schemeBonuses: { "rat-patrol": 1.08, "luxury-rebrand": 1.08 },
    shieldBonuses: { "rat-patrol": 15 },
  },
  gold: {
    id: "gold",
    name: "Gilded Blocks",
    badge: "☕",
    archetype: "Gentrification Machine",
    tagline: "Every exposed pipe is now a feature and every tax bill has discovered ambition.",
    residents: "Remote workers · boutique dogs · legacy tenants · people asking where the natural-wine bar is",
    rentMultiplier: 1.28,
    assessmentMultiplier: 1.4,
    inspectionMultiplier: 0.92,
    upgradeCostMultiplier: 1.12,
    volatility: 0.24,
    schemeBonuses: { "luxury-rebrand": 1.28, "landlord-special": 1.08 },
    shieldBonuses: {},
  },
  midnight: {
    id: "midnight",
    name: "Midnight Towers",
    badge: "🏢",
    archetype: "Vertical Chaos",
    tagline: "Maximum density means maximum rent, maximum complaints, and one elevator for everybody.",
    residents: "Hundreds of renters · delivery drivers · night owls · one superintendent approaching spiritual collapse",
    rentMultiplier: 1.38,
    assessmentMultiplier: 1.25,
    inspectionMultiplier: 1.45,
    upgradeCostMultiplier: 1.18,
    volatility: 0.36,
    schemeBonuses: { "vice-motel": 1.1, "drug-lord-lease": 1.12, "luxury-rebrand": 1.15 },
    shieldBonuses: { "gang-protection": 10 },
  },
};

export const DISTRICT_INCIDENTS = {
  rust: [
    { id: "boiler-threat", title: "Boiler Makes a Threat", text: "The boiler starts knocking in a rhythm the plumber describes as 'financial.'", ownerCash: -85, pressure: 1 },
    { id: "copper-walks", title: "Copper Walks Away", text: "Half the basement plumbing leaves overnight to pursue a new career at the scrapyard.", ownerCash: -105, pressure: 1 },
    { id: "tenant-repair-crew", title: "Tenants Fix It Themselves", text: "The residents stop waiting on you, repair the stair rail, and send a photo with the receipt.", ownerCash: -45, pressure: -1 },
  ],
  brick: [
    { id: "group-chat-portal", title: "The Group Chat Finds the City Portal", text: "Twenty-seven complaints arrive with timestamps, photos, and disturbingly good grammar.", ownerCash: -70, pressure: 2 },
    { id: "stoop-lawyer", title: "Somebody's Cousin Passed the Bar", text: "A casual stoop conversation becomes a demand letter before dinner.", ownerCash: -95, pressure: 1 },
    { id: "rent-party", title: "Rent Party Actually Works", text: "The block throws a fundraiser and every late balance gets covered. You are confused by community competence.", ownerCash: 80, pressure: -1 },
  ],
  sunset: [
    { id: "bounce-house", title: "Bounce House Blocks the Fire Lane", text: "The birthday party is legendary. The fire marshal is less festive.", ownerCash: -55, pressure: 1 },
    { id: "school-fundraiser", title: "School Fundraiser Takes Over the Lot", text: "You lose parking revenue but gain three sheet cakes and a suspicious amount of goodwill.", ownerCash: -30, pressure: -1 },
    { id: "grandma-committee", title: "Grandmas Form a Maintenance Committee", text: "They have clipboards, phone trees, and absolutely no fear of your voicemail system.", ownerCash: -60, pressure: 1 },
  ],
  neon: [
    { id: "vice-parade", title: "Vice Squad Parks Very Visibly", text: "Nothing technically happens, but every hourly guest suddenly remembers another appointment.", ownerCash: -110, pressure: 1 },
    { id: "bachelor-party", title: "Bachelor Party vs. Drywall", text: "Drywall loses by unanimous decision.", ownerCash: -90, pressure: 1 },
    { id: "music-video", title: "Music Video Location Fee", text: "A rapper rents the parking lot for six hours. Nobody asks what the smoke machine is actually doing.", ownerCash: 135, pressure: 1 },
  ],
  concrete: [
    { id: "crew-boiler", title: "Neighborhood Crew Fixes the Boiler", text: "Nobody admits who repaired it. Somebody does leave an invoice that just says 'respect.'", ownerCash: -45, pressure: -1 },
    { id: "gang-unit-lights", title: "Gang Unit Brings Stadium Lighting", text: "The block receives twelve hours of free illumination and zero useful explanations.", ownerCash: -75, pressure: 1 },
    { id: "block-cookout", title: "Block Cookout Occupies Everything", text: "Parking disappears, but the building suddenly has fewer complaints and much better ribs.", ownerCash: -35, pressure: -1 },
  ],
  vinyl: [
    { id: "watch-email", title: "Neighborhood Watch Sends a 14-Page Email", text: "Only page nine concerns your property. Unfortunately page nine has pictures.", ownerCash: -45, pressure: 1 },
    { id: "quiet-month", title: "Everybody Pays and Nobody Calls", text: "A statistically suspicious month of normal property management occurs.", ownerCash: 95, pressure: -1 },
    { id: "leaf-war", title: "Leaf-Blower Border War", text: "Two neighbors escalate landscaping into a municipal matter. Somehow your fence gets cited.", ownerCash: -50, pressure: 1 },
  ],
  gold: [
    { id: "brunch-crawl", title: "Brunch Crawl Discovers the Block", text: "People wait forty minutes for eggs and call the neighborhood 'electric.' Your rents become emotionally validated.", ownerCash: 125, pressure: 1 },
    { id: "assessment-selfie", title: "Tax Assessor Takes a Selfie", text: "Your new facade appears in the background. The assessed value updates before the photo finishes uploading.", ownerCash: -145, pressure: 1 },
    { id: "legacy-tenant-meeting", title: "Legacy Tenants Call a Meeting", text: "Your luxury-rebrand flyer becomes Exhibit A in a very organized discussion.", ownerCash: -80, pressure: 2 },
  ],
  midnight: [
    { id: "elevator-funeral", title: "Elevator Holds a Funeral for Itself", text: "The service is on the 19th floor. Everyone walks.", ownerCash: -150, pressure: 2 },
    { id: "roof-party", title: "Roof Party Sells Out", text: "Nobody knows who promoted it, but somebody pays you cash for 'venue access.'", ownerCash: 145, pressure: 1 },
    { id: "alarm-symphony", title: "3 A.M. Fire Alarm Symphony", text: "False alarm. Real rage. The tenant chat achieves a level of unity normally reserved for revolutions.", ownerCash: -90, pressure: 2 },
  ],
};

export function getDistrict(groupId) {
  return DISTRICTS[groupId] || null;
}

export function districtForSpace(spaceOrId) {
  const space = typeof spaceOrId === "number" ? BOARD[spaceOrId] : spaceOrId;
  return space?.group ? getDistrict(space.group) : null;
}

export function districtSchemeMultiplier(groupId, schemeId) {
  return getDistrict(groupId)?.schemeBonuses?.[schemeId] || 1;
}

export function districtShieldBonus(groupId, schemeId) {
  return getDistrict(groupId)?.shieldBonuses?.[schemeId] || 0;
}

export function pickDistrictIncident(groupId, rng = Math.random) {
  const district = getDistrict(groupId);
  const incidents = DISTRICT_INCIDENTS[groupId] || [];
  if (!district || !incidents.length || rng() >= district.volatility) return null;
  return incidents[Math.min(incidents.length - 1, Math.floor(rng() * incidents.length))];
}
