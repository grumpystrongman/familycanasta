import { ADVENTURE_BY_ID, HEROES } from "./data.js";
import {
  advanceCombatTurn,
  castPartyVote,
  completeAdventure,
  continueStoryScene,
  createCampaign,
  currentCombatActor,
  currentScene,
  endHeroTurn,
  finishCombat,
  moveCombatActor,
  moveToScene,
  recoverFromDefeat,
  resolvePartyVote,
  rollCheck,
  runAutomaticTurns,
  startCombat,
  useAbility,
} from "./engine.js";
import { useTileAbility } from "./specialActions.js";

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function heroForUid(state, uid) {
  const heroId = state.seatHeroes?.[uid];
  return state.campaign?.heroes?.find((hero) => hero.id === heroId) || null;
}

function memberForUid(members, uid) {
  return members.find((member) => member.uid === uid) || null;
}

function hostUid(members) {
  return members.find((member) => member.isHost)?.uid || members[0]?.uid;
}

function requireHost(actorUid, members) {
  if (actorUid !== hostUid(members)) throw new Error("Only the host can advance this part of the adventure.");
}

function availableHeroId(selections, preferredIndex = 0) {
  const used = new Set(Object.values(selections || {}).filter(Boolean));
  for (let offset = 0; offset < HEROES.length; offset += 1) {
    const candidate = HEROES[(preferredIndex + offset) % HEROES.length];
    if (!used.has(candidate.id)) return candidate.id;
  }
  return HEROES[0].id;
}

function humanHeroIds(members, state) {
  return members
    .filter((member) => !member.isRobot)
    .map((member) => state.seatHeroes?.[member.uid])
    .filter(Boolean);
}

function appendNetworkLog(campaign, entry) {
  campaign.log = [...(campaign.log || []), {
    id: `${entry.type || "event"}-${Date.now()}-${campaign.log?.length || 0}`,
    ...entry,
  }].slice(-120);
}

function addHeroFlag(flags, flag, heroId) {
  if (!flag) return;
  const current = flags[flag];
  const heroes = Array.isArray(current) ? current : current ? [current] : [];
  flags[flag] = Array.from(new Set([...heroes, heroId]));
}

export function createPixelQuestGameState(members, rules = {}) {
  const adventureId = ADVENTURE_BY_ID[rules.adventureId] ? rules.adventureId : "bells-blackhollow";
  const selections = {};
  for (const member of members) {
    if (member.isRobot) selections[member.uid] = availableHeroId(selections, Number(member.seat || 0));
  }
  return {
    phase: "hero-select",
    roundNumber: 0,
    adventureId,
    difficulty: rules.difficulty || "story",
    selections,
    seatHeroes: {},
    campaign: null,
    message: "Choose a hero. Each adventurer must be unique.",
  };
}

function beginCampaign(state, actorUid, members) {
  requireHost(actorUid, members);
  const selections = { ...(state.selections || {}) };
  for (const member of members) {
    if (!selections[member.uid]) {
      if (member.isRobot) selections[member.uid] = availableHeroId(selections, Number(member.seat || 0));
      else throw new Error(`${member.nickname} still needs to choose a hero.`);
    }
  }
  const ordered = [...members].sort((a, b) => Number(a.seat) - Number(b.seat));
  const heroIds = ordered.map((member) => selections[member.uid]);
  const controllers = ordered.map((member) => member.isRobot ? "ai" : "human");
  const seed = `${state.adventureId}:${Date.now()}:${ordered.map((member) => member.uid).join("|")}`;
  const campaign = createCampaign({ adventureId: state.adventureId, heroIds, controllers, seed });
  return {
    ...state,
    phase: "playing",
    roundNumber: 1,
    selections,
    seatHeroes: Object.fromEntries(ordered.map((member, index) => [member.uid, heroIds[index]])),
    campaign,
    message: "The adventure begins.",
  };
}

function selectHero(state, actorUid, heroId, members) {
  const member = memberForUid(members, actorUid);
  if (!member || member.isRobot) throw new Error("That seat cannot choose a human hero.");
  if (!HEROES.some((hero) => hero.id === heroId)) throw new Error("Choose a valid hero.");
  const takenBy = Object.entries(state.selections || {}).find(([uid, selected]) => uid !== actorUid && selected === heroId);
  if (takenBy) throw new Error("Another adventurer already chose that hero.");
  return { ...state, selections: { ...(state.selections || {}), [actorUid]: heroId }, message: `${member.nickname} is ready.` };
}

