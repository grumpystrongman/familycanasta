import {
  BOARD,
  CASH_STASH_POSITION,
  COURT_FINE,
  COURT_POSITION,
  GO_TO_COURT_POSITION,
  GROUPS,
  INSPECTION_CARDS,
  MAX_UPGRADES,
  PASS_START_BONUS,
  START_CASH,
  STREET_CARDS,
  TOKENS,
  getSpace,
  groupSpaces,
} from "./data.js";

const OWNABLE_TYPES = new Set(["property", "business", "utility"]);
const clone = (value) => JSON.parse(JSON.stringify(value));
const money = (value) => `$${Math.max(0, Math.round(value)).toLocaleString()}`;

function shuffledIds(cards, rng = Math.random) {
  const ids = cards.map((card) => card.id);
  for (let index = ids.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [ids[index], ids[swap]] = [ids[swap], ids[index]];
  }
  return ids;
}

function addLog(state, text, kind = "info") {
  state.log.unshift({ id: `${state.turnCount}-${state.logSequence}`, text, kind });
  state.logSequence += 1;
  state.log = state.log.slice(0, 80);
}

function activePlayers(state) {
  return state.players.filter((player) => !player.bankrupt);
}

function playerById(state, playerId) {
  return state.players.find((player) => player.id === playerId) || null;
}

function ownershipFor(state, spaceId) {
  return state.ownership[String(spaceId)] || null;
}

function setOwnership(state, spaceId, value) {
  if (value) state.ownership[String(spaceId)] = value;
  else delete state.ownership[String(spaceId)];
}

function nextActiveIndex(state, fromIndex) {
  if (!activePlayers(state).length) return fromIndex;
  for (let offset = 1; offset <= state.players.length; offset += 1) {
    const candidate = (fromIndex + offset) % state.players.length;
    if (!state.players[candidate].bankrupt) return candidate;
  }
  return fromIndex;
}

function wrapsPastStart(from, steps) {
  if (steps <= 0) return false;
  return from + steps >= BOARD.length;
}

function maybeClearDebt(state, playerId) {
  if (state.debt?.playerId === playerId) {
    const player = playerById(state, playerId);
    if (player && player.cash >= 0) {
      addLog(state, `${player.name} is solvent again.`, "good");
      state.debt = null;
    }
  }
}

function chargePlayer(state, playerId, amount, options = {}) {
  if (!amount || amount <= 0) return;
  const player = playerById(state, playerId);
  if (!player || player.bankrupt) return;

  player.cash -= amount;
  if (options.recipientId) {
    const recipient = playerById(state, options.recipientId);
    if (recipient && !recipient.bankrupt) recipient.cash += amount;
  }
  if (options.toPot) state.pot += amount;

  if (player.cash < 0) {
    state.debt = {
      playerId,
      creditorId: options.recipientId || null,
      reason: options.reason || "Outstanding debt",
    };
    addLog(state, `${player.name} is ${money(-player.cash)} underwater and must raise cash.`, "danger");
  }
}

function creditPlayer(state, playerId, amount, reason) {
  const player = playerById(state, playerId);
  if (!player || player.bankrupt || amount <= 0) return;
  player.cash += amount;
  if (reason) addLog(state, `${player.name} collects ${money(amount)} — ${reason}.`, "good");
  maybeClearDebt(state, playerId);
}

function sendToCourt(state, playerId, reason = "Code Enforcement") {
  const player = playerById(state, playerId);
  if (!player) return;
  player.position = COURT_POSITION;
  player.inCourt = true;
  player.courtTurns = 0;
  state.extraTurn = false;
  state.doublesStreak = 0;
  addLog(state, `${player.name} is hauled into Housing Court — ${reason}.`, "danger");
}

function ownsWholeGroup(state, playerId, groupId) {
  const spaces = groupSpaces(groupId);
  return spaces.length > 0 && spaces.every((space) => ownershipFor(state, space.id)?.ownerId === playerId);
}

