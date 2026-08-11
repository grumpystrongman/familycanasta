export const START_CASH = 1500;
export const PASS_START_BONUS = 200;
export const COURT_FINE = 50;
export const COURT_POSITION = 9;
export const CASH_STASH_POSITION = 18;
export const GO_TO_COURT_POSITION = 27;
export const MAX_UPGRADES = 4;

export const GROUPS = {
  rust: { name: "Rust Belt", color: "#8f563b" },
  brick: { name: "Brick Row", color: "#c75b39" },
  sunset: { name: "Sunset Courts", color: "#d89b31" },
  neon: { name: "Neon Strip", color: "#d84b86" },
  concrete: { name: "Concrete Jungle", color: "#5b8fa8" },
  vinyl: { name: "Vinyl Heights", color: "#6f9b51" },
  gold: { name: "Gilded Blocks", color: "#c2a130" },
  midnight: { name: "Midnight Towers", color: "#554b7d" },
};

function property(id, name, group, price, rent, upgradeCost) {
  return {
    id,
    type: "property",
    name,
    group,
    price,
    rent,
    upgradeCost,
    mortgage: Math.floor(price / 2),
  };
}

function business(id, name, price = 200) {
  return { id, type: "business", name, price, mortgage: Math.floor(price / 2) };
}

function utility(id, name, price = 150) {
  return { id, type: "utility", name, price, mortgage: Math.floor(price / 2) };
}

export const BOARD = [
  { id: 0, type: "start", name: "Rent Day", subtitle: `Collect $${PASS_START_BONUS}` },
  property(1, "Pothole Place", "rust", 60, [4, 18, 52, 145, 320], 50),
  { id: 2, type: "inspection", name: "Code Inspection" },
  property(3, "Leaky Roof Lane", "rust", 70, [6, 22, 65, 175, 360], 50),
  { id: 4, type: "fee", name: "City Fine", amount: 100, subtitle: "Pay the cash stash" },
  business(5, "24/7 Laundromat"),
  property(6, "Boarded Window Blvd", "brick", 100, [8, 30, 90, 250, 440], 50),
  utility(7, "Boiler & Power"),
  property(8, "Broken Stair Street", "brick", 110, [10, 34, 100, 270, 460], 50),
  { id: 9, type: "court", name: "Housing Court", subtitle: "Just visiting" },

  property(10, "Faded Awning Ave", "sunset", 130, [12, 42, 120, 330, 520], 100),
  { id: 11, type: "inspection", name: "Code Inspection" },
  property(12, "Vacancy Sign Way", "sunset", 140, [14, 48, 140, 360, 560], 100),
  business(13, "Repo & Tow Yard"),
  property(14, "Sunset Courts", "sunset", 150, [16, 54, 160, 390, 600], 100),
  property(15, "Neon Motel Row", "neon", 170, [18, 60, 180, 430, 650], 100),
  { id: 16, type: "fee", name: "Emergency Repair", amount: 75, subtitle: "The pipe finally burst" },
  property(17, "Pawnshop Promenade", "neon", 180, [20, 66, 200, 460, 700], 100),
  { id: 18, type: "stash", name: "Cash Stash", subtitle: "Collect accumulated fines" },

  property(19, "Cinderblock Court", "concrete", 200, [22, 75, 220, 500, 750], 150),
  { id: 20, type: "inspection", name: "Code Inspection" },
  property(21, "Concrete Canyon", "concrete", 210, [24, 82, 240, 530, 790], 150),
  business(22, "Check Cashing Express"),
  property(23, "Overpass Terrace", "concrete", 220, [26, 90, 260, 560, 830], 150),
  property(24, "Vinyl Siding Vista", "vinyl", 240, [28, 98, 285, 600, 880], 150),
  utility(25, "Water Works"),
  property(26, "Satellite Dish Drive", "vinyl", 250, [30, 105, 305, 640, 920], 150),
  { id: 27, type: "go-to-court", name: "Code Enforcement Raid", subtitle: "Go to Housing Court" },

  property(28, "Gentrification Gap", "gold", 280, [34, 120, 340, 700, 1000], 200),
  { id: 29, type: "inspection", name: "Code Inspection" },
  property(30, "Boutique Bodega Block", "gold", 300, [38, 135, 380, 760, 1080], 200),
  business(31, "All-Night Corner Mart"),
  property(32, "Luxury Loft Lie", "gold", 320, [42, 150, 420, 820, 1160], 200),
  property(33, "Midnight Tower A", "midnight", 350, [50, 175, 480, 900, 1250], 200),
  { id: 34, type: "street", name: "Street Luck" },
  property(35, "Midnight Tower B", "midnight", 400, [65, 210, 560, 1000, 1400], 200),
];

