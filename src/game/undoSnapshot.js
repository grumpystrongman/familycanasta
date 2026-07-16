function cleanCards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .filter((card) => card && typeof card === "object" && typeof card.id === "string")
    .map((card) => ({ ...card }));
}

export function cleanBoard(board) {
  if (!Array.isArray(board)) return [];
  return board
    .filter((meld) => meld && typeof meld === "object" && meld.rank !== undefined && meld.rank !== null)
    .map((meld) => ({
      ...meld,
      rank: String(meld.rank),
      cards: cleanCards(meld.cards),
    }));
}

function cleanTeamBoards(teamBoards) {
  return Object.fromEntries(
    Object.entries(teamBoards || {})
      .filter(([, board]) => Array.isArray(board))
      .map(([team, board]) => [team, cleanBoard(board)]),
  );
}

export function restoreUndoSnapshot(room, player, undo) {
  if (!room?.publicState || !player || !undo || !Array.isArray(undo.privateHand)) {
    throw new Error("The saved play cannot be undone safely.");
  }

  const team = Number(player.team);
  if (!Number.isInteger(team) || team < 0) {
    throw new Error("The saved play has an invalid team.");
  }

  const restoredHand = cleanCards(undo.privateHand);
  const restoredBoard = cleanBoard(undo.teamBoard);

  room.privateHands ||= {};
  room.publicState.teamBoards = cleanTeamBoards(room.publicState.teamBoards);
  room.publicState.teamMelds = cleanTeamBoards(room.publicState.teamMelds);
  room.publicState.opened ||= {};
  room.publicState.handCounts ||= {};

  room.privateHands[player.uid] = restoredHand;
  room.publicState.teamBoards[team] = restoredBoard;
  room.publicState.teamMelds[team] = cleanBoard(restoredBoard);
  room.publicState.opened[team] = Boolean(undo.opened);
  room.publicState.pendingDiscardPickup = undo.pendingDiscardPickup && typeof undo.pendingDiscardPickup === "object"
    ? structuredClone(undo.pendingDiscardPickup)
    : null;
  room.publicState.openingTurnUid = null;
  room.publicState.openingTurnPoints = 0;
  room.publicState.handCounts[player.uid] = restoredHand.length;
  room.publicState.lastAction = typeof undo.lastAction === "string" ? undo.lastAction : "";
  room.publicState.undoPlay = null;

  return room;
}
