import React, { useEffect, useState } from "react";
import {
  LAYOUT_MODES,
  readLayoutPreference,
  recommendLayoutModeForWindow,
  writeLayoutPreference,
} from "./layoutMode";

function initialLayoutState() {
  const saved = readLayoutPreference();
  return {
    mode: saved || recommendLayoutModeForWindow(),
    hasExplicitPreference: Boolean(saved),
  };
}

export default function LayoutModeControl({ gameId = "game" }) {
  const [layout, setLayout] = useState(initialLayoutState);
  const adaptive = layout.mode === LAYOUT_MODES.ADAPTIVE;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.gameLayout = layout.mode;
    root.dataset.gameLayoutControl = "ready";

    return () => {
      delete root.dataset.gameLayout;
      delete root.dataset.gameLayoutControl;
    };
  }, [layout.mode]);

  useEffect(() => {
    if (layout.hasExplicitPreference) return undefined;

    const updateRecommendation = () => {
      setLayout((current) => current.hasExplicitPreference
        ? current
        : { ...current, mode: recommendLayoutModeForWindow() });
    };

    const pointerQuery = window.matchMedia?.("(pointer: coarse)");
    window.addEventListener("resize", updateRecommendation);
    window.addEventListener("orientationchange", updateRecommendation);
    pointerQuery?.addEventListener?.("change", updateRecommendation);

    return () => {
      window.removeEventListener("resize", updateRecommendation);
      window.removeEventListener("orientationchange", updateRecommendation);
      pointerQuery?.removeEventListener?.("change", updateRecommendation);
    };
  }, [layout.hasExplicitPreference]);

  function chooseMode(mode) {
    writeLayoutPreference(mode);
    setLayout({ mode, hasExplicitPreference: true });
  }

  function toggleMode() {
    chooseMode(adaptive ? LAYOUT_MODES.CLASSIC : LAYOUT_MODES.ADAPTIVE);
  }

  const description = adaptive
    ? "Adaptive layout is on. The game is arranged for touch and smaller screens."
    : "Classic layout is on. The original desktop arrangement is preserved.";

  return (
    <aside className="layout-mode-control" aria-label={`${gameId} display layout`}>
      <span className={!adaptive ? "active" : ""} aria-hidden="true">Classic</span>
      <label className="layout-mode-switch" title={description}>
        <span className="visually-hidden">Use adaptive game layout</span>
        <input
          type="checkbox"
          role="switch"
          checked={adaptive}
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
