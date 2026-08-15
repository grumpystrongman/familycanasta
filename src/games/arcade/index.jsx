import React, { useEffect, useMemo, useState } from "react";
import { ARCADE_GAMES, CURATED_ARCADE_GAMES, PERSONAL_ARCADE_GAMES, findArcadeGameForFile } from "./catalog.js";
import { isSupportedRomArchiveName, listInstalledRoms, loadRom, removeRom, romIdForFile, saveRom } from "./romVault.js";
import "./styles.css";
import "./romVault.css";

const EMULATOR_DATA_PATH = "https://cdn.emulatorjs.org/stable/data/";
const ROM_ARCHIVE_ACCEPT = ".zip,.7z,application/zip,application/x-7z-compressed";

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

function ArcadeFrame({ rom, game, core, session }) {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    if (!rom?.blob) {
      setSrcDoc("");
      return undefined;
    }
    const romUrl = URL.createObjectURL(rom.blob);
    setSrcDoc(buildArcadeFrame({ romUrl, gameName: game?.title || rom.name, core }));
    return () => URL.revokeObjectURL(romUrl);
  }, [rom, game, core, session]);

  if (!srcDoc) {
    return (
      <div className="arcade-screen arcade-screen-empty">
        <span aria-hidden="true">🕹️</span>
        <strong>Your cabinet is ready</strong>
        <p>Install or import ROM archives once, then launch them directly from the library.</p>
      </div>
    );
  }

  return (
    <iframe
      key={session}
      className="arcade-emulator-frame"
      title={`${game?.title || rom?.name || "Arcade"} emulator`}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads"
      allow="autoplay; fullscreen; gamepad"
      referrerPolicy="no-referrer"
    />
  );
}

