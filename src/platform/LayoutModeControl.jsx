import React, { useEffect, useState } from "react";
import {
  LAYOUT_MODES,
  readLayoutPreference,
  resolveLayoutMode,
  viewportLayoutSignals,
  writeLayoutPreference,
} from "./layoutMode";

function initialLayoutState() {
  return {
    preference: readLayoutPreference(),
    signals: viewportLayoutSignals(),
  };
}

export default function LayoutModeControl({ gameId = "game" }) {
  const [layout, setLayout] = useState(initialLayoutState);
  const mode = resolveLayoutMode({ preference: layout.preference, ...layout.signals });
  const adaptive = mode === LAYOUT_MODES.ADAPTIVE;
  const compactViewport = layout.signals.width <= 900;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gameLayout = mode;
    root.dataset.gameLayoutControl = "ready";

    return () => {
      delete root.dataset.gameLayout;
      delete root.dataset.gameLayoutControl;
    };
  }, [mode]);

  useEffect(() => {
    const updateSignals = () => {
      setLayout((current) => ({ ...current, signals: viewportLayoutSignals() }));
    };

    const pointerQuery = window.matchMedia?.("(pointer: coarse)");
    window.addEventListener("resize", updateSignals);
    window.addEventListener("orientationchange", updateSignals);
    pointerQuery?.addEventListener?.("change", updateSignals);

    return () => {
      window.removeEventListener("resize", updateSignals);
      window.removeEventListener("orientationchange", updateSignals);
      pointerQuery?.removeEventListener?.("change", updateSignals);
    };
  }, []);

  function chooseMode(nextMode) {
    if (compactViewport && nextMode === LAYOUT_MODES.CLASSIC) return;
    writeLayoutPreference(nextMode);
    setLayout((current) => ({ ...current, preference: nextMode }));
  }

  function toggleMode() {
    chooseMode(adaptive ? LAYOUT_MODES.CLASSIC : LAYOUT_MODES.ADAPTIVE);
  }

  const description = compactViewport
    ? "Adaptive layout is required on this screen so the game remains playable."
    : adaptive
      ? "Adaptive layout is on. The game is arranged for touch and smaller screens."
      : "Classic layout is on. The original desktop arrangement is preserved.";

  return (
    <aside className={`layout-mode-control ${compactViewport ? "compact-locked" : ""}`} aria-label={`${gameId} display layout`}>
      <span className={!adaptive ? "active" : ""} aria-hidden="true">Classic</span>
      <label className="layout-mode-switch" title={description}>
        <span className="visually-hidden">Use adaptive game layout</span>
        <input
          type="checkbox"
          role="switch"
          checked={adaptive}
          disabled={compactViewport}
          aria-checked={adaptive}
          aria-describedby="layout-mode-status"
          onChange={toggleMode}
        />
        <span className="layout-mode-slider" aria-hidden="true" />
      </label>
      <span className={adaptive ? "active" : ""} aria-hidden="true">Adaptive</span>
      <span id="layout-mode-status" className="visually-hidden" aria-live="polite">{description}</span>
    </aside>
  );
}
