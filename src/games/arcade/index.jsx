import React, { useEffect, useMemo, useState } from "react";
import { LEGAL_ARCADE_GAMES, findArcadeGameForFile } from "./catalog.js";
import "./styles.css";

const EMULATOR_DATA_PATH = "https://cdn.emulatorjs.org/stable/data/";

function backToHub() {
  const next = new URL(window.location.href);
  next.searchParams.delete("game");
  next.searchParams.delete("room");
  next.searchParams.delete("role");
  window.location.assign(next.toString());
}

function buildArcadeFrame({ romUrl, gameName, core }) {
  const safe = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
html,body,#game{margin:0;width:100%;height:100%;min-height:100%;background:#030707;overflow:hidden}
</style>
</head>
<body>
<div id="game"></div>
<script>
window.EJS_player = "#game";
window.EJS_core = ${safe(core)};
window.EJS_gameUrl = ${safe(romUrl)};
window.EJS_gameName = ${safe(gameName)};
window.EJS_pathtodata = ${safe(EMULATOR_DATA_PATH)};
window.EJS_startOnLoaded = true;
window.EJS_threads = false;
</script>
<script src="${EMULATOR_DATA_PATH}loader.js"></script>
</body>
</html>`;
}

function ArcadeFrame({ file, game, core, session }) {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    if (!file) {
      setSrcDoc("");
      return undefined;
    }
    const romUrl = URL.createObjectURL(file);
    setSrcDoc(buildArcadeFrame({ romUrl, gameName: game?.title || file.name, core }));
    return () => URL.revokeObjectURL(romUrl);
  }, [file, game, core, session]);

  if (!srcDoc) {
    return (
      <div className="arcade-screen arcade-screen-empty">
        <span aria-hidden="true">🕹️</span>
        <strong>Cabinet waiting for a ROM</strong>
        <p>Choose an authorized ZIP below, then start the cabinet.</p>
      </div>
    );
  }

  return (
    <iframe
      key={session}
      className="arcade-emulator-frame"
      title={`${game?.title || "Arcade"} emulator`}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads"
      allow="autoplay; fullscreen; gamepad"
      referrerPolicy="no-referrer"
    />
  );
}

export default function Arcade() {
  const [selectedId, setSelectedId] = useState(LEGAL_ARCADE_GAMES[0].id);
  const [pendingFile, setPendingFile] = useState(null);
  const [activeFile, setActiveFile] = useState(null);
  const [core, setCore] = useState("arcade");
  const [session, setSession] = useState(0);

  const selectedGame = useMemo(
    () => LEGAL_ARCADE_GAMES.find((game) => game.id === selectedId) || LEGAL_ARCADE_GAMES[0],
    [selectedId],
  );

  function chooseFile(event) {
    const file = event.target.files?.[0] || null;
    setPendingFile(file);
    const recognized = file ? findArcadeGameForFile(file.name) : null;
    if (recognized) setSelectedId(recognized.id);
  }

  function startCabinet() {
    if (!pendingFile) return;
    setActiveFile(pendingFile);
    setSession((value) => value + 1);
  }

  return (
    <main className="arcade-page">
      <header className="arcade-header">
        <div>
          <p className="arcade-kicker">Family Game Room · Arcade</p>
          <h1>Browser Arcade</h1>
          <p>Play legally obtained arcade ROMs in the browser with a WebAssembly arcade core. ROM files stay local to this browser session; Family Game Room does not mirror or bundle commercial game ROMs.</p>
        </div>
        <button type="button" className="arcade-back" onClick={backToHub}>Back to library</button>
      </header>

      <section className="arcade-cabinet-shell" aria-label="Arcade cabinet">
        <div className="arcade-marquee"><span>INSERT COIN</span><strong>{selectedGame.title}</strong><span>{selectedGame.year}</span></div>
        <ArcadeFrame file={activeFile} game={selectedGame} core={core} session={session} />
        <div className="arcade-controls-panel">
          <label>
            Emulator core
            <select value={core} onChange={(event) => setCore(event.target.value)}>
              <option value="arcade">FinalBurn Neo (recommended)</option>
              <option value="mame2003">MAME 2003 (legacy)</option>
            </select>
          </label>
          <label className="arcade-file-picker">
            ROM ZIP
            <input type="file" accept=".zip,application/zip" onChange={chooseFile} />
          </label>
          <button type="button" onClick={startCabinet} disabled={!pendingFile}>Start cabinet</button>
        </div>
        <p className="arcade-core-note">Arcade ROM sets are version-sensitive. FinalBurn Neo is recommended for the curated library; MAME 2003 remains available for older compatible sets. If a ROM does not match a core, use a matching legally obtained set or a current-MAME build.</p>
      </section>

      <section className="arcade-library" aria-labelledby="arcade-library-title">
        <div className="arcade-library-heading">
          <div><p className="arcade-kicker">Authorized downloads</p><h2 id="arcade-library-title">Free 80s &amp; 90s ROM sources</h2></div>
          <span>{LEGAL_ARCADE_GAMES.length} verified listings</span>
        </div>
        <div className="arcade-legal-note">
          <strong>Important:</strong> these titles are free for non-commercial use from the linked rights-approved source. The permission does not let Family Game Room re-host the ZIP files, so download there and load the ZIP here.
        </div>
        <div className="arcade-title-grid">
          {LEGAL_ARCADE_GAMES.map((game) => (
            <article key={game.id} className={`arcade-title-card ${selectedId === game.id ? "selected" : ""}`}>
              <div className="arcade-title-year">{game.year}</div>
              <h3>{game.title}</h3>
              <p>{game.maker}</p>
              <span>{game.genre}</span>
              <div className="arcade-title-actions">
                <button type="button" onClick={() => setSelectedId(game.id)}>Select</button>
                <a href={game.sourceUrl} target="_blank" rel="noreferrer">Authorized download</a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="arcade-own-rom">
        <div><p className="arcade-kicker">Your collection</p><h2>Use your own legal ROM dump</h2></div>
        <p>You can also load a compatible ZIP you are legally entitled to use, including a ROM dumped from hardware you own where local law and licensing permit it. Nothing is uploaded by this screen.</p>
      </section>
    </main>
  );
}
