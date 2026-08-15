function personalGame(id, title, year, maker, genre, preferredCore = "arcade", compatibilityNote = "") {
  return {
    id,
    title,
    year,
    maker,
    genre,
    preferredCore,
    compatibilityNote,
  };
}

// Metadata only for ROM set names that were present in the uploaded ROMS collection.
// The Arcade UI does not render this list directly; it only renders ROMs that are
// actually installed in the browser's ROM Vault.
export const PERSONAL_ARCADE_GAMES = [
  personalGame("005", "005", 1981, "Sega", "Stealth action", "mame2003_plus"),
  personalGame("1941", "1941: Counter Attack", 1990, "Capcom", "Vertical shooter"),
  personalGame("1942", "1942", 1984, "Capcom", "Vertical shooter"),
  personalGame("1943", "1943: The Battle of Midway", 1987, "Capcom", "Vertical shooter"),
  personalGame("1943kai", "1943 Kai: Midway Kaisen", 1987, "Capcom", "Vertical shooter"),
  personalGame("1943mii", "1943: The Battle of Midway Mark II", 1987, "Capcom", "Vertical shooter", "mame2003_plus"),
  personalGame("1944", "1944: The Loop Master", 2000, "Eighting / Raizing", "Vertical shooter"),
  personalGame("1945kiii", "1945k III", 2000, "Oriental", "Vertical shooter"),
  personalGame("19xx", "19XX: The War Against Destiny", 1996, "Capcom", "Vertical shooter"),
  personalGame("2020bb", "2020 Super Baseball", 1991, "SNK", "Baseball"),
  personalGame("20pacgal", "Ms. Pac-Man/Galaga: 20th Anniversary", 2000, "Namco / Cosmodog", "Maze / shooter"),
  personalGame("280zzzap", "Datsun 280 ZZZAP", 1976, "Midway", "Driving", "mame2003_plus"),
  personalGame("3countb", "3 Count Bout", 1993, "SNK", "Wrestling"),
  personalGame("3in1semi", "New HyperMan 3-in-1", 1998, "SemiCom / XESS", "Minigame collection"),
  personalGame("3kokushi", "Sankokushi", 1996, "Mitchell", "Puzzle / strategy", "mame2003_plus", "MAME 2003-Plus reports imperfect graphics."),
  personalGame("3on3dunk", "3 On 3 Dunk Madness", 1996, "Video System Co.", "Basketball"),
  personalGame("3stooges", "The Three Stooges", 1984, "Mylstar", "Arcade action", "mame2003_plus"),
  personalGame("3wonders", "Three Wonders", 1991, "Capcom", "Action collection"),
  personalGame("3x3puzzl", "3X3 Puzzle", 1998, "Ace Enterprise", "Puzzle"),
  personalGame("4dwarrio", "4-D Warriors", 1985, "Coreland / Sega", "Shooter", "mame2003_plus"),
  personalGame("4in1", "4 Fun in 1", 1981, "Armenia / Food and Fun", "Multigame", "mame2003_plus", "MAME 2003-Plus reports imperfect sound."),
  personalGame("4in1boot", "Puzzle King", 1999, "K1 Soft", "Puzzle / action collection", "mame2003_plus"),
  personalGame("40love", "Forty-Love", 1984, "Taito", "Tennis", "mame2003_plus"),
  personalGame("64street", "64th. Street: A Detective Story", 1991, "Jaleco", "Beat 'em up", "mame2003_plus"),
  personalGame("720", "720°", 1986, "Atari Games", "Skateboarding", "mame2003_plus"),
  personalGame("7jigen", "7jigen no Youseitachi - Mahjong 7 Dimensions", 1990, "Dynax", "Mahjong", "mame2003_plus", "MAME 2003-Plus reports imperfect graphics."),
  personalGame("88games", "'88 Games", 1988, "Konami", "Sports", "mame2003_plus"),
  personalGame("8ball", "Video Eight Ball", 1982, "Century Electronics", "Pool", "mame2003_plus", "MAME 2003-Plus reports imperfect sound."),
  personalGame("8ballact", "Eight Ball Action", 1984, "Seatongrove", "Arcade action", "mame2003_plus"),
  personalGame("10yard", "10-Yard Fight", 1983, "Irem", "American football"),
];

// Keep the old exports so any existing imports do not break. There are no
// starter/default titles anymore.
export const CURATED_ARCADE_GAMES = [];
export const ARCADE_GAMES = PERSONAL_ARCADE_GAMES;
export const LEGAL_ARCADE_GAMES = ARCADE_GAMES;

export function normalizeArcadeSetName(fileName = "") {
  return String(fileName).trim().toLowerCase().replace(/\.(zip|7z)$/i, "");
}

export function findArcadeGameForFile(fileName = "") {
  const setName = normalizeArcadeSetName(fileName);
  return PERSONAL_ARCADE_GAMES.find((game) => game.id === setName) || null;
}

export function arcadeDecades() {
  return [...new Set(PERSONAL_ARCADE_GAMES.map((game) => Math.floor(game.year / 10) * 10))].sort();
}
