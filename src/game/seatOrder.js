export function sortMembersBySeat(members = []) {
  return [...members].sort((a, b) => {
    const aSeat = Number.isFinite(Number(a?.seat)) ? Number(a.seat) : Number.MAX_SAFE_INTEGER;
    const bSeat = Number.isFinite(Number(b?.seat)) ? Number(b.seat) : Number.MAX_SAFE_INTEGER;
    if (aSeat !== bSeat) return aSeat - bSeat;

    const aJoined = Number(a?.joinedAt || 0);
    const bJoined = Number(b?.joinedAt || 0);
    if (aJoined !== bJoined) return aJoined - bJoined;

    return String(a?.uid || "").localeCompare(String(b?.uid || ""));
  });
}

export function alternatingTeamOrder(members = [], teamCount = 2, playersPerTeam = 1) {
  const ordered = sortMembersBySeat(members);
  const normalizedTeamCount = Math.max(1, Number(teamCount) || 1);
  const normalizedPlayersPerTeam = Math.max(1, Number(playersPerTeam) || 1);
  const byTeam = Array.from({ length: normalizedTeamCount }, (_, team) =>
    ordered.filter((member) => Number(member?.team) === team),
  );

  const result = [];
  for (let partnerIndex = 0; partnerIndex < normalizedPlayersPerTeam; partnerIndex += 1) {
    for (let team = 0; team < normalizedTeamCount; team += 1) {
      const member = byTeam[team][partnerIndex];
      if (member) result.push(member.uid);
    }
  }

  const included = new Set(result);
  for (const member of ordered) {
    if (!included.has(member.uid)) result.push(member.uid);
  }

  return result;
}

export function boardKeeperRepairs(room) {
  const repairs = {};
  if (!room) return repairs;

  const members = sortMembersBySeat(Object.values(room.members || {}));
  const teamCount = Math.max(1, Number(room.rules?.teamCount || 2));

  for (let team = 0; team < teamCount; team += 1) {
    const keeperUid = room.teamBoardKeepers?.[team];
    const keeper = keeperUid ? room.members?.[keeperUid] : null;
    const keeperIsValid = Boolean(keeper && Number(keeper.team) === team);
    if (keeperIsValid) continue;

    const replacement = members.find((member) => Number(member.team) === team);
    if (replacement) repairs[team] = replacement.uid;
  }

  return repairs;
}
