export const LEGAL_ARCADE_GAMES = [
  { id: "targ", title: "Targ", year: 1980, maker: "Exidy", genre: "Maze shooter", sourceUrl: "https://www.mamedev.org/roms/targ/" },
  { id: "spectar", title: "Spectar", year: 1980, maker: "Exidy", genre: "Maze shooter", sourceUrl: "https://www.mamedev.org/roms/spectar/" },
  { id: "robby", title: "Robby Roto", year: 1981, maker: "Bally/Midway", genre: "Maze action", sourceUrl: "https://www.mamedev.org/roms/robby/" },
  { id: "supertnk", title: "Super Tank", year: 1981, maker: "Video Games GmbH", genre: "Tank action", sourceUrl: "https://www.mamedev.org/roms/supertnk/" },
  { id: "hardhat", title: "Hard Hat", year: 1982, maker: "Exidy", genre: "Arcade action", sourceUrl: "https://www.mamedev.org/roms/hardhat/" },
  { id: "victory", title: "Victory", year: 1982, maker: "Exidy", genre: "Shooter", sourceUrl: "https://www.mamedev.org/roms/victory/" },
  { id: "teetert", title: "Teeter Torture", year: 1982, maker: "Exidy", genre: "Arcade action", sourceUrl: "https://www.mamedev.org/roms/teetert/" },
  { id: "looping", title: "Looping", year: 1982, maker: "Video Games GmbH", genre: "Flying shooter", sourceUrl: "https://www.mamedev.org/roms/looping/" },
  { id: "gridlee", title: "Gridlee", year: 1982, maker: "Videa", genre: "Prototype action", sourceUrl: "https://www.mamedev.org/roms/gridlee/" },
  { id: "fax", title: "FAX", year: 1983, maker: "Exidy", genre: "Trivia", sourceUrl: "https://www.mamedev.org/roms/fax/" },
  { id: "alienar", title: "Alien Arena", year: 1985, maker: "Duncan Brown", genre: "Capture-the-flag action", sourceUrl: "https://www.mamedev.org/roms/alienar/" },
  { id: "topgunnr", title: "Top Gunner / Vertigo", year: 1986, maker: "Exidy", genre: "Vector flight combat", sourceUrl: "https://www.mamedev.org/roms/topgunnr/" },
  { id: "falcnwld", title: "Falcons Wild - World Wide Poker", year: 1990, maker: "Video Klein", genre: "Video poker", sourceUrl: "https://www.mamedev.org/roms/falcnwld/" },
  { id: "witchcrd", title: "Witch Card", year: 1991, maker: "Video Klein", genre: "Video poker", sourceUrl: "https://www.mamedev.org/roms/witchcrd/" },
  { id: "wstrike", title: "Witch Strike", year: 1992, maker: "Video Klein", genre: "Video poker", sourceUrl: "https://www.mamedev.org/roms/wstrike/" },
  { id: "witchjol", title: "Jolli Witch", year: 1994, maker: "Video Klein", genre: "Video poker", sourceUrl: "https://www.mamedev.org/roms/witchjol/" },
  { id: "wtchjack", title: "Witch Jack", year: 1996, maker: "Video Klein", genre: "Video poker", sourceUrl: "https://www.mamedev.org/roms/wtchjack/" },
  { id: "wupndown", title: "Witch Up & Down", year: 1998, maker: "Video Klein", genre: "Video poker", sourceUrl: "https://www.mamedev.org/roms/wupndown/" },
];

export function findArcadeGameForFile(fileName = "") {
  const setName = String(fileName).trim().toLowerCase().replace(/\.zip$/i, "");
  return LEGAL_ARCADE_GAMES.find((game) => game.id === setName) || null;
}

export function arcadeDecades() {
  return [...new Set(LEGAL_ARCADE_GAMES.map((game) => Math.floor(game.year / 10) * 10))].sort();
}
