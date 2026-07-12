export const SESSION_COMPATIBILITY_VERSION = "2026-07-12-stable-1";

export function resetIncompatibleSession(storage) {
  if (!storage) return false;

  const versionKey = "canastaSessionCompatibility";
  if (storage.getItem(versionKey) === SESSION_COMPATIBILITY_VERSION) return false;

  storage.removeItem("canastaRoomCode");
  storage.setItem(versionKey, SESSION_COMPATIBILITY_VERSION);
  return true;
}
