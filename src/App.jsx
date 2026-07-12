import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Check,
  Copy,
  Crown,
  Hand,
  LayoutGrid,
  LayoutPanelTop,
  List,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Send,
  Settings,
  Shuffle,
  Trash2,
  UserRound,
  Video,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { ensureAnonymousAuth, firebaseMissing, firebaseReady } from "./firebase";
import {
  addRobot,
  advanceDealAnimation,
  createRoom,
  joinRoom,
  leaveRoom,
  removeRobot,
  reconnectMember,
  runRobotTurn,
  sendMessage,
  setTeamBoardKeeper,
  startOnlineGame,
  updateMember,
  watchPrivateHand,
  watchRoom,
} from "./services/roomService";
import {
  approveGoOut,
  cancelGoOutRequest,
  discardSelectedCard,
  drawFromStock,
  meldSelectedCards,
  requestGoOut,
  takeDiscardPile,
} from "./game/humanActions";
import {
  cardPoints,
  DEFAULT_RULES,
  isRedThree,
  isWild,
  openingRequirementForTeam,
  scoreTeamBoard,
  sortHand,
  SUIT_SYMBOLS,
  TEAM_NAMES,
  teamSeatTargets,
} from "./game/engine";
import { goOutRequirementStatus } from "./game/houseRules";

const AVATARS = ["🦊","🐻","🦉","🐙","🦁","🐼","🐯","🦄","🐸","🤠"];
const BACKS = ["midnight","emerald","ruby","royal","sunset","linen"];
const SUIT_ORDER = ["S", "H", "D", "C", "J"];
const PIPS = {
  A:[[50,50]], 2:[[50,22],[50,78]], 3:[[50,20],[50,50],[50,80]],
  4:[[28,25],[72,25],[28,75],[72,75]],
  5:[[28,22],[72,22],[50,50],[28,78],[72,78]],
  6:[[28,20],[72,20],[28,50],[72,50],[28,80],[72,80]],
  7:[[28,18],[72,18],[50,35],[28,52],[72,52],[28,82],[72,82]],
  8:[[28,17],[72,17],[50,32],[28,48],[72,48],[50,64],[28,83],[72,83]],
  9:[[28,16],[72,16],[28,36],[72,36],[50,50],[28,64],[72,64],[28,84],[72,84]],
  10:[[28,13],[72,13],[50,27],[28,37],[72,37],[28,63],[72,63],[50,73],[28,87],[72,87]],
};

function teamName(team) {
  return TEAM_NAMES[team] || `Team ${Number(team) + 1}`;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

function sortCardsBySuit(cards) {
  return [...cards].sort((a, b) => {
    const suit = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit);
    if (suit) return suit;
    return sortHand([a, b])[0]?.id === a.id ? -1 : 1;
  });
}

function handleCardKeyDown(event, onMove) {
  if (!onMove) return;
  const offsets = { ArrowLeft: -1, ArrowRight: 1 };
  const offset = offsets[event.key];
  if (!offset) return;
  event.preventDefault();
  onMove(offset);
}

function buildCardInteractionProps({ card, selected, onClick, onInspect, onMove, reduceMotion, timerRef }) {
  if (!onClick && !onMove && !onInspect) return {};
  const clearLongPress = () => window.clearTimeout(timerRef.current);
  const startLongPress = () => {
    clearLongPress();
    if (onInspect) timerRef.current = window.setTimeout(() => onInspect(card), 550);
  };
  const inspectCard = () => onInspect?.(card);
  return {
    type: "button",
    onClick: onClick || inspectCard,
    onPointerDown: startLongPress,
    onPointerUp: clearLongPress,
    onPointerCancel: clearLongPress,
    onPointerLeave: clearLongPress,
    onContextMenu: (event) => {
      if (!onInspect) return;
      event.preventDefault();
      inspectCard();
    },
    onKeyDown: (event) => handleCardKeyDown(event, onMove),
    whileTap: reduceMotion ? undefined : { scale: 0.97 },
    "aria-pressed": onClick || onMove ? selected : undefined,
    "aria-label": `${card.rank} ${SUIT_SYMBOLS[card.suit] || "★"}${selected ? ", selected" : ""}`,
  };
}

function CardArtwork({ card, suit }) {
  if (card.rank === "JOKER") {
    return <div className="joker-art"><span>★</span><b>JOKER</b></div>;
  }
  if (["J", "Q", "K"].includes(card.rank)) {
    return <div className="court-art"><span>{suit}</span><b>{card.rank}</b><span>{suit}</span></div>;
  }
  return (
    <div className="pip-field">
      {(PIPS[card.rank] || [[50,50]]).map(([x,y], index) => (
        <span key={index} style={{ left:`${x}%`, top:`${y}%` }}>{suit}</span>
      ))}
    </div>
  );
}

function CardFace({
  card,
  selected = false,
  onClick,
  onInspect,
  onMove,
  compact = false,
  dragProps = {},
}) {
  const suit = SUIT_SYMBOLS[card.suit] || "★";
  const timerRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const interactionProps = buildCardInteractionProps({
    card,
    selected,
    onClick,
    onInspect,
    onMove,
    reduceMotion,
    timerRef,
  });
  const CardElement = Object.keys(interactionProps).length ? motion.button : motion.div;
  const rankLabel = card.rank === "JOKER" ? "JK" : card.rank;
  const colorClass = card.color === "red" ? "red" : "black";
  const selectedClass = selected ? "selected" : "";
  const compactClass = compact ? "compact" : "";

  return (
    <CardElement
      {...interactionProps}
      className={`real-card ${colorClass} ${selectedClass} ${compactClass}`}
      {...dragProps}
    >
      <span className="card-corner top"><b>{rankLabel}</b><i>{suit}</i></span>
      <CardArtwork card={card} suit={suit}/>
      <span className="card-corner bottom"><b>{rankLabel}</b><i>{suit}</i></span>
    </CardElement>
  );
}

function TurnProgress({ turnPhase, activeName }) {
  const drawDone = turnPhase !== "draw";
  return (
    <div className="turn-progress" aria-label={`Turn progress for ${activeName || "current player"}`}>
      <span className={turnPhase === "draw" ? "current" : "done"}><i>1</i><b>Draw</b></span>
      <span className={drawDone ? "current" : ""}><i>2</i><b>Meld or play</b></span>
      <span className={drawDone ? "available" : ""}><i>3</i><b>Discard</b></span>
    </div>
  );
}