function groupHasMortgage(state, groupId) {
  return groupSpaces(groupId).some((space) => ownershipFor(state, space.id)?.mortgaged);
}

function countOwnedType(state, playerId, type) {
  return BOARD.filter((space) => space.type === type)
    .filter((space) => {
      const owned = ownershipFor(state, space.id);
      return owned?.ownerId === playerId && !owned.mortgaged;
    }).length;
}

export function calculateRent(state, spaceId, diceTotal = state.lastRollTotal || 0) {
  const space = getSpace(spaceId);
  const owned = ownershipFor(state, spaceId);
  if (!space || !owned || owned.mortgaged) return 0;

  if (space.type === "property") {
    let rent = space.rent[Math.min(owned.upgrades || 0, space.rent.length - 1)] || 0;
    if ((owned.upgrades || 0) === 0 && ownsWholeGroup(state, owned.ownerId, space.group)) rent *= 2;
    return rent;
  }

  if (space.type === "business") {
    const count = countOwnedType(state, owned.ownerId, "business");
    return [0, 25, 50, 100, 200][count] || 200;
  }

  if (space.type === "utility") {
    const count = countOwnedType(state, owned.ownerId, "utility");
    return Math.max(1, diceTotal) * (count >= 2 ? 10 : 4);
  }

  return 0;
}

function drawCard(state, deckType, playerId) {
  const isInspection = deckType === "inspection";
  const cards = isInspection ? INSPECTION_CARDS : STREET_CARDS;
  const deckKey = isInspection ? "inspectionDeck" : "streetDeck";
  const indexKey = isInspection ? "inspectionIndex" : "streetIndex";
  const deck = state[deckKey];
  const cardId = deck[state[indexKey] % deck.length];
  state[indexKey] = (state[indexKey] + 1) % deck.length;
  const card = cards.find((candidate) => candidate.id === cardId) || cards[0];
  state.lastCard = { ...card, deckType };

  const player = playerById(state, playerId);
  addLog(state, `${player.name} draws “${card.title}.”`, isInspection ? "warning" : "info");

  let cashEffect = card.cash || 0;
  if (card.perProperty) cashEffect += card.perProperty * getPlayerProperties(state, playerId).length;
  if (card.perUpgrade) {
    const upgrades = getPlayerProperties(state, playerId)
      .reduce((sum, item) => sum + (item.ownership.upgrades || 0), 0);
    cashEffect += card.perUpgrade * upgrades;
  }

  if (cashEffect < 0) {
    chargePlayer(state, playerId, Math.abs(cashEffect), {
      toPot: Boolean(card.toPot),
      reason: card.title,
    });
  } else if (cashEffect > 0) {
    creditPlayer(state, playerId, cashEffect, card.title);
  }

  if (card.courtPass) {
    player.courtPasses = (player.courtPasses || 0) + 1;
    addLog(state, `${player.name} pockets a Housing Court pass.`, "good");
  }

  if (card.goToCourt) {
    sendToCourt(state, playerId, card.title);
  } else if (Number.isInteger(card.moveTo)) {
    if (card.collectStart) creditPlayer(state, playerId, PASS_START_BONUS, "passing Rent Day");
    player.position = card.moveTo;
  }
}

