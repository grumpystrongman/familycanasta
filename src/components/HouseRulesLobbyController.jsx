import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "../firebase";
import HouseRulesPanel from "./HouseRulesPanel";
import {
  DEFAULT_HOUSE_RULES,
  normalizeHouseRules,
  variantProfile,
} from "../game/houseRules.js";

function findLobbyElements() {
  const lobby = document.querySelector(".lobby-page");
  const roomCode = lobby?.querySelector(".code b")?.textContent?.trim() || "";
  const actions = lobby?.querySelector(".lobby-actions") || null;
  const originalStart = actions?.querySelector(":scope > button.primary") || null;
  return { lobby, roomCode, actions, originalStart };
}

export default function HouseRulesLobbyController() {
  const [domVersion, setDomVersion] = useState(0);
  const [room, setRoom] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const observer = new MutationObserver(() => setDomVersion((value) => value + 1));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const elements = useMemo(() => findLobbyElements(), [domVersion]);

  useEffect(() => {
    if (!elements.roomCode) {
      setRoom(null);
      return undefined;
    }
    return onValue(ref(db, `rooms/${elements.roomCode}`), (snapshot) => {
      setRoom(snapshot.val());
    });
  }, [elements.roomCode]);

  const host = Boolean(room && auth?.currentUser?.uid === room.hostUid);
  const rules = normalizeHouseRules(room?.houseRules || DEFAULT_HOUSE_RULES);

  useEffect(() => {
    if (!room || !host || room.status !== "lobby" || room.houseRules) return;
    update(ref(db, `rooms/${elements.roomCode}`), { houseRules: rules }).catch((event) => setError(event.message));
  }, [room, host, elements.roomCode]);

  useEffect(() => {
    if (!elements.originalStart) return undefined;
    elements.originalStart.classList.add("house-rules-original-start");
    return () => elements.originalStart?.classList.remove("house-rules-original-start");
  }, [elements.originalStart]);

  async function saveRules(nextValue) {
    if (!host || room?.status !== "lobby") return;
    const normalized = normalizeHouseRules(nextValue);
    const profile = variantProfile(normalized.deckVariation.variant);
    setSaving(true);
    setError("");
    try {
      await update(ref(db, `rooms/${elements.roomCode}`), {
        houseRules: normalized,
        "rules/drawCount": normalized.drawAndDiscard.drawCount,
        ...(profile.deckCount ? { "rules/deckCount": profile.deckCount } : {}),
        ...(profile.handSize ? { "rules/cardsPerPlayer": profile.handSize } : {}),
      });
    } catch (event) {
      setError(event.message);
    } finally {
      setSaving(false);
    }
  }

  async function startGame() {
    if (!host || !elements.originalStart || elements.originalStart.disabled) return;
    setSaving(true);
    setError("");
    try {
      const lockedRules = normalizeHouseRules(room?.houseRules || DEFAULT_HOUSE_RULES);
      await update(ref(db, `rooms/${elements.roomCode}`), {
        activeRules: lockedRules,
        rulesLockedAt: Date.now(),
      });
      elements.originalStart.click();
    } catch (event) {
      setError(event.message);
    } finally {
      setSaving(false);
    }
  }

  if (!elements.actions || !room || room.status !== "lobby") return null;

  return createPortal(
    <section className="house-rules-lobby-integration">
      <HouseRulesPanel
        value={rules}
        onChange={saveRules}
        disabled={!host || saving}
      />
      {!host && <p className="house-rules-readonly">Only the host can change house rules.</p>}
      {host && (
        <button
          type="button"
          className="primary house-rules-start"
          disabled={saving || Boolean(elements.originalStart?.disabled)}
          onClick={startGame}
        >
          {saving ? "Saving rules…" : "Start game"}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </section>,
    elements.actions,
  );
}