function ensureOwnTurn(state, actorUid) {
  const hero = heroForUid(state, actorUid);
  const current = currentCombatActor(state.campaign);
  if (!hero || !current || current.id !== hero.id) throw new Error("Wait for your hero's turn.");
  return hero;
}

function autoResolve(campaign) {
  if (!campaign?.combat || campaign.combat.victory) return campaign;
  return runAutomaticTurns(campaign, 48);
}

function resolveSoloPartyChoice(campaign, scene, hero, choiceId) {
  const choice = scene.choices?.find((entry) => entry.id === choiceId);
  if (!choice) throw new Error("Choose a valid party action.");
  const next = clone(campaign);
  next.votes = { [hero.id]: choiceId };
  if (choice.flag) next.flags[choice.flag] = true;
  appendNetworkLog(next, {
    type: "decision",
    text: `${hero.name} chose for the party: ${choice.label}.`,
  });
  return moveToScene(next, choice.next);
}

function resolveIndividualPrivateChoice(campaign, scene, hero, choiceId, members, state) {
  const choice = scene.choices?.find((entry) => entry.id === choiceId);
  if (!choice) throw new Error("Choose a valid private action.");
  const key = `${scene.id}:${hero.id}`;
  if (campaign.privateChoices?.[key]) throw new Error("Your private decision is already locked in.");
  const next = clone(campaign);
  next.privateChoices ||= {};
  next.privateChoices[key] = choiceId;
  addHeroFlag(next.flags, choice.flag, hero.id);
  appendNetworkLog(next, {
    type: "secret",
    text: `${hero.name} locked in a private decision.`,
    private: true,
  });

  const everyoneLocked = humanHeroIds(members, state).every((heroId) => next.privateChoices[`${scene.id}:${heroId}`]);
  return everyoneLocked ? moveToScene(next, scene.next) : next;
}

function recordSkillAttempt(campaign, scene, hero) {
  const sceneAttempts = campaign.skillAttempts?.[scene.id] || {};
  if (sceneAttempts[hero.id]) throw new Error("Your hero already took this skill turn.");
  const result = rollCheck(campaign, {
    actorName: hero.name,
    statValue: Number(hero.stats?.[scene.stat] || 0),
    dc: scene.dc,
    label: `${scene.title} · ${scene.stat}`,
  });
  const next = result.state;
  next.skillAttempts ||= {};
  next.skillAttempts[scene.id] ||= {};
  next.skillAttempts[scene.id][hero.id] = {
    heroId: hero.id,
    success: result.success,
    raw: result.raw,
    total: result.total,
  };
  if (result.success) next.stats.checksPassed += 1;
  else next.stats.checksFailed += 1;
  appendNetworkLog(next, {
    type: "check",
    text: `${hero.name} ${result.success ? "succeeds" : "fails"} their part of the challenge (${result.total} vs DC ${scene.dc}).`,
    success: result.success,
  });
  return next;
}

function resolveGroupSkillTurn(campaign, scene, hero, members, state) {
  let next = recordSkillAttempt(campaign, scene, hero);
  const humanIds = humanHeroIds(members, state);
  const humanDone = humanIds.every((heroId) => next.skillAttempts?.[scene.id]?.[heroId]);
  if (!humanDone) return next;

  for (const aiHero of next.heroes.filter((entry) => entry.controller === "ai" && !entry.downed)) {
    if (!next.skillAttempts?.[scene.id]?.[aiHero.id]) next = recordSkillAttempt(next, scene, aiHero);
  }

  const participating = next.heroes.filter((entry) => !entry.downed);
  const attempts = participating.map((entry) => next.skillAttempts?.[scene.id]?.[entry.id]).filter(Boolean);
  const successes = attempts.filter((attempt) => attempt.success).length;
  const required = Math.max(1, Math.ceil(attempts.length / 2));
  const success = successes >= required;
  if (success && scene.flagOnSuccess) next.flags[scene.flagOnSuccess] = true;
  appendNetworkLog(next, {
    type: "check",
    text: `${successes}/${attempts.length} heroes succeeded. ${success ? scene.successText || "The party clears the challenge." : scene.failText || "The party suffers the consequence."}`,
    success,
  });
  const finalRoll = next.lastRoll;
  next = moveToScene(next, success ? scene.successNext : scene.failNext);
  next.lastRoll = finalRoll;
  return next;
}

