import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "./firebase";
import { normalizeRoomSetup, roomSetupMatches } from "./game/roomSetup";

const STORAGE_KEY = "canastaUnprotectedRedThreesPenalty";
const PICKUP_RULE_KEY = "canastaDiscardPickupRule";
const CANASTAS_TO_GO_OUT_KEY = "canastaCanastasToGoOut";
const PENDING_SETUP_KEY = "canastaPendingRoomSetup";
const PENDING_SETUP_TTL = 5 * 60 * 1000;
const ROOM_OPTIONS = [
  { value: "solo:2", label: "2 solo", seats: 2 },
  { value: "solo:3", label: "3 solo", seats: 3 },
  { value: "solo:4", label: "4 solo", seats: 4 },
  { value: "partners:2", label: "4 partners", seats: 4 },
  { value: "partners:3", label: "6 partners", seats: 6 },
];

function storedPickupRule() {
  return localStorage.getItem(PICKUP_RULE_KEY) === "modern" ? "modern" : "classic";
}

function storedCanastasToGoOut() {
  return localStorage.getItem(CANASTAS_TO_GO_OUT_KEY) === "2" ? 2 : 1;
}

function findSettingsControl(settings, labelText) {
  if (!settings) return null;
  const label = Array.from(settings.querySelectorAll("label"))
    .find((item) => item.textContent?.trim().startsWith(labelText));
  return label?.querySelector("select, input") || null;
}

function readSelectedSetup() {
  const settings = document.querySelector(".settings-grid");
  const playMode = findSettingsControl(settings, "Play style")?.value;
  const teamCount = findSettingsControl(settings, "Teams")?.value;
  if (!playMode || !teamCount) return null;

  return normalizeRoomSetup({
    playMode,
    teamCount,
    deckCount: findSettingsControl(settings, "Decks")?.value,
    cardsPerPlayer: findSettingsControl(settings, "Starting cards")?.value,
    cardBack: findSettingsControl(settings, "Card back")?.value,
    discardPickupRule: findSettingsControl(settings, "Discard pickup")?.value || storedPickupRule(),
    canastasToGoOut: findSettingsControl(settings, "Canastas to go out")?.value || storedCanastasToGoOut(),
  });
}

function clearPendingSetup() {
  try {
    sessionStorage.removeItem(PENDING_SETUP_KEY);
  } catch {
    // Storage may be unavailable in locked-down browsers. The lobby editor remains available.
  }
}

function rememberPendingSetup(setup) {
  try {
    sessionStorage.setItem(PENDING_SETUP_KEY, JSON.stringify({ setup, capturedAt: Date.now() }));
  } catch {
    // Storage may be unavailable in locked-down browsers. The lobby editor remains available.
  }
}

function readPendingSetup() {
  try {
    const value = JSON.parse(sessionStorage.getItem(PENDING_SETUP_KEY) || "null");
    if (!value?.setup || !value.capturedAt || Date.now() - Number(value.capturedAt) > PENDING_SETUP_TTL) {
      clearPendingSetup();
      return null;
    }
    return normalizeRoomSetup(value.setup);
  } catch {
    clearPendingSetup();
    return null;
  }
}

