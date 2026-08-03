export const LAYOUT_MODE_STORAGE_KEY = "familyCardLayoutMode";

export const LAYOUT_MODES = Object.freeze({
  CLASSIC: "classic",
  ADAPTIVE: "adaptive",
});

const VALID_LAYOUT_MODES = new Set(Object.values(LAYOUT_MODES));

export function isLayoutMode(value) {
  return VALID_LAYOUT_MODES.has(value);
}

export function recommendLayoutMode({ width = Number.POSITIVE_INFINITY, coarsePointer = false } = {}) {
  const usableWidth = Number.isFinite(Number(width)) ? Number(width) : Number.POSITIVE_INFINITY;
  const compactViewport = usableWidth <= 900;
  const tabletLikeTouchScreen = Boolean(coarsePointer) && usableWidth <= 1366;
  return compactViewport || tabletLikeTouchScreen ? LAYOUT_MODES.ADAPTIVE : LAYOUT_MODES.CLASSIC;
}

export function viewportLayoutSignals(targetWindow = globalThis.window) {
  const width = Number(
    targetWindow?.innerWidth
      || targetWindow?.document?.documentElement?.clientWidth
      || Number.POSITIVE_INFINITY,
  );

  let coarsePointer = false;
  try {
    coarsePointer = Boolean(targetWindow?.matchMedia?.("(pointer: coarse)")?.matches);
  } catch {
    coarsePointer = false;
  }

  return { width, coarsePointer };
}

export function recommendLayoutModeForWindow(targetWindow = globalThis.window) {
  return recommendLayoutMode(viewportLayoutSignals(targetWindow));
}

export function readLayoutPreference(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem?.(LAYOUT_MODE_STORAGE_KEY);
    return isLayoutMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLayoutPreference(mode, storage = globalThis.localStorage) {
  if (!isLayoutMode(mode)) return false;
  try {
    storage?.setItem?.(LAYOUT_MODE_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}
