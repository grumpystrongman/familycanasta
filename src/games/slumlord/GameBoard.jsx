import React, { useEffect, useMemo, useState } from "react";
import { BOARD, GROUPS, TOKENS, UPGRADE_NAMES } from "./data.js";
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
  createGame,
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
import "./n64-overrides.css";

const PLAYER_COLORS = ["#ef5350", "#42a5f5", "#ffca28", "#66bb6a"];
const TOKEN_NAMES = ["Wrench", "Plunger", "Brick", "Bucket", "Key", "Van", "Toolbox", "Saw"];

const cash = (value) => {
  const amount = Math.round(Number(value) || 0);
  return `${amount < 0 ? "-" : ""}$${Math.abs(amount).toLocaleString()}`;
};

function gridPosition(id) {
  if (id <= 9) return { gridRow: 10, gridColumn: 10 - id };
  if (id <= 18) return { gridRow: 19 - id, gridColumn: 1 };
  if (id <= 27) return { gridRow: 1, gridColumn: id - 17 };
  return { gridRow: id - 26, gridColumn: 10 };
}

const tokenOffsets = [[23, 22], [66, 22], [23, 66], [66, 66]];

function ownerColor(state, playerId) {
  const index = state.players.findIndex((player) => player.id === playerId);
  return PLAYER_COLORS[Math.max(0, index) % PLAYER_COLORS.length];
}

function iconFor(space) {
  return {
    start: "💵",
    inspection: "📋",
    fee: "🧾",
    business: "🏪",
    utility: "⚡",
    court: "⚖",
    stash: "💰",
    "go-to-court": "🚨",
    street: "🎴",
  }[space.type] || "";
}

function Token({ player, index, active = false, compact = false }) {
  const [x, y] = tokenOffsets[index] || tokenOffsets[0];
  return (
    <div
      className={`sl-token ${active ? "active" : ""} ${compact ? "compact" : ""}`}
      style={{ "--player": PLAYER_COLORS[index], "--token-x": `${x}%`, "--token-y": `${y}%` }}
      title={`${player.name} — ${TOKEN_NAMES[TOKENS.indexOf(player.token)] || "piece"}`}
    >
      <span className="sl-token-shadow" />
      <span className="sl-token-base" />
      <span className="sl-token-body"><b>{player.token}</b></span>
    </div>
  );
}

function Setup({ onStart, onExit }) {
  const [count, setCount] = useState(4);
  const [roundLimit, setRoundLimit] = useState(25);
  const [players, setPlayers] = useState([
    { name: "Landlord 1", isBot: false, token: TOKENS[0] },
    { name: "Landlord 2", isBot: false, token: TOKENS[1] },
    { name: "Landlord 3", isBot: true, token: TOKENS[2] },
    { name: "Landlord 4", isBot: true, token: TOKENS[3] },
  ]);

  const patchPlayer = (index, patch) => setPlayers((list) => list.map((player, itemIndex) => itemIndex === index ? { ...player, ...patch } : player));

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
          <label>Players<select value={count} onChange={(event) => setCount(Number(event.target.value))}><option value={2}>2 players</option><option value={3}>3 players</option><option value={4}>4 players</option></select></label>
          <label>Game length<select value={roundLimit} onChange={(event) => setRoundLimit(Number(event.target.value))}><option value={15}>Quick — 15 rounds</option><option value={25}>Standard — 25 rounds</option><option value={40}>Long — 40 rounds</option><option value={0}>Last landlord standing</option></select></label>
        </div>

        <div className="sl-player-setup-list">
          {players.slice(0, count).map((player, index) => (
            <div key={index} className="sl-player-setup-row" style={{ "--player": PLAYER_COLORS[index] }}>
              <div className="sl-mini-token"><span>{player.token}</span></div>
              <input value={player.name} maxLength={24} aria-label={`Player ${index + 1} name`} onChange={(event) => patchPlayer(index, { name: event.target.value })} />
              <select aria-label={`Player ${index + 1} type`} value={player.isBot ? "bot" : "human"} onChange={(event) => patchPlayer(index, { isBot: event.target.value === "bot" })}><option value="human">Local player</option><option value="bot">CPU landlord</option></select>
              <select aria-label={`Player ${index + 1} piece`} value={player.token} onChange={(event) => patchPlayer(index, { token: event.target.value })}>{TOKENS.map((token, tokenIndex) => <option key={token} value={token}>{token} {TOKEN_NAMES[tokenIndex]}</option>)}</select>
            </div>
          ))}
        </div>

        <div className="sl-setup-actions">
          <button type="button" className="sl-button sl-button-secondary" onClick={onExit}>Back to game room</button>
          <button type="button" className="sl-button sl-button-primary" onClick={() => onStart(players.slice(0, count), roundLimit || null)}>Start game</button>
        </div>
      </section>
    </main>
  );
}

