import {
  acceptTrade,
  autoResolveDebt,
  botAuctionLimit,
  botPurchaseDecision,
  buyPendingProperty,
  currentPlayer,
  passAuction,
  placeAuctionBid,
  startAuction,
} from "./engine.js";
import {
  botChaosAction,
  finishChaosTurn,
  rollStreetDice,
} from "./chaos.js";

function playerById(state, playerId) {
  return state?.players?.find((player) => player.id === playerId) || null;
}

export function botActionActor(state) {
  if (!state || state.status !== "playing") return null;

  if (state.debt) {
    const debtor = playerById(state, state.debt.playerId);
    return debtor?.isBot ? debtor : null;
  }

  if (state.pendingTrade) {
    const tradeTarget = playerById(state, state.pendingTrade.toId);
    return tradeTarget?.isBot ? tradeTarget : null;
  }

  if (state.auction) {
    const bidder = playerById(state, state.auction.currentBidderId);
    return bidder?.isBot ? bidder : null;
  }

  if (state.pendingAction?.type === "purchase") {
    const buyer = playerById(state, state.pendingAction.playerId);
    return buyer?.isBot ? buyer : null;
  }

  const turnPlayer = currentPlayer(state);
  return turnPlayer?.isBot ? turnPlayer : null;
}

export function runBotStep(state) {
  const bot = botActionActor(state);
  if (!bot) return state;

  if (state.debt?.playerId === bot.id) {
    return autoResolveDebt(state, bot.id);
  }

  if (state.pendingTrade?.toId === bot.id) {
    return acceptTrade(state, bot.id);
  }

  if (state.auction?.currentBidderId === bot.id) {
    const limit = botAuctionLimit(state, bot.id, state.auction.spaceId);
    const nextBid = Math.max(10, state.auction.highBid + state.auction.minIncrement);
    return nextBid <= limit
      ? placeAuctionBid(state, bot.id, nextBid)
      : passAuction(state, bot.id);
  }

  if (state.pendingAction?.playerId === bot.id) {
    return botPurchaseDecision(state, bot.id, state.pendingAction.spaceId)
      ? buyPendingProperty(state)
      : startAuction(state);
  }

  const turnPlayer = currentPlayer(state);
  if (turnPlayer?.id !== bot.id) return state;
  if (!state.rolled) return rollStreetDice(state, "normal");

  const managed = botChaosAction(state, bot.id);
  if (managed) return managed;
  return finishChaosTurn(state);
}
