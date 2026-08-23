import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, update } from "firebase/database";
import { ArrowDown, ArrowUp, RotateCw } from "lucide-react";
import { auth, db } from "./firebase";
import { TEAM_NAMES } from "./game/engine";
import { alternatingTeamOrder, boardKeeperRepairs, sortMembersBySeat } from "./game/seatOrder";

function roomCodeFromLobby() {
  const code = document.querySelector(".lobby-page .code b")?.textContent?.trim() || "";
  return /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

export default function SeatOrderEnhancer() {
  const [summaryTarget, setSummaryTarget] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [uid, setUid] = useState(auth?.currentUser?.uid || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const repairing = useRef(false);

  useEffect(() => {
    const locate = () => {
      setSummaryTarget(document.querySelector(".lobby-page .lobby-actions .summary"));
      setRoomCode(roomCodeFromLobby());
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!auth) return undefined;
    return onAuthStateChanged(auth, (user) => setUid(user?.uid || ""));
  }, []);

  useEffect(() => {
    if (!roomCode || !db) {
      setRoom(null);
      return undefined;
    }
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  const members = useMemo(
    () => sortMembersBySeat(Object.values(room?.members || {})),
    [room],
  );
  const teamCount = Number(room?.rules?.teamCount || 2);
  const playersPerTeam = Number(room?.rules?.playersPerTeam || 1);
  const isHost = Boolean(uid && room?.hostUid === uid && room?.status === "lobby");

  useEffect(() => {
    if (!isHost || !roomCode || !room || repairing.current) return;
    const repairs = boardKeeperRepairs(room);
    const entries = Object.entries(repairs);
    if (!entries.length) return;

    repairing.current = true;
    const updates = Object.fromEntries(
      entries.map(([team, keeperUid]) => [`teamBoardKeepers/${team}`, keeperUid]),
    );
    update(ref(db, `rooms/${roomCode}`), updates)
      .catch(() => {})
      .finally(() => {
        repairing.current = false;
      });
  }, [isHost, roomCode, room]);

  async function saveOrder(orderedUids) {
    if (!isHost || !roomCode || saving) return;
    setSaving(true);
    setError("");
    try {
      const snapshot = await get(ref(db, `rooms/${roomCode}`));
      if (!snapshot.exists()) throw new Error("Room not found.");
      const latest = snapshot.val();
      if (latest.status !== "lobby") throw new Error("Player order can only be changed before the game starts.");
      if (latest.hostUid !== uid) throw new Error("Only the host can change player order.");

      const latestIds = Object.keys(latest.members || {});
      const requested = [...orderedUids];
      if (
        latestIds.length !== requested.length ||
        new Set(requested).size !== requested.length ||
        latestIds.some((memberUid) => !requested.includes(memberUid))
      ) {
        throw new Error("The player list changed. Try the order again.");
      }

      const updates = {};
      requested.forEach((memberUid, index) => {
        updates[`members/${memberUid}/seat`] = index;
      });
      await update(ref(db, `rooms/${roomCode}`), updates);
    } catch (failure) {
      setError(failure.message || "Could not change player order.");
    } finally {
      setSaving(false);
    }
  }

  function moveMember(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= members.length) return;
    const orderedUids = members.map((member) => member.uid);
    [orderedUids[index], orderedUids[nextIndex]] = [orderedUids[nextIndex], orderedUids[index]];
    saveOrder(orderedUids);
  }

  function autoSeat() {
    saveOrder(alternatingTeamOrder(members, teamCount, playersPerTeam));
  }

  if (!summaryTarget || !room || room.status !== "lobby") return null;

  return createPortal(
    <div
      className="seat-order-enhancer"
      style={{
        borderTop: "1px solid #dfe6e2",
        marginTop: "14px",
        paddingTop: "14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
        <div>
          <b style={{ display: "block" }}>Clockwise play order</b>
          <small style={{ color: "#60716a" }}>Dealer rotates; the next seat after the dealer takes the first turn.</small>
        </div>
        {isHost && members.length > 1 ? (
          <button
            type="button"
            onClick={autoSeat}
            disabled={saving}
            title={playersPerTeam > 1 ? "Alternate teams around the table" : "Order players by team"}
            style={{
              border: "1px solid #cfd9d4",
              borderRadius: "9px",
              background: "white",
              color: "#15372d",
              padding: "7px 9px",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              fontWeight: 700,
            }}
          >
            <RotateCw size={14} />
            {playersPerTeam > 1 ? "Alternate teams" : "Order by team"}
          </button>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: "6px" }}>
        {members.map((member, index) => (
          <div
            key={member.uid}
            style={{
              display: "grid",
              gridTemplateColumns: isHost ? "28px minmax(0,1fr) auto" : "28px minmax(0,1fr)",
              gap: "8px",
              alignItems: "center",
              padding: "7px 8px",
              borderRadius: "10px",
              background: "#eef4f1",
            }}
          >
            <span
              aria-label={`Seat ${index + 1}`}
              style={{
                width: "24px",
                height: "24px",
                display: "grid",
                placeItems: "center",
                borderRadius: "999px",
                background: "#173c31",
                color: "white",
                fontSize: "11px",
                fontWeight: 800,
              }}
            >
              {index + 1}
            </span>
            <span style={{ minWidth: 0 }}>
              <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {member.nickname}{member.isRobot ? " 🤖" : ""}
              </b>
              <small style={{ color: "#60716a" }}>{TEAM_NAMES[Number(member.team)] || `Team ${Number(member.team) + 1}`}</small>
            </span>
            {isHost ? (
              <span style={{ display: "inline-flex", gap: "4px" }}>
                <button
                  type="button"
                  aria-label={`Move ${member.nickname} earlier`}
                  title="Move earlier"
                  disabled={saving || index === 0}
                  onClick={() => moveMember(index, -1)}
                  style={{ border: "1px solid #cfd9d4", borderRadius: "8px", background: "white", padding: "5px", display: "grid", placeItems: "center" }}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${member.nickname} later`}
                  title="Move later"
                  disabled={saving || index === members.length - 1}
                  onClick={() => moveMember(index, 1)}
                  style={{ border: "1px solid #cfd9d4", borderRadius: "8px", background: "white", padding: "5px", display: "grid", placeItems: "center" }}
                >
                  <ArrowDown size={14} />
                </button>
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <small style={{ display: "block", marginTop: "8px", color: "#60716a", lineHeight: 1.35 }}>
        {isHost ? "Use the arrows to arrange the table before starting. This order controls dealing, turns, dealer rotation, robots, and the player layout." : "The host can rearrange this order before the game starts."}
      </small>
      {error ? <small className="error" style={{ display: "block", marginTop: "8px" }}>{error}</small> : null}
    </div>,
    summaryTarget,
  );
}