function BoardSpace({ state, space, selected, onSelect }) {
  const ownership = state.ownership[String(space.id)];
  const group = space.group ? GROUPS[space.group] : null;
  const current = currentPlayer(state);
  const occupants = state.players.map((player, index) => ({ player, index })).filter(({ player }) => !player.bankrupt && player.position === space.id);

  return (
    <button type="button" className={`sl-space sl-space-${space.type} ${selected ? "selected" : ""}`} style={{ ...gridPosition(space.id), "--group": group?.color || "#d9d4c7" }} onClick={() => onSelect(space.id)}>
      {group ? <span className="sl-group-band" /> : null}
      {ownership ? <span className="sl-owner-flag" style={{ "--owner": ownerColor(state, ownership.ownerId) }} /> : null}
      <span className="sl-space-icon" aria-hidden="true">{iconFor(space)}</span>
      <strong>{space.name}</strong>
      <small>{space.price ? cash(space.price) : space.subtitle || ""}</small>
      {ownership?.mortgaged ? <span className="sl-mortgage-stamp">MORTGAGED</span> : null}
      {space.type === "property" && ownership?.upgrades ? <span className="sl-upgrade-pips">{Array.from({ length: ownership.upgrades }, (_, index) => <i key={index} />)}</span> : null}
      <span className="sl-token-layer">{occupants.map(({ player, index }) => <Token key={player.id} player={player} index={index} active={current?.id === player.id} />)}</span>
    </button>
  );
}

function PlayerRail({ state }) {
  const current = currentPlayer(state);
  return (
    <aside className="sl-player-rail">
      {state.players.map((player, index) => (
        <section key={player.id} className={`sl-player-card ${current?.id === player.id ? "current" : ""} ${player.bankrupt ? "bankrupt" : ""}`} style={{ "--player": PLAYER_COLORS[index] }}>
          <div className="sl-player-card-token"><Token player={player} index={index} active={current?.id === player.id} compact /></div>
          <div><strong>{player.name}</strong><small>{player.isBot ? "CPU" : "LOCAL"}{player.inCourt ? " · IN COURT" : ""}</small></div>
          <b>{player.bankrupt ? "BANKRUPT" : cash(player.cash)}</b>
          <span>Net worth {cash(calculateNetWorth(state, player.id))}</span>
        </section>
      ))}
    </aside>
  );
}