function TeamScoreCard({ room, team, members, onOpen }) {
  const breakdown = scoreTeamBoard(room, team, null);
  const total = Number(room.publicState?.teamScores?.[team] || 0);
  const opened = Boolean(room.publicState?.opened?.[team]);
  const meldNeed = openingRequirementForTeam(room, team);
  const goOutStatus = goOutRequirementStatus(room, team);
  const eligible = goOutStatus.eligible;
  const teamMembers = members.filter((member) => Number(member.team) === Number(team));
  return (
    <article className="score-team-card">
      <div className="score-team-head">
        <div><small>TEAM</small><b>{teamName(team)}</b></div>
        <strong>{total.toLocaleString()}</strong>
      </div>
      <div className="score-lines">
        <span><i>Current board</i><b>{breakdown.boardCardPoints + breakdown.canastaBonus + breakdown.redThreePoints}</b></span>
        <span><i>Cards played</i><b>{breakdown.boardCardPoints}</b></span>
        <span><i>Clean canastas</i><b>{breakdown.cleanCanastas} · {breakdown.cleanCanastas * 500}</b></span>
        <span><i>Mixed canastas</i><b>{breakdown.dirtyCanastas} · {breakdown.dirtyCanastas * 300}</b></span>
        <span><i>Red threes</i><b>{breakdown.redThreeCount} · {breakdown.redThreePoints}</b></span>
        <span><i>Cards remaining</i><b>{teamMembers.reduce((sum, member) => sum + Number(room.publicState?.handCounts?.[member.uid] || 0), 0)}</b></span>
      </div>
      <div className={`meld-requirement ${opened ? "met" : ""}`}>
        {opened ? "Opening meld completed" : `Opening meld required: ${meldNeed} points`}
      </div>
      <div className={`go-out-status ${eligible ? "eligible" : "blocked"}`}>
        {eligible ? "Eligible to go out" : goOutStatus.message}
      </div>
      {onOpen && <button className="text-button" onClick={() => onOpen({ type:"team", team })}>View team details</button>}
    </article>
  );
}

function cardDescription(card) {
  if (isWild(card)) return "Wild card";
  if (isRedThree(card)) return "Red three";
  return `${cardPoints(card)} points`;
}

function meldStatus(meld) {
  if ((meld?.cards?.length || 0) < 7) return "In progress";
  return meld.cards.some(isWild) ? "Mixed canasta" : "Natural canasta";
}

function buildCardDetail(detail) {
  const card = detail.card;
  return {
    title: `${card.rank} ${SUIT_SYMBOLS[card.suit] || "★"}`,
    body: <div className="card-detail"><CardFace card={card}/><p>{cardDescription(card)}</p></div>,
  };
}

function buildDiscardDetail(_detail, room) {
  const cards = [...(room.publicState?.discardPile || [])].slice(-10).reverse();
  return {
    title: "Recent discard pile",
    body: <div className="detail-card-grid">{cards.map((card) => <CardFace card={card} compact key={card.id}/>)}</div>,
  };
}

function buildMeldDetail(detail, room) {
  const meld = room.publicState?.teamBoards?.[detail.team]?.[detail.index];
  if (!meld) return { title: "Meld details", body: <p>This meld is no longer available.</p> };
  return {
    title: `${teamName(detail.team)} ${meld.rank || ""} meld`,
    body: (
      <>
        <p>{meld.cards?.length || 0} cards · {meldStatus(meld)}</p>
        <div className="detail-card-grid">{(meld.cards || []).map((card) => <CardFace card={card} compact key={card.id}/>)}</div>
      </>
    ),
  };
}

function buildPlayerDetail(detail, room, members) {
  const member = members.find((item) => item.uid === detail.uid);
  if (!member) return { title: "Player", body: <p>This player is no longer at the table.</p> };
  const breakdown = scoreTeamBoard(room, member.team, null);
  const connection = member.connected === false ? "Disconnected" : "Connected";
  return {
    title: member.nickname,
    body: (
      <div className="detail-facts">
        <p><span>Team</span><b>{teamName(member.team)}</b></p>
        <p><span>Cards in hand</span><b>{room.publicState?.handCounts?.[member.uid] || 0}</b></p>
        <p><span>Connection</span><b>{connection}</b></p>
        <p><span>Canastas</span><b>{breakdown.cleanCanastas + breakdown.dirtyCanastas}</b></p>
        <p><span>Team meld points</span><b>{breakdown.boardCardPoints}</b></p>
        <p><span>Red threes</span><b>{room.publicState?.redThrees?.[member.uid]?.length || 0}</b></p>
      </div>
    ),
  };
}

function buildTeamDetail(detail, room, members) {
  const team = Number(detail.team);
  const breakdown = scoreTeamBoard(room, team, null);
  const teamMembers = members.filter((member) => Number(member.team) === team);
  const eligibility = goOutRequirementStatus(room, team).eligible ? "Eligible" : "Not eligible";
  return {
    title: teamName(team),
    body: (
      <>
        <div className="detail-facts">
          <p><span>Members</span><b>{teamMembers.map((member) => member.nickname).join(", ")}</b></p>
          <p><span>Total score</span><b>{Number(room.publicState?.teamScores?.[team] || 0).toLocaleString()}</b></p>
          <p><span>Meld points</span><b>{breakdown.boardCardPoints}</b></p>
          <p><span>Canastas</span><b>{breakdown.cleanCanastas + breakdown.dirtyCanastas}</b></p>
          <p><span>Red threes</span><b>{breakdown.redThreeCount}</b></p>
          <p><span>Going out</span><b>{eligibility}</b></p>
        </div>
        <div className="detail-meld-list">
          {(room.publicState?.teamBoards?.[team] || []).map((meld, index) => (
            <section key={`${meld.rank}-${index}`}>
              <h3>{meld.rank}s · {meld.cards?.length || 0} cards</h3>
              <div className="detail-card-grid">{(meld.cards || []).map((card) => <CardFace card={card} compact key={card.id}/>)}</div>
            </section>
          ))}
        </div>
      </>
    ),
  };
}

const DETAIL_BUILDERS = {
  card: buildCardDetail,
  discard: buildDiscardDetail,
  meld: buildMeldDetail,
  player: buildPlayerDetail,
  team: buildTeamDetail,
};

function detailContent(detail, room, members) {
  const builder = DETAIL_BUILDERS[detail.type];
  if (!builder) return { title: "Details", body: null };
  return builder(detail, room, members);
}

function DetailDialog({ detail, room, members, onClose }) {
  if (!detail) return null;
  const { title, body } = detailContent(detail, room, members);
  return (
    <div className="dialog-backdrop">
      <dialog open className="detail-dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close details"><X/></button></header>
        <div className="detail-dialog-body">{body}</div>
      </dialog>
    </div>
  );
}

function reportAsyncError(operation, setError) {
  operation.catch((error_) => setError(error_.message));
}

function memberConnectionLabel(member) {
  if (member.isRobot) return "Robot";
  if (member.connected === false) return "Disconnected";
  return "Connected";
}

function getDrawReason({ isMyTurn, turnPhase, stockCount }) {
  if (!isMyTurn) return "Wait for your turn.";
  if (turnPhase !== "draw") return "You already drew this turn.";
  if (!stockCount) return "The stock is empty.";
  return "Draw cards from the stock.";
}

function getPileReason({ isMyTurn, turnPhase, discardCount, discardFrozen }) {
  if (!isMyTurn) return "Wait for your turn.";
  if (turnPhase !== "draw") return "You already drew this turn.";
  if (!discardCount) return "The discard pile is empty.";
  if (discardFrozen) return "The pile is frozen. You need the required natural matches to take it.";
  return "Take the discard pile if your hand can legally use the top card.";
}

