import React, { useEffect, useMemo, useState } from "react";
import { ARCADE_GAMES, findArcadeGameForFile, normalizeArcadeSetName } from "./catalog.js";
import { isSupportedRomArchiveName, listInstalledRoms, loadRom, removeRom, romIdForFile, saveRom } from "./romVault.js";
import { buildArcadeFrame } from "./runtime.js";
import "./styles.css";
import "./romVault.css";

const ROM_ARCHIVE_ACCEPT = ".zip,.7z,application/zip,application/x-7z-compressed";
const DEFAULT_IMPORTED_CORE = "mame2003_plus";

function backToHub() {
  const next = new URL(window.location.href);
  next.searchParams.delete("game");
  next.searchParams.delete("room");
  next.searchParams.delete("role");
  window.location.assign(next.toString());
}

function metadataForRecord(record) {
  if (!record) return null;
  return findArcadeGameForFile(record.name) || ARCADE_GAMES.find((game) => game.id === record.id) || null;
}

function displayEntry(record) {
  const game = metadataForRecord(record);
  if (game) return { record, game, recognized: true };

  const setName = normalizeArcadeSetName(record.name || record.id);
  return {
    record,
    recognized: false,
    game: {
      id: record.id,
      title: setName || record.name,
      year: null,
      maker: "Imported ROM",
      genre: "Unverified arcade set",
      preferredCore: DEFAULT_IMPORTED_CORE,
      compatibilityNote: "No built-in metadata for this set. Try the available arcade cores.",
    },
  };
}