export default function Arcade() {
  const [selectedId, setSelectedId] = useState(ARCADE_GAMES[0].id);
  const [activeRom, setActiveRom] = useState(null);
  const [installed, setInstalled] = useState([]);
  const [installingId, setInstallingId] = useState(null);
  const [core, setCore] = useState("arcade");
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState("");

  const selectedGame = useMemo(
    () => ARCADE_GAMES.find((game) => game.id === selectedId) || null,
    [selectedId],
  );

  const installedById = useMemo(
    () => new Map(installed.map((record) => [record.id, record])),
    [installed],
  );

  async function refreshInstalled() {
    try {
      setInstalled(await listInstalledRoms());
    } catch (error) {
      setStatus(error.message || "Could not read the local ROM library.");
    }
  }

  useEffect(() => {
    refreshInstalled();
  }, []);

  async function importFiles(event) {
    const selectedFiles = [...(event.target.files || [])];
    const files = selectedFiles.filter((file) => isSupportedRomArchiveName(file.name));
    if (!files.length) {
      setStatus("No .zip or .7z ROM archives were found in that selection.");
      event.target.value = "";
      return;
    }

    try {
      let recognizedCount = 0;
      for (const file of files) {
        const recognized = findArcadeGameForFile(file.name);
        if (recognized) recognizedCount += 1;
        await saveRom(file, recognized?.id || romIdForFile(file.name));
      }
      await refreshInstalled();
      const first = files[0];
      const recognized = findArcadeGameForFile(first.name);
      if (recognized) {
        setSelectedId(recognized.id);
        setCore(recognized.preferredCore || "arcade");
      }
      const skippedCount = selectedFiles.length - files.length;
      const skippedText = skippedCount ? ` ${skippedCount} non-ROM file${skippedCount === 1 ? " was" : "s were"} skipped.` : "";
      setStatus(`${files.length} ROM${files.length === 1 ? "" : "s"} installed in this browser; ${recognizedCount} matched library titles.${skippedText}`);
      event.target.value = "";
    } catch (error) {
      setStatus(error.message || "ROM import failed.");
    }
  }

  async function installCurated(game) {
    if (!game.downloadUrl) return;
    setInstallingId(game.id);
    setStatus(`Installing ${game.title}…`);
    try {
      const response = await fetch(game.downloadUrl, { mode: "cors", credentials: "omit" });
      if (!response.ok) throw new Error(`Download failed (${response.status}).`);
      const blob = await response.blob();
      const file = new File([blob], `${game.id}.zip`, { type: blob.type || "application/zip" });
      await saveRom(file, game.id);
      await refreshInstalled();
      setSelectedId(game.id);
      setCore(game.preferredCore || "arcade");
      setStatus(`${game.title} installed. Press Play.`);
    } catch (error) {
      setStatus(`Direct install was blocked by the source or browser. Use the ZIP button for ${game.title}, then add the downloaded file to the library.`);
    } finally {
      setInstallingId(null);
    }
  }

  async function playInstalled(gameId) {
    try {
      const record = await loadRom(gameId);
      if (!record) {
        setStatus("That ROM is no longer in local storage. Import it again.");
        await refreshInstalled();
        return;
      }
      const game = ARCADE_GAMES.find((item) => item.id === gameId) || null;
      if (game) {
        setSelectedId(game.id);
        setCore(game.preferredCore || "arcade");
      } else {
        setSelectedId(gameId);
      }
      setActiveRom(record);
      setSession((value) => value + 1);
      setStatus(`Playing ${game?.title || record.name}.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setStatus(error.message || "Could not launch ROM.");
    }
  }

  async function uninstall(gameId) {
    try {
      await removeRom(gameId);
      if (activeRom?.id === gameId) setActiveRom(null);
      await refreshInstalled();
      setStatus("ROM removed from this browser.");
    } catch (error) {
      setStatus(error.message || "Could not remove ROM.");
    }
  }

  const activeGame = ARCADE_GAMES.find((game) => game.id === activeRom?.id) || selectedGame;

  return (
    <main className="arcade-page">
      <header className="arcade-header">
        <div>
          <p className="arcade-kicker">Family Game Room · Arcade</p>
          <h1>Browser Arcade</h1>
          <p>Build a personal arcade library in your browser. Import ZIP or 7-Zip sets once, keep them in local browser storage, and launch installed games directly from their cards.</p>
        </div>
        <button type="button" className="arcade-back" onClick={backToHub}>Back to library</button>
      </header>

      <section className="arcade-cabinet-shell" aria-label="Arcade cabinet">
        <div className="arcade-marquee"><span>INSERT COIN</span><strong>{activeGame?.title || activeRom?.name || "ARCADE"}</strong><span>{activeGame?.year || "READY"}</span></div>
        <ArcadeFrame rom={activeRom} game={activeGame} core={core} session={session} />
        <div className="arcade-controls-panel arcade-controls-panel-library">
          <label>
            Emulator core
            <select value={core} onChange={(event) => setCore(event.target.value)}>
              <option value="arcade">FinalBurn Neo (recommended)</option>
              <option value="mame2003_plus">MAME 2003-Plus</option>
              <option value="mame2003">MAME 2003 (legacy)</option>
            </select>
          </label>
          <label className="arcade-file-picker">
            Add ROM archives
            <input type="file" accept={ROM_ARCHIVE_ACCEPT} multiple onChange={importFiles} />
          </label>
          <label className="arcade-file-picker">
            Add ROM folder
            <input type="file" accept={ROM_ARCHIVE_ACCEPT} multiple webkitdirectory="" directory="" onChange={importFiles} />
          </label>
          <div className="arcade-installed-count"><strong>{installed.length}</strong><span>installed</span></div>
        </div>
        {status ? <p className="arcade-status" role="status">{status}</p> : null}
        <p className="arcade-core-note">ROM sets are version-sensitive. Known titles automatically select the best first-choice core; you can switch cores here if a particular set revision needs another one.</p>
      </section>

      <section className="arcade-library" aria-labelledby="arcade-library-title">
        <div className="arcade-library-heading">
          <div><p className="arcade-kicker">Arcade shelf</p><h2 id="arcade-library-title">Arcade collection</h2></div>
          <span>{ARCADE_GAMES.length} titles · {PERSONAL_ARCADE_GAMES.length} matched from your ROMS folder</span>
        </div>
        <div className="arcade-legal-note">
          Import your ROMS folder once and recognized filenames become installed library games automatically. ZIP and 7-Zip archives are supported.
        </div>
        <div className="arcade-title-grid">
          {ARCADE_GAMES.map((game) => {
            const installedRom = installedById.get(game.id);
            const isInstalling = installingId === game.id;
            return (
              <article key={game.id} className={`arcade-title-card ${selectedId === game.id ? "selected" : ""}`}>
                <div className="arcade-title-card-top">
                  <div className="arcade-title-year">{game.year}</div>
                  {installedRom ? <span className="arcade-installed-badge">Installed</span> : null}
                </div>
                <h3>{game.title}</h3>
                <p>{game.maker}</p>
                <span>{game.genre}</span>
                {game.compatibilityNote ? <small>{game.compatibilityNote}</small> : null}
                <div className="arcade-title-actions arcade-title-actions-wrap">
                  {installedRom ? (
                    <>
                      <button type="button" onClick={() => playInstalled(game.id)}>Play</button>
                      <button type="button" className="arcade-secondary-button" onClick={() => uninstall(game.id)}>Remove</button>
                    </>
                  ) : game.localOnly ? (
                    <span>Import <code>{game.id}.7z</code> or <code>{game.id}.zip</code> from your ROMS folder.</span>
                  ) : game.downloadUrl ? (
                    <>
                      <button type="button" onClick={() => installCurated(game)} disabled={isInstalling}>{isInstalling ? "Installing…" : "Install"}</button>
                      <a href={game.downloadUrl}>ZIP</a>
                    </>
                  ) : (
                    <>
                      <a href={game.sourceUrl} target="_blank" rel="noreferrer">Get ROM</a>
                      <button type="button" className="arcade-secondary-button" onClick={() => setSelectedId(game.id)}>Select</button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="arcade-own-rom" aria-labelledby="arcade-vault-title">
        <div><p className="arcade-kicker">Your collection</p><h2 id="arcade-vault-title">ROM Vault</h2></div>
        <div className="arcade-vault-content">
          <p>Bulk-import compatible ZIP or 7-Zip sets from your collection. Unknown filenames are still stored and playable; recognized set names automatically match the corresponding library card.</p>
          {installed.length ? (
            <div className="arcade-vault-list">
              {installed.map((record) => {
                const game = ARCADE_GAMES.find((item) => item.id === record.id);
                return (
                  <div key={record.id} className="arcade-vault-row">
                    <div><strong>{game?.title || record.name}</strong><span>{record.name} · {Math.max(1, Math.round(record.size / 1024))} KB</span></div>
                    <div>
                      <button type="button" onClick={() => playInstalled(record.id)}>Play</button>
                      <button type="button" className="arcade-secondary-button" onClick={() => uninstall(record.id)}>Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <p className="arcade-vault-empty">No ROMs installed yet. Choose “Add ROM folder” and select your ROMS directory.</p>}
        </div>
      </section>

      <footer className="arcade-library-summary">
        {CURATED_ARCADE_GAMES.length} curated starter titles · {PERSONAL_ARCADE_GAMES.length} compatible titles recognized from your uploaded collection
      </footer>
    </main>
  );
}
