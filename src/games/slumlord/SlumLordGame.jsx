import React, { useEffect, useMemo, useState } from "react";
import {
  BOARD,
  GROUPS,
  TOKENS,
  UPGRADE_NAMES,
} from "./data.js";
import {
  acceptTrade,
  autoResolveDebt,
  botAuctionLimit,
  botPurchaseDecision,
  botUpgradeChoice,
  buyPendingProperty,
  calculateNetWorth,
  canMortgageProperty,
  canSellUpgrade,
  canUnmortgageProperty,
  canUpgradeProperty,
  currentPlayer,
  declareBankruptcy,
  describeSpace,
  endTurn,
  getPlayerProperties,
  mortgageProperty,
  passAuction,
  payCourtFine,
  placeAuctionBid,
  proposeTrade,
  rejectTrade,
  rollDice,
  sellUpgrade,
  startAuction,
  unmortgageProperty,
  upgradeProperty,
  useCourtPass,
} from "./engine.js";
import "./styles.css";

const PLAYER_COLORS = ["#ef5350", "#42a5f5", "#ffca28", "#66bb6a"];
const TOKEN_LABELS = {
  "🛠️": "Wrench",
  "🪠": "Plunger",
  "🧱": "Brick",
  "🪣": "Bucket",
  "🔑": "Key",
  "🚐": "Van",
  "🧰": "Toolbox",
  "🪚": "Saw",
};

function money(value) {
  const amount = Math.round(Number(value) || 0);
  return `${amount < 0 ? "-" : ""}$${Math.abs(amount).toLocaleString()}`;
}

function boardGridPosition(spaceId) {
  if (spaceId >= 0 && spaceId <= 9) return { gridRow: 11, gridColumn: 11 - spaceId };
  if (spaceId >= 10 && spaceId <= 18) return { gridRow: 19 - spaceId, gridColumn: 1 };
  if (spaceId >= 19 && spaceId <= 27) return { gridRow: 1, gridColumn: spaceId - 17 };
  return { gridRow: spaceId - 26, gridColumn: 11 };
}

function tokenOffset(index) {
  const offsets = [
    [20, 18],
    [58, 18],
    [20, 58],
    [58, 58],
  ];
  return offsets[index] || offsets[0];
}

function playerColor(state, playerId) {
  const index = state.players.findIndex((player) => player.id === playerId);
  return PLAYER_COLORS[Math.max(0, index) % PLAYER_COLORS.length];
}

function spaceIcon(space) {
  switch (space.type) {
    case "start": return "💵";
    case "inspection": return "📋";
    case "fee": return "🧾";
    case "business": return "🏪";
    case "utility": return "⚡";
    case "court": return "⚖";
    case "stash": return "💰";
    case "go-to-court": return "🚨";
    case "street": return "🎴";
    default: return "";
  }
}