function PropertyPanel({ state, spaceId, onState }) {
  const space = BOARD[spaceId];
  const detail = describeSpace(state, spaceId);
  const player = currentPlayer(state);
  if (!space || !detail) return null;

  const { ownership, owner, currentRent } = detail;
  const mine = ownership?.ownerId === player?.id;
  const upgradeLabel = space.type === "property" ? UPGRADE_NAMES[Math.min(ownership?.upgrades || 0, UPGRADE_NAMES.length - 1)] : null;

  return (
    <section className="sl-space-panel">
      <div className="sl-panel-header" style={{ "--group": space.group ? GROUPS[space.group].color : "#d9d4c7" }}>
        {space.group ? <span /> : null}
        <div><small>{space.group ? GROUPS[space.group].name : space.type.replaceAll("-", " ")}</small><h3>{space.name}</h3></div>
      </div>

      {space.price ? <div className="sl-property-facts">
        <span><small>Price</small><b>{cash(space.price)}</b></span>
        <span><small>Owner</small><b>{owner?.name || "Bank"}</b></span>
        <span><small>Rent</small><b>{ownership && !ownership.mortgaged ? cash(currentRent) : "—"}</b></span>
        <span><small>Mortgage</small><b>{cash(space.mortgage)}</b></span>
      </div> : <p className="sl-space-description">{space.subtitle || "Special board space."}</p>}

      {space.type === "property" ? <div className="sl-rent-ladder"><strong>{upgradeLabel || "Rent schedule"}</strong><div>{space.rent.map((rent, index) => <span key={index} className={(ownership?.upgrades || 0) === index ? "active" : ""}>{index === 0 ? "Base" : index === 4 ? "Cash Cow" : `Lv ${index}`} <b>{cash(rent)}</b></span>)}</div></div> : null}

      {mine ? <div className="sl-panel-actions">
        {canUpgradeProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(upgradeProperty(state, player.id, space.id))}>Upgrade {cash(space.upgradeCost)}</button> : null}
        {canSellUpgrade(state, player.id, space.id) ? <button type="button" onClick={() => onState(sellUpgrade(state, player.id, space.id))}>Sell upgrade</button> : null}
        {canMortgageProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(mortgageProperty(state, player.id, space.id))}>Mortgage</button> : null}
        {canUnmortgageProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(unmortgageProperty(state, player.id, space.id))}>Pay mortgage</button> : null}
      </div> : null}
    </section>
  );
}

function Dice({ state }) {
  return <div className={`sl-dice ${state.rolled ? "rolled" : ""}`}>{state.dice.map((die, index) => <span key={index}>{state.rolled ? die : "?"}</span>)}</div>;
}

function PurchaseModal({ state, onState }) {
  if (state.pendingAction?.type !== "purchase") return null;
  const space = BOARD[state.pendingAction.spaceId];
  const player = state.players.find((candidate) => candidate.id === state.pendingAction.playerId);
  return <div className="sl-modal-backdrop"><section className="sl-game-modal"><p className="sl-kicker">Unclaimed property</p><h2>{space.name}</h2><p>{player.name} can buy it for <strong>{cash(space.price)}</strong> or send it to auction.</p><div className="sl-property-ticket" style={{ "--group": space.group ? GROUPS[space.group].color : "#8aa2b0" }}><span /><b>{space.name}</b><small>{space.group ? GROUPS[space.group].name : space.type}</small><strong>{cash(space.price)}</strong></div>{player.isBot ? <p className="sl-thinking">CPU landlord is deciding…</p> : <div className="sl-modal-actions"><button type="button" className="sl-button sl-button-secondary" onClick={() => onState(startAuction(state))}>Auction</button><button type="button" className="sl-button sl-button-primary" disabled={player.cash < space.price} onClick={() => onState(buyPendingProperty(state))}>Buy</button></div>}</section></div>;
}

function AuctionModal({ state, onState }) {
  const auction = state.auction;
  const [bid, setBid] = useState(10);
  useEffect(() => { if (auction) setBid(Math.max(10, auction.highBid + 10)); }, [auction?.highBid, auction?.spaceId]);
  if (!auction) return null;
  const space = BOARD[auction.spaceId];
  const bidder = state.players.find((player) => player.id === auction.currentBidderId);
  return <div className="sl-modal-backdrop"><section className="sl-game-modal sl-auction-modal"><p className="sl-kicker">Bank auction</p><h2>{space.name}</h2><div className="sl-auction-price"><small>High bid</small><strong>{auction.highBid ? cash(auction.highBid) : "No bids"}</strong></div><p><b style={{ color: ownerColor(state, bidder.id) }}>{bidder.name}</b>, your move.</p>{bidder.isBot ? <p className="sl-thinking">CPU landlord is thinking…</p> : <><input type="number" min={Math.max(10, auction.highBid + 10)} step="10" value={bid} onChange={(event) => setBid(Number(event.target.value))} /><div className="sl-modal-actions"><button type="button" className="sl-button sl-button-secondary" onClick={() => onState(passAuction(state, bidder.id))}>Pass</button><button type="button" className="sl-button sl-button-primary" disabled={bid > bidder.cash || bid <= auction.highBid} onClick={() => onState(placeAuctionBid(state, bidder.id, bid))}>Bid {cash(bid)}</button></div></>}</section></div>;
}

