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
  { id: 0, type: "start", name: "Rent Day", subtitle: `Collect $${PASS_START_BONUS} · then the city remembers taxes` },
  property(1, "Pothole Place", "rust", 60, [4, 18, 52, 145, 320], 50),
  { id: 2, type: "inspection", name: "Code Inspection", subtitle: "Clipboard season" },
  property(3, "Leaky Roof Lane", "rust", 70, [6, 22, 65, 175, 360], 50),
  { id: 4, type: "fee", name: "City Fine", amount: 100, subtitle: "Pay the cash stash" },
  business(5, "24/7 Laundromat"),
  property(6, "Boarded Window Blvd", "brick", 100, [8, 30, 90, 250, 440], 50),
  utility(7, "Boiler & Power"),
  property(8, "Broken Stair Street", "brick", 110, [10, 34, 100, 270, 460], 50),
  { id: 9, type: "court", name: "Housing Court", subtitle: "Just visiting. Probably." },

  property(10, "Faded Awning Ave", "sunset", 130, [12, 42, 120, 330, 520], 100),
  { id: 11, type: "inspection", name: "Code Inspection", subtitle: "Somebody snitched" },
  property(12, "Vacancy Sign Way", "sunset", 140, [14, 48, 140, 360, 560], 100),
  business(13, "Repo & Tow Yard"),
  property(14, "Sunset Courts", "sunset", 150, [16, 54, 160, 390, 600], 100),
  property(15, "Neon Motel Row", "neon", 170, [18, 60, 180, 430, 650], 100),
  { id: 16, type: "fee", name: "Emergency Repair", amount: 75, subtitle: "The pipe achieved consciousness" },
  property(17, "Pawnshop Promenade", "neon", 180, [20, 66, 200, 460, 700], 100),
  { id: 18, type: "stash", name: "Cash Stash", subtitle: "Collect accumulated civic nonsense" },

  property(19, "Cinderblock Court", "concrete", 200, [22, 75, 220, 500, 750], 150),
  { id: 20, type: "inspection", name: "Code Inspection", subtitle: "Rat Police are here" },
  property(21, "Concrete Canyon", "concrete", 210, [24, 82, 240, 530, 790], 150),
  business(22, "Check Cashing Express"),
  property(23, "Overpass Terrace", "concrete", 220, [26, 90, 260, 560, 830], 150),
  property(24, "Vinyl Siding Vista", "vinyl", 240, [28, 98, 285, 600, 880], 150),
  utility(25, "Water & Questionable Plumbing"),
  property(26, "Satellite Dish Drive", "vinyl", 250, [30, 105, 305, 640, 920], 150),
  { id: 27, type: "go-to-court", name: "Code Enforcement Raid", subtitle: "Go directly to Housing Court" },

  property(28, "Gentrification Gap", "gold", 280, [34, 120, 340, 700, 1000], 200),
  { id: 29, type: "inspection", name: "Code Inspection", subtitle: "The assessor smelled fresh paint" },
  property(30, "Boutique Bodega Block", "gold", 300, [38, 135, 380, 760, 1080], 200),
  business(31, "Liquor, Lottery & Bail Bonds"),
  property(32, "Luxury Loft Lie", "gold", 320, [42, 150, 420, 820, 1160], 200),
  property(33, "Midnight Tower A", "midnight", 350, [50, 175, 480, 900, 1250], 200),
  { id: 34, type: "street", name: "Street Luck", subtitle: "Nothing good happens after 2 a.m." },
  property(35, "Midnight Tower B", "midnight", 400, [65, 210, 560, 1000, 1400], 200),
];

export const INSPECTION_CARDS = [
  { id: "rat-police", title: "Rat Police Task Force", text: "They found eleven rats, three aliases, and one tiny parole violation. Pay $35 per property.", perProperty: -35, toPot: true },
  { id: "vice-wrong-door", title: "Vice Squad, Wrong Door", text: "The cops kick in the wrong door, apologize to nobody, and leave you the repair bill. Pay $110.", cash: -110, toPot: true },
  { id: "prostitution-sting", title: "Prostitution Sting in 2B", text: "Your 'hourly corporate housing' explanation does not impress the judge. Pay $160.", cash: -160, toPot: true },
  { id: "meth-vent", title: "Meth Lab Ventilation Review", text: "Apparently a dryer hose is not hazmat ventilation. Pay $180 plus $20 per upgrade.", cash: -180, perUpgrade: -20, toPot: true },
  { id: "gang-paperwork", title: "Gang Unit Loves Paperwork", text: "Nothing was found, but six forms were generated. Pay $95.", cash: -95, toPot: true },
  { id: "drunk-sprinkler", title: "Drunk Tenant vs. Sprinkler System", text: "The sprinkler won. The ceiling did not. Pay $120.", cash: -120, toPot: true },
  { id: "outreach-invoice", title: "Homeless Outreach Cleanup Invoice", text: "The city clears the sidewalk and somehow mails you the bill. Pay $60.", cash: -60, toPot: true },
  { id: "paint-tax", title: "Tax Assessor Smells Fresh Paint", text: "One new window has been classified as luxury redevelopment. Pay $45 per upgrade.", perUpgrade: -45, toPot: true },
  { id: "cops-door", title: "Police Needed Another Door", text: "Your deadbolt met a battering ram during a wellness check. Pay $80.", cash: -80, toPot: true },
  { id: "extension-grid", title: "Extension-Cord Power Grid", text: "The fire marshal is impressed, which is somehow worse. Pay $130.", cash: -130, toPot: true },
  { id: "tenant-lawyer", title: "Tenant Gets a Lawyer", text: "Your lease was apparently not written in a legally binding font. Pay $140.", cash: -140, toPot: true },
  { id: "court", title: "Emergency Hearing", text: "The inspector used the phrase 'immediate threat.' Report directly to Housing Court.", goToCourt: true },
  { id: "permit", title: "Permit? What Permit?", text: "Your contractor said permits were a mindset. Pay $40 per upgrade.", perUpgrade: -40, toPot: true },
  { id: "escrow", title: "Rent Escrow Order", text: "The court temporarily discovers tenant rights. Pay $125 into the stash.", cash: -125, toPot: true },
  { id: "clean", title: "Miraculous Clean Inspection", text: "The inspector arrives during the twelve-minute window when everything works. Collect $90.", cash: 90 },
  { id: "rat-amnesty", title: "Rat Amnesty Weekend", text: "The Rat Police budget got cut. Keep $75 you definitely would have spent on compliance.", cash: 75 },
  { id: "cousin-plumber", title: "Inspector's Cousin Is Your Plumber", text: "Conflict of interest has never been this affordable. Collect $100.", cash: 100 },
  { id: "grant", title: "Blight Reduction Grant", text: "You accidentally complete a government form correctly. Collect $150.", cash: 150 },
  { id: "refund", title: "Overpaid Permit Fee", text: "City accounting found your receipt under a vending machine. Collect $65.", cash: 65 },
  { id: "advance", title: "Inspector Leaves Early", text: "The lunch truck arrived. Advance to Rent Day and collect $200.", moveTo: 0, collectStart: true },
];