export const INSPECTION_CARDS = [
  { id: "mold", title: "Mold Complaint Sticks", text: "The inspector brought a flashlight this time. Pay $80.", cash: -80, toPot: true },
  { id: "detectors", title: "Smoke Detector Sweep", text: "Replace what should have been replaced years ago. Pay $25 per property you own.", perProperty: -25, toPot: true },
  { id: "permit", title: "Permit Problem", text: "That 'quick renovation' needed paperwork. Pay $40 per upgrade.", perUpgrade: -40, toPot: true },
  { id: "grant", title: "Rehab Grant", text: "Somehow the paperwork cleared. Collect $125.", cash: 125 },
  { id: "tenant-lawyer", title: "Tenant Gets a Lawyer", text: "Your bluff gets expensive. Pay $120.", cash: -120, toPot: true },
  { id: "court", title: "Emergency Hearing", text: "Report directly to Housing Court.", goToCourt: true },
  { id: "refund", title: "Overpaid Permit Fee", text: "City accounting found your receipt. Collect $60.", cash: 60 },
  { id: "escrow", title: "Rent Escrow Order", text: "Miss a payment cycle. Pay $100 into the cash stash.", cash: -100, toPot: true },
  { id: "clean", title: "Surprise Clean Inspection", text: "Against all odds: no violations. Collect $75.", cash: 75 },
  { id: "advance", title: "Inspector Leaves Early", text: "Advance to Rent Day and collect $200.", moveTo: 0, collectStart: true },
];

export const STREET_CARDS = [
  { id: "dryer", title: "Coin Dryer Jackpot", text: "Somebody left a month of quarters behind. Collect $90.", cash: 90 },
  { id: "plumber", title: "Your Cousin Knows a Plumber", text: "The repair is suspiciously cheap. Collect $50.", cash: 50 },
  { id: "roof", title: "Roof Gives Up", text: "Tarps are not a permanent roofing system. Pay $110.", cash: -110, toPot: true },
  { id: "rent-bump", title: "Questionable Rent Bump", text: "Short-term gain, long-term side-eye. Collect $140.", cash: 140 },
  { id: "block-party", title: "Block Party Blocks the Driveway", text: "Lose a little time and a little money. Pay $35.", cash: -35, toPot: true },
  { id: "start", title: "Rent Checks Clear", text: "Advance to Rent Day and collect $200.", moveTo: 0, collectStart: true },
  { id: "court-pass", title: "Continuance Granted", text: "Keep this card. Use it to leave Housing Court for free.", courtPass: true },
  { id: "side-job", title: "Side Job Pays Cash", text: "Collect $100.", cash: 100 },
];

export const TOKENS = ["🛠️", "🪠", "🧱", "🪣", "🔑", "🚐", "🧰", "🪚"];

export const UPGRADE_NAMES = ["Bare Bones", "Patch Job", "Fresh Paint", "Split Unit", "Cash Cow"];

export function getSpace(spaceId) {
  return BOARD[spaceId] || null;
}

export function groupSpaces(groupId) {
  return BOARD.filter((space) => space.type === "property" && space.group === groupId);
}

export function ownableSpaces() {
  return BOARD.filter((space) => ["property", "business", "utility"].includes(space.type));
}
