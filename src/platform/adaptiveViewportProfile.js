export const ADAPTIVE_VIEWPORT_PROFILES = Object.freeze({
  MINI_LANDSCAPE: "ipad-mini-landscape",
  STANDARD_LANDSCAPE: "ipad-standard-landscape",
  LARGE_LANDSCAPE: "ipad-large-landscape",
  MINI_PORTRAIT: "ipad-mini-portrait",
  STANDARD_PORTRAIT: "ipad-standard-portrait",
  LARGE_PORTRAIT: "ipad-large-portrait",
});

function positiveDimension(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : fallback;
}

export function resolveAdaptiveViewportProfile({ width, height }) {
  const safeWidth = positiveDimension(width, 1024);
  const safeHeight = positiveDimension(height, 768);
  const landscape = safeWidth >= safeHeight;

  if (landscape) {
    // iPad mini is roughly 1133 × 744 CSS pixels in landscape. Browser chrome,
    // Split View, and Stage Manager can make the available viewport smaller.
    if (safeWidth < 1160 || safeHeight < 780) {
      return ADAPTIVE_VIEWPORT_PROFILES.MINI_LANDSCAPE;
    }

    // Standard and 11-inch iPads generally occupy the 1180–1210 × 820–834
    // range. Keep this profile through 1279px so older 12.9-inch models and
    // constrained 13-inch windows do not receive an oversized composition.
    if (safeWidth < 1280 || safeHeight < 930) {
      return ADAPTIVE_VIEWPORT_PROFILES.STANDARD_LANDSCAPE;
    }

    return ADAPTIVE_VIEWPORT_PROFILES.LARGE_LANDSCAPE;
  }

  if (safeWidth < 780) return ADAPTIVE_VIEWPORT_PROFILES.MINI_PORTRAIT;
  if (safeWidth < 930) return ADAPTIVE_VIEWPORT_PROFILES.STANDARD_PORTRAIT;
  return ADAPTIVE_VIEWPORT_PROFILES.LARGE_PORTRAIT;
}

export function readAdaptiveViewportMetrics(targetWindow = globalThis.window) {
  const fallbackWidth = positiveDimension(targetWindow?.innerWidth, 1024);
  const fallbackHeight = positiveDimension(targetWindow?.innerHeight, 768);
  const viewport = targetWindow?.visualViewport;
  const width = positiveDimension(viewport?.width, fallbackWidth);
  const height = positiveDimension(viewport?.height, fallbackHeight);

  return {
    width,
    height,
    orientation: width >= height ? "landscape" : "portrait",
    profile: resolveAdaptiveViewportProfile({ width, height }),
  };
}