export default function HomeRulesOptions() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [pickupRule, setPickupRule] = useState(storedPickupRule);
  const [canastasToGoOut, setCanastasToGoOut] = useState(storedCanastasToGoOut);
  const [settingsTarget, setSettingsTarget] = useState(null);
  const [lobbySummaryTarget, setLobbySummaryTarget] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState("");
  const setupSyncing = useRef(false);

  useEffect(() => {
    const locate = () => {
      setSettingsTarget(document.querySelector(".settings-grid"));
      setLobbySummaryTarget(document.querySelector(".lobby-actions .summary"));
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      setRoomCode(/^[A-Z0-9]{6}$/.test(code) ? code : "");
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const captureRequestedSetup = (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button) return;

      if (button.matches(".quick-robot") || button.closest(".join-row")) {
        clearPendingSetup();
        return;
      }

      if (!button.textContent?.includes("Create custom game")) return;
      const setup = readSelectedSetup();
      if (setup) rememberPendingSetup(setup);
    };

    document.addEventListener("click", captureRequestedSetup, true);
    return () => document.removeEventListener("click", captureRequestedSetup, true);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, [enabled]);

  useEffect(() => {
    localStorage.setItem(PICKUP_RULE_KEY, pickupRule);
  }, [pickupRule]);

  useEffect(() => {
    localStorage.setItem(CANASTAS_TO_GO_OUT_KEY, String(canastasToGoOut));
  }, [canastasToGoOut]);

  useEffect(() => {
    if (!roomCode || !db) {
      setRoom(null);
      return undefined;
    }
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !roomCode || !room || room.hostUid !== uid || room.status !== "lobby") return;
    if (Boolean(room.rules?.unprotectedRedThreesPenalty) === enabled) return;
    update(ref(db, `rooms/${roomCode}/rules`), {
      unprotectedRedThreesPenalty: enabled,
      unprotectedRedThreePenalty: 200,
      freezeOnBlackThree: false,
    }).catch(() => {});
  }, [enabled, roomCode, room]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !roomCode || !room || room.hostUid !== uid || room.status !== "lobby" || setupSyncing.current) return;

    const requestedSetup = readPendingSetup();
    if (!requestedSetup) return;
    if (roomSetupMatches(room.rules, requestedSetup)) {
      clearPendingSetup();
      return;
    }

    setupSyncing.current = true;
    update(ref(db, `rooms/${roomCode}/rules`), requestedSetup)
      .then(() => clearPendingSetup())
      .catch((error) => setSetupError(error.message || "Could not apply the selected room setup."))
      .finally(() => {
        setupSyncing.current = false;
      });
  }, [roomCode, room]);

  async function changeLobbySetup(value) {
    if (!roomCode || !room || room.status !== "lobby") return;
    const [playMode, teamCountValue] = value.split(":");
    const setup = normalizeRoomSetup({
      playMode,
      teamCount: Number(teamCountValue),
      cardBack: room.rules?.cardBack,
      discardPickupRule: room.rules?.discardPickupRule,
      canastasToGoOut: room.rules?.canastasToGoOut,
    });

    clearPendingSetup();
    setSavingSetup(true);
    setSetupError("");
    try {
      await update(ref(db, `rooms/${roomCode}/rules`), setup);
    } catch (error) {
      setSetupError(error.message || "Could not update the room capacity.");
    } finally {
      setSavingSetup(false);
    }
  }

  async function changeLobbyPickupRule(value) {
    if (!roomCode || !room || room.status !== "lobby") return;
    const nextRule = value === "modern" ? "modern" : "classic";
    setPickupRule(nextRule);
    setSavingSetup(true);
    setSetupError("");
    try {
      await update(ref(db, `rooms/${roomCode}/rules`), { discardPickupRule: nextRule });
    } catch (error) {
      setSetupError(error.message || "Could not update the discard pickup rule.");
    } finally {
      setSavingSetup(false);
    }
  }

  async function changeLobbyCanastasToGoOut(value) {
    if (!roomCode || !room || room.status !== "lobby") return;
    const nextValue = Number(value) === 2 ? 2 : 1;
    setCanastasToGoOut(nextValue);
    setSavingSetup(true);
    setSetupError("");
    try {
      await update(ref(db, `rooms/${roomCode}/rules`), { canastasToGoOut: nextValue });
    } catch (error) {
      setSetupError(error.message || "Could not update the canasta requirement.");
    } finally {
      setSavingSetup(false);
    }
  }

  const uid = auth?.currentUser?.uid;
  const isLobbyHost = Boolean(uid && room && room.hostUid === uid && room.status === "lobby");
  const currentSetup = normalizeRoomSetup(room?.rules || {});
  const currentRoomOption = `${currentSetup.playMode}:${currentSetup.teamCount}`;
  const memberCount = Object.keys(room?.members || {}).length;

  return (
    <>
      {settingsTarget && createPortal(
        <>
          <label className="wide-setting">Discard pickup
            <select value={pickupRule} onChange={(event) => setPickupRule(event.target.value)}>
              <option value="classic">Classic Canasta</option>
              <option value="modern">Modern American</option>
            </select>
            <small>Classic allows an unfrozen pickup with two naturals, one natural plus one wild, or an existing meld. Modern always requires two naturals.</small>
          </label>
          <label className="wide-setting">Canastas to go out
            <select value={canastasToGoOut} onChange={(event) => setCanastasToGoOut(Number(event.target.value) === 2 ? 2 : 1)}>
              <option value={1}>1 canasta — standard</option>
              <option value={2}>2 canastas — house rule</option>
            </select>
            <small>When set to two, a team must complete two seven-card canastas before any player on that team may go out.</small>
          </label>
          <label className="home-rule-toggle wide-setting">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            <span>
              <b>Unprotected red threes count against you</b>
              <small>When selected, a team with red threes but no clean or dirty canasta scores −200 per red three at the end of the hand.</small>
            </span>
          </label>
        </>,
        settingsTarget,
      )}

      {lobbySummaryTarget && isLobbyHost && createPortal(
        <>
          <p>
            <span>Capacity</span>
            <select
              aria-label="Room capacity and format"
              value={currentRoomOption}
              disabled={savingSetup}
              onChange={(event) => changeLobbySetup(event.target.value)}
              style={{ maxWidth: "116px" }}
            >
              {ROOM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} disabled={option.seats < memberCount}>
                  {option.label}
                </option>
              ))}
            </select>
          </p>
          <p>
            <span>Pickup</span>
            <select
              aria-label="Discard pickup rule"
              value={currentSetup.discardPickupRule}
              disabled={savingSetup}
              onChange={(event) => changeLobbyPickupRule(event.target.value)}
              style={{ maxWidth: "136px" }}
            >
              <option value="classic">Classic</option>
              <option value="modern">Modern American</option>
            </select>
          </p>
          <p>
            <span>Go out</span>
            <select
              aria-label="Canastas required to go out"
              value={currentSetup.canastasToGoOut}
              disabled={savingSetup}
              onChange={(event) => changeLobbyCanastasToGoOut(event.target.value)}
              style={{ maxWidth: "136px" }}
            >
              <option value={1}>1 canasta</option>
              <option value={2}>2 canastas</option>
            </select>
          </p>
          {setupError && <small className="error">{setupError}</small>}
        </>,
        lobbySummaryTarget,
      )}
    </>
  );
}