function DebtModal({ state, onState }) {
  const debt = state.debt;
  if (!debt) return null;
  const player = state.players.find((candidate) => candidate.id === debt.playerId);
  const properties = getPlayerProperties(state, player.id);
  return <div className="sl-modal-backdrop"><section className="sl-game-modal sl-debt-modal"><p className="sl-kicker">Cash crisis</p><h2>{player.name} is {cash(player.cash)}</h2><p>Raise cash before the bank takes the keys.</p><div className="sl-debt-assets">{properties.map(({ space, ownership }) => <div key={space.id}><span><b>{space.name}</b><small>{ownership.mortgaged ? "Mortgaged" : `${ownership.upgrades || 0} upgrades`}</small></span><span>{canSellUpgrade(state, player.id, space.id) ? <button type="button" onClick={() => onState(sellUpgrade(state, player.id, space.id))}>Sell upgrade</button> : null}{canMortgageProperty(state, player.id, space.id) ? <button type="button" onClick={() => onState(mortgageProperty(state, player.id, space.id))}>Mortgage {cash(space.mortgage)}</button> : null}</span></div>)}</div><div className="sl-modal-actions"><button type="button" className="sl-button sl-button-secondary" onClick={() => onState(autoResolveDebt(state, player.id))}>Auto raise cash</button><button type="button" className="sl-button sl-button-danger" onClick={() => onState(declareBankruptcy(state, player.id))}>Bankruptcy</button></div></section></div>;
}