export function reducePixelQuest(state, actorUid, action, members) {
  if (!action?.type) throw new Error("Choose an action.");
  if (state.phase === "hero-select") {
    if (action.type === "select-hero") return selectHero(state, actorUid, action.heroId, members);
    if (action.type === "begin-adventure") return beginCampaign(state, actorUid, members);
    throw new Error("Choose a hero before the adventure begins.");
  }
  if (state.phase !== "playing" || !state.campaign) throw new Error("The adventure is not active.");

  let next = clone(state);
  let campaign = next.campaign;
  const scene = currentScene(campaign);
  const myHero = heroForUid(next, actorUid);

  switch (action.type) {
    case "continue-story":
      requireHost(actorUid, members);
      campaign = continueStoryScene(campaign);
      break;
    case "vote":
      if (!myHero) throw new Error("No hero is assigned to your seat.");
      if (scene?.type !== "party-choice") throw new Error("There is no party decision right now.");
      if (humanHeroIds(members, next).length === 1) campaign = resolveSoloPartyChoice(campaign, scene, myHero, action.choiceId);
      else campaign = castPartyVote(campaign, myHero.id, action.choiceId);
      break;
    case "resolve-vote": {
      requireHost(actorUid, members);
      const resolved = resolvePartyVote(campaign);
      if (!resolved.resolved) throw new Error("Every human adventurer must vote before the party moves on.");
      campaign = resolved.state;
      break;
    }
    case "private-choice":
      if (!myHero) throw new Error("No hero is assigned to your seat.");
      if (scene?.type !== "private") throw new Error("There is no private decision right now.");
      campaign = resolveIndividualPrivateChoice(campaign, scene, myHero, action.choiceId, members, next);
      break;
    case "skill-check":
      if (!myHero) throw new Error("No hero is assigned to your seat.");
      if (scene?.type !== "skill") throw new Error("There is no skill challenge right now.");
      campaign = resolveGroupSkillTurn(campaign, scene, myHero, members, next);
      break;
    case "start-combat":
      requireHost(actorUid, members);
      campaign = autoResolve(startCombat(campaign));
      break;
    case "move": {
      ensureOwnTurn(next, actorUid);
      const result = moveCombatActor(campaign, myHero.id, Number(action.x), Number(action.y));
      if (!result.ok) throw new Error(result.reason);
      campaign = result.state;
      break;
    }
    case "ability": {
      ensureOwnTurn(next, actorUid);
      const result = useAbility(campaign, myHero.id, action.abilityId, action.targetId);
      if (!result.ok) throw new Error(result.reason);
      campaign = autoResolve(result.state);
      break;
    }
    case "tile-ability": {
      ensureOwnTurn(next, actorUid);
      const result = useTileAbility(campaign, myHero.id, action.abilityId, Number(action.x), Number(action.y));
      if (!result.ok) throw new Error(result.reason);
      campaign = autoResolve(result.state);
      break;
    }
    case "end-turn":
      ensureOwnTurn(next, actorUid);
      campaign = autoResolve(endHeroTurn(campaign));
      break;
    case "finish-combat":
      requireHost(actorUid, members);
      campaign = finishCombat(campaign);
      break;
    case "recover-defeat":
      requireHost(actorUid, members);
      campaign = recoverFromDefeat(campaign);
      break;
    case "complete-adventure":
      requireHost(actorUid, members);
      campaign = completeAdventure(campaign);
      next.phase = campaign.completed ? "complete" : "playing";
      break;
    case "dev-skip-turn":
      requireHost(actorUid, members);
      campaign = advanceCombatTurn(campaign);
      break;
    default:
      throw new Error(`Unknown PixelQuest action: ${action.type}`);
  }

  next.campaign = campaign;
  next.roundNumber = campaign.combat?.round || next.roundNumber;
  next.message = currentScene(campaign)?.title || scene?.title || "The adventure continues.";
  return next;
}

export function pixelQuestSeatForUid(state, uid) {
  return state?.seatHeroes?.[uid] || state?.selections?.[uid] || null;
}