function getMeldReason({ canSelectCards, turnPhase, selectedCount, selectionLegal, requirementMet, openingNeed }) {
  if (!canSelectCards) return turnPhase === "draw" ? "Draw first." : "Wait for your turn.";
  if (!selectedCount) return "Select cards to meld.";
  if (!selectionLegal) return "Select matching natural ranks; wild cards cannot outnumber natural cards.";
  if (!requirementMet) return `Your opening needs ${openingNeed} points.`;
  return "Play the selected cards.";
}

function getDiscardReason({ canSelectCards, turnPhase, selectedCards }) {
  if (!canSelectCards) return turnPhase === "draw" ? "Draw first." : "Wait for your turn.";
  if (selectedCards.length !== 1) return "Select exactly one card to discard.";
  if (isRedThree(selectedCards[0])) return "Red threes are played automatically.";
  return "Discard the selected card and end your turn.";
}

function getTurnInstruction({ phase, isMyTurn, activeName, turnPhase, pendingPickup, myUid, selectedCount, selectionLegal, requirementMet, openingNeed }) {
  if (phase === "dealing") return "Cards are being dealt.";
  if (!isMyTurn) return `Wait for ${activeName || "the current player"} to finish.`;
  if (turnPhase === "draw") return "Draw from the stock or take the discard pile.";
  if (pendingPickup?.uid === myUid) return `Complete your opening with the picked-up ${pendingPickup.rank}.`;
  if (!selectedCount) return "Play cards if you can, then discard one card to end your turn.";
  if (!selectionLegal) return "Adjust the selected cards to make a legal meld.";
  if (!requirementMet) return `Your team needs ${openingNeed} opening points.`;
  return "Your selected play is legal. Meld it or select one card to discard.";
}

function getTurnHeading({ phase, isMyTurn, turnPhase, activeName }) {
  if (phase === "dealing") return "Dealing cards…";
  if (!isMyTurn) return `${activeName || "Player"}'s turn`;
  if (turnPhase === "draw") return "YOUR TURN — DRAW";
  return "YOUR TURN — PLAY OR DISCARD";
}

function getPlayerTurnState({ isActive, turnPhase, drawn, discarded }) {
  if (!isActive) return discarded ? "Last discarded" : "Waiting";
  if (turnPhase === "draw") return "Must draw";
  if (drawn) return "Drawn · must play/discard";
  return "Playing";
}

function meldCanastaSummary(meld) {
  if ((meld.cards?.length || 0) < 7) return "";
  const kind = meld.cards.some(isWild) ? "MIXED" : "NATURAL";
  return `· ${kind} CANASTA`;
}

