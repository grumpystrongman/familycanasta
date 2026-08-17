import {
  BLOOD_ALIBI_RULES,
  LOCATIONS,
  LOCATION_MAP,
  METHODS,
  START_SPACES,
  SUSPECTS,
  boardRoomId,
  getReachableBoardNodes,
  normalizeBoardPosition,
  roomNodeId,
} from "./boardModel.js";

export { BLOOD_ALIBI_RULES, BOARD_SIZE, CORRIDOR_SPACES, LOCATIONS, METHODS, SUSPECTS, boardRoomId, evidenceLabel, getReachableBoardNodes, normalizeBoardPosition, roomNodeId } from "./boardModel.js";

function shuffled(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
function pick(items) { return items[Math.floor(Math.random() * items.length)]; }
function cardId(kind, id) { return `${kind}:${id}`; }
function activePlayers(state, members) { return members.map((member,index) => ({member,index})).filter(({member}) => !state.eliminated?.[member.uid]); }
function nextActiveIndex(state, members, fromIndex) {
  for (let offset = 1; offset <= members.length; offset += 1) {
    const index = (fromIndex + offset) % members.length;
    if (members[index] && !state.eliminated?.[members[index].uid]) return index;
  }
  return -1;
}
function advanceTurn(state, members, currentIndex, message) {
  const nextIndex = nextActiveIndex(state, members, currentIndex);
  if (nextIndex < 0) return { ...state, phase:"game-over", winnerUid:null, message:"The case collapsed with nobody left to accuse." };
  return { ...state, currentPlayerIndex:nextIndex, turnPhase:"roll", moveRemaining:0, lastRoll:null, turnNumber:Number(state.turnNumber||1)+1, message:`${message} ${members[nextIndex].nickname}'s turn.` };
}
function dealEvidence(members, solution) {
  const cards = [
    ...SUSPECTS.filter((item) => item.id !== solution.suspectId).map((item) => cardId("suspect",item.id)),
    ...METHODS.filter((item) => item.id !== solution.methodId).map((item) => cardId("method",item.id)),
    ...LOCATIONS.filter((item) => item.id !== solution.locationId).map((item) => cardId("location",item.id)),
  ];
  const hands = Object.fromEntries(members.map((member) => [member.uid, []]));
  shuffled(cards).forEach((card,index) => hands[members[index % members.length].uid].push(card));
  return hands;
}
function validateChoice(action,key,collection,label) {
  const value = String(action?.[key] || "");
  if (!collection.some((item) => item.id === value)) throw new Error(`Choose a valid ${label}.`);
  return value;
}

export function createBloodAlibiGame(members) {
  if (members.length < BLOOD_ALIBI_RULES.playersMin || members.length > BLOOD_ALIBI_RULES.playersMax) throw new Error("Blood & Alibi supports two to six investigators.");
  const solution = { suspectId:pick(SUSPECTS).id, methodId:pick(METHODS).id, locationId:pick(LOCATIONS).id };
  return {
    phase:"playing", roundNumber:1, turnNumber:1, turnPhase:"roll", currentPlayerIndex:0,
    positions:Object.fromEntries(members.map((member,index) => [member.uid,START_SPACES[index % START_SPACES.length]])),
    hands:dealEvidence(members,solution), solution, eliminated:{}, reveals:[],
    suspectPositions:Object.fromEntries(SUSPECTS.map((suspect,index) => [suspect.id,LOCATIONS[index % LOCATIONS.length].id])),
    methodPositions:Object.fromEntries(METHODS.map((method,index) => [method.id,LOCATIONS[(index+3) % LOCATIONS.length].id])),
    moveRemaining:0, lastRoll:null,
    caseLog:[{type:"opening",text:"A body was found before dawn. One suspect, one method, one room form the hidden truth."}],
    winnerUid:null, message:`${members[0].nickname} has the first move. Roll the die and enter the hotel.`,
  };
}

export function reduceBloodAlibi(state, actorUid, action, members) {
  if (state.phase !== "playing") throw new Error("This case is already closed.");
  const currentIndex = Number(state.currentPlayerIndex || 0);
  const current = members[currentIndex];
  if (!current || current.uid !== actorUid) throw new Error("Wait for your turn.");
  if (state.eliminated?.[actorUid]) throw new Error("Your accusation was wrong; you can still hold evidence but no longer investigate.");
  const positions = { ...(state.positions || {}) };
  positions[actorUid] = normalizeBoardPosition(positions[actorUid], current.seat);
  const caseLog = Array.isArray(state.caseLog) ? [...state.caseLog] : [];
  const reveals = Array.isArray(state.reveals) ? [...state.reveals] : [];
  const currentRoomId = boardRoomId(positions[actorUid]);

  if (state.turnPhase === "roll") {
    if (action?.type === "passage") {
      if (!currentRoomId) throw new Error("You must be in a room with a secret passage.");
      const destination = LOCATION_MAP[currentRoomId]?.passageTo;
      if (!destination) throw new Error("There is no secret passage from this room.");
      positions[actorUid] = roomNodeId(destination);
      caseLog.push({ type:"passage", uid:actorUid, text:`${current.nickname} slipped through a secret passage into ${LOCATION_MAP[destination].name}.` });
      return { ...state, positions, caseLog:caseLog.slice(-50), turnPhase:"investigate", lastRoll:null, moveRemaining:0, message:`${current.nickname} emerged in ${LOCATION_MAP[destination].name}. Build a theory or accuse.` };
    }
    if (action?.type === "investigateHere") {
      if (!currentRoomId) throw new Error("You must be inside a room to investigate without moving.");
      return { ...state, positions, turnPhase:"investigate", lastRoll:null, moveRemaining:0, message:`${current.nickname} stayed in ${LOCATION_MAP[currentRoomId].name} to question the scene.` };
    }
    if (action?.type !== "roll") throw new Error("Roll the die, use a secret passage, or investigate the room you are already in.");
    const roll = 1 + Math.floor(Math.random() * 6);
    caseLog.push({ type:"roll", uid:actorUid, text:`${current.nickname} rolled ${roll}.` });
    const rolled = { ...state, positions, caseLog:caseLog.slice(-50), turnPhase:"move", lastRoll:roll, moveRemaining:roll, message:`${current.nickname} rolled ${roll}. Move up to ${roll} spaces; entering a room ends movement.` };
    return getReachableBoardNodes(rolled,actorUid,members).length ? rolled : advanceTurn(rolled,members,currentIndex,`${current.nickname} had no open path.`);
  }

  if (state.turnPhase === "move") {
    if (action?.type === "endMove") {
      caseLog.push({type:"move",uid:actorUid,text:`${current.nickname} stopped in the corridor.`});
      return advanceTurn({ ...state,positions,caseLog:caseLog.slice(-50)},members,currentIndex,`${current.nickname} ended movement without entering a room.`);
    }
    if (action?.type !== "move") throw new Error("Choose a highlighted board space or end movement.");
    const targetNodeId = String(action.nodeId || "");
    const target = getReachableBoardNodes({ ...state,positions },actorUid,members).find((item) => item.id === targetNodeId);
    if (!target) throw new Error("That board space is not reachable with the movement you have left.");
    positions[actorUid] = targetNodeId;
    const remaining = Math.max(0,Number(state.moveRemaining || 0) - target.distance);
    const roomId = boardRoomId(targetNodeId);
    if (roomId) {
      caseLog.push({type:"move",uid:actorUid,text:`${current.nickname} entered ${LOCATION_MAP[roomId].name}.`});
      return { ...state,positions,caseLog:caseLog.slice(-50),turnPhase:"investigate",moveRemaining:0,message:`${current.nickname} entered ${LOCATION_MAP[roomId].name}. Test a theory, accuse, or end the turn.` };
    }
    caseLog.push({type:"move",uid:actorUid,text:`${current.nickname} moved ${target.distance} space${target.distance===1?"":"s"}.`});
    if (remaining <= 0) return advanceTurn({ ...state,positions,caseLog:caseLog.slice(-50),moveRemaining:0 },members,currentIndex,`${current.nickname} ended movement in the corridor.`);
    return { ...state,positions,caseLog:caseLog.slice(-50),moveRemaining:remaining,message:`${current.nickname} has ${remaining} move${remaining===1?"":"s"} left.` };
  }

  if (state.turnPhase !== "investigate") throw new Error("The case is between turns.");
  const investigationRoomId = boardRoomId(positions[actorUid]);
  if (action?.type === "suggest") {
    if (!investigationRoomId) throw new Error("Enter a room before testing a theory.");
    const suspectId = validateChoice(action,"suspectId",SUSPECTS,"suspect");
    const methodId = validateChoice(action,"methodId",METHODS,"method");
    const candidates = [cardId("suspect",suspectId),cardId("method",methodId),cardId("location",investigationRoomId)];
    const suspectPositions = { ...(state.suspectPositions||{}), [suspectId]:investigationRoomId };
    const methodPositions = { ...(state.methodPositions||{}), [methodId]:investigationRoomId };
    let refuter=null, shownCard=null;
    for (let offset=1; offset<members.length; offset+=1) {
      const candidate = members[(currentIndex+offset)%members.length];
      const matches = (state.hands?.[candidate.uid]||[]).filter((card)=>candidates.includes(card)).sort();
      if (matches.length) { refuter=candidate; shownCard=matches[0]; break; }
    }
    if (refuter) {
      reveals.push({toUid:actorUid,fromUid:refuter.uid,cardId:shownCard,turn:state.turnNumber});
      caseLog.push({type:"suggestion",uid:actorUid,text:`${current.nickname} placed ${SUSPECTS.find((x)=>x.id===suspectId)?.name} in ${LOCATION_MAP[investigationRoomId].name} with ${METHODS.find((x)=>x.id===methodId)?.name}; ${refuter.nickname} refuted it.`});
      return advanceTurn({ ...state,positions,suspectPositions,methodPositions,reveals:reveals.slice(-80),caseLog:caseLog.slice(-50)},members,currentIndex,`${refuter.nickname} produced an alibi card.`);
    }
    caseLog.push({type:"suggestion",uid:actorUid,text:`${current.nickname}'s theory in ${LOCATION_MAP[investigationRoomId].name} could not be refuted.`});
    return advanceTurn({ ...state,positions,suspectPositions,methodPositions,reveals:reveals.slice(-80),caseLog:caseLog.slice(-50)},members,currentIndex,"Nobody at the table could refute the theory.");
  }

  if (action?.type === "accuse") {
    const suspectId=validateChoice(action,"suspectId",SUSPECTS,"suspect"), methodId=validateChoice(action,"methodId",METHODS,"method"), locationId=validateChoice(action,"locationId",LOCATIONS,"location");
    const solution=state.solution||{};
    if (suspectId===solution.suspectId && methodId===solution.methodId && locationId===solution.locationId) {
      caseLog.push({type:"accusation",uid:actorUid,text:`${current.nickname} named the killer, method, and scene correctly.`});
      return { ...state,positions,phase:"game-over",winnerUid:actorUid,caseLog:caseLog.slice(-50),message:`${current.nickname} solved the murder.` };
    }
    const eliminated={...(state.eliminated||{}),[actorUid]:true};
    caseLog.push({type:"accusation",uid:actorUid,text:`${current.nickname} made a final accusation and got it wrong.`});
    const remaining=activePlayers({...state,eliminated},members);
    if (remaining.length===1) return { ...state,positions,phase:"game-over",eliminated,winnerUid:remaining[0].member.uid,caseLog:caseLog.slice(-50),message:`${current.nickname}'s accusation failed. ${remaining[0].member.nickname} is the last investigator standing.` };
    return advanceTurn({ ...state,positions,eliminated,caseLog:caseLog.slice(-50)},members,currentIndex,`${current.nickname} is out of the investigation after a false accusation.`);
  }

  if (action?.type === "end") {
    caseLog.push({type:"end",uid:actorUid,text:`${current.nickname} ended the turn without naming a theory.`});
    return advanceTurn({ ...state,positions,caseLog:caseLog.slice(-50)},members,currentIndex,`${current.nickname} kept the theory off the record.`);
  }
  throw new Error("Make a theory, accuse, or end the turn.");
}

export function chooseBloodAlibiRobotMove(state,members) {
  if (state?.phase !== "playing") return null;
  const current=members[Number(state.currentPlayerIndex||0)];
  if (!current?.isRobot || state.eliminated?.[current.uid]) return null;
  const roomId=boardRoomId(normalizeBoardPosition(state.positions?.[current.uid],current.seat));
  if (state.turnPhase==="roll") {
    if (roomId && LOCATION_MAP[roomId]?.passageTo && Number(state.turnNumber||0)%5===0) return {uid:current.uid,action:{type:"passage"},key:`${state.turnNumber}:${current.uid}:passage:${roomId}`};
    return {uid:current.uid,action:{type:"roll"},key:`${state.turnNumber}:${current.uid}:roll`};
  }
  if (state.turnPhase==="move") {
    const reachable=getReachableBoardNodes(state,current.uid,members), rooms=reachable.filter((item)=>item.roomId), choices=rooms.length?rooms:reachable;
    if (!choices.length) return {uid:current.uid,action:{type:"endMove"},key:`${state.turnNumber}:${current.uid}:endMove`};
    const target=[...choices].sort((a,b)=>b.distance-a.distance||a.id.localeCompare(b.id))[(Number(state.turnNumber||1)+Number(current.seat||0))%choices.length];
    return {uid:current.uid,action:{type:"move",nodeId:target.id},key:`${state.turnNumber}:${current.uid}:move:${state.moveRemaining}:${target.id}`};
  }
  if (state.turnPhase==="investigate") {
    if (!roomId) return {uid:current.uid,action:{type:"end"},key:`${state.turnNumber}:${current.uid}:end`};
    const suspect=SUSPECTS[(Number(state.turnNumber||1)+1)%SUSPECTS.length], method=METHODS[(Number(state.turnNumber||1)+2)%METHODS.length];
    return {uid:current.uid,action:{type:"suggest",suspectId:suspect.id,methodId:method.id},key:`${state.turnNumber}:${current.uid}:suggest:${suspect.id}:${method.id}:${roomId}`};
  }
  return null;
}