function ArcadeFrame({ rom, game, core, session }) {
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() => {
    if (!rom?.blob) {
      setSrcDoc("");
      return undefined;
    }

    const sessionKey = `family-arcade-${session}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const setName = game?.id || rom.id || normalizeArcadeSetName(rom.name);
    window.__familyArcadeRomSessions = window.__familyArcadeRomSessions || {};
    window.__familyArcadeRomSessions[sessionKey] = {
      blob: rom.blob,
      name: rom.name,
      type: rom.type || rom.blob.type || "application/octet-stream",
    };

    setSrcDoc(buildArcadeFrame({ sessionKey, setName, core }));

    return () => {
      if (window.__familyArcadeRomSessions) {
        delete window.__familyArcadeRomSessions[sessionKey];
      }
    };
  }, [rom, game, core, session]);

  if (!srcDoc) {
    return (
      <div className="arcade-screen arcade-screen-empty">
        <span aria-hidden="true">🕹️</span>
        <strong>Your cabinet is ready</strong>
        <p>Import your ROMS folder, then launch one of the archives actually installed in this browser.</p>
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
  const [selectedId, setSelectedId] = useState(null);
  const [activeRom, setActiveRom] = useState(null);
  const [installed, setInstalled] = useState([]);
  const [core, setCore] = useState(DEFAULT_IMPORTED_CORE);
  const [session, setSession] = useState(0);
  const [status, setStatus] = useState("");

  const libraryEntries = useMemo(
    () => installed.map(displayEntry).sort((a, b) => a.game.title.localeCompare(b.game.title)),
    [installed],
  );

  const selectedEntry = useMemo(
    () => libraryEntries.find((entry) => entry.record.id === selectedId) || null,
    [libraryEntries, selectedId],
  );

  async function refreshInstalled() {
    try {
      const records = await listInstalledRoms();
      setInstalled(records);
      return records;
    } catch (error) {
      setStatus(error.message || "Could not read the local ROM library.");
      return [];
    }
  }

  useEffect(() => {
    refreshInstalled();
  }, []);

  useEffect(() => {
    if (!libraryEntries.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !libraryEntries.some((entry) => entry.record.id === selectedId)) {
      setSelectedId(libraryEntries[0].record.id);
    }
  }, [libraryEntries, selectedId]);

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

      const records = await refreshInstalled();
      const first = files[0];
      const firstId = findArcadeGameForFile(first.name)?.id || romIdForFile(first.name);
      const firstRecord = records.find((record) => record.id === firstId);
      const firstGame = metadataForRecord(firstRecord);
      setSelectedId(firstId);
      setCore(firstGame?.preferredCore || DEFAULT_IMPORTED_CORE);

      const skippedCount = selectedFiles.length - files.length;
      const skippedText = skippedCount ? ` ${skippedCount} non-ROM file${skippedCount === 1 ? " was" : "s were"} skipped.` : "";
      setStatus(`${files.length} ROM archive${files.length === 1 ? "" : "s"} installed; ${recognizedCount} matched known set metadata.${skippedText}`);
      event.target.value = "";
    } catch (error) {
      setStatus(error.message || "ROM import failed.");
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

      const game = metadataForRecord(record);
      setSelectedId(record.id);
      setCore(game?.preferredCore || DEFAULT_IMPORTED_CORE);
      setActiveRom(record);
      setSession((value) => value + 1);
      setStatus(`Launching ${game?.title || normalizeArcadeSetName(record.name)}.`);
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

  const activeGame = metadataForRecord(activeRom) || selectedEntry?.game || null;

  return (
    <main className="arcade-page">
      <header className="arcade-header">
        <div>
          <p className="arcade-kicker">Family Game Room · Arcade</p>
          <h1>Browser Arcade</h1>
          <p>Your Arcade shelf is now driven only by ROM archives actually installed in this browser. There are no starter or placeholder games.</p>
        </div>
        <button type="button" className="arcade-back" onClick={backToHub}>Back to library</button>
      </header>

      <section className="arcade-cabinet-shell" aria-label="Arcade cabinet">
        <div className="arcade-marquee">
          <span>INSERT COIN</span>
          <strong>{activeGame?.title || activeRom?.name || selectedEntry?.game.title || "ARCADE"}</strong>
          <span>{activeGame?.year || "READY"}</span>
        </div>
        <ArcadeFrame rom={activeRom} game={activeGame} core={core} session={session} />
        <div className="arcade-controls-panel arcade-controls-panel-library">
          <label>
            Emulator core
            <select value={core} onChange={(event) => setCore(event.target.value)}>
              <option value="arcade">FinalBurn Neo</option>
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
        <p className="arcade-core-note">Arcade cores are ROM-set-version sensitive. The launcher now preserves the original archive filename so FBNeo/MAME can identify the set correctly. If a set revision still does not match one core, try another core.</p>
      </section>

      <section className="arcade-library" aria-labelledby="arcade-library-title">
        <div className="arcade-library-heading">
          <div><p className="arcade-kicker">Installed only</p><h2 id="arcade-library-title">Your Arcade collection</h2></div>
          <span>{installed.length} ROM archive{installed.length === 1 ? "" : "s"}</span>
        </div>
        <div className="arcade-legal-note">
          This shelf is generated from the browser ROM Vault. Remove a ROM and its card disappears; import a ROM and its card appears.
        </div>

        {libraryEntries.length ? (
          <div className="arcade-title-grid">
            {libraryEntries.map(({ record, game, recognized }) => (
              <article key={record.id} className={`arcade-title-card ${selectedId === record.id ? "selected" : ""}`}>
                <div className="arcade-title-card-top">
                  <div className="arcade-title-year">{game.year || "ROM"}</div>
                  <span className="arcade-installed-badge">Installed</span>
                </div>
                <h3>{game.title}</h3>
                <p>{game.maker}</p>
                <span>{game.genre}</span>
                <small>{record.name} · {Math.max(1, Math.round(record.size / 1024))} KB{recognized ? "" : " · metadata unverified"}</small>
                {game.compatibilityNote ? <small>{game.compatibilityNote}</small> : null}
                <div className="arcade-title-actions arcade-title-actions-wrap">
                  <button type="button" onClick={() => playInstalled(record.id)}>Play</button>
                  <button type="button" className="arcade-secondary-button" onClick={() => uninstall(record.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="arcade-vault-empty">
            No Arcade games are listed because no ROM archives are installed in this browser yet. Use “Add ROM folder” and select your ROMS directory.
          </div>
        )}
      </section>

      <footer className="arcade-library-summary">
        No defaults · {installed.length} locally installed ROM archive{installed.length === 1 ? "" : "s"}
      </footer>
    </main>
  );
}
