import React, { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { auth, db, firebaseReady } from "../firebase";
import "./gameGuidance.css";

const DEFAULT_HINT_SECONDS = 20;
const HINT_OPTIONS = [0, 10, 15, 20, 30, 45];

const RULEBOOKS = {
  canasta: {
    name: "Canasta",
    objective: "Build same-rank melds and canastas, satisfy the opening requirement, and go out with the strongest team score.",
    sections: [
      ["Turn", [
        "Draw two cards from the stock, or legally claim the discard pile.",
        "Optionally create melds or add cards to existing team melds.",
        "Discard one card to end the turn.",
      ]],
      ["Melds and canastas", [
        "A new meld needs at least three cards of one natural rank.",
        "Twos and jokers are wild. A meld must keep more natural cards than wild cards and obey the table's wild-card limit.",
        "Seven or more cards form a canasta. A clean canasta has no wild cards; a dirty canasta has one or more.",
      ]],
      ["Opening requirement", [
        "A team's first meld total is based on its cumulative score: below 0 requires 15; 0–1,499 requires 50; 1,500–2,999 requires 90; 3,000 or more requires 120.",
      ]],
      ["Discard pile", [
        "The opening discard pile starts frozen.",
        "A frozen pile requires the configured natural-card support matching the top discard.",
        "When a legal pile is claimed, the top discard is used in the meld and the remaining pile enters the player's hand.",
        "Wild cards and black threes affect whether the pile is frozen or blocked.",
      ]],
      ["Red threes", [
        "Red threes move to the team's red-three area and are replaced from the stock when possible.",
        "Their value and any unprotected-red-three penalty follow the active table rules.",
      ]],
      ["Going out and scoring", [
        "The team must have the required number of canastas before a player can go out.",
        "Partnership tables may require teammate permission before going out.",
        "Hand scoring combines card points, canasta bonuses, red threes, and the going-out bonus, then subtracts cards left in teammates' hands.",
      ]],
    ],
    defaults: {
      targetScore: 5000,
      maxWildsPerMeld: 3,
      cleanCanastaBonus: 500,
      dirtyCanastaBonus: 300,
      redThreeValue: 100,
      goingOutBonus: 100,
      wildCanastas: false,
    },
  },
  hearts: {
    name: "Hearts",
    objective: "Finish with the lowest score by avoiding hearts and the queen of spades, unless you can capture every penalty card and shoot the moon.",
    sections: [
      ["Table and scoring", [
        "Four individual players use one 52-card deck. Aces are high and there is no trump suit.",
        "Each heart is 1 point and the queen of spades is 13 points.",
        "The game ends after a hand in which someone reaches the target score; the lowest total wins.",
      ]],
      ["Passing", [
        "The passing cycle is left, right, across, then hold.",
        "Choose exactly three cards. Passes remain hidden until every required player submits.",
      ]],
      ["Trick play", [
        "The player holding the two of clubs leads the first trick.",
        "Follow the led suit when able. The highest card of that suit wins the trick.",
        "Hearts and the queen of spades cannot be discarded on the first trick when a non-penalty alternative is available.",
        "Hearts cannot be led until broken unless the leader holds only hearts.",
      ]],
      ["Shooting the moon", [
        "Capturing all 13 hearts and the queen of spades gives the shooter 0 points and every opponent 26 points.",
      ]],
    ],
    defaults: { targetScore: 100 },
  },
  spades: {
    name: "Spades",
    objective: "Bid accurately with your partner, make the team contract, manage bags, and reach the target score first.",
    sections: [
      ["Table and teams", [
        "Four players sit in fixed partnerships: seats 1 and 3 against seats 2 and 4.",
        "Every player receives 13 cards. Spades are always trump.",
      ]],
      ["Bidding", [
        "Bidding starts left of the dealer and proceeds clockwise.",
        "Each player bids 0–13. A zero bid is nil and promises to take no tricks.",
        "The partnership contract is the sum of both non-nil bids.",
      ]],
      ["Trick play", [
        "Follow the led suit when able. A player who cannot follow may play any card, including a spade.",
        "Spades cannot be led until broken unless the leader holds only spades.",
        "The highest spade wins a trumped trick; otherwise the highest card of the led suit wins.",
      ]],
      ["Scoring", [
        "Making the contract earns 10 points per contracted trick plus 1 point per overtrick.",
        "Missing the contract loses 10 points per contracted trick.",
        "Overtricks are bags. Ten bags cause a 100-point penalty and remove ten bags.",
        "Successful nil is +100; failed nil is -100. Nil tricks still count toward the team contract and bags.",
      ]],
    ],
    defaults: { targetScore: 500 },
  },
  rummy: {
    name: "Rummy",
    objective: "Create sets and suit runs, lay off cards after opening, and empty your hand before the other players.",
    sections: [
      ["Deal", [
        "Two players receive 10 cards; three or four receive 7; five or six receive 6.",
        "One card starts the discard pile and the rest form the stock.",
      ]],
      ["Turn", [
        "Draw exactly one card from the stock or the top of the discard pile.",
        "Optionally play one or more melds and, after opening, lay cards onto existing melds.",
        "Discard one card to end the turn. A player may go out without discarding when every remaining card is legally played.",
      ]],
      ["Melds", [
        "A set contains three or four cards of the same rank.",
        "A run contains at least three consecutive cards of the same suit.",
        "Ace is low only: A-2-3 is valid; Q-K-A and K-A-2 are not.",
        "A layoff must leave the complete table group as a valid set or run.",
      ]],
      ["Scoring", [
        "The round winner scores the combined deadwood remaining in opponents' hands.",
        "Aces are 1, number cards use face value, and tens and face cards are 10.",
        "The first player to reach the target score after a completed round wins.",
      ]],
    ],
    defaults: { targetScore: 100 },
  },
};

const RULE_LABELS = {
  targetScore: "Target score",
  playMode: "Play format",
  playersPerTeam: "Players per team",
  teamCount: "Teams",
  deckCount: "Decks",
  cardsPerPlayer: "Starting cards",
  maxWildsPerMeld: "Maximum wild cards per meld",
  canastasToGoOut: "Canastas required to go out",
  partnerPermission: "Partner permission to go out",
  requirePartnerPermission: "Partner permission to go out",
  cleanCanastaBonus: "Clean canasta bonus",
  dirtyCanastaBonus: "Dirty canasta bonus",
  redThreeValue: "Red three value",
  goingOutBonus: "Going-out bonus",
  wildCanastas: "Wild canastas",
  unprotectedRedThreePenalty: "Unprotected red-three penalty",
  frozenPileNaturalCount: "Natural cards needed for a frozen pile",
  hintDelaySeconds: "Idle hint delay",
  variant: "Variant",
};

function findRoomCode() {
  const candidates = [
    document.querySelector(".game-page .code b")?.textContent,
    document.querySelector(".lobby-page .code b")?.textContent,
    document.querySelector(".modular-room-code")?.textContent,
  ];
  return candidates.map((value) => value?.trim().toUpperCase()).find((value) => /^[A-Z0-9]{6}$/.test(value || "")) || "";
}

function orderedMembers(room) {
  return Object.values(room?.members || {}).sort((left, right) => Number(left.seat) - Number(right.seat));
}

function formatRuleName(key) {
  return RULE_LABELS[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function formatRuleValue(value) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value ?? "—");
}

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function interactiveElements(selector) {
  return [...document.querySelectorAll(selector)].filter((element) => {
    if (element.closest(".game-guidance")) return false;
    if (element.disabled) return false;
    return element.getClientRects().length > 0;
  });
}

function buttonByText(pattern) {
  return interactiveElements("button:not(:disabled)").find((button) => pattern.test(button.textContent || ""));
}

function buildHintPlan(gameId, room) {
  const state = gameId === "canasta" ? room?.publicState : room?.gameState;
  const phase = state?.phase;
  const turnPhase = state?.turnPhase;

  if (gameId === "canasta") {
    if (turnPhase === "draw") {
      const target = interactiveElements(".center .pile-action:not(:disabled)")[0];
      return { text: "Start by drawing two cards. The highlighted pile is a legal choice.", targets: target ? [target] : [] };
    }
    const readyAction = buttonByText(/play selected|meld selected|discard selected/i);
    if (readyAction) return { text: `You already have a legal next action: ${readyAction.textContent.trim()}.`, targets: [readyAction] };
    const cards = interactiveElements(".cards-selectable .real-card");
    const groups = new Map();
    cards.forEach((card) => {
      const rank = (card.getAttribute("aria-label") || "").split(" ")[0];
      if (!rank || rank === "3" || rank === "JOKER" || rank === "2") return;
      groups.set(rank, [...(groups.get(rank) || []), card]);
    });
    const meld = [...groups.values()].find((group) => group.length >= 3)?.slice(0, 3);
    if (meld) return { text: "These matching natural cards can form a meld. Select them, then use Meld selected.", targets: meld };
    return { text: "Select one card to discard, or select matching ranks to build a meld.", targets: cards.slice(0, 1) };
  }

  if (gameId === "hearts") {
    if (phase === "passing") {
      const submit = buttonByText(/pass selected cards/i);
      if (submit) return { text: "Your three cards are selected. Submit the pass.", targets: [submit] };
      return { text: "Choose three cards to pass. The highlighted cards are available selections.", targets: interactiveElements(".modular-hand .standard-card:not(:disabled)").slice(0, 3) };
    }
    const card = interactiveElements(".modular-hand .standard-card:not(:disabled)")[0];
    return { text: "Play a legal card. The highlighted card follows the current trick rules.", targets: card ? [card] : [] };
  }

  if (gameId === "spades") {
    if (phase === "bidding") {
      const box = document.querySelector(".spades-action-box");
      return { text: "Choose your bid, then submit it. Estimate how many tricks your hand can win.", targets: box ? [box] : [] };
    }
    const card = interactiveElements(".modular-hand .standard-card:not(:disabled)")[0];
    return { text: "Play a legal card. The highlighted card follows suit when required.", targets: card ? [card] : [] };
  }

  if (gameId === "rummy") {
    if (turnPhase === "draw") {
      const pile = interactiveElements(".rummy-pile:not(:disabled)")[0];
      return { text: "Draw one card to begin your turn. The highlighted pile is available.", targets: pile ? [pile] : [] };
    }
    const readyAction = buttonByText(/meld selected|lay off selected|discard selected/i);
    if (readyAction) return { text: `Use the highlighted action: ${readyAction.textContent.trim()}.`, targets: [readyAction] };
    const cards = interactiveElements(".modular-hand .standard-card:not(:disabled)");
    return { text: "Select cards for a set or run. When finished, select one card and discard it.", targets: cards.slice(0, Math.min(3, cards.length)) };
  }

  return { text: "Choose one of the highlighted legal actions to continue.", targets: interactiveElements("button:not(:disabled)").slice(0, 1) };
}

function playerCanAct(gameId, room) {
  if (!room || room.status !== "playing") return false;
  const uid = auth?.currentUser?.uid;
  if (!uid || !room.members?.[uid]) return false;
  const state = gameId === "canasta" ? room.publicState : room.gameState;
  if (!state || !["playing", "passing", "bidding"].includes(state.phase)) return false;
  if (gameId === "hearts" && state.phase === "passing") return !state.pendingPasses?.[uid];
  const active = orderedMembers(room)[Number(state.currentPlayerIndex || 0)];
  return active?.uid === uid;
}

function ruleActivityKey(gameId, room) {
  const state = gameId === "canasta" ? room?.publicState : room?.gameState;
  return [
    room?.handNumber,
    state?.roundNumber,
    state?.phase,
    state?.turnPhase,
    state?.currentPlayerIndex,
    state?.lastAction,
    state?.completedTricks,
    state?.currentTrick?.length,
    Object.keys(state?.pendingPasses || {}).length,
    state?.discardPile?.length,
    state?.melds?.length,
  ].join(":");
}

export default function GameGuidance({ gameId }) {
  const rulebook = RULEBOOKS[gameId] || RULEBOOKS.canasta;
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rulesTab, setRulesTab] = useState("rules");
  const [hintVisible, setHintVisible] = useState(false);
  const [hintText, setHintText] = useState("");
  const [activityVersion, setActivityVersion] = useState(0);
  const [hintSeconds, setHintSeconds] = useState(() => Number(localStorage.getItem("familyCardHintSeconds") ?? DEFAULT_HINT_SECONDS));

  useEffect(() => {
    const locate = () => setRoomCode(findRoomCode());
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [gameId]);

  useEffect(() => {
    if (!firebaseReady || !roomCode) {
      setRoom(null);
      return undefined;
    }
    return onValue(ref(db, `rooms/${roomCode}`), (snapshot) => setRoom(snapshot.val()));
  }, [roomCode]);

  const canAct = playerCanAct(gameId, room);
  const activityKey = ruleActivityKey(gameId, room);

  useEffect(() => {
    const markActivity = () => {
      setHintVisible(false);
      setActivityVersion((value) => value + 1);
    };
    window.addEventListener("pointerdown", markActivity, true);
    window.addEventListener("keydown", markActivity, true);
    return () => {
      window.removeEventListener("pointerdown", markActivity, true);
      window.removeEventListener("keydown", markActivity, true);
    };
  }, []);

  useEffect(() => {
    setHintVisible(false);
    if (!canAct || hintSeconds <= 0 || rulesOpen) return undefined;
    const timer = window.setTimeout(() => setHintVisible(true), hintSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [canAct, hintSeconds, activityKey, activityVersion, rulesOpen]);

  useEffect(() => {
    if (!hintVisible) return undefined;
    const plan = buildHintPlan(gameId, room);
    setHintText(plan.text);
    plan.targets.forEach((target) => target.classList.add("game-hint-highlight"));
    plan.targets[0]?.scrollIntoView?.({ behavior: "smooth", block: "nearest", inline: "center" });
    return () => plan.targets.forEach((target) => target.classList.remove("game-hint-highlight"));
  }, [hintVisible, gameId, room, activityKey]);

  const activeRules = useMemo(() => {
    const tableRules = room?.rules || {};
    const keys = new Set([...Object.keys(rulebook.defaults || {}), ...Object.keys(tableRules)]);
    return [...keys].sort().map((key) => {
      const hasTableValue = Object.prototype.hasOwnProperty.call(tableRules, key);
      const value = hasTableValue ? tableRules[key] : rulebook.defaults?.[key];
      const standardValue = rulebook.defaults?.[key];
      const source = standardValue === undefined ? "Variant / house rule" : valuesMatch(value, standardValue) ? "Standard" : "House override";
      return { key, value, source };
    });
  }, [room?.rules, rulebook]);

  function changeHintDelay(event) {
    const next = Number(event.target.value);
    setHintSeconds(next);
    localStorage.setItem("familyCardHintSeconds", String(next));
    setHintVisible(false);
  }

  return (
    <aside className="game-guidance" aria-label={`${rulebook.name} help`}>
      <button type="button" className="game-rules-tab" aria-expanded={rulesOpen} onClick={() => setRulesOpen((open) => !open)}>
        Rules
      </button>

      {hintVisible && hintText ? (
        <div className="game-hint-toast" role="status" aria-live="polite">
          <strong>Hint</strong>
          <span>{hintText}</span>
          <button type="button" onClick={() => setHintVisible(false)}>Got it</button>
        </div>
      ) : null}

      {rulesOpen ? (
        <section className="game-rules-panel" role="dialog" aria-modal="false" aria-label={`${rulebook.name} rules`}>
          <header>
            <div><small>RULE REFRESHER</small><h2>{rulebook.name}</h2></div>
            <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}>×</button>
          </header>
          <nav aria-label="Rules sections">
            <button type="button" className={rulesTab === "rules" ? "active" : ""} onClick={() => setRulesTab("rules")}>How to play</button>
            <button type="button" className={rulesTab === "active" ? "active" : ""} onClick={() => setRulesTab("active")}>Active table rules</button>
          </nav>

          {rulesTab === "rules" ? (
            <div className="game-rulebook-content">
              <p className="game-rule-objective">{rulebook.objective}</p>
              {rulebook.sections.map(([heading, items]) => (
                <section key={heading}>
                  <h3>{heading}</h3>
                  <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
                </section>
              ))}
            </div>
          ) : (
            <div className="active-rule-content">
              <p>{roomCode ? `Room ${roomCode} is using the rules below.` : "Create or join a room to see its exact overrides. Standard defaults are shown for now."}</p>
              <div className="active-rule-list">
                {activeRules.map((rule) => (
                  <article key={rule.key} className={rule.source === "Standard" ? "standard" : "override"}>
                    <div><strong>{formatRuleName(rule.key)}</strong><span>{formatRuleValue(rule.value)}</span></div>
                    <small>{rule.source}</small>
                  </article>
                ))}
              </div>
            </div>
          )}

          <footer>
            <label>Show a hint after
              <select value={hintSeconds} onChange={changeHintDelay}>
                {HINT_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds === 0 ? "Off" : `${seconds} seconds`}</option>)}
              </select>
            </label>
            <small>Any click, tap, key press, or game-state change resets the timer.</small>
          </footer>
        </section>
      ) : null}
    </aside>
  );
}