function resolveLanding(state, playerId) {
  const player = playerById(state, playerId);
  const space = getSpace(player.position);
  if (!space) return;

  addLog(state, `${player.name} lands on ${space.name}.`);

  if (OWNABLE_TYPES.has(space.type)) {
    const owned = ownershipFor(state, space.id);
    if (!owned) {
      state.pendingAction = { type: "purchase", playerId, spaceId: space.id };
      return;
    }
    if (owned.ownerId !== playerId && !owned.mortgaged) {
      const rent = calculateRent(state, space.id, state.lastRollTotal);
      const owner = playerById(state, owned.ownerId);
      chargePlayer(state, playerId, rent, {
        recipientId: owned.ownerId,
        reason: `Rent at ${space.name}`,
      });
      addLog(state, `${player.name} pays ${money(rent)} to ${owner?.name || "the owner"} for ${space.name}.`, "warning");
    }
    return;
  }

  switch (space.type) {
    case "fee":
      chargePlayer(state, playerId, space.amount, { toPot: true, reason: space.name });
      addLog(state, `${player.name} pays ${money(space.amount)} into the cash stash.`, "warning");
      break;
    case "inspection":
      drawCard(state, "inspection", playerId);
      break;
    case "street":
      drawCard(state, "street", playerId);
      break;
    case "stash":
      if (state.pot > 0) {
        const payout = state.pot;
        state.pot = 0;
        creditPlayer(state, playerId, payout, "the Cash Stash");
      } else {
        addLog(state, `${player.name} finds an empty cash stash.`);
      }
      break;
    case "go-to-court":
      sendToCourt(state, playerId, "a Code Enforcement raid");
      break;
    default:
      break;
  }
}

function movePlayer(state, playerId, steps) {
  const player = playerById(state, playerId);
  if (!player) return;
  if (wrapsPastStart(player.position, steps)) {
    creditPlayer(state, playerId, PASS_START_BONUS, "passing Rent Day");
  }
  player.position = (player.position + steps) % BOARD.length;
}

function checkGameOver(state) {
  const remaining = activePlayers(state);
  if (remaining.length <= 1 && state.status === "playing") {
    state.status = "finished";
    state.winnerId = remaining[0]?.id || null;
    if (remaining[0]) addLog(state, `${remaining[0].name} owns the block. Game over.`, "good");
    return true;
  }

  if (state.roundLimit && state.round > state.roundLimit && state.status === "playing") {
    const ranked = rankPlayers(state);
    state.status = "finished";
    state.winnerId = ranked[0]?.id || null;
    if (ranked[0]) addLog(state, `${ranked[0].name} wins on net worth after ${state.roundLimit} rounds.`, "good");
    return true;
  }

  return false;
}

export function createGame(setupPlayers, options = {}) {
  if (!Array.isArray(setupPlayers) || setupPlayers.length < 2 || setupPlayers.length > 4) {
    throw new Error("Slum Lord requires 2–4 players.");
  }

  const rng = options.rng || Math.random;
  const players = setupPlayers.map((input, index) => ({
    id: input.id || `p${index + 1}`,
    name: String(input.name || `Landlord ${index + 1}`).trim().slice(0, 24),
    isBot: Boolean(input.isBot),
    botLevel: input.botLevel || "normal",
    token: input.token || TOKENS[index],
    cash: START_CASH,
    position: 0,
    bankrupt: false,
    inCourt: false,
    courtTurns: 0,
    courtPasses: 0,
  }));

  const state = {
    status: "playing",
    players,
    ownership: {},
    currentPlayerIndex: 0,
    round: 1,
    roundLimit: options.roundLimit || null,
    turnCount: 1,
    rolled: false,
    dice: [1, 1],
    lastRollTotal: 0,
    doublesStreak: 0,
    extraTurn: false,
    pendingAction: null,
    auction: null,
    pendingTrade: null,
    debt: null,
    pot: 0,
    inspectionDeck: shuffledIds(INSPECTION_CARDS, rng),
    streetDeck: shuffledIds(STREET_CARDS, rng),
    inspectionIndex: 0,
    streetIndex: 0,
    lastCard: null,
    winnerId: null,
    log: [],
    logSequence: 1,
  };
  addLog(state, `${players[0].name} has the first roll.`, "good");
  return state;
}

export function currentPlayer(state) {
  return state.players[state.currentPlayerIndex] || null;
}

export function getPlayerProperties(state, playerId) {
  return BOARD.filter((space) => ownershipFor(state, space.id)?.ownerId === playerId)
    .map((space) => ({ space, ownership: ownershipFor(state, space.id) }));
}

