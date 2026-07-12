import React, { useEffect, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import { auth, db } from "./firebase";
import { cardPoints, isWild } from "./game/engine";

function calculateTeam(room, team) {
  const melds = room?.publicState?.teamBoards?.[team] || [];
  const cards = melds.flatMap((meld) => meld.cards || []);
  const cardCount = cards.length;
  const cardPointTotal = cards.reduce((sum, card) => sum + cardPoints(card), 0);

  let cleanBooks = 0;
  let dirtyBooks = 0;
  for (const meld of melds) {
    if ((meld.cards || []).length < 7) continue;
    if ((meld.cards || []).some(isWild)) dirtyBooks += 1;
    else cleanBooks += 1;
  }

  const redThreeCount = Object.entries(room?.publicState?.redThrees || {})
    .filter(([uid]) => Number(room?.members?.[uid]?.team) === Number(team))
    .flatMap(([, redThrees]) => redThrees || [])
    .filter((card) => card.rank === "3" && (card.suit === "H" || card.suit === "D"))
    .length;

  const protectedByBook = cleanBooks + dirtyBooks > 0;
  const unprotectedPenalty = Boolean(room?.rules?.unprotectedRedThreesPenalty) && !protectedByBook;
  const redThreePoints = unprotectedPenalty ? redThreeCount * -200 : redThreeCount * 100;
  const bookPoints = cleanBooks * 500 + dirtyBooks * 300;

  return {
    cardCount,
    cardPointTotal,
    cleanBooks,
    dirtyBooks,
    redThreeCount,
    redThreePoints,
    currentBoard: cardPointTotal + bookPoints + redThreePoints,
  };
}

function setTextIfChanged(node, value) {
  if (!node) return;
  const next = String(value);
  if (node.textContent !== next) node.textContent = next;
}

export default function ScoringDisplayFix() {
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);

  useEffect(() => {
    const locate = () => {
      const code = document.querySelector(".code b")?.textContent?.trim() || "";
      if (/^[A-Z0-9]{6}$/.test(code)) setRoomCode(code);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!roomCode || !db) return undefined;
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  useEffect(() => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !roomCode || !room || room.hostUid !== uid) return;
    const needsCorrection = Number(room.rules?.redThreeBonus) !== 100
      || Number(room.rules?.unprotectedRedThreePenalty) !== 200
      || room.rules?.freezeOnBlackThree !== false;
    if (!needsCorrection) return;
    update(ref(db, `rooms/${roomCode}/rules`), {
      redThreeBonus: 100,
      unprotectedRedThreePenalty: 200,
      freezeOnBlackThree: false,
    }).catch(() => {});
  }, [roomCode, room]);

  useEffect(() => {
    if (!room) return undefined;

    const apply = () => {
      const scoreCards = [...document.querySelectorAll(".score-team-card")];
      scoreCards.forEach((scoreCard, team) => {
        const score = calculateTeam(room, team);
        const rows = scoreCard.querySelectorAll(".score-lines > span");
        if (rows[0]) {
          setTextIfChanged(rows[0].querySelector("i"), "Current board points");
          setTextIfChanged(rows[0].querySelector("b"), score.currentBoard);
        }
        if (rows[1]) {
          setTextIfChanged(rows[1].querySelector("i"), "Cards on board");
          setTextIfChanged(rows[1].querySelector("b"), score.cardCount);
        }
        if (rows[4]) {
          setTextIfChanged(rows[4].querySelector("i"), "Red threes");
          setTextIfChanged(rows[4].querySelector("b"), `${score.redThreeCount} · ${score.redThreePoints}`);
        }
      });

      [...document.querySelectorAll(".shared-board")].forEach((board, team) => {
        const score = calculateTeam(room, team);
        setTextIfChanged(board.querySelector(".board-title strong"), `${score.currentBoard} pts on board`);
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [room]);

  return null;
}
