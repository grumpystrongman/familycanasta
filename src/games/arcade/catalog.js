const MAME_ROM_BASE = "https://www.mamedev.org/roms";

function mameGame(id, title, year, maker, genre) {
  return {
    id,
    title,
    year,
    maker,
    genre,
    sourceUrl: `${MAME_ROM_BASE}/${id}/`,
    downloadUrl: `${MAME_ROM_BASE}/${id}/${id}.zip`,
  };
}

export const LEGAL_ARCADE_GAMES = [
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
    sourceUrl: "https://www.mamedev.org/links.php",
    downloadUrl: null,
    sourceNote: "MAME's Resources page links to Gaelco's World Rally release.",
  },
];

export function findArcadeGameForFile(fileName = "") {
  const setName = String(fileName).trim().toLowerCase().replace(/\.zip$/i, "");
  return LEGAL_ARCADE_GAMES.find((game) => game.id === setName) || null;
}

export function arcadeDecades() {
  return [...new Set(LEGAL_ARCADE_GAMES.map((game) => Math.floor(game.year / 10) * 10))].sort();
}