export function calculateNetWorth(state, playerId) {
  const player = playerById(state, playerId);
  if (!player || player.bankrupt) return 0;
  return getPlayerProperties(state, playerId).reduce((total, item) => {
    const assetValue = item.ownership.mortgaged ? item.space.mortgage : item.space.price;
    const improvementValue = item.space.type === "property"
      ? (item.ownership.upgrades || 0) * item.space.upgradeCost
      : 0;
    return total + assetValue + improvementValue;
  }, Math.max(0, player.cash));
}

export function rankPlayers(state) {
  return [...state.players]
    .filter((player) => !player.bankrupt)
    .sort((a, b) => calculateNetWorth(state, b.id) - calculateNetWorth(state, a.id));
}

export function rollDice(state, forcedDice = null, rng = Math.random) {
  if (state.status !== "playing") return state;
  if (state.rolled || state.pendingAction || state.auction || state.pendingTrade || state.debt) return state;

  const next = clone(state);
  const player = currentPlayer(next);
  if (!player || player.bankrupt) return next;

  const dice = forcedDice || [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  const [dieOne, dieTwo] = dice.map((value) => Math.max(1, Math.min(6, Number(value) || 1)));
  const total = dieOne + dieTwo;
  const isDouble = dieOne === dieTwo;
  next.dice = [dieOne, dieTwo];
  next.lastRollTotal = total;
  next.rolled = true;
  next.lastCard = null;
  addLog(next, `${player.name} rolls ${dieOne} + ${dieTwo} = ${total}.`);

  if (player.inCourt) {
    if (isDouble) {
      player.inCourt = false;
      player.courtTurns = 0;
      next.doublesStreak = 0;
      next.extraTurn = false;
      addLog(next, `${player.name} rolls doubles and walks out of Housing Court.`, "good");
      movePlayer(next, player.id, total);
      resolveLanding(next, player.id);
      return next;
    }

    player.courtTurns += 1;
    next.extraTurn = false;
    if (player.courtTurns >= 3) {
      player.inCourt = false;
      player.courtTurns = 0;
      chargePlayer(next, player.id, COURT_FINE, { toPot: true, reason: "Housing Court fine" });
      addLog(next, `${player.name} has served three turns, pays ${money(COURT_FINE)}, and moves.`, "warning");
      movePlayer(next, player.id, total);
      resolveLanding(next, player.id);
    } else {
      addLog(next, `${player.name} stays in Housing Court (${player.courtTurns}/3).`, "warning");
    }
    return next;
  }

  if (isDouble) {
    next.doublesStreak += 1;
    if (next.doublesStreak >= 3) {
      sendToCourt(next, player.id, "three doubles in a row");
      return next;
    }
    next.extraTurn = true;
  } else {
    next.doublesStreak = 0;
    next.extraTurn = false;
  }

  movePlayer(next, player.id, total);
  resolveLanding(next, player.id);
  return next;
}

export function payCourtFine(state, playerId = currentPlayer(state)?.id) {
  if (state.status !== "playing" || state.rolled || state.debt) return state;
  const next = clone(state);
  const player = playerById(next, playerId);
  if (!player?.inCourt || player.cash < COURT_FINE) return state;
  chargePlayer(next, playerId, COURT_FINE, { toPot: true, reason: "Housing Court fine" });
  player.inCourt = false;
  player.courtTurns = 0;
  addLog(next, `${player.name} pays ${money(COURT_FINE)} and leaves Housing Court.`, "warning");
  return next;
}

export function useCourtPass(state, playerId = currentPlayer(state)?.id) {
  if (state.status !== "playing" || state.rolled) return state;
  const next = clone(state);
  const player = playerById(next, playerId);
  if (!player?.inCourt || !player.courtPasses) return state;
  player.courtPasses -= 1;
  player.inCourt = false;
  player.courtTurns = 0;
  addLog(next, `${player.name} uses a continuance and leaves Housing Court.`, "good");
  return next;
}

export function buyPendingProperty(state) {
  if (state.pendingAction?.type !== "purchase" || state.debt) return state;
  const next = clone(state);
  const { playerId, spaceId } = next.pendingAction;
  const player = playerById(next, playerId);
  const space = getSpace(spaceId);
  if (!player || !space || ownershipFor(next, spaceId) || player.cash < space.price) return state;

  player.cash -= space.price;
  setOwnership(next, spaceId, { ownerId: playerId, upgrades: 0, mortgaged: false });
  next.pendingAction = null;
  addLog(next, `${player.name} buys ${space.name} for ${money(space.price)}.`, "good");
  return next;
}

function finalizeAuction(state, winnerId = null) {
  const auction = state.auction;
  if (!auction) return;
  const space = getSpace(auction.spaceId);
  if (winnerId && auction.highBid > 0) {
    const winner = playerById(state, winnerId);
    if (winner && winner.cash >= auction.highBid) {
      winner.cash -= auction.highBid;
      setOwnership(state, auction.spaceId, { ownerId: winnerId, upgrades: 0, mortgaged: false });
      addLog(state, `${winner.name} wins ${space.name} at auction for ${money(auction.highBid)}.`, "good");
    }
  } else {
    addLog(state, `${space.name} gets no bids and stays with the bank.`);
  }
  state.auction = null;
}

function nextAuctionBidder(state, afterId) {
  const auction = state.auction;
  if (!auction) return null;
  const eligible = auction.bidderIds.filter((id) => !auction.passedIds.includes(id));

  if (auction.highBidderId && eligible.length === 1 && eligible[0] === auction.highBidderId) {
    finalizeAuction(state, auction.highBidderId);
    return null;
  }
  if (!auction.highBidderId && eligible.length === 0) {
    finalizeAuction(state, null);
    return null;
  }

  const startIndex = Math.max(0, auction.bidderIds.indexOf(afterId));
  for (let offset = 1; offset <= auction.bidderIds.length; offset += 1) {
    const id = auction.bidderIds[(startIndex + offset) % auction.bidderIds.length];
    if (auction.passedIds.includes(id)) continue;
    if (auction.highBidderId && id === auction.highBidderId && eligible.length > 1) continue;
    auction.currentBidderId = id;
    return id;
  }

  if (auction.highBidderId) finalizeAuction(state, auction.highBidderId);
  else finalizeAuction(state, null);
  return null;
}

export function startAuction(state) {
  if (state.pendingAction?.type !== "purchase") return state;
  const next = clone(state);
  const spaceId = next.pendingAction.spaceId;
  const bidders = activePlayers(next).filter((player) => player.cash >= 10);
  next.pendingAction = null;
  if (!bidders.length) return next;

  next.auction = {
    spaceId,
    bidderIds: bidders.map((player) => player.id),
    currentBidderId: bidders[0].id,
    highBid: 0,
    highBidderId: null,
    passedIds: [],
    minIncrement: 10,
  };
  addLog(next, `${getSpace(spaceId).name} goes to auction.`, "warning");
  return next;
}

export function placeAuctionBid(state, playerId, amount) {
  if (!state.auction || state.auction.currentBidderId !== playerId) return state;
  const next = clone(state);
  const player = playerById(next, playerId);
  const auction = next.auction;
  const bid = Math.floor(Number(amount));
  const minimum = auction.highBid + auction.minIncrement;
  if (!player || bid < minimum || bid > player.cash) return state;

  auction.highBid = bid;
  auction.highBidderId = playerId;
  addLog(next, `${player.name} bids ${money(bid)}.`, "info");
  nextAuctionBidder(next, playerId);
  return next;
}

export function passAuction(state, playerId) {
  if (!state.auction || state.auction.currentBidderId !== playerId) return state;
  const next = clone(state);
  const player = playerById(next, playerId);
  if (!next.auction.passedIds.includes(playerId)) next.auction.passedIds.push(playerId);
  addLog(next, `${player?.name || "A player"} passes on the auction.`);
  nextAuctionBidder(next, playerId);
  return next;
}

export function canUpgradeProperty(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const owned = ownershipFor(state, spaceId);
  const player = playerById(state, playerId);
  if (!space || space.type !== "property" || !owned || owned.ownerId !== playerId || !player) return false;
  if (owned.mortgaged || owned.upgrades >= MAX_UPGRADES || player.cash < space.upgradeCost) return false;
  if (!ownsWholeGroup(state, playerId, space.group) || groupHasMortgage(state, space.group)) return false;
  const levels = groupSpaces(space.group).map((item) => ownershipFor(state, item.id)?.upgrades || 0);
  return owned.upgrades === Math.min(...levels);
}

export function upgradeProperty(state, playerId, spaceId) {
  if (!canUpgradeProperty(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = getSpace(spaceId);
  const player = playerById(next, playerId);
  const owned = ownershipFor(next, spaceId);
  player.cash -= space.upgradeCost;
  owned.upgrades += 1;
  addLog(next, `${player.name} adds an upgrade to ${space.name} for ${money(space.upgradeCost)}.`, "good");
  return next;
}

export function canSellUpgrade(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const owned = ownershipFor(state, spaceId);
  if (!space || space.type !== "property" || owned?.ownerId !== playerId || !owned.upgrades) return false;
  const levels = groupSpaces(space.group).map((item) => ownershipFor(state, item.id)?.upgrades || 0);
  return owned.upgrades === Math.max(...levels);
}

export function sellUpgrade(state, playerId, spaceId) {
  if (!canSellUpgrade(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = getSpace(spaceId);
  const player = playerById(next, playerId);
  const owned = ownershipFor(next, spaceId);
  owned.upgrades -= 1;
  const refund = Math.floor(space.upgradeCost / 2);
  player.cash += refund;
  addLog(next, `${player.name} strips an upgrade from ${space.name} for ${money(refund)} cash.`, "warning");
  maybeClearDebt(next, playerId);
  return next;
}

export function canMortgageProperty(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const owned = ownershipFor(state, spaceId);
  if (!space || !owned || owned.ownerId !== playerId || owned.mortgaged) return false;
  if (space.type === "property") {
    const group = groupSpaces(space.group);
    if (group.some((item) => (ownershipFor(state, item.id)?.upgrades || 0) > 0)) return false;
  }
  return true;
}

export function mortgageProperty(state, playerId, spaceId) {
  if (!canMortgageProperty(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = getSpace(spaceId);
  const player = playerById(next, playerId);
  const owned = ownershipFor(next, spaceId);
  owned.mortgaged = true;
  player.cash += space.mortgage;
  addLog(next, `${player.name} mortgages ${space.name} for ${money(space.mortgage)}.`, "warning");
  maybeClearDebt(next, playerId);
  return next;
}

export function canUnmortgageProperty(state, playerId, spaceId) {
  const space = getSpace(spaceId);
  const owned = ownershipFor(state, spaceId);
  const player = playerById(state, playerId);
  if (!space || owned?.ownerId !== playerId || !owned.mortgaged || !player) return false;
  return player.cash >= Math.ceil(space.mortgage * 1.1);
}

export function unmortgageProperty(state, playerId, spaceId) {
  if (!canUnmortgageProperty(state, playerId, spaceId)) return state;
  const next = clone(state);
  const space = getSpace(spaceId);
  const player = playerById(next, playerId);
  const owned = ownershipFor(next, spaceId);
  const cost = Math.ceil(space.mortgage * 1.1);
  player.cash -= cost;
  owned.mortgaged = false;
  addLog(next, `${player.name} clears the mortgage on ${space.name} for ${money(cost)}.`, "good");
  return next;
}

export function proposeTrade(state, trade) {
  if (state.status !== "playing" || state.pendingTrade || state.auction || state.pendingAction || state.debt) return state;
  const next = clone(state);
  const from = playerById(next, trade.fromId);
  const to = playerById(next, trade.toId);
  if (!from || !to || from.bankrupt || to.bankrupt || from.id === to.id) return state;

  const offerIds = [...new Set(trade.offerPropertyIds || [])];
  const requestIds = [...new Set(trade.requestPropertyIds || [])];
  const offerCash = Math.max(0, Math.floor(Number(trade.offerCash) || 0));
  const requestCash = Math.max(0, Math.floor(Number(trade.requestCash) || 0));

  if (offerCash > from.cash || requestCash > to.cash) return state;
  const validOffer = offerIds.every((id) => {
    const owned = ownershipFor(next, id);
    return owned?.ownerId === from.id && !(owned.upgrades > 0);
  });
  const validRequest = requestIds.every((id) => {
    const owned = ownershipFor(next, id);
    return owned?.ownerId === to.id && !(owned.upgrades > 0);
  });
  if (!validOffer || !validRequest || (!offerIds.length && !requestIds.length && !offerCash && !requestCash)) return state;

  next.pendingTrade = { fromId: from.id, toId: to.id, offerPropertyIds: offerIds, requestPropertyIds: requestIds, offerCash, requestCash };
  addLog(next, `${from.name} proposes a trade to ${to.name}.`, "info");
  return next;
}

export function acceptTrade(state, playerId) {
  if (!state.pendingTrade || state.pendingTrade.toId !== playerId) return state;
  const next = clone(state);
  const trade = next.pendingTrade;
  const from = playerById(next, trade.fromId);
  const to = playerById(next, trade.toId);
  if (!from || !to || from.cash < trade.offerCash || to.cash < trade.requestCash) return state;

  from.cash -= trade.offerCash;
  to.cash += trade.offerCash;
  to.cash -= trade.requestCash;
  from.cash += trade.requestCash;
  trade.offerPropertyIds.forEach((spaceId) => { ownershipFor(next, spaceId).ownerId = to.id; });
  trade.requestPropertyIds.forEach((spaceId) => { ownershipFor(next, spaceId).ownerId = from.id; });
  next.pendingTrade = null;
  addLog(next, `${to.name} accepts ${from.name}'s trade.`, "good");
  return next;
}

export function rejectTrade(state, playerId) {
  if (!state.pendingTrade || state.pendingTrade.toId !== playerId) return state;
  const next = clone(state);
  const from = playerById(next, next.pendingTrade.fromId);
  const to = playerById(next, playerId);
  next.pendingTrade = null;
  addLog(next, `${to?.name || "The other player"} rejects ${from?.name || "the"} trade.`);
  return next;
}

export function declareBankruptcy(state, playerId) {
  const next = clone(state);
  const player = playerById(next, playerId);
  if (!player || player.bankrupt) return state;

  getPlayerProperties(next, playerId).forEach(({ space }) => setOwnership(next, space.id, null));
  player.cash = 0;
  player.bankrupt = true;
  player.inCourt = false;
  if (next.debt?.playerId === playerId) next.debt = null;
  if (next.pendingAction?.playerId === playerId) next.pendingAction = null;
  if (next.pendingTrade && [next.pendingTrade.fromId, next.pendingTrade.toId].includes(playerId)) next.pendingTrade = null;
  addLog(next, `${player.name} is bankrupt. The bank takes the keys.`, "danger");
  checkGameOver(next);
  return next;
}

export function autoResolveDebt(state, playerId) {
  let next = clone(state);
  let player = playerById(next, playerId);
  if (!player || player.cash >= 0) {
    maybeClearDebt(next, playerId);
    return next;
  }

  const improved = getPlayerProperties(next, playerId)
    .filter(({ ownership }) => ownership.upgrades > 0)
    .sort((a, b) => (b.ownership.upgrades || 0) - (a.ownership.upgrades || 0));
  for (const item of improved) {
    while (player.cash < 0 && canSellUpgrade(next, playerId, item.space.id)) {
      next = sellUpgrade(next, playerId, item.space.id);
      player = playerById(next, playerId);
    }
  }

  const mortgageable = getPlayerProperties(next, playerId)
    .filter(({ space }) => canMortgageProperty(next, playerId, space.id))
    .sort((a, b) => b.space.mortgage - a.space.mortgage);
  for (const item of mortgageable) {
    if (player.cash >= 0) break;
    next = mortgageProperty(next, playerId, item.space.id);
    player = playerById(next, playerId);
  }

  if (player.cash < 0) return declareBankruptcy(next, playerId);
  maybeClearDebt(next, playerId);
  return next;
}

export function endTurn(state) {
  if (state.status !== "playing" || !state.rolled || state.pendingAction || state.auction || state.pendingTrade || state.debt) return state;
  const next = clone(state);
  const player = currentPlayer(next);
  if (!player) return state;

  if (next.extraTurn && !player.bankrupt && !player.inCourt) {
    next.rolled = false;
    next.extraTurn = false;
    next.lastCard = null;
    next.turnCount += 1;
    addLog(next, `${player.name} earned another roll with doubles.`, "good");
    return next;
  }

  const oldIndex = next.currentPlayerIndex;
  const newIndex = nextActiveIndex(next, oldIndex);
  next.currentPlayerIndex = newIndex;
  if (newIndex <= oldIndex) next.round += 1;
  next.rolled = false;
  next.lastRollTotal = 0;
  next.lastCard = null;
  next.doublesStreak = 0;
  next.extraTurn = false;
  next.turnCount += 1;
  checkGameOver(next);
  if (next.status === "playing") addLog(next, `${currentPlayer(next).name}'s turn.`);
  return next;
}

export function botPurchaseDecision(state, playerId, spaceId) {
  const player = playerById(state, playerId);
  const space = getSpace(spaceId);
  if (!player || !space || player.cash < space.price) return false;
  const reserve = player.botLevel === "hard" ? 150 : player.botLevel === "easy" ? 350 : 250;
  let attraction = 1;
  if (space.type === "property") {
    const groupOwned = groupSpaces(space.group).filter((item) => ownershipFor(state, item.id)?.ownerId === playerId).length;
    attraction += groupOwned * 0.35;
  } else if (space.type === "business") {
    attraction += countOwnedType(state, playerId, "business") * 0.2;
  } else if (space.type === "utility") {
    attraction += countOwnedType(state, playerId, "utility") * 0.3;
  }
  return player.cash - space.price >= reserve / attraction;
}

export function botAuctionLimit(state, playerId, spaceId) {
  const player = playerById(state, playerId);
  const space = getSpace(spaceId);
  if (!player || !space) return 0;
  const reserve = player.botLevel === "hard" ? 120 : player.botLevel === "easy" ? 350 : 220;
  let multiplier = player.botLevel === "hard" ? 1.15 : player.botLevel === "easy" ? 0.8 : 1;
  if (space.type === "property") {
    const ownedInGroup = groupSpaces(space.group).filter((item) => ownershipFor(state, item.id)?.ownerId === playerId).length;
    multiplier += ownedInGroup * 0.25;
  }
  return Math.max(0, Math.min(player.cash - reserve, Math.round(space.price * multiplier)));
}

export function botUpgradeChoice(state, playerId) {
  const player = playerById(state, playerId);
  if (!player || player.cash < 300) return null;
  return getPlayerProperties(state, playerId)
    .filter(({ space }) => canUpgradeProperty(state, playerId, space.id))
    .sort((a, b) => a.space.upgradeCost - b.space.upgradeCost)[0]?.space.id ?? null;
}

export function describeSpace(state, spaceId) {
  const space = getSpace(spaceId);
  const owned = ownershipFor(state, spaceId);
  if (!space) return null;
  const owner = owned ? playerById(state, owned.ownerId) : null;
  return {
    ...space,
    groupName: space.group ? GROUPS[space.group]?.name : null,
    groupColor: space.group ? GROUPS[space.group]?.color : null,
    owner,
    ownership: owned,
    currentRent: owned ? calculateRent(state, spaceId) : null,
  };
}

export function isOwnable(space) {
  return OWNABLE_TYPES.has(space?.type);
}

export { CASH_STASH_POSITION, COURT_FINE, COURT_POSITION, GO_TO_COURT_POSITION };