function TradeModal({ state, onState, onClose }) {
  const from = currentPlayer(state);
  const others = state.players.filter((player) => !player.bankrupt && player.id !== from.id);
  const [toId, setToId] = useState(others[0]?.id || "");
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerIds, setOfferIds] = useState([]);
  const [requestIds, setRequestIds] = useState([]);
  const to = state.players.find((player) => player.id === toId);
  const myProperties = getPlayerProperties(state, from.id).filter(({ ownership }) => !ownership.mortgaged);
  const theirProperties = to ? getPlayerProperties(state, to.id).filter(({ ownership }) => !ownership.mortgaged) : [];
  const toggle = (id, setter) => setter((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  const submit = () => {
    onState(proposeTrade(state, { fromId: from.id, toId, offerPropertyIds: offerIds, requestPropertyIds: requestIds, offerCash, requestCash }));
    onClose();
  };
  return <div className="sl-modal-backdrop"><section className="sl-game-modal sl-trade-modal"><button type="button" className="sl-modal-close" onClick={onClose}>×</button><p className="sl-kicker">Make a deal</p><h2>Trade properties</h2><label>Trade with<select value={toId} onChange={(event) => { setToId(event.target.value); setRequestIds([]); }}>{others.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><div className="sl-trade-columns"><div><h3>You offer</h3>{myProperties.map(({ space }) => <label className="sl-trade-check" key={space.id}><input type="checkbox" checked={offerIds.includes(space.id)} onChange={() => toggle(space.id, setOfferIds)} />{space.name}</label>)}<label>Cash<input type="number" min="0" max={Math.max(0, from.cash)} value={offerCash} onChange={(event) => setOfferCash(Number(event.target.value))} /></label></div><div><h3>You request</h3>{theirProperties.map(({ space }) => <label className="sl-trade-check" key={space.id}><input type="checkbox" checked={requestIds.includes(space.id)} onChange={() => toggle(space.id, setRequestIds)} />{space.name}</label>)}<label>Cash<input type="number" min="0" max={Math.max(0, to?.cash || 0)} value={requestCash} onChange={(event) => setRequestCash(Number(event.target.value))} /></label></div></div><button type="button" className="sl-button sl-button-primary" onClick={submit}>Propose trade</button></section></div>;
}

function TradeDecision({ state, onState }) {
  const trade = state.pendingTrade;
  if (!trade) return null;
  const from = state.players.find((player) => player.id === trade.fromId);
  const to = state.players.find((player) => player.id === trade.toId);
  const propertyNames = (ids) => ids.map((id) => BOARD[id]?.name).filter(Boolean).join(", ") || "No properties";
  return <div className="sl-modal-backdrop"><section className="sl-game-modal"><p className="sl-kicker">Trade offer</p><h2>{to.name}, deal?</h2><div className="sl-trade-summary"><p><b>{from.name} gives:</b> {propertyNames(trade.offerPropertyIds)}{trade.offerCash ? ` + ${cash(trade.offerCash)}` : ""}</p><p><b>{to.name} gives:</b> {propertyNames(trade.requestPropertyIds)}{trade.requestCash ? ` + ${cash(trade.requestCash)}` : ""}</p></div>{to.isBot ? <p className="sl-thinking">CPU landlord is considering it…</p> : <div className="sl-modal-actions"><button type="button" className="sl-button sl-button-secondary" onClick={() => onState(rejectTrade(state, to.id))}>Reject</button><button type="button" className="sl-button sl-button-primary" onClick={() => onState(acceptTrade(state, to.id))}>Accept</button></div>}</section></div>;
}

function CardPopup({ card, onClose }) {
  if (!card) return null;
  return <div className="sl-card-pop"><div className={`sl-drawn-card ${card.deckType}`}><small>{card.deckType === "inspection" ? "CODE INSPECTION" : "STREET LUCK"}</small><h3>{card.title}</h3><p>{card.text}</p><button type="button" onClick={onClose}>Got it</button></div></div>;
}

function GameOver({ state, onRestart, onExit }) {
  if (state.status !== "finished") return null;
  const ranking = [...state.players].sort((a, b) => calculateNetWorth(state, b.id) - calculateNetWorth(state, a.id));
  const winner = state.players.find((player) => player.id === state.winnerId) || ranking[0];
  return <div className="sl-modal-backdrop"><section className="sl-game-modal sl-game-over"><p className="sl-kicker">The block has spoken</p><h2>{winner?.name || "Nobody"} wins.</h2><ol>{ranking.map((player) => <li key={player.id}><span>{player.name}</span><b>{cash(calculateNetWorth(state, player.id))}</b></li>)}</ol><div className="sl-modal-actions"><button type="button" className="sl-button sl-button-secondary" onClick={onExit}>Game room</button><button type="button" className="sl-button sl-button-primary" onClick={onRestart}>Play again</button></div></section></div>;
}

export default function GameBoard() {
  const [state, setState] = useState(null);
  const [selectedSpace, setSelectedSpace] = useState(0);
  const [showTrade, setShowTrade] = useState(false);
  const [card, setCard] = useState(null);

  const exit = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("game");
    window.location.assign(url.toString());
  };

  useEffect(() => {
    if (state?.lastCard) setCard(state.lastCard);
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
        if (current.pendingAction?.playerId === bot.id) return botPurchaseDecision(current, bot.id, current.pendingAction.spaceId) ? buyPendingProperty(current) : startAuction(current);
        if (!current.rolled) return rollDice(current);
        const upgrade = botUpgradeChoice(current, bot.id);
        if (upgrade !== null) return upgradeProperty(current, bot.id, upgrade);
        return endTurn(current);
      });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [state]);

  const selected = useMemo(() => state ? describeSpace(state, selectedSpace) : null, [state, selectedSpace]);
  if (!state) return <Setup onExit={exit} onStart={(players, roundLimit) => setState(createGame(players, { roundLimit }))} />;

  const active = currentPlayer(state);
  const canRoll = active && !active.isBot && !state.rolled && !state.pendingAction && !state.auction && !state.pendingTrade && !state.debt;
  const canEnd = active && !active.isBot && state.rolled && !state.pendingAction && !state.auction && !state.pendingTrade && !state.debt;
  const canTrade = active && !active.isBot && !state.rolled && !state.pendingAction && !state.auction && !state.pendingTrade && !state.debt;

  return (
    <main className="sl-game-shell">
      <header className="sl-game-topbar"><button type="button" className="sl-back" onClick={exit}>← Game Room</button><div className="sl-title"><b>SLUM LORD</b><span>Round {state.round}{state.roundLimit ? ` / ${state.roundLimit}` : ""}</span></div><div className="sl-pot"><small>Cash Stash</small><b>{cash(state.pot)}</b></div></header>

      <section className="sl-table-layout">
        <PlayerRail state={state} />

        <section className="sl-board-zone">
          <div className="sl-board-perspective"><div className="sl-board">
            {BOARD.map((space) => <BoardSpace key={space.id} state={state} space={space} selected={selectedSpace === space.id} onSelect={setSelectedSpace} />)}
            <div className="sl-board-center"><div className="sl-center-skyline"><i /><i /><i /><i /><i /></div><p>PROPERTY MANAGEMENT</p><h1>SLUM<br />LORD</h1><span>Own the block. Avoid the inspector.</span></div>
          </div></div>

          <section className="sl-turn-console">
            <div className="sl-active-player" style={{ "--player": ownerColor(state, active.id) }}><small>{active.isBot ? "CPU TURN" : "YOUR TURN"}</small><strong>{active.name}</strong><span>{active.inCourt ? "Housing Court" : BOARD[active.position].name}</span></div>
            <Dice state={state} />
            <div className="sl-turn-buttons">
              {active.inCourt && !state.rolled && !active.isBot ? <button type="button" disabled={active.cash < 50} onClick={() => setState(payCourtFine(state, active.id))}>Pay $50 fine</button> : null}
              {active.inCourt && active.courtPasses > 0 && !state.rolled && !active.isBot ? <button type="button" onClick={() => setState(useCourtPass(state, active.id))}>Use court pass</button> : null}
              <button type="button" className="primary" disabled={!canRoll} onClick={() => setState(rollDice(state))}>Roll dice</button>
              <button type="button" disabled={!canEnd} onClick={() => setState(endTurn(state))}>{state.extraTurn ? "Roll again" : "End turn"}</button>
              <button type="button" disabled={!canTrade} onClick={() => setShowTrade(true)}>Trade</button>
            </div>
          </section>
        </section>

        <aside className="sl-info-rail"><PropertyPanel state={state} spaceId={selectedSpace} onState={setState} /><section className="sl-log-panel"><h3>Neighborhood feed</h3><div>{state.log.slice(0, 8).map((entry) => <p key={entry.id} className={entry.kind}>{entry.text}</p>)}</div></section></aside>
      </section>

      {selected?.price && selected.owner ? <div className="sl-owner-key" style={{ "--owner": ownerColor(state, selected.owner.id) }}>{selected.owner.name} owns this property</div> : null}
      <PurchaseModal state={state} onState={setState} />
      <AuctionModal state={state} onState={setState} />
      <DebtModal state={state} onState={setState} />
      <TradeDecision state={state} onState={setState} />
      {showTrade ? <TradeModal state={state} onState={setState} onClose={() => setShowTrade(false)} /> : null}
      <CardPopup card={card} onClose={() => setCard(null)} />
      <GameOver state={state} onRestart={() => setState(null)} onExit={exit} />
    </main>
  );
}
