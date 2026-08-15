const DEFAULT_EMULATOR_DATA_PATH = "https://cdn.emulatorjs.org/stable/data/";

function safeInlineJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/**
 * Build the isolated EmulatorJS frame. Arcade libretro cores identify a ROM set
 * by the archive filename, so the frame reconstructs a real File object with the
 * original filename instead of passing a nameless blob: URL.
 */
export function buildArcadeFrame({ sessionKey, setName, core, dataPath = DEFAULT_EMULATOR_DATA_PATH }) {
  const safeSessionKey = safeInlineJson(sessionKey);
  const safeSetName = safeInlineJson(setName);
  const safeCore = safeInlineJson(core);
  const safeDataPath = safeInlineJson(dataPath);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
html,body,#game{margin:0;width:100%;height:100%;min-height:100%;background:#030707;overflow:hidden}
.arcade-frame-error{box-sizing:border-box;padding:24px;color:#f5f0dc;font:16px/1.5 system-ui,sans-serif}
</style>
</head>
<body>
<div id="game"></div>
<script>
(() => {
  const registry = window.parent.__familyArcadeRomSessions || {};
  const payload = registry[${safeSessionKey}];
  if (!payload || !payload.blob) {
    document.getElementById("game").innerHTML = '<div class="arcade-frame-error">ROM data is unavailable. Relaunch the game from the Arcade library.</div>';
    throw new Error("Arcade ROM session is unavailable");
  }

  // Construct the File inside this iframe realm. EmulatorJS preserves File.name
  // for arcade cores; that filename is how FBNeo/MAME resolve the ROM set driver.
  window.EJS_player = "#game";
  window.EJS_core = ${safeCore};
  window.EJS_gameUrl = new File([payload.blob], payload.name, {
    type: payload.type || payload.blob.type || "application/octet-stream"
  });
  window.EJS_gameName = ${safeSetName};
  window.EJS_pathtodata = ${safeDataPath};
  window.EJS_startOnLoaded = true;
  window.EJS_threads = false;
})();
</script>
<script src="${dataPath}loader.js"></script>
</body>
</html>`;
}

export { DEFAULT_EMULATOR_DATA_PATH };