function SetupScreen({ onStart, onExit }) {
  const [count, setCount] = useState(4);
  const [roundLimit, setRoundLimit] = useState(25);
  const [players, setPlayers] = useState([
    { name: "Landlord 1", isBot: false, token: TOKENS[0] },
    { name: "Landlord 2", isBot: false, token: TOKENS[1] },
    { name: "Landlord 3", isBot: true, token: TOKENS[2] },
    { name: "Landlord 4", isBot: true, token: TOKENS[3] },
  ]);

  const updatePlayer = (index, patch) => {
    setPlayers((current) => current.map((player, playerIndex) => (
      playerIndex === index ? { ...player, ...patch } : player
    )));
  };

  return (
    <main className="sl-setup-shell">
      <section className="sl-setup-card">
        <div className="sl-logo-lockup">
          <div className="sl-logo-building" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <p className="sl-kicker">A property game with terrible maintenance</p>
            <h1>SLUM LORD</h1>
            <p>Buy the block. Patch the leaks. Dodge inspections. Collect rent.</p>
          </div>
        </div>

        <div className="sl-setup-options">
          <label>
            Players
            <select value={count} onChange={(event) => setCount(Number(event.target.value))}>
              <option value={2}>2 players</option>
              <option value={3}>3 players</option>
              <option value={4}>4 players</option>
            </select>
          </label>
          <label>
            Game length
            <select value={roundLimit} onChange={(event) => setRoundLimit(Number(event.target.value))}>
              <option value={15}>Quick — 15 rounds</option>
              <option value={25}>Standard — 25 rounds</option>
              <option value={40}>Long — 40 rounds</option>
              <option value={0}>Last landlord standing</option>
            </select>
          </label>
        </div>

        <div className="sl-player-setup-list">
          {players.slice(0, count).map((player, index) => (
            <div className="sl-player-setup-row" key={index} style={{ "--player": PLAYER_COLORS[index] }}>
              <div className="sl-mini-token" aria-hidden="true"><span>{player.token}</span></div>
              <input
                aria-label={`Player ${index + 1} name`}
                value={player.name}
                maxLength={24}
                onChange={(event) => updatePlayer(index, { name: event.target.value })}
              />
              <select
                aria-label={`Player ${index + 1} type`}
                value={player.isBot ? "bot" : "human"}
                onChange={(event) => updatePlayer(index, { isBot: event.target.value === "bot" })}
              >
                <option value="human">Local player</option>
                <option value="bot">CPU landlord</option>
              </select>
              <select
                aria-label={`Player ${index + 1} token`}
                value={player.token}
                onChange={(event) => updatePlayer(index, { token: event.target.value })}
              >
                {TOKENS.slice(0, 8).map((token) => <option key={token} value={token}>{token} {TOKEN_LABELS[token] || "Token"}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="sl-setup-actions">
          <button type="button" className="sl-button sl-button-secondary" onClick={onExit}>Back to game room</button>
          <button
            type="button"
            className="sl-button sl-button-primary"
            onClick={() => onStart(players.slice(0, count), roundLimit || null)}
          >
            Start game
          </button>
        </div>
      </section>
    </main>
  );
}

function LowPolyToken({ player, index, active = false }) {
  return (
    <div
      className={`sl-token ${active ? "active" : ""}`}
      style={{ "--player": PLAYER_COLORS[index], "--token-x": `${tokenOffset(index)[0]}%`, "--token-y": `${tokenOffset(index)[1]}%` }}
      title={`${player.name} — ${TOKEN_LABELS[player.token] || "token"}`}
    >
      <span className="sl-token-shadow" />
      <span className="sl-token-base" />
      <span className="sl-token-body"><b>{player.token}</b></span>
    </div>
  );
}

function BoardSpace({ state, space, selected, onSelect }) {
  const owned = state.ownership[String(space.id)];
  const group = space.group ? GROUPS[space.group] : null;
  const playersHere = state.players
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => !player.bankrupt && player.position === space.id);
  const current = currentPlayer(state);

  return (
    <button
      type="button"
      className={`sl-space sl-space-${space.type} ${selected ? "selected" : ""}`}
      style={{ ...boardGridPosition(space.id), "--group": group?.color || "#d9d4c7" }}
      onClick={() => onSelect(space.id)}
      aria-label={`${space.name}${space.price ? `, ${money(space.price)}` : ""}`}
    >
      {group ? <span className="sl-group-band" /> : null}
      {owned ? <span className="sl-owner-flag" style={{ "--owner": playerColor(state, owned.ownerId) }} /> : null}
      <span className="sl-space-icon" aria-hidden="true">{spaceIcon(space)}</span>
      <strong>{space.name}</strong>
      {space.price ? <small>{money(space.price)}</small> : <small>{space.subtitle || ""}</small>}
      {owned?.mortgaged ? <span className="sl-mortgage-stamp">MORTGAGED</span> : null}
      {space.type === "property" && owned?.upgrades ? (
        <span className="sl-upgrade-pips" aria-label={`${owned.upgrades} upgrades`}>
          {Array.from({ length: owned.upgrades }).map((_, index) => <i key={index} />)}
        </span>
      ) : null}
      <span className="sl-token-layer" aria-hidden="true">
        {playersHere.map(({ player, index }) => (
          <LowPolyToken key={player.id} player={player} index={index} active={current?.id === player.id} />
        ))}
      </span>
    </button>
  );
}

function Dice({ dice, rolled }) {
  return (
    <div className={`sl-dice ${rolled ? "rolled" : ""}`} aria-label={rolled ? `Dice ${dice[0]} and ${dice[1]}` : "Dice not rolled"}>
      {dice.map((die, index) => <span key={index}>{rolled ? die : "?"}</span>)}
    </div>
  );
}

function PlayerRail({ state }) {
  const current = currentPlayer(state);
  return (
    <aside className="sl-player-rail" aria-label="Players">
      {state.players.map((player, index) => (
        <section
          key={player.id}
          className={`sl-player-card ${current?.id === player.id ? "current" : ""} ${player.bankrupt ? "bankrupt" : ""}`}
          style={{ "--player": PLAYER_COLORS[index] }}
        >
          <div className="sl-player-card-token"><LowPolyToken player={player} index={index} active={current?.id === player.id} /></div>
          <div>
            <strong>{player.name}</strong>
            <small>{player.isBot ? "CPU" : "LOCAL"}{player.inCourt ? " · IN COURT" : ""}</small>
          </div>
          <b>{player.bankrupt ? "BANKRUPT" : money(player.cash)}</b>
          <span>Worth {money(calculateNetWorth(state, player.id))}</span>
        </section>
      ))}
    </aside>
  );
}

function SpacePanel({ state, spaceId, onState }) {
  const detail = describeSpace(state, spaceId);
  if (!detail) return null;
  const { space, ownership, owner, currentRent } = detail;
  const player = currentPlayer(state);
  const ownedByCurrent = ownership?.ownerId === player?.id;
  const upgradeName = space.type === "property" ? UPGRADE_NAMES[Math.min(ownership?.upgrades || 0, UPGRADE_NAMES.length - 1)] : null;

  return (
    <section className="sl-space-panel">
      <div className="sl-panel-header" style={{ "--group": space.group ? GROUPS[space.group].color : "#d9d4c7" }}>
        {space.group ? <span /> : null}
        <div>
          <small>{space.group ? GROUPS[space.group].name : space.type.replaceAll("-", " ")}</small>
          <h3>{space.name}</h3>
        </div>
      </div>

      {space.price ? (
        <div className="sl-property-facts">
          <span><small>Price</small><b>{money(space.price)}</b></span>
          <span><small>Owner</small><b>{owner?.name || "Bank"}</b></span>
          <span><small>Rent</small><b>{ownership?.mortgaged ? "—" : ownership ? money(currentRent) : "—"}</b></span>
          <span><small>Mortgage</small><b>{money(space.mortgage)}</b></span>
        </div>
      ) : <p className="sl-space-description">{space.subtitle || "Special board space."}</p>}

      {space.type === "property" ? (
        <div className="sl-rent-ladder">
          <strong>{upgradeName || "Rent schedule"}</strong>
          <div>{space.rent.map((rent, index) => <span key={index} className={(ownership?.upgrades || 0) === index ? "active" : ""}>{index === 0 ? "Base" : index === 4 ? "Cash Cow" : `Lv ${index}`} <b>{money(rent)}</b></span>)}</div>
        </div>
      ) : null}

      {ownedByCurrent ? (
        <div className="sl-panel-actions">
          {canUpgradeProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(upgradeProperty(state, player.id, space.id))}>Upgrade {money(space.upgradeCost)}</button> : null}
          {canSellUpgrade(state, player.id, space.id) ? <button type="button" onClick={() => onState(sellUpgrade(state, player.id, space.id))}>Sell upgrade</button> : null}
          {canMortgageProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(mortgageProperty(state, player.id, space.id))}>Mortgage</button> : null}
          {canUnmortgageProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(unmortgageProperty(state, player.id, space.id))}>Pay off mortgage</button> : null}
        </div>
      ) : null}
    </section>
  );
}

function PurchasePrompt({ state, onState }) {
  const pending = state.pendingAction;
  if (pending?.type !== "purchase") return null;
  const space = BOARD[pending.spaceId];
  const player = state.players.find((candidate) => candidate.id === pending.playerId);
  return (
    <div className="sl-modal-backdrop">
      <section className="sl-game-modal sl-buy-modal">
        <p className="sl-kicker">Unclaimed property</p>
        <h2>{space.name}</h2>
        <p>{player.name} landed here. Buy it for <strong>{money(space.price)}</strong>, or send it to auction.</p>
        <div className="sl-property-ticket" style={{ "--group": space.group ? GROUPS[space.group].color : "#8aa2b0" }}>
          <span />
          <b>{space.name}</b>
          <small>{space.type === "property" ? GROUPS[space.group].name : space.type}</small>
          <strong>{money(space.price)}</strong>
        </div>
        <div className="sl-modal-actions">
          <button type="button" className="sl-button sl-button-secondary" onClick={() => onState(startAuction(state))}>Auction</button>
          <button type="button" className="sl-button sl-button-primary" disabled={player.cash < space.price} onClick={() => onState(buyPendingProperty(state))}>Buy property</button>
        </div>
      </section>
    </div>
  );
}

function AuctionPrompt({ state, onState }) {
  const auction = state.auction;
  const [bid, setBid] = useState(10);
  useEffect(() => {
    if (auction) setBid(Math.max(10, auction.highBid + 10));
  }, [auction?.highBid, auction?.spaceId]);
  if (!auction) return null;
  const space = BOARD[auction.spaceId];
  const bidder = state.players.find((player) => player.id === auction.currentBidderId);

  return (
    <div className="sl-modal-backdrop">
      <section className="sl-game-modal sl-auction-modal">
        <p className="sl-kicker">Bank auction</p>
        <h2>{space.name}</h2>
        <div className="sl-auction-price"><small>High bid</small><strong>{auction.highBid ? money(auction.highBid) : "No bids"}</strong></div>
        <p><b style={{ color: playerColor(state, bidder.id) }}>{bidder.name}</b>, your move.</p>
        {!bidder.isBot ? (
          <>
            <input type="number" min={Math.max(10, auction.highBid + 10)} step="10" value={bid} onChange={(event) => setBid(Number(event.target.value))} />
            <div className="sl-modal-actions">
              <button type="button" className="sl-button sl-button-secondary" onClick={() => onState(passAuction(state, bidder.id))}>Pass</button>
              <button type="button" className="sl-button sl-button-primary" disabled={bid > bidder.cash || bid <= auction.highBid} onClick={() => onState(placeAuctionBid(state, bidder.id, bid))}>Bid {money(bid)}</button>
            </div>
          </>
        ) : <p className="sl-thinking">CPU landlord is thinking…</p>}
      </section>
    </div>
  );
}

function CardPopup({ card, onClose }) {
  if (!card) return null;
  return (
    <div className="sl-card-pop" role="status">
      <div className={`sl-drawn-card ${card.deckType}`}>
        <small>{card.deckType === "inspection" ? "CODE INSPECTION" : "STREET LUCK"}</small>
        <h3>{card.title}</h3>
        <p>{card.text}</p>
        <button type="button" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

function TradePanel({ state, onState, onClose }) {
  const from = currentPlayer(state);
  const candidates = state.players.filter((player) => !player.bankrupt && player.id !== from.id);
  const [toId, setToId] = useState(candidates[0]?.id || "");
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerIds, setOfferIds] = useState([]);
  const [requestIds, setRequestIds] = useState([]);
  const to = state.players.find((player) => player.id === toId);
  const fromProps = getPlayerProperties(state, from.id).filter(({ ownership }) => !ownership.mortgaged);
  const toProps = to ? getPlayerProperties(state, to.id).filter(({ ownership }) => !ownership.mortgaged) : [];

  const toggle = (id, setValues) => setValues((values) => values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);

  return (
    <div className="sl-modal-backdrop">
      <section className="sl-game-modal sl-trade-modal">
        <button type="button" className="sl-modal-close" onClick={onClose}>×</button>
        <p className="sl-kicker">Make a deal</p>
        <h2>Trade properties</h2>
        <label>Trade with<select value={toId} onChange={(event) => { setToId(event.target.value); setRequestIds([]); }}>{candidates.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
        <div className="sl-trade-columns">
          <div><h3>You offer</h3>{fromProps.map(({ space }) => <label className="sl-trade-check" key={space.id}><input type="checkbox" checked={offerIds.includes(space.id)} onChange={() => toggle(space.id, setOfferIds)} />{space.name}</label>)}<label>Cash<input type="number" min="0" max={Math.max(0, from.cash)} value={offerCash} onChange={(event) => setOfferCash(Number(event.target.value))} /></label></div>
          <div><h3>You request</h3>{toProps.map(({ space }) => <label className="sl-trade-check" key={space.id}><input type="checkbox" checked={requestIds.includes(space.id)} onChange={() => toggle(space.id, setRequestIds)} />{space.name}</label>)}<label>Cash<input type="number" min="0" max={Math.max(0, to?.cash || 0)} value={requestCash} onChange={(event) => setRequestCash(Number(event.target.value))} /></label></div>
        </div>
        <button type="button" className="sl-button sl-button-primary" onClick={() => { onState(proposeTrade(state, { fromId: from.id, toId, offerPropertyIds: offerIds, requestPropertyIds: requestIds, offerCash, requestCash })); onClose(); }}>Propose trade</button>
      </section>
    </div>
  );
}

function TradeDecision({ state, onState }) {
  const trade = state.pendingTrade;
  if (!trade) return null;
  const from = state.players.find((player) => player.id === trade.fromId);
  const to = state.players.find((player) => player.id === trade.toId);
  const names = (ids) => ids.map((id) => BOARD[id]?.name).filter(Boolean).join(", ") || "No properties";
  return (
    <div className="sl-modal-backdrop">
      <section className="sl-game-modal">
        <p className="sl-kicker">Trade offer</p>
        <h2>{to.name}, deal or no deal?</h2>
        <div className="sl-trade-summary"><p><b>{from.name} gives:</b> {names(trade.offerPropertyIds)}{trade.offerCash ? ` + ${money(trade.offerCash)}` : ""}</p><p><b>{to.name} gives:</b> {names(trade.requestPropertyIds)}{trade.requestCash ? ` + ${money(trade.requestCash)}` : ""}</p></div>
        <div className="sl-modal-actions"><button className="sl-button sl-button-secondary" type="button" onClick={() => onState(rejectTrade(state, to.id))}>Reject</button><button className="sl-button sl-button-primary" type="button" onClick={() => onState(acceptTrade(state, to.id))}>Accept</button></div>
      </section>
    </div>
  );
}

function DebtPrompt({ state, onState }) {
  const debt = state.debt;
  if (!debt) return null;
  const player = state.players.find((candidate) => candidate.id === debt.playerId);
  const assets = getPlayerProperties(state, player.id);
  return (
    <div className="sl-modal-backdrop">
      <section className="sl-game-modal">
        <p className="sl-kicker">Cash crisis</p>
        <h2>{player.name} is {money(player.cash)}.</h2>
        <p>Sell upgrades or mortgage property from the board panel to get back above zero. If there is no way out, declare bankruptcy.</p>
        <div className="sl-modal-actions">
          <button className="sl-button sl-button-secondary" type="button" onClick={() => onState(autoResolveDebt(state, player.id))}>Auto raise cash</button>
          <button className="sl-button sl-button-danger" type="button" disabled={assets.length > 0 && player.cash >= 0} onClick={() => onState(declareBankruptcy(state, player.id))}>Declare bankruptcy</button>
        </div>
      </section>
    </div>
  );
}

function GameOver({ state, onRestart, onExit }) {
  if (state.status !== "finished") return null;
  const ranked = [...state.players].sort((a, b) => calculateNetWorth(state, b.id) - calculateNetWorth(state, a.id));
  const winner = state.players.find((player) => player.id === state.winnerId) || ranked[0];
  return (
    <div className="sl-modal-backdrop">
      <section className="sl-game-modal sl-game-over">
        <p className="sl-kicker">The block has spoken</p>
        <h2>{winner?.name || "Nobody"} wins Slum Lord.</h2>
        <ol>{ranked.map((player) => <li key={player.id}><span>{player.name}</span><b>{money(calculateNetWorth(state, player.id))}</b></li>)}</ol>
        <div className="sl-modal-actions"><button className="sl-button sl-button-secondary" type="button" onClick={onExit}>Game room</button><button className="sl-button sl-button-primary" type="button" onClick={onRestart}>Play again</button></div>
      </section>
    </div>
  );
}

export default function SlumLordGame() {
  const [state, setState] = useState(null);
  const [selectedSpace, setSelectedSpace] = useState(0);
  const [showTrade, setShowTrade] = useState(false);
  const [visibleCard, setVisibleCard] = useState(null);

  const exitToHub = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    window.location.assign(url.toString());
  };

  useEffect(() => {
    if (!state?.lastCard) return;
    setVisibleCard(state.lastCard);
  }, [state?.lastCard?.title, state?.turnCount]);

  useEffect(() => {
    if (!state || state.status !== "playing") return undefined;
    const player = currentPlayer(state);
    if (!player?.isBot) return undefined;

    const timer = window.setTimeout(() => {
      setState((current) => {
        const bot = currentPlayer(current);
        if (!bot?.isBot || current.status !== "playing") return current;
        if (current.debt?.playerId === bot.id) return autoResolveDebt(current, bot.id);
        if (current.pendingTrade) {
          if (current.pendingTrade.toId === bot.id) return acceptTrade(current, bot.id);
          return current;
        }
        if (current.auction?.currentBidderId === bot.id) {
          const limit = botAuctionLimit(current, bot.id, current.auction.spaceId);
          const nextBid = Math.max(10, current.auction.highBid + 10);
          return nextBid <= limit ? placeAuctionBid(current, bot.id, nextBid) : passAuction(current, bot.id);
        }
        if (current.pendingAction?.playerId === bot.id) {
          return botPurchaseDecision(current, bot.id, current.pendingAction.spaceId) ? buyPendingProperty(current) : startAuction(current);
        }
        if (!current.rolled) return rollDice(current);
        const upgrade = botUpgradeChoice(current, bot.id);
        if (upgrade !== null) return upgradeProperty(current, bot.id, upgrade);
        return endTurn(current);
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [state]);

  const active = state ? currentPlayer(state) : null;
  const selectedDetail = useMemo(() => state ? describeSpace(state, selectedSpace) : null, [state, selectedSpace]);

  if (!state) return <SetupScreen onStart={(players, roundLimit) => setState(createInitial(players, roundLimit))} onExit={exitToHub} />;

  const canRoll = active && !active.isBot && !state.rolled && !state.pendingAction && !state.auction && !state.pendingTrade && !state.debt;
  const canFinishTurn = active && !active.isBot && state.rolled && !state.pendingAction && !state.auction && !state.pendingTrade && !state.debt;

  return (
    <main className="sl-game-shell">
      <header className="sl-game-topbar">
        <button type="button" className="sl-back" onClick={exitToHub}>← Game Room</button>
        <div className="sl-title"><b>SLUM LORD</b><span>Round {state.round}{state.roundLimit ? ` / ${state.roundLimit}` : ""}</span></div>
        <div className="sl-pot"><small>Cash Stash</small><b>{money(state.pot)}</b></div>
      </header>

      <section className="sl-table-layout">
        <PlayerRail state={state} />

        <section className="sl-board-zone">
          <div className="sl-board-perspective">
            <div className="sl-board">
              {BOARD.map((space) => <BoardSpace key={space.id} state={state} space={space} selected={selectedSpace === space.id} onSelect={setSelectedSpace} />)}
              <div className="sl-board-center">
                <div className="sl-center-skyline" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                <p>PROPERTY MANAGEMENT</p>
                <h1>SLUM<br />LORD</h1>
                <span>Own the block. Avoid the inspector.</span>
              </div>
            </div>
          </div>

          <section className="sl-turn-console">
            <div className="sl-active-player" style={{ "--player": playerColor(state, active.id) }}>
              <small>{active.isBot ? "CPU TURN" : "YOUR TURN"}</small>
              <strong>{active.name}</strong>
              <span>{active.inCourt ? "Housing Court" : BOARD[active.position].name}</span>
            </div>
            <Dice dice={state.dice} rolled={state.rolled} />
            <div className="sl-turn-buttons">
              {active.inCourt && !state.rolled && !active.isBot ? <button type="button" disabled={active.cash < 50} onClick={() => setState(payCourtFine(state, active.id))}>Pay $50 bail</button> : null}
              {active.inCourt && active.courtPasses > 0 && !state.rolled && !active.isBot ? <button type="button" onClick={() => setState(useCourtPass(state, active.id))}>Use court pass</button> : null}
              <button type="button" className="primary" disabled={!canRoll} onClick={() => setState(rollDice(state))}>Roll dice</button>
              <button type="button" disabled={!canFinishTurn} onClick={() => setState(endTurn(state))}>{state.extraTurn ? "Roll again" : "End turn"}</button>
              <button type="button" disabled={!active || active.isBot || state.rolled || state.pendingAction || state.auction || state.pendingTrade || state.debt} onClick={() => setShowTrade(true)}>Trade</button>
            </div>
          </section>
        </section>

        <aside className="sl-info-rail">
          <SpacePanel state={state} spaceId={selectedSpace} onState={setState} />
          <section className="sl-log-panel">
            <h3>Neighborhood feed</h3>
            <div>{state.log.slice(0, 8).map((entry) => <p key={entry.id} className={entry.kind}>{entry.text}</p>)}</div>
          </section>
        </aside>
      </section>

      {selectedDetail?.space?.price && selectedDetail.owner ? <div className="sl-owner-key" style={{ "--owner": playerColor(state, selectedDetail.owner.id) }}>{selectedDetail.owner.name} owns this property</div> : null}
      <PurchasePrompt state={state} onState={setState} />
      <AuctionPrompt state={state} onState={setState} />
      <TradeDecision state={state} onState={setState} />
      <DebtPrompt state={state} onState={setState} />
      {showTrade ? <TradePanel state={state} onState={setState} onClose={() => setShowTrade(false)} /> : null}
      <CardPopup card={visibleCard} onClose={() => setVisibleCard(null)} />
      <GameOver state={state} onRestart={() => setState(null)} onExit={exitToHub} />
    </main>
  );
}

function createInitial(players, roundLimit) {
  return createGameCompat(players, roundLimit);
}

function createGameCompat(players, roundLimit) {
  return window.__slumLordCreateGame ? window.__slumLordCreateGame(players, { roundLimit }) : importedCreateGame(players, { roundLimit });
}

import { createGame as importedCreateGame } from "./engine.js";