export const STREET_CARDS = [
  { id: "drug-lord", title: "Drug Lord Wants a Quiet Lease", text: "Six months cash up front, zero maintenance requests, deeply suspicious references. Collect $180.", cash: 180 },
  { id: "vice-tenant", title: "Vice Tenant Pays Cash", text: "You decide not to ask why every guest stays exactly 47 minutes. Collect $150.", cash: 150 },
  { id: "meth-next-door", title: "Meth House Next Door Explodes", text: "Your building survives. Your windows retire immediately. Pay $145.", cash: -145, toPot: true },
  { id: "gang-security", title: "Neighborhood Crew Offers Security", text: "Your boiler has never felt safer. Collect $85 in mysteriously refunded losses.", cash: 85 },
  { id: "drunk-master-key", title: "Drunk Guy Finds the Master Key", text: "By sunrise he has inspected every unit and one vending machine. Pay $90.", cash: -90, toPot: true },
  { id: "veteran-envelope", title: "Lost Rent Envelope Returned", text: "A homeless veteran finds the envelope your tenant dropped and brings it back untouched. Collect $100 and feel briefly ashamed of your assumptions.", cash: 100 },
  { id: "cop-lawn", title: "Cops Park on the Lawn", text: "Six cruisers, four hours, one destroyed sprinkler head. Pay $50.", cash: -50, toPot: true },
  { id: "illegal-poker", title: "Illegal Poker Night Tips the Super", text: "Nobody knows who won, but the laundry room has never been cleaner. Collect $95.", cash: 95 },
  { id: "influencer", title: "Influencer Calls It 'Authentic'", text: "Your peeling brick is now 'industrial texture.' Collect $160.", cash: 160 },
  { id: "up-and-coming", title: "Local News Says 'Up-and-Coming'", text: "Three coffee shops spawn overnight. Collect $200.", cash: 200 },
  { id: "bodega", title: "Gentrifier Discovers the Bodega", text: "They post a twelve-minute review of buying chips. Collect $120.", cash: 120 },
  { id: "tenant-card", title: "Tenant Lawyer Sends a Holiday Card", text: "It contains an itemized list of your violations. Pay $105.", cash: -105, toPot: true },
  { id: "roof", title: "Roof Gives Up", text: "The tarp has formally resigned. Pay $120.", cash: -120, toPot: true },
  { id: "rent-bump", title: "Questionable Rent Bump", text: "Short-term gain, long-term group-chat screenshots. Collect $140.", cash: 140 },
  { id: "block-party", title: "Block Party Occupies the Driveway", text: "You lose parking revenue but gain one suspicious casserole. Pay $40.", cash: -40, toPot: true },
  { id: "dryer", title: "Coin Dryer Jackpot", text: "Somebody left a month of quarters and one wedding ring behind. Collect $90.", cash: 90 },
  { id: "plumber", title: "Your Cousin Knows a Plumber", text: "The repair violates three laws but only one is currently enforced. Collect $55.", cash: 55 },
  { id: "side-job", title: "Cash Side Job", text: "No invoice, no questions, no memory of Tuesday. Collect $110.", cash: 110 },
  { id: "court-pass", title: "Continuance Granted", text: "Keep this. Even Housing Court gets tired eventually.", courtPass: true },
  { id: "start", title: "Rent Checks Clear", text: "Advance to Rent Day and collect $200 before the city notices.", moveTo: 0, collectStart: true },
];

export const TOKENS = ["🛠️", "🪠", "🧱", "🪣", "🔑", "🚐", "🧰", "🪚"];

export const UPGRADE_NAMES = [
  "Barely Habitable",
  "Fresh Paint Over It",
  "Landlord Special",
  "Luxury-ish Units",
  "Cash Cow Deluxe",
];

export function getSpace(spaceId) {
  return BOARD[spaceId] || null;
}

export function groupSpaces(groupId) {
  return BOARD.filter((space) => space.type === "property" && space.group === groupId);
}

export function ownableSpaces() {
  return BOARD.filter((space) => ["property", "business", "utility"].includes(space.type));
}
