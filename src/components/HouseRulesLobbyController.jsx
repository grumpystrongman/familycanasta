import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "../firebase";
import { startOnlineGame } from "../services/roomService.js";
import HouseRulesPanel from "./HouseRulesPanel";
import {
  DEFAULT_HOUSE_RULES,
  buildHouseRuleRoomUpdates,
  normalizeHouseRules,
} from "../game/houseRules.js";

const OPERATION_TIMEOUT_MS = 15000;

function withTimeout(promise, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error(message)), OPERATION_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function findLobbyElements() {
  const lobby = document.querySelector(".lobby-page");
  const roomCode = lobby?.querySelector(".code b")?.textContent?.trim() || "";
  const actions = lobby?.querySelector(".lobby-actions") || null;
  const originalStart = actions?.querySelector(":scope > button.primary") || null;
  return {
    roomCode,
    actions,
    originalStart,
    startDisabled: Boolean(originalStart?.disabled),
  };
}

export default function HouseRulesLobbyController() {
  const [elements, setElements] = useState(() => findLobbyElements());
  const [room, setRoom] = useState(null);
  const [savingRules, setSavingRules] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const saveRequest = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = findLobbyElements();
      setElements((current) => {
        if (
          current.roomCode === next.roomCode
          && current.actions === next.actions
          && current.originalStart === next.originalStart
          && current.startDisabled === next.startDisabled
        ) {
          return current;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!elements.roomCode) {
      setRoom(null);
      return undefined;
    }
    return onValue(
      ref(db, `rooms/${elements.roomCode}`),
      (snapshot) => setRoom(snapshot.val()),
      (event) => setError(event.message),
    );
  }, [elements.roomCode]);

  const host = Boolean(room && auth?.currentUser?.uid === room.hostUid);
  const rules = normalizeHouseRules(room?.houseRules || DEFAULT_HOUSE_RULES);

  useEffect(() => {
    if (!room || !host || room.status !== "lobby" || room.houseRules) return;
    withTimeout(
      update(
        ref(db, `rooms/${elements.roomCode}`),
        buildHouseRuleRoomUpdates(DEFAULT_HOUSE_RULES),
      ),
      "The default house rules could not be saved. Check the connection and retry.",
    ).catch((event) => setError(event.message));
  }, [room, host, elements.roomCode]);

  useEffect(() => {
    if (!elements.originalStart) return undefined;
    elements.originalStart.classList.add("house-rules-original-start");
    return () => elements.originalStart?.classList.remove("house-rules-original-start");
  }, [elements.originalStart]);

  async function saveRules(nextValue) {
    if (!host || room?.status !== "lobby") return;
    const requestId = saveRequest.current + 1;
    saveRequest.current = requestId;
    setSavingRules(true);
    setError("");

    try {
      await withTimeout(
        update(
          ref(db, `rooms/${elements.roomCode}`),
          buildHouseRuleRoomUpdates(nextValue),
        ),
        "Saving the house rules took too long. Check the connection and retry.",
      );
    } catch (event) {
      if (requestId === saveRequest.current) setError(event.message);
    } finally {
      if (requestId === saveRequest.current) setSavingRules(false);
    }
  }

  async function startGame() {
    const uid = auth?.currentUser?.uid;
    if (!host || !uid || !elements.originalStart || elements.startDisabled || starting) return;

    setStarting(true);
    setError("");
    try {
      await withTimeout(
        update(
          ref(db, `rooms/${elements.roomCode}`),
          buildHouseRuleRoomUpdates(rules, { lock: true }),
        ),
        "The rules could not be locked for the game. Check the connection and retry.",
      );
      await withTimeout(
        startOnlineGame(elements.roomCode, uid),
        "Starting the game took too long. Check the connection before retrying.",
      );
    } catch (event) {
      setError(event.message);
    } finally {
      setStarting(false);
    }
  }

  if (!elements.actions || !room || room.status !== "lobby") return null;

  return createPortal(
    <section className="house-rules-lobby-integration">
      <HouseRulesPanel
        value={rules}
        onChange={saveRules}
        disabled={!host || starting}
      />
      {!host && <p className="house-rules-readonly">Only the host can change house rules.</p>}
      {host && savingRules && !starting && (
        <p className="house-rules-save-status" role="status">Saving changes…</p>
      )}
      {host && (
        <button
          type="button"
          className="primary house-rules-start"
          disabled={starting || elements.startDisabled}
          onClick={startGame}
        >
          {starting ? "Starting game…" : "Start game"}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </section>,
    elements.actions,
  );
}
