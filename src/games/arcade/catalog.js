const MAME_ROM_BASE = "https://www.mamedev.org/roms";

function mameGame(id, title, year, maker, genre, preferredCore = "arcade") {
  return {
    id,
    title,
    year,
    maker,
    genre,
    preferredCore,
    sourceUrl: `${MAME_ROM_BASE}/${id}/`,
    downloadUrl: `${MAME_ROM_BASE}/${id}/${id}.zip`,
  };
}

function localGame(id, title, year, maker, genre, preferredCore = "arcade", compatibilityNote = "") {
  return {
    id,
    title,
    year,
    maker,
    genre,
    preferredCore,
    localOnly: true,
    compatibilityNote,
  };
}

export const CURATED_ARCADE_GAMES = [
  mameGame("targ", "Targ", 1980, "Exidy", "Maze shooter"),
  mameGame("spectar", "Spectar", 1980, "Exidy", "Maze shooter"),
  mameGame("robby", "Robby Roto", 1981, "Bally/Midway", "Maze action"),
  mameGame("supertnk", "Super Tank", 1981, "Video Games GmbH", "Tank action"),
  mameGame("hardhat", "Hard Hat", 1982, "Exidy", "Arcade action"),
  mameGame("victory", "Victory", 1982, "Exidy", "Shooter"),
  mameGame("teetert", "Teeter Torture", 1982, "Exidy", "Arcade action"),
  mameGame("looping", "Looping", 1982, "Video Games GmbH", "Flying shooter"),
  mameGame("gridlee", "Gridlee", 1982, "Videa", "Prototype action"),
  mameGame("fax", "FAX", 1983, "Exidy", "Trivia"),
  mameGame("alienar", "Alien Arena", 1985, "Duncan Brown", "Capture-the-flag action"),
  mameGame("topgunnr", "Top Gunner / Vertigo", 1986, "Exidy", "Vector flight combat"),
  {
    id: "wrally",
    title: "World Rally",
    year: 1993,
    maker: "Gaelco",
    genre: "Rally racing",
    preferredCore: "arcade",
    sourceUrl: "https://www.mamedev.org/links.php",
    downloadUrl: null,
    sourceNote: "MAME's Resources page links to Gaelco's World Rally release.",
  },
];

export const PERSONAL_ARCADE_GAMES = [
  localGame("005", "005", 1981, "Sega", "Stealth action", "mame2003_plus"),
  localGame("1941", "1941: Counter Attack", 1990, "Capcom", "Vertical shooter"),
  localGame("1942", "1942", 1984, "Capcom", "Vertical shooter"),
  localGame("1943", "1943: The Battle of Midway", 1987, "Capcom", "Vertical shooter"),
  localGame("1943kai", "1943 Kai: Midway Kaisen", 1987, "Capcom", "Vertical shooter"),
  localGame("1943mii", "1943: The Battle of Midway Mark II", 1987, "Capcom", "Vertical shooter", "mame2003_plus"),
  localGame("1944", "1944: The Loop Master", 2000, "Eighting / Raizing", "Vertical shooter"),
  localGame("1945kiii", "1945k III", 2000, "Oriental", "Vertical shooter"),
  localGame("19xx", "19XX: The War Against Destiny", 1996, "Capcom", "Vertical shooter"),
  localGame("2020bb", "2020 Super Baseball", 1991, "SNK", "Baseball"),
  localGame("20pacgal", "Ms. Pac-Man/Galaga: 20th Anniversary", 2000, "Namco / Cosmodog", "Maze / shooter"),
  localGame("280zzzap", "Datsun 280 ZZZAP", 1976, "Midway", "Driving", "mame2003_plus"),
  localGame("3countb", "3 Count Bout", 1993, "SNK", "Wrestling"),
  localGame("3in1semi", "New HyperMan 3-in-1", 1998, "SemiCom / XESS", "Minigame collection"),
  localGame("3kokushi", "Sankokushi", 1996, "Mitchell", "Puzzle / strategy", "mame2003_plus", "Playable with imperfect graphics in MAME 2003-Plus."),
  localGame("3on3dunk", "3 On 3 Dunk Madness", 1996, "Video System Co.", "Basketball"),
  localGame("3stooges", "The Three Stooges", 1984, "Mylstar", "Arcade action", "mame2003_plus"),
  localGame("3wonders", "Three Wonders", 1991, "Capcom", "Action collection"),
  localGame("3x3puzzl", "3X3 Puzzle", 1998, "Ace Enterprise", "Puzzle"),
  localGame("4dwarrio", "4-D Warriors", 1985, "Coreland / Sega", "Shooter", "mame2003_plus"),
  localGame("4in1", "4 Fun in 1", 1981, "Armenia / Food and Fun", "Multigame", "mame2003_plus", "Playable with imperfect sound."),
  localGame("4in1boot", "Puzzle King", 1999, "K1 Soft", "Puzzle / action collection", "mame2003_plus"),
  localGame("40love", "Forty-Love", 1984, "Taito", "Tennis", "mame2003_plus"),
  localGame("64street", "64th. Street: A Detective Story", 1991, "Jaleco", "Beat 'em up", "mame2003_plus"),
  localGame("720", "720°", 1986, "Atari Games", "Skateboarding", "mame2003_plus"),
  localGame("7jigen", "7jigen no Youseitachi - Mahjong 7 Dimensions", 1990, "Dynax", "Mahjong", "mame2003_plus", "Playable with imperfect graphics."),
  localGame("88games", "'88 Games", 1988, "Konami", "Sports", "mame2003_plus"),
  localGame("8ball", "Video Eight Ball", 1982, "Century Electronics", "Pool", "mame2003_plus", "Playable with imperfect sound."),
  localGame("8ballact", "Eight Ball Action", 1984, "Seatongrove", "Arcade action", "mame2003_plus"),
  localGame("10yard", "10-Yard Fight", 1983, "Irem", "American football"),
];

export const ARCADE_GAMES = [...CURATED_ARCADE_GAMES, ...PERSONAL_ARCADE_GAMES];

// Backward-compatible export for older imports while the Arcade module transitions
// from the original curated-only catalog to the full personal library.
export const LEGAL_ARCADE_GAMES = ARCADE_GAMES;

export function normalizeArcadeSetName(fileName = "") {
  return String(fileName).trim().toLowerCase().replace(/\.(zip|7z)$/i, "");
}

export function findArcadeGameForFile(fileName = "") {
  const setName = normalizeArcadeSetName(fileName);
  return ARCADE_GAMES.find((game) => game.id === setName) || null;
}

export function arcadeDecades() {
  return [...new Set(ARCADE_GAMES.map((game) => Math.floor(game.year / 10) * 10))].sort();
}