function MeldCards({ meld, expanded }) {
  if (expanded) {
    return <div>{(meld.cards || []).map((card) => <CardFace card={card} compact key={card.id}/>)}</div>;
  }
  return <div className="meld-mini-stack">{(meld.cards || []).slice(0,3).map((card) => <span className={`mini-card ${card.color}`} key={card.id}>{card.rank}</span>)}</div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const savedRoomCode = localStorage.getItem("canastaRoomCode") || "";
  const [screen, setScreen] = useState(savedRoomCode ? "lobby" : "home");
  const [nickname, setNickname] = useState(localStorage.getItem("canastaNickname") || "Jeff");
  const [avatar, setAvatar] = useState(localStorage.getItem("canastaAvatar") || "🦊");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState(savedRoomCode);
  const [room, setRoom] = useState(null);
  const [privateHand, setPrivateHand] = useState([]);
  const [selected, setSelected] = useState([]);
  const [targetRank, setTargetRank] = useState("");
  const [handOrder, setHandOrder] = useState([]);
  const [handSort, setHandSort] = useState("rank");
  const [message, setMessage] = useState("");
  const [chatScope, setChatScope] = useState("table");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("score");
  const [mobileView, setMobileView] = useState("hand");
  const [boardMode, setBoardMode] = useState("full");
  const [expandedTeams, setExpandedTeams] = useState({});
  const [detail, setDetail] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionPanelOpen, setActionPanelOpen] = useState(false);
  const [lastReadMessageCount, setLastReadMessageCount] = useState(0);
  const [rules, setRules] = useState({ ...DEFAULT_RULES, cardBack:"midnight" });
  const [meetLink, setMeetLink] = useState("");
  const robotTimer = useRef(null);
  const robotTurnKey = useRef("");
  const touchStartY = useRef(null);
  const isPhone = useMediaQuery("(max-width: 760px)");
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (firebaseReady) ensureAnonymousAuth().then(setUser).catch((event) => setError(event.message));
  }, []);

  useEffect(() => {
    if (!roomCode) return undefined;
    return watchRoom(roomCode, (value) => {
      setRoom(value);
      if (!value) {
        setScreen("home");
        setRoomCode("");
        localStorage.removeItem("canastaRoomCode");
      }
    });
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !user) return undefined;
    reconnectMember(roomCode, user.uid).catch(() => {});
    return watchPrivateHand(roomCode, user.uid, setPrivateHand);
  }, [roomCode, user]);

  useEffect(() => {
    setHandOrder((current) => {
      const available = new Set(privateHand.map((card) => card.id));
      const retained = current.filter((id) => available.has(id));
      const sorted = handSort === "suit" ? sortCardsBySuit(privateHand) : sortHand(privateHand);
      const missing = sorted.map((card) => card.id).filter((id) => !retained.includes(id));
      return [...retained, ...missing];
    });
    setSelected((current) => current.filter((id) => privateHand.some((card) => card.id === id)));
  }, [privateHand, handSort]);

  const members = useMemo(
    () => Object.values(room?.members || {}).sort((a,b) => a.seat - b.seat),
    [room],
  );
  const teamCount = Number(room?.rules?.teamCount || rules.teamCount || 2);
  const totalPlayers = Number(room?.rules?.totalPlayers || rules.totalPlayers || 2);
  const capacities = useMemo(() => teamSeatTargets(totalPlayers, teamCount), [totalPlayers, teamCount]);
  const teams = useMemo(
    () => Array.from({ length:teamCount }, (_, team) => members.filter((member) => Number(member.team) === team)),
    [members, teamCount],
  );
  const me = room?.members?.[user?.uid];
  const activeIndex = Number(room?.publicState?.currentPlayerIndex || 0);
  const active = members[activeIndex];
  const nextPlayer = members.length ? members[(activeIndex + 1) % members.length] : null;
  const isMyTurn = active?.uid === user?.uid;
  const turnPhase = room?.publicState?.turnPhase || "draw";
  const canSelectCards = Boolean(isMyTurn && room?.publicState?.phase === "playing" && turnPhase !== "draw" && !busy);
  const orderedHand = handOrder.map((id) => privateHand.find((card) => card.id === id)).filter(Boolean);
  const selectedCards = orderedHand.filter((card) => selected.includes(card.id));
  const selectedPoints = selectedCards.reduce((sum, card) => sum + cardPoints(card), 0);
  const openingNeed = me ? openingRequirementForTeam(room, me.team) : 0;
  const teamOpened = Boolean(room?.publicState?.opened?.[me?.team]);
  const teamBoard = room?.publicState?.teamBoards?.[me?.team] || [];
  const existingRanks = teamBoard.map((meld) => meld.rank);
  const selectedNaturals = [...new Set(selectedCards.filter((card) => !isWild(card)).map((card) => card.rank))];
  const allWild = selectedCards.length > 0 && selectedCards.every(isWild);
  const suggestedRank = allWild ? targetRank : (selectedNaturals.length === 1 ? selectedNaturals[0] : "");
  const existingTarget = teamBoard.find((meld) => meld.rank === suggestedRank);
  const combined = existingTarget ? [...(existingTarget.cards || []), ...selectedCards] : selectedCards;
  const naturals = combined.filter((card) => !isWild(card));
  const wilds = combined.filter(isWild);
  const selectionLegal = selectedCards.length > 0
    && !selectedCards.some((card) => card.rank === "3")
    && naturals.length > 0
    && new Set(naturals.map((card) => card.rank)).size === 1
    && wilds.length < naturals.length
    && wilds.length <= Number(room?.rules?.maxWildsPerMeld || 3)
    && (existingTarget || selectedCards.length >= 3);
  const requirementMet = teamOpened || selectedPoints >= openingNeed;
  const rawMessages = useMemo(
    () => Object.entries(room?.messages || {})
      .map(([id, value]) => ({ id, ...value }))
      .sort((a,b) => (a.createdAt || 0) - (b.createdAt || 0)),
    [room],
  );
  const accessibleMessages = useMemo(
    () => rawMessages.filter((item) => item.scope !== "team" || Number(item.team) === Number(me?.team)),
    [rawMessages, me?.team],
  );
  const visibleMessages = accessibleMessages.filter((item) => chatScope === "team" ? item.scope === "team" : item.scope !== "team");
  const unreadCount = Math.max(0, accessibleMessages.length - lastReadMessageCount);
  const goOutRequest = room?.publicState?.goOutRequest;
  const goOutRequester = goOutRequest ? members.find((member) => member.uid === goOutRequest.uid) : null;
  const canApproveGoOut = Boolean(goOutRequest && me && goOutRequest.uid !== me.uid && Number(goOutRequest.team) === Number(me.team));
  const myGoOutApproved = Boolean(goOutRequest && goOutRequest.uid === me?.uid && (goOutRequest.approvedBy || []).length);
  const myTeamCanGoOut = Boolean(me && goOutRequirementStatus(room, me.team).eligible);
  const teammates = members.filter((member) => member.uid !== me?.uid && Number(member.team) === Number(me?.team));

  useEffect(() => {
    if (teamCount >= 3 || members.length >= 5) setBoardMode("compact");
  }, [teamCount, members.length]);

  useEffect(() => {
    if ((isPhone && mobileView === "chat") || (!isPhone && sidebarTab === "chat")) {
      setLastReadMessageCount(accessibleMessages.length);
    }
  }, [isPhone, mobileView, sidebarTab, accessibleMessages.length]);

  useEffect(() => {
    if (!room || !user || room.hostUid !== user.uid || room.publicState?.phase !== "dealing") return;
    const order = room.publicState.dealOrder || [];
    const index = room.publicState.dealAnimationIndex || 0;
    if (index >= order.length) {
      advanceDealAnimation(roomCode, user.uid, order.length, true);
      return;
    }
    const timer = setTimeout(
      () => advanceDealAnimation(roomCode, user.uid, index + 1, index + 1 >= order.length),
      reduceMotion ? 1 : 45,
    );
    return () => clearTimeout(timer);
  }, [room?.publicState?.phase, room?.publicState?.dealAnimationIndex, roomCode, user, reduceMotion]);

  useEffect(() => {
    if (!room || !user || room.hostUid !== user.uid || room.status !== "playing" || room.publicState?.phase !== "playing") return;
    const current = members[Number(room.publicState.currentPlayerIndex || 0)];
    if (!current?.isRobot) {
      robotTurnKey.current = "";
      return;
    }
    const key = `${room.handNumber}-${room.publicState.currentPlayerIndex}-${current.uid}-${room.publicState.lastAction}`;
    if (robotTurnKey.current === key) return;
    robotTurnKey.current = key;
    clearTimeout(robotTimer.current);
    robotTimer.current = setTimeout(() => {
      runRobotTurn(roomCode, user.uid).catch((event) => {
        setError(event.message);
        robotTurnKey.current = "";
      });
    }, reduceMotion ? 50 : 900);
    return () => clearTimeout(robotTimer.current);
  }, [room?.status, room?.publicState?.phase, room?.publicState?.currentPlayerIndex, room?.publicState?.lastAction, members, roomCode, user, room?.handNumber, reduceMotion]);

  async function act(action, keepSelection = false) {
    setBusy(true);
    setError("");
    try {
      await action();
      if (!keepSelection) {
        setSelected([]);
        setTargetRank("");
      }
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleCard(id) {
    if (!canSelectCards) return;
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function moveCard(source, target) {
    if (!source || !target || source === target) return;
    setHandOrder((current) => {
      const next = [...current];
      const from = next.indexOf(source);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return current;
      next.splice(from, 1);
      next.splice(to, 0, source);
      return next;
    });
  }

  function moveCardByOffset(id, offset) {
    setHandOrder((current) => {
      const from = current.indexOf(id);
      const to = Math.max(0, Math.min(current.length - 1, from + offset));
      if (from < 0 || from === to) return current;
      const next = [...current];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }

  function applyHandSort(mode) {
    setHandSort(mode);
    const sorted = mode === "suit" ? sortCardsBySuit(privateHand) : sortHand(privateHand);
    setHandOrder(sorted.map((card) => card.id));
  }

  function updateSetup(patch) {
    const next = { ...rules, ...patch };
    next.totalPlayers = Math.min(6, Math.max(2, Number(next.totalPlayers || 2)));
    next.teamCount = Math.min(3, Math.max(2, Math.min(next.totalPlayers, Number(next.teamCount || 2))));
    next.playersPerTeam = Math.max(...teamSeatTargets(next.totalPlayers, next.teamCount));
    next.playMode = "flexible";
    next.deckCount = next.totalPlayers > 4 ? 3 : 2;
    if (patch.totalPlayers !== undefined) next.cardsPerPlayer = next.totalPlayers === 2 ? 15 : 11;
    setRules(next);
  }

  async function createGame({ versusRobot = false } = {}) {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      localStorage.setItem("canastaNickname", nickname);
      localStorage.setItem("canastaAvatar", avatar);
      const selectedRules = versusRobot
        ? { ...rules, totalPlayers:2, teamCount:2, playersPerTeam:1, deckCount:2, cardsPerPlayer:15 }
        : rules;
      const code = await createRoom({ user, nickname, avatar, rules:selectedRules, meetLink });
      if (versusRobot) await addRobot(code, user.uid, 1, "standard");
      setRoomCode(code);
      localStorage.setItem("canastaRoomCode", code);
      setScreen("lobby");
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinGame() {
    setBusy(true);
    setError("");
    try {
      const code = await joinRoom({ code:joinCode, user, nickname, avatar });
      setRoomCode(code);
      localStorage.setItem("canastaRoomCode", code);
      setScreen("lobby");
    } catch (event) {
      setError(event.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitMessage() {
    if (!message.trim() || !me) return;
    const text = message;
    setMessage("");
    await sendMessage(roomCode, me, text, chatScope);
  }

  async function leaveCurrentRoom() {
    if (!user || !roomCode) return;
    const confirmed = window.confirm("Leave this game? Your seat will be removed from the room.");
    if (!confirmed) return;
    try {
      await leaveRoom(roomCode, user.uid);
    } finally {
      setRoom(null);
      setRoomCode("");
      localStorage.removeItem("canastaRoomCode");
      setScreen("home");
      setSelected([]);
    }
  }

  function changeMobileView(view) {
    setMobileView(view);
    if (view === "score") setSidebarTab("score");
    if (view === "chat") {
      setSidebarTab("chat");
      setLastReadMessageCount(accessibleMessages.length);
    }
  }

  if (!firebaseReady) {
    return <main className="setup-page"><section className="config-card"><WifiOff/><h1>Connect Firebase</h1><p>Missing: {firebaseMissing.join(", ")}</p></section></main>;
  }

  if (screen === "home") {
    const setupCapacities = teamSeatTargets(rules.totalPlayers, rules.teamCount);
    return (
      <main className="landing">
        <section className="hero">
          <div className="brand"><span>FC</span><b>Family Canasta</b></div>
          <p className="eyebrow">PLAY TOGETHER, ANYWHERE</p>
          <h1>Two to six players. One board that fits.</h1>
          <p className="lede">Create balanced or flexible teams, play on desktop or phone, and keep every important action in reach.</p>
          <div className="trust"><Wifi size={16}/> Firebase connected</div>
        </section>
        <section className="entry-panel">
          <label>Nickname</label>
          <input value={nickname} onChange={(event) => setNickname(event.target.value)}/>
          <label>Avatar</label>
          <div className="avatars">{AVATARS.map((item) => <button aria-label={`Use ${item} avatar`} className={avatar === item ? "chosen" : ""} onClick={() => setAvatar(item)} key={item}>{item}</button>)}</div>

          <button className="quick-robot" disabled={!user || busy} onClick={() => createGame({ versusRobot:true })}>
            <Bot/> Play against one robot
          </button>

          <details open>
            <summary><Settings size={16}/> Custom game</summary>
            <div className="settings-grid">
              <label><span>Players</span>
                <select value={rules.totalPlayers} onChange={(event) => updateSetup({ totalPlayers:Number(event.target.value) })}>
                  {[2,3,4,5,6].map((count) => <option value={count} key={count}>{count} players</option>)}
                </select>
              </label>
              <label><span>Teams</span>
                <select value={rules.teamCount} onChange={(event) => updateSetup({ teamCount:Number(event.target.value) })}>
                  {Array.from({ length:Math.min(3, rules.totalPlayers) - 1 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count} teams</option>)}
                </select>
              </label>
              <label>Seat distribution<input value={setupCapacities.join(" / ")} readOnly/></label>
              <label>Decks
                <select value={rules.deckCount} onChange={(event) => setRules({ ...rules, deckCount:Number(event.target.value) })}>
                  <option value={2}>2 decks</option><option value={3}>3 decks</option>
                </select>
              </label>
              <label>Starting cards
                <select value={rules.cardsPerPlayer} onChange={(event) => setRules({ ...rules, cardsPerPlayer:Number(event.target.value) })}>
                  <option value={11}>11</option><option value={13}>13</option><option value={15}>15</option>
                </select>
              </label>
              <label>Card back
                <select value={rules.cardBack} onChange={(event) => setRules({ ...rules, cardBack:event.target.value })}>
                  {BACKS.map((back) => <option key={back}>{back}</option>)}
                </select>
              </label>
              <label className="wide-setting">Meet link<input value={meetLink} onChange={(event) => setMeetLink(event.target.value)}/></label>
            </div>
          </details>
          <button className="primary" disabled={!user || busy} onClick={() => createGame()}><Plus/> Create custom game</button>
          <div className="divider"><span/>or join<span/></div>
          <div className="join-row"><input maxLength={6} value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ROOM CODE"/><button onClick={joinGame}>Join</button></div>
          {error && <p className="error">{error}</p>}
        </section>
      </main>
    );
  }

  if (!room) return <main className="loading">Joining table…</main>;

  if (room.status === "lobby") {
    const ready = members.length === totalPlayers
      && teams.every((team, index) => team.length === capacities[index])
      && Array.from({ length:teamCount }, (_, team) => room.teamBoardKeepers?.[team]).every(Boolean);
    return (
      <main className="lobby-page">
        <header><div className="brand"><span>FC</span><b>Family Canasta</b></div><div className="code"><small>ROOM</small><b>{roomCode}</b><button aria-label="Copy room code" onClick={() => navigator.clipboard.writeText(roomCode)}><Copy size={16}/></button></div></header>
        <section className="team-lobby">
          <div className="lobby-title"><p className="eyebrow">FLEXIBLE TEAM GAME</p><h1>Choose the table</h1><p>{totalPlayers} players · {teamCount} teams · seats {capacities.join(" / ")}</p></div>
          <div className={`team-columns teams-${Math.min(teamCount,3)}`}>
            {Array.from({ length:teamCount }, (_, team) => (
              <section className="team-card" key={team}>
                <div className="team-card-head"><h2>{teamName(team)}</h2><span>{teams[team].length}/{capacities[team]}</span></div>
                <div className="team-members">
                  {teams[team].map((member) => (
                    <article key={member.uid}>
                      <span className="avatar">{member.avatar}</span>
                      <div><b>{member.nickname}</b><small>{memberConnectionLabel(member)}</small></div>
                      {member.isHost && <Crown size={16}/>} {member.isRobot && <Bot size={16}/>} 
                      {member.uid === user.uid && <select aria-label="Choose team" value={member.team} onChange={(event) => reportAsyncError(updateMember(roomCode, user.uid, { team:Number(event.target.value) }), setError)}>{Array.from({ length:teamCount }, (_, index) => <option value={index} key={index}>{teamName(index)}</option>)}</select>}
                      {room.hostUid === user.uid && member.isRobot && <button aria-label={`Remove ${member.nickname}`} className="icon-button" onClick={() => removeRobot(roomCode, user.uid, member.uid)}><Trash2 size={15}/></button>}
                    </article>
                  ))}
                  {teams[team].length < capacities[team] && room.hostUid === user.uid && (
                    <button className="add-robot" onClick={() => reportAsyncError(addRobot(roomCode, user.uid, team, "standard"), setError)}><Bot/> Add robot</button>
                  )}
                </div>
                <label className="board-keeper"><LayoutPanelTop/><span>Board shown in front of</span><select value={room.teamBoardKeepers?.[team] || ""} onChange={(event) => setTeamBoardKeeper(roomCode, user.uid, team, event.target.value)} disabled={room.hostUid !== user.uid}><option value="">Choose</option>{teams[team].map((member) => <option value={member.uid} key={member.uid}>{member.nickname}</option>)}</select></label>
              </section>
            ))}
          </div>
          <aside className="lobby-actions">
            <div className="summary"><h3>Game setup</h3><p><span>Players</span><b>{members.length}/{totalPlayers}</b></p><p><span>Teams</span><b>{teamCount}</b></p><p><span>Seats</span><b>{capacities.join(" / ")}</b></p><p><span>Draw</span><b>{room.rules?.drawCount || 2} cards</b></p></div>
            {room.meetLink && <a className="meet" href={room.meetLink.startsWith("http") ? room.meetLink : `https://meet.google.com/${room.meetLink}`} target="_blank" rel="noreferrer"><Video/> Meet</a>}
            {room.hostUid === user.uid ? <button className="primary" disabled={!ready} onClick={() => reportAsyncError(startOnlineGame(roomCode, user.uid), setError)}><Play/> Start game</button> : <p>Waiting for host…</p>}
            <button className="secondary danger" onClick={leaveCurrentRoom}><LogOut/> Leave room</button>
            {error && <p className="error">{error}</p>}
          </aside>
        </section>
      </main>
    );
  }

  const dealer = members[room.dealerIndex];
  const visibleDealCount = room.publicState?.dealAnimationIndex || 0;
  const buttonLabel = teamOpened ? "Play selected" : "Play opening meld";
  const canDraw = Boolean(isMyTurn && turnPhase === "draw" && !busy && room.publicState?.stockCount > 0);
  const canTakeDiscard = Boolean(isMyTurn && turnPhase === "draw" && !busy && room.publicState?.discardPile?.length);
  const canMeld = Boolean(canSelectCards && selectionLegal && requirementMet);
  const canDiscard = Boolean(canSelectCards && selected.length === 1 && !isRedThree(selectedCards[0]));
  const drawReason = getDrawReason({
    isMyTurn,
    turnPhase,
    stockCount: room.publicState?.stockCount,
  });
  const pileReason = getPileReason({
    isMyTurn,
    turnPhase,
    discardCount: room.publicState?.discardPile?.length,
    discardFrozen: room.publicState?.discardFrozen,
  });
  const meldReason = getMeldReason({
    canSelectCards,
    turnPhase,
    selectedCount: selected.length,
    selectionLegal,
    requirementMet,
    openingNeed,
  });
  const discardReason = getDiscardReason({ canSelectCards, turnPhase, selectedCards });
  const turnInstruction = getTurnInstruction({
    phase: room.publicState?.phase,
    isMyTurn,
    activeName: active?.nickname,
    turnPhase,
    pendingPickup: room.publicState?.pendingDiscardPickup,
    myUid: me?.uid,
    selectedCount: selected.length,
    selectionLegal,
    requirementMet,
    openingNeed,
  });

  const renderActions = (compact = false) => (
    <div className={`context-actions ${compact ? "compact-actions" : ""}`}>
      {turnPhase === "draw" ? (
        <>
          <button disabled={!canDraw} title={drawReason} onClick={() => act(() => drawFromStock(roomCode, user.uid))}><Shuffle size={17}/> Draw stock</button>
          <button disabled={!canTakeDiscard} title={pileReason} onClick={() => act(() => takeDiscardPile(roomCode, user.uid))}><LayoutGrid size={17}/> Take discard</button>
        </>
      ) : (
        <>
          <button disabled={!canMeld} title={meldReason} onClick={() => act(() => meldSelectedCards(roomCode, user.uid, selected, targetRank || null))}><Hand size={17}/> Meld</button>
          <button className="discard-button" disabled={!canDiscard} title={discardReason} onClick={() => act(() => discardSelectedCard(roomCode, user.uid, selected[0]))}>Discard</button>
        </>
      )}
      <button className="more-action" onClick={() => setActionPanelOpen(true)} aria-label="Open all game actions"><MoreHorizontal size={18}/></button>
    </div>
  );

  const scoreContent = (
    <div className="score-sidebar-content">
      <div className="score-target"><small>PLAYING TO</small><b>{Number(room.rules?.targetScore || 5000).toLocaleString()}</b></div>
      <div className="round-label">Round {Number(room.handNumber || room.publicState?.handNumber || 1)}</div>
      {Array.from({ length:teamCount }, (_, team) => <TeamScoreCard room={room} team={team} members={members} onOpen={setDetail} key={team}/>) }
      <div className="meld-guide">
        <b>Meld requirements</b>
        <span>Below 0: 15</span><span>0–1,499: 50</span><span>1,500–2,999: 90</span><span>3,000+: 120</span>
      </div>
    </div>
  );

  const chatContent = (
    <>
      <div className="chat-scope-tabs">
        <button className={chatScope === "table" ? "active" : ""} onClick={() => setChatScope("table")}>Table</button>
        {teammates.length > 0 && <button className={chatScope === "team" ? "active" : ""} onClick={() => setChatScope("team")}>Team only</button>}
      </div>
      <div className="messages" aria-live="polite">
        <article className="system-message"><span>•</span><div><b>Game</b><p>{room.publicState?.lastAction || "Game ready."}</p></div></article>
        {members.filter((member) => member.connected === false).map((member) => <article className="system-message" key={`offline-${member.uid}`}><span>!</span><div><b>Connection</b><p>{member.nickname} is disconnected and may rejoin.</p></div></article>)}
        {goOutRequest && <article className="system-message"><span>✓</span><div><b>Go-out request</b><p>{goOutRequester?.nickname || "A teammate"} is waiting for team approval.</p></div></article>}
        {visibleMessages.map((item) => <article className={item.scope === "system" ? "system-message" : ""} key={item.id}><span>{item.avatar}</span><div><b>{item.nickname}{item.scope === "team" ? " · Team" : ""}</b><p>{item.text}</p></div></article>)}
      </div>
      <div className="compose"><input aria-label={`Message ${chatScope === "team" ? "your team" : "the table"}`} value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submitMessage()} placeholder={chatScope === "team" ? "Message your team" : "Message the table"}/><button aria-label="Send message" onClick={submitMessage}><Send size={17}/></button></div>
    </>
  );

  const moreContent = (
    <div className="more-content">
      <h2>Game options</h2>
      <div className="detail-facts">
        <p><span>Room</span><b>{roomCode}</b></p>
        <p><span>Round</span><b>{room.handNumber || 1}</b></p>
        <p><span>Players</span><b>{members.length}</b></p>
        <p><span>Teams</span><b>{teamCount}</b></p>
        <p><span>Stock</span><b>{room.publicState?.stockCount || 0}</b></p>
      </div>
      <button className="secondary" onClick={() => navigator.clipboard.writeText(roomCode)}><Copy/> Copy room code</button>
      <button className="secondary" onClick={() => setBoardMode((current) => current === "compact" ? "full" : "compact")}><LayoutPanelTop/> {boardMode === "compact" ? "Use full board" : "Use compact board"}</button>
      <button className="secondary danger" onClick={leaveCurrentRoom}><LogOut/> Leave game</button>
    </div>
  );

  return (
    <main className={`game-page responsive-game ${isPhone ? "phone-game" : "desktop-game"}`} data-mobile-view={mobileView}>
      <header className="game-topbar">
        <div className="brand"><span>FC</span><b>Family Canasta</b></div>
        <div className="turn-context" aria-live="polite">
          <small>ROUND {room.handNumber || 1} · TEAM {teamName(active?.team || 0)}</small>
          <div className={`turn ${isMyTurn ? "your-turn" : ""}`}>
            {getTurnHeading({ phase: room.publicState?.phase, isMyTurn, turnPhase, activeName: active?.nickname })}
          </div>
          <span>Next: {nextPlayer?.nickname || "—"}</span>
        </div>
        <div className="top-score-strip">
          {Array.from({ length:teamCount }, (_, team) => <span key={team}><small>{teamName(team)}</small><b>{Number(room.publicState?.teamScores?.[team] || 0).toLocaleString()}</b></span>)}
        </div>
        <div className="topbar-actions">
          <button onClick={() => setMoreOpen(true)}><Menu size={17}/><span>Menu</span></button>
          <button onClick={() => { setMoreOpen(true); setMobileView("more"); }}><Settings size={17}/><span>Settings</span></button>
          <button className="danger" onClick={leaveCurrentRoom}><LogOut size={17}/><span>Leave</span></button>
        </div>
        <div className="code"><small>ROOM</small><b>{roomCode}</b></div>
      </header>

      <div className="game-shell">
        <section className="table board-region">
          <div className="board-toolbar">
            <div><b>Board view</b><span>{boardMode === "compact" ? "Compact overview" : "Full card view"}</span></div>
            <button className={boardMode === "compact" ? "active" : ""} onClick={() => setBoardMode("compact")}><List size={16}/> Compact</button>
            <button className={boardMode === "full" ? "active" : ""} onClick={() => setBoardMode("full")}><LayoutGrid size={16}/> Full cards</button>
          </div>

          <section className="mobile-more-panel">{moreContent}</section>

          <div className="opponents player-overview" aria-label="Players">
            {members.map((member) => {
              const breakdown = scoreTeamBoard(room, member.team, null);
              const drawn = room.publicState?.turnDrawnUid === member.uid;
              const discarded = room.publicState?.lastDiscardedUid === member.uid;
              return (
                <button className={`player-panel ${active?.uid === member.uid ? "active-player" : ""} ${member.uid === me?.uid ? "is-me" : ""}`} key={member.uid} onClick={() => setDetail({ type:"player", uid:member.uid })}>
                  <span className="player-avatar">{member.avatar}</span>
                  <span className="player-main"><b>{member.nickname}{member.isRobot ? " 🤖" : ""}</b><small>{teamName(member.team)} · {room.publicState?.handCounts?.[member.uid] || 0} cards</small></span>
                  <span className={`connection-dot ${member.connected === false ? "offline" : "online"}`}>{member.connected === false ? "Offline" : "Online"}</span>
                  <span className="player-stats"><i>{breakdown.cleanCanastas + breakdown.dirtyCanastas} canastas</i><i>{breakdown.boardCardPoints} meld pts</i><i>{room.publicState?.redThrees?.[member.uid]?.length || 0} red 3s</i></span>
                  <span className="turn-state">{getPlayerTurnState({ isActive: active?.uid === member.uid, turnPhase, drawn, discarded })}</span>
                  {dealer?.uid === member.uid && <em><Crown size={12}/> Dealer</em>}
                </button>
              );
            })}
          </div>

          <div className={`shared-boards ${boardMode === "compact" ? "compact-board-mode" : "full-board-mode"}`}>
            {Array.from({ length:teamCount }, (_, team) => {
              const breakdown = scoreTeamBoard(room, team, null);
              const score = Number(room.publicState?.teamScores?.[team] || 0);
              const opened = Boolean(room.publicState?.opened?.[team]);
              const melds = room.publicState?.teamBoards?.[team] || [];
              const expanded = boardMode === "full" || expandedTeams[team];
              return (
                <section key={team} className={`shared-board team-${team} ${expanded ? "board-expanded" : "board-collapsed"}`}>
                  <div className="board-title">
                    <LayoutPanelTop size={16}/>
                    <button className="board-title-button" onClick={() => setDetail({ type:"team", team })}>
                      <b>Team {teamName(team)}</b>
                      <small>{teams[team].map((member) => member.nickname).join(" · ") || "No players"}</small>
                    </button>
                    <strong>{score.toLocaleString()} total</strong>
                    <span>{breakdown.boardCardPoints} meld · {breakdown.cleanCanastas + breakdown.dirtyCanastas} canastas · {breakdown.redThreeCount} red 3s</span>
                    <span className={opened ? "status-good" : "status-warn"}>{opened ? "Opened" : `Need ${openingRequirementForTeam(room, team)} to open`}</span>
                    <span className={goOutRequirementStatus(room, team).eligible ? "status-good" : "status-warn"}>{goOutRequirementStatus(room, team).eligible ? "Can go out" : "Cannot go out yet"}</span>
                    <button className="board-view-toggle" onClick={() => setExpandedTeams((current) => ({ ...current, [team]:!current[team] }))}>{expanded ? "Collapse" : "Expand"}</button>
                  </div>
                  <div className="meld-slots">
                    {!melds.length ? <span className="empty-meld">No melds yet</span> : melds.map((meld, index) => (
                      <button className="board-meld" key={`${meld.rank}-${index}`} onClick={() => setDetail({ type:"meld", team, index })}>
                        <b>{meld.rank}</b>
                        <MeldCards meld={meld} expanded={expanded}/>
                        <small>{meld.cards?.length || 0} cards {meldCanastaSummary(meld)}</small>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="center action-area" aria-label="Draw and discard area">
            <button className="pile-action" disabled={!canDraw} title={drawReason} onClick={() => act(() => drawFromStock(roomCode, user.uid))}>
              <div className="pile back-card"><span>{room.publicState?.stockCount || 0}</span></div><b>Draw {room.rules?.drawCount || 2} from stock</b><small>{drawReason}</small>
            </button>
            <div className="turn-guidance">
              <TurnProgress turnPhase={turnPhase} activeName={active?.nickname}/>
              <b>{turnInstruction}</b>
              <span>{room.publicState?.lastAction}</span>
              <button className="inspect-discard-button" type="button" onClick={() => setDetail({ type:"discard" })}>Inspect recent discards</button>
            </div>
            <button className="pile-action" disabled={!canTakeDiscard} title={pileReason} onClick={() => act(() => takeDiscardPile(roomCode, user.uid))}>
              <div className="pile discard-face">{room.publicState?.discardPile?.at(-1) && <CardFace card={room.publicState.discardPile.at(-1)} compact/>}</div><b>Take discard pile</b><small>{room.publicState?.discardFrozen ? "Frozen pile" : `${room.publicState?.discardPile?.length || 0} cards`}</small>
            </button>
          </section>

          <section
            className={`hand ${isMyTurn ? "active-hand" : ""}`}
            onTouchStart={(event) => { touchStartY.current = event.touches[0]?.clientY; }}
            onTouchEnd={(event) => {
              const end = event.changedTouches[0]?.clientY;
              if (touchStartY.current != null && end != null && touchStartY.current - end > 55) setActionPanelOpen(true);
              touchStartY.current = null;
            }}
          >
            <div className="hand-header">
              <div className="identity"><span>{me?.avatar}</span><b>{me?.nickname}</b><small>Team {teamName(me?.team || 0)}</small>{isMyTurn && <strong>YOUR TURN</strong>}</div>
              <div className="hand-sort-controls" aria-label="Sort hand"><button className={handSort === "rank" ? "active" : ""} onClick={() => applyHandSort("rank")}>Sort rank</button><button className={handSort === "suit" ? "active" : ""} onClick={() => applyHandSort("suit")}>Sort suit</button></div>
            </div>
            <div className="selection-advisor">
              <div>
                <b>{selectedCards.length} selected · {selectedPoints} points</b>
                <span>{turnInstruction}</span>
                {allWild && existingRanks.length > 0 && (
                  <label className="wild-target">Play wild on
                    <select value={targetRank} onChange={(event) => setTargetRank(event.target.value)}>
                      <option value="">Choose meld</option>{existingRanks.map((rank) => <option key={rank} value={rank}>{rank}s</option>)}
                    </select>
                  </label>
                )}
              </div>
              <button disabled={!canMeld} title={meldReason} onClick={() => act(() => meldSelectedCards(roomCode, user.uid, selected, targetRank || null))}><Hand size={16}/> {buttonLabel}</button>
              <button className="discard-button" disabled={!canDiscard} title={discardReason} onClick={() => act(() => discardSelectedCard(roomCode, user.uid, selected[0]))}>Discard selected</button>
              <button className="secondary-action" disabled={!selected.length} onClick={() => setSelected([])}><RotateCcw size={16}/> Undo selection</button>
            </div>

            <div className={`cards ${canSelectCards ? "cards-selectable" : ""}`}>
              <AnimatePresence>
                {orderedHand.map((card, index) => {
                  const wasDealt = room.publicState?.phase !== "dealing" || visibleDealCount > index * members.length;
                  if (!wasDealt) return null;
                  return (
                    <motion.div
                      className={`hand-card-wrap ${selected.includes(card.id) ? "selected-wrap" : ""}`}
                      key={card.id}
                      initial={reduceMotion ? false : { y:-320, opacity:0 }}
                      animate={{ y:0, opacity:1 }}
                      draggable={canSelectCards}
                      onDragStart={(event) => event.dataTransfer.setData("text/card-id", card.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => moveCard(event.dataTransfer.getData("text/card-id"), card.id)}
                    >
                      <CardFace card={card} selected={selected.includes(card.id)} onClick={() => toggleCard(card.id)} onInspect={(inspected) => setDetail({ type:"card", card:inspected })} onMove={(offset) => moveCardByOffset(card.id, offset)}/>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </section>
        </section>

        <aside className="chat score-chat-sidebar">
          <div className="sidebar-tabs">
            <button className={sidebarTab === "score" ? "active" : ""} onClick={() => setSidebarTab("score")}>Game score</button>
            <button className={sidebarTab === "chat" ? "active" : ""} onClick={() => { setSidebarTab("chat"); setLastReadMessageCount(accessibleMessages.length); }}>Table chat {unreadCount > 0 && <span className="badge">{unreadCount}</span>}</button>
          </div>
          {sidebarTab === "score" ? scoreContent : chatContent}
        </aside>
      </div>

      <section className="mobile-action-bar" aria-label="Current turn actions">
        <div><b>{isMyTurn ? "Your turn" : `${active?.nickname || "Player"}'s turn`}</b><span>{turnInstruction}</span></div>
        {renderActions(true)}
      </section>

      <nav className="mobile-game-nav" aria-label="Mobile game navigation">
        {[
          ["hand", "Hand", Hand],
          ["board", "Board", LayoutGrid],
          ["score", "Teams", Crown],
          ["chat", "Chat", MessageCircle],
          ["more", "More", MoreHorizontal],
        ].map(([view, label, Icon]) => (
          <button className={mobileView === view ? "active" : ""} aria-current={mobileView === view ? "page" : undefined} onClick={() => changeMobileView(view)} key={view}><Icon size={19}/><span>{label}</span>{view === "chat" && unreadCount > 0 && <i className="badge">{unreadCount}</i>}</button>
        ))}
      </nav>

      {actionPanelOpen && (
        <div className="action-panel-backdrop">
          <dialog open className="action-panel" aria-modal="true" aria-label="Game actions">
            <header><div><small>CURRENT ACTION</small><h2>{turnInstruction}</h2></div><button className="icon-button" aria-label="Close actions" onClick={() => setActionPanelOpen(false)}><X/></button></header>
            {renderActions()}
            <div className="action-explanations"><p><b>Draw stock:</b> {drawReason}</p><p><b>Take discard:</b> {pileReason}</p><p><b>Meld:</b> {meldReason}</p><p><b>Discard:</b> {discardReason}</p></div>
            <div className="go-out-actions">
              {canApproveGoOut && <button onClick={() => act(() => approveGoOut(roomCode, user.uid), true)}><Check/> Approve {goOutRequester?.nickname} to go out</button>}
              {goOutRequest?.uid === me?.uid ? (
                <button className="secondary" onClick={() => act(() => cancelGoOutRequest(roomCode, user.uid), true)}><X/> Cancel go-out request</button>
              ) : (
                <button disabled={!isMyTurn || turnPhase !== "play" || !myTeamCanGoOut || !teammates.length} title={!myTeamCanGoOut ? "Complete the required canasta first." : "Ask a teammate before using your final card."} onClick={() => act(() => requestGoOut(roomCode, user.uid), true)}><UserRound/> Ask to go out</button>
              )}
              {myGoOutApproved && <p className="approval-message"><Check/> Your teammate approved. You may play or discard your final card.</p>}
            </div>
          </dialog>
        </div>
      )}

      {moreOpen && (
        <div className="drawer-backdrop">
          <aside className="more-drawer"><button className="icon-button drawer-close" aria-label="Close menu" onClick={() => setMoreOpen(false)}><X/></button>{moreContent}</aside>
        </div>
      )}

      <DetailDialog detail={detail} room={room} members={members} onClose={() => setDetail(null)}/>
      {error && <button className="game-error" type="button" aria-label="Dismiss error" onClick={() => setError("")}>{error}</button>}
    </main>
  );
}
