import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth, db } from "./firebase";
import { wildMeldTargetOptions } from "./game/wildMeldTargets";

function isRenderedWildCard(button) {
  const label = button?.getAttribute("aria-label") || "";
  return label.startsWith("JOKER ") || label.startsWith("2 ");
}

function compactUnavailableLabel(status) {
  if (!status) return "unavailable";
  if (status.totalWildCount > status.maxWilds) return `max ${status.maxWilds} wilds`;
  const needed = Math.max(1, status.totalWildCount - status.naturalCount + 1);
  return `needs ${needed} natural ${status.rank}${needed === 1 ? "" : "s"}`;
}

export default function WildTargetEnhancer() {
  const [uid, setUid] = useState(() => auth?.currentUser?.uid || "");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [selectElement, setSelectElement] = useState(null);
  const [selectedWildCount, setSelectedWildCount] = useState(0);
  const [selectedRank, setSelectedRank] = useState("");

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => setUid(user?.uid || ""));
  }, []);

  useEffect(() => {
    const scan = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode((current) => current === code ? current : code);

      const nextSelect = document.querySelector(".wild-target select");
      setSelectElement((current) => current === nextSelect ? current : nextSelect);
      setSelectedRank((current) => {
        const next = nextSelect?.value || "";
        return current === next ? current : next;
      });

      const selectedButtons = [...document.querySelectorAll(".cards .real-card.selected")];
      const nextWildCount = selectedButtons.filter(isRenderedWildCard).length;
      setSelectedWildCount((current) => current === nextWildCount ? current : nextWildCount);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  useEffect(() => {
    if (!selectElement) return undefined;
    const handleChange = () => setSelectedRank(selectElement.value || "");
    selectElement.addEventListener("change", handleChange);
    return () => selectElement.removeEventListener("change", handleChange);
  }, [selectElement]);

  const team = Number(room?.members?.[uid]?.team ?? -1);
  const board = team >= 0 ? (room?.publicState?.teamBoards?.[team] || []) : [];
  const options = useMemo(
    () => wildMeldTargetOptions(board, selectedWildCount, room?.rules || {}),
    [board, selectedWildCount, room?.rules],
  );
  const optionByRank = useMemo(
    () => new Map(options.map((option) => [option.rank, option])),
    [options],
  );
  const selectedStatus = selectedRank ? optionByRank.get(selectedRank) : null;

  useEffect(() => {
    if (!selectElement) return;

    for (const option of selectElement.options) {
      if (!option.value) continue;
      const status = optionByRank.get(option.value);
      const disabled = !status?.legal;
      const label = disabled
        ? `${option.value}s — ${compactUnavailableLabel(status)}`
        : `${option.value}s`;
      if (option.disabled !== disabled) option.disabled = disabled;
      if (option.textContent !== label) option.textContent = label;
      option.title = status?.reason || "";
    }

    const advisor = selectElement.closest(".selection-advisor");
    const playButton = advisor
      ? [...advisor.children].find((child) => child.matches?.("button:not(.discard-button)"))
      : null;
    if (playButton) {
      const reason = selectedStatus && !selectedStatus.legal ? selectedStatus.reason : "";
      playButton.title = reason;
      playButton.setAttribute("aria-describedby", "wild-target-guidance");
    }
  }, [selectElement, optionByRank, selectedStatus]);

  if (!selectElement?.parentElement) return null;

  let guidance = "Choose a meld. Unavailable choices need more natural cards or have reached the wild-card limit.";
  let state = "choose";
  if (selectedStatus?.legal) {
    guidance = `Ready to play ${selectedWildCount === 1 ? "this wild card" : "these wild cards"} on ${selectedStatus.rank}s.`;
    state = "ready";
  } else if (selectedStatus) {
    guidance = selectedStatus.reason;
    state = "blocked";
  } else if (options.length > 0 && options.every((option) => !option.legal)) {
    guidance = "None of your current melds can accept another wild card yet.";
    state = "blocked";
  }

  return createPortal(
    <span id="wild-target-guidance" className={`wild-target-guidance ${state}`} aria-live="polite">
      {guidance}
    </span>,
    selectElement.parentElement,
  );
}
