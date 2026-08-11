import { ADVENTURE_BY_ID, ADVENTURES, ENEMIES, HERO_BY_ID, HEROES, MAPS, adventureScene } from "./data.js";

export const PIXELQUEST_RULES = Object.freeze({
  minPlayers: 1,
  maxPlayers: 8,
  proficiency: 2,
  boardWidth: 12,
  boardHeight: 8,
  critMultiplier: 2,
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const key = (x, y) => `${x},${y}`;

export function normalizeSeed(seed) {
  const text = String(seed ?? "pixelquest");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function nextRandomValue(rngState) {
  const nextState = (Math.imul(rngState >>> 0, 1664525) + 1013904223) >>> 0;
  return { rngState: nextState, value: nextState / 4294967296 };
}

export function rollDieFromState(rngState, sides = 20) {
  if (![4, 6, 8, 10, 12, 20, 100].includes(Number(sides))) throw new Error(`Unsupported die d${sides}`);
  const next = nextRandomValue(rngState);
  return { rngState: next.rngState, raw: 1 + Math.floor(next.value * sides), sides };
}

export function parseDice(expression) {
  const match = String(expression || "").trim().match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/i);
  if (!match) throw new Error(`Invalid dice expression: ${expression}`);
  return {
    count: Number(match[1]),
    sides: Number(match[2]),
    modifier: match[3] ? Number(`${match[3]}${match[4]}`) : 0,
  };
}

export function rollExpression(rngState, expression) {
  const { count, sides, modifier } = parseDice(expression);
  let state = rngState;
  const rolls = [];
  for (let i = 0; i < count; i += 1) {
    const result = rollDieFromState(state, sides);
    state = result.rngState;
    rolls.push(result.raw);
  }
  return { rngState: state, rolls, modifier, total: rolls.reduce((sum, value) => sum + value, 0) + modifier, expression };
}

function statBonus(hero, stat) {
  return Number(hero?.stats?.[stat] || 0);
}

function makeRollRecord({ actorName, kind, die = "d20", raw, modifiers = [], total, target = null, outcome, detail = "" }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    actorName,
    kind,
    die,
    raw,
    modifiers,
    total,
    target,
    outcome,
    detail,
  };
}

function appendLog(state, entry) {
  state.log = [...(state.log || []), { id: `log-${state.log?.length || 0}-${Date.now()}`, ...entry }].slice(-120);
}

function appendRoll(state, record) {
  state.rollHistory = [...(state.rollHistory || []), record].slice(-120);
  state.lastRoll = record;
}

export function rollCheck(campaign, { actorName, statValue = 0, dc = 10, label = "Skill Check", advantage = 0 }) {
  const state = clone(campaign);
  const first = rollDieFromState(state.rngState, 20);
  state.rngState = first.rngState;
  let raw = first.raw;
  const extraRolls = [];
  if (advantage !== 0) {
    const second = rollDieFromState(state.rngState, 20);
    state.rngState = second.rngState;
    extraRolls.push(second.raw);
    raw = advantage > 0 ? Math.max(first.raw, second.raw) : Math.min(first.raw, second.raw);
  }
  const total = raw + statValue + PIXELQUEST_RULES.proficiency;
  const success = raw === 20 || (raw !== 1 && total >= dc);
  appendRoll(state, makeRollRecord({
    actorName,
    kind: label,
    raw,
    modifiers: [statValue, PIXELQUEST_RULES.proficiency],
    total,
    target: dc,
    outcome: raw === 20 ? "critical" : raw === 1 ? "fumble" : success ? "success" : "failure",
    detail: extraRolls.length ? `Rolled ${first.raw} and ${extraRolls[0]}.` : "",
  }));
  return { state, success, total, raw };
}

function heroActor(hero, index, controller = "human") {
  return {
    id: hero.id,
    templateId: hero.id,
    type: "hero",
    name: hero.name,
    className: hero.className,
    role: hero.role,
    controller,
    stats: clone(hero.stats),
    maxHp: hero.maxHp,
    hp: hero.maxHp,
    defense: hero.defense,
    baseDefense: hero.defense,
    move: hero.move,
    initiative: hero.initiative,
    abilities: clone(hero.abilities),
    cooldowns: {},
    conditions: [],
    buffs: [],
    downed: false,
    gold: 0,
    xp: 0,
    inventory: [],
    x: 0,
    y: index + 1,
    acted: false,
  };
}

export function createCampaign({ adventureId = ADVENTURES[0].id, heroIds = [HEROES[0].id], controllers = [], seed = Date.now() } = {}) {
  const adventure = ADVENTURE_BY_ID[adventureId];
  if (!adventure) throw new Error(`Unknown adventure: ${adventureId}`);
  const selected = heroIds.slice(0, PIXELQUEST_RULES.maxPlayers).map((id) => HERO_BY_ID[id]).filter(Boolean);
  if (selected.length < PIXELQUEST_RULES.minPlayers) throw new Error("PixelQuest requires at least one hero.");
  const heroes = selected.map((hero, index) => heroActor(hero, index, controllers[index] || "human"));
  const campaign = {
    version: 1,
    adventureId,
    sceneId: adventure.scenes[0].id,
    seed: String(seed),
    rngState: normalizeSeed(seed),
    heroes,
    flags: {},
    gold: 0,
    xp: 0,
    completed: false,
    combat: null,
    votes: {},
    privateChoices: {},
    rollHistory: [],
    lastRoll: null,
    log: [],
    legends: [],
    stats: { crits: 0, fumbles: 0, monstersDefeated: 0, combatsWon: 0, checksPassed: 0, checksFailed: 0 },
  };
  appendLog(campaign, { type: "story", text: adventure.intro });
  return campaign;
}

export function currentAdventure(campaign) {
  return ADVENTURE_BY_ID[campaign?.adventureId] || null;
}

export function currentScene(campaign) {
  const adventure = currentAdventure(campaign);
  return adventureScene(adventure, campaign?.sceneId);
}

export function moveToScene(campaign, sceneId) {
  const state = clone(campaign);
  const scene = adventureScene(currentAdventure(state), sceneId);
  if (!scene) throw new Error(`Unknown scene ${sceneId}`);
  state.sceneId = sceneId;
  state.votes = {};
  state.lastRoll = null;
  appendLog(state, { type: "story", text: scene.text, sceneId });
  return state;
}

export function continueStoryScene(campaign) {
  const scene = currentScene(campaign);
  if (!scene?.next) return campaign;
  return moveToScene(campaign, scene.next);
}

export function castPartyVote(campaign, heroId, choiceId) {
  const state = clone(campaign);
  const scene = currentScene(state);
  if (scene?.type !== "party-choice") throw new Error("Current scene is not a party choice.");
  if (!state.heroes.some((hero) => hero.id === heroId)) throw new Error("Unknown hero voting.");
  if (!scene.choices.some((choice) => choice.id === choiceId)) throw new Error("Unknown choice.");
  state.votes[heroId] = choiceId;
  return state;
}

function aiVoteFor(hero, choices) {
  if (!choices.length) return null;
  const classBias = {
    Vanguard: 0, Berserker: 0, Shadow: 1, Warden: 2, Arcanist: 2, Luminary: 2,
    Oathkeeper: 0, Wildcaller: 2, Troubadour: 1, Engineer: 2, Hexbinder: 1, "Wayfarer Monk": 1,
  };
  return choices[classBias[hero.className] % choices.length]?.id || choices[0].id;
}

export function autoFillAiVotes(campaign) {
  let state = clone(campaign);
  const scene = currentScene(state);
  if (scene?.type !== "party-choice") return state;
  for (const hero of state.heroes) {
    if (hero.controller === "ai" && !state.votes[hero.id]) state.votes[hero.id] = aiVoteFor(hero, scene.choices);
  }
  return state;
}

export function resolvePartyVote(campaign) {
  let state = autoFillAiVotes(campaign);
  const scene = currentScene(state);
  if (scene?.type !== "party-choice") throw new Error("Current scene is not a party choice.");
  const livingHeroes = state.heroes.filter((hero) => !hero.downed);
  const missingHumans = livingHeroes.filter((hero) => hero.controller !== "ai" && !state.votes[hero.id]);
  if (missingHumans.length) return { state, resolved: false, missingHeroIds: missingHumans.map((hero) => hero.id) };

  const counts = new Map();
  for (const choiceId of Object.values(state.votes)) counts.set(choiceId, (counts.get(choiceId) || 0) + 1);
  const max = Math.max(...counts.values());
  let winners = [...counts.entries()].filter(([, count]) => count === max).map(([choiceId]) => choiceId);
  if (winners.length > 1) {
    let bestChoice = winners[0];
    let bestRoll = -1;
    for (const choiceId of winners) {
      const roll = rollDieFromState(state.rngState, 20);
      state.rngState = roll.rngState;
      appendRoll(state, makeRollRecord({ actorName: "The Party", kind: "Fate Roll", raw: roll.raw, modifiers: [], total: roll.raw, target: null, outcome: "tie-break", detail: scene.choices.find((choice) => choice.id === choiceId)?.label || choiceId }));
      if (roll.raw > bestRoll) { bestRoll = roll.raw; bestChoice = choiceId; }
    }
    winners = [bestChoice];
  }

  const choice = scene.choices.find((entry) => entry.id === winners[0]);
  if (choice?.flag) state.flags[choice.flag] = true;
  appendLog(state, { type: "decision", text: `The party chose: ${choice?.label || winners[0]}.` });
  state = moveToScene(state, choice.next);
  return { state, resolved: true, choiceId: choice.id };
}

export function applyPrivateChoice(campaign, heroId, choiceId) {
  let state = clone(campaign);
  const scene = currentScene(state);
  if (scene?.type !== "private") throw new Error("Current scene is not private.");
  const hero = state.heroes.find((entry) => entry.id === heroId);
  if (!hero) throw new Error("Unknown hero.");
  const choice = scene.choices.find((entry) => entry.id === choiceId);
  if (!choice) throw new Error("Unknown private choice.");
  state.privateChoices[`${scene.id}:${heroId}`] = choiceId;
  if (choice.flag) state.flags[choice.flag] = heroId;
  appendLog(state, { type: "secret", text: `${hero.name} made a private decision.`, private: true });
  state = moveToScene(state, scene.next);
  return state;
}

export function resolveSkillScene(campaign, heroId) {
  const scene = currentScene(campaign);
  if (scene?.type !== "skill") throw new Error("Current scene is not a skill challenge.");
  const hero = campaign.heroes.find((entry) => entry.id === heroId) || campaign.heroes.find((entry) => !entry.downed);
  if (!hero) throw new Error("No hero available for skill check.");
  const result = rollCheck(campaign, { actorName: hero.name, statValue: statBonus(hero, scene.stat), dc: scene.dc, label: `${scene.title} · ${scene.stat}` });
  let state = result.state;
  if (result.success) {
    state.stats.checksPassed += 1;
    if (scene.flagOnSuccess) state.flags[scene.flagOnSuccess] = true;
    appendLog(state, { type: "check", text: scene.successText || `${hero.name} succeeds.`, success: true });
  } else {
    state.stats.checksFailed += 1;
    appendLog(state, { type: "check", text: scene.failText || `${hero.name} fails.`, success: false });
  }
  return moveToScene(state, result.success ? scene.successNext : scene.failNext);
}

function tileAt(map, x, y) {
  return map?.[y]?.[x] || "#";
}

export function isWalkable(map, x, y) {
  const tile = tileAt(map, x, y);
  return x >= 0 && y >= 0 && x < PIXELQUEST_RULES.boardWidth && y < PIXELQUEST_RULES.boardHeight && tile !== "#";
}

export function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function occupiedBy(combat, x, y, exceptId = null) {
  return combat.actors.find((actor) => actor.id !== exceptId && !actor.downed && actor.hp > 0 && actor.x === x && actor.y === y) || null;
}

function placeActors(heroes, enemies, map) {
  const heroSpots = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [2, 1], [2, 5], [2, 6]].filter(([x, y]) => isWalkable(map, x, y));
  const enemySpots = [[10, 1], [10, 2], [10, 3], [10, 4], [10, 5], [9, 1], [9, 5], [9, 6]].filter(([x, y]) => isWalkable(map, x, y));
  const heroActors = heroes.map((hero, index) => ({ ...clone(hero), x: heroSpots[index % heroSpots.length][0], y: heroSpots[index % heroSpots.length][1], acted: false }));
  const enemyActors = enemies.map((templateId, index) => {
    const template = ENEMIES[templateId];
    const spot = enemySpots[index % enemySpots.length];
    return {
      id: `${templateId}-${index + 1}`,
      templateId,
      type: "enemy",
      name: template.name,
      glyph: template.glyph,
      palette: template.palette,
      boss: Boolean(template.boss),
      maxHp: template.maxHp,
      hp: template.maxHp,
      defense: template.defense,
      baseDefense: template.defense,
      move: template.move,
      initiative: template.initiative,
      attack: clone(template.attack),
      conditions: [], buffs: [], cooldowns: {},
      x: spot[0], y: spot[1], downed: false, acted: false,
    };
  });
  return [...heroActors, ...enemyActors];
}

export function startCombat(campaign) {
  const state = clone(campaign);
  const scene = currentScene(state);
  if (scene?.type !== "combat") throw new Error("Current scene is not combat.");
  const map = MAPS[scene.map] || MAPS.genericDungeon;
  const actors = placeActors(state.heroes, scene.enemies, map);
  const initiativeRolls = [];
  for (const actor of actors) {
    const roll = rollDieFromState(state.rngState, 20);
    state.rngState = roll.rngState;
    actor.initiativeRoll = roll.raw + (actor.initiative || 0);
    initiativeRolls.push(actor);
  }
  initiativeRolls.sort((a, b) => b.initiativeRoll - a.initiativeRoll || a.name.localeCompare(b.name));
  const order = initiativeRolls.map((actor) => actor.id);
  state.combat = {
    sceneId: scene.id,
    map: clone(map),
    actors,
    order,
    turnIndex: 0,
    round: 1,
    selectedAbilityId: null,
    lastAction: "Combat begins.",
    victory: null,
  };
  appendLog(state, { type: "combat", text: `${scene.title}: combat begins.` });
  return state;
}

export function currentCombatActor(campaign) {
  const combat = campaign?.combat;
  if (!combat?.order?.length) return null;
  return combat.actors.find((actor) => actor.id === combat.order[combat.turnIndex]) || null;
}

export function reachableCells(campaign, actorId) {
  const combat = campaign.combat;
  const actor = combat?.actors.find((entry) => entry.id === actorId);
  if (!combat || !actor || actor.downed) return [];
  const maxMove = actor.move + (actor.buffs?.includes("trailstep") ? 2 : 0);
  const seen = new Set([key(actor.x, actor.y)]);
  const queue = [{ x: actor.x, y: actor.y, d: 0 }];
  const output = [];
  while (queue.length) {
    const node = queue.shift();
    if (node.d > 0) output.push({ x: node.x, y: node.y, distance: node.d });
    if (node.d >= maxMove) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = node.x + dx; const y = node.y + dy; const id = key(x, y);
      if (seen.has(id) || !isWalkable(combat.map, x, y) || occupiedBy(combat, x, y, actor.id)) continue;
      seen.add(id); queue.push({ x, y, d: node.d + 1 });
    }
  }
  return output;
}

export function moveCombatActor(campaign, actorId, x, y) {
  const state = clone(campaign);
  const actor = currentCombatActor(state);
  if (!state.combat || actor?.id !== actorId || actor.type !== "hero") return { state, ok: false, reason: "It is not that hero's turn." };
  const legal = reachableCells(state, actorId).some((cell) => cell.x === x && cell.y === y);
  if (!legal) return { state, ok: false, reason: "That tile is out of movement range." };
  actor.x = x; actor.y = y;
  state.combat.lastAction = `${actor.name} moves.`;
  appendLog(state, { type: "combat", text: state.combat.lastAction });
  return { state, ok: true };
}

function effectiveDefense(actor) {
  let defense = actor.baseDefense ?? actor.defense ?? 10;
  if (actor.buffs?.includes("guarded")) defense += 3;
  if (actor.buffs?.includes("arcane-shield")) defense += 4;
  if (actor.buffs?.includes("sanctuary")) defense += 3;
  if (actor.buffs?.includes("aura")) defense += 1;
  if (actor.conditions?.includes("distracted") || actor.conditions?.includes("cursed")) defense -= 2;
  if (actor.buffs?.includes("raging") || actor.buffs?.includes("reckless")) defense -= 1;
  return defense;
}

function abilityFor(actor, abilityId) {
  return actor.abilities?.find((entry) => entry.id === abilityId) || null;
}

function targetInRange(actor, target, range) {
  return manhattan(actor, target) <= range;
}

function decrementCooldowns(actor) {
  for (const [id, value] of Object.entries(actor.cooldowns || {})) {
    actor.cooldowns[id] = Math.max(0, value - 1);
  }
}

function applyCondition(target, condition) {
  if (!condition) return;
  if (!target.conditions.includes(condition)) target.conditions.push(condition);
}

function applyBuff(target, buff) {
  if (!buff) return;
  if (!target.buffs.includes(buff)) target.buffs.push(buff);
}

function attackAdvantage(actor, ability, target) {
  if (actor.buffs?.includes("inspired")) return 1;
  if (ability.id === "reckless-strike") return 1;
  if (actor.buffs?.includes("hidden")) return 1;
  if (actor.conditions?.includes("blinded")) return -1;
  if (target.buffs?.includes("hidden")) return -1;
  return 0;
}

function rollAttack(state, actor, ability, target) {
  const stat = ability.stat || "strength";
  const bonus = statBonus(actor, stat) + PIXELQUEST_RULES.proficiency + (actor.buffs?.includes("inspired") ? 2 : 0);
  const advantage = attackAdvantage(actor, ability, target);
  const first = rollDieFromState(state.rngState, 20); state.rngState = first.rngState;
  let raw = first.raw;
  let secondRaw = null;
  if (advantage) {
    const second = rollDieFromState(state.rngState, 20); state.rngState = second.rngState; secondRaw = second.raw;
    raw = advantage > 0 ? Math.max(raw, second.raw) : Math.min(raw, second.raw);
  }
  const defense = effectiveDefense(target);
  const total = raw + bonus;
  const hit = raw === 20 || (raw !== 1 && total >= defense);
  const outcome = raw === 20 ? "critical" : raw === 1 ? "fumble" : hit ? "hit" : "miss";
  appendRoll(state, makeRollRecord({ actorName: actor.name, kind: ability.name, raw, modifiers: [bonus], total, target: defense, outcome, detail: secondRaw == null ? "" : `Advantage roll: ${first.raw}/${secondRaw}` }));
  if (raw === 20) state.stats.crits += 1;
  if (raw === 1) state.stats.fumbles += 1;
  return { hit, raw, crit: raw === 20 };
}

function rollDamage(state, expression, crit = false) {
  if (!expression) return { total: 0, rolls: [] };
  const parsed = parseDice(expression);
  const count = crit ? parsed.count * PIXELQUEST_RULES.critMultiplier : parsed.count;
  let total = parsed.modifier;
  const rolls = [];
  for (let i = 0; i < count; i += 1) {
    const die = rollDieFromState(state.rngState, parsed.sides); state.rngState = die.rngState; rolls.push(die.raw); total += die.raw;
  }
  return { total: Math.max(0, total), rolls };
}

function applyDamage(state, target, amount, source = null) {
  let actual = Math.max(0, amount);
  if (target.conditions?.includes("marked")) actual += 2;
  target.hp = clamp(target.hp - actual, 0, target.maxHp);
  if (target.hp <= 0) {
    target.downed = true;
    if (target.type === "enemy") state.stats.monstersDefeated += 1;
  }
  if (target.buffs?.includes("hidden")) target.buffs = target.buffs.filter((entry) => entry !== "hidden");
  appendLog(state, { type: "damage", text: `${source ? `${source} hits ` : ""}${target.name} for ${actual} damage${target.downed ? " and drops them" : ""}.` });
  return actual;
}

function applyHealing(state, target, amount) {
  const before = target.hp;
  target.hp = clamp(target.hp + amount, 0, target.maxHp);
  if (target.hp > 0) target.downed = false;
  appendLog(state, { type: "heal", text: `${target.name} recovers ${target.hp - before} HP.` });
}

function validAbilityTarget(actor, ability, target) {
  if (!ability || !target) return false;
  if (ability.target === "enemy") return target.type !== actor.type && !target.downed && target.hp > 0 && targetInRange(actor, target, ability.range);
  if (ability.target === "ally") return target.type === actor.type && target.type === "hero" && targetInRange(actor, target, ability.range);
  if (ability.target === "self") return target.id === actor.id;
  return true;
}

export function useAbility(campaign, actorId, abilityId, targetId) {
  const state = clone(campaign);
  const combat = state.combat;
  const actor = currentCombatActor(state);
  if (!combat || !actor || actor.id !== actorId || actor.type !== "hero") return { state, ok: false, reason: "Not that hero's turn." };
  if (actor.downed) return { state, ok: false, reason: "Downed heroes cannot act." };
  const ability = abilityFor(actor, abilityId);
  if (!ability) return { state, ok: false, reason: "Unknown ability." };
  if ((actor.cooldowns?.[ability.id] || 0) > 0) return { state, ok: false, reason: "That ability is cooling down." };
  const target = ability.target === "self" ? actor : combat.actors.find((entry) => entry.id === targetId);
  if (!target && ability.target !== "area" && ability.target !== "tile") return { state, ok: false, reason: "Choose a target." };
  if (target && !validAbilityTarget(actor, ability, target)) return { state, ok: false, reason: "Target is not legal or is out of range." };

  if (ability.sacrifice) {
    if (actor.hp <= ability.sacrifice) return { state, ok: false, reason: "Not enough HP for the bargain." };
    actor.hp -= ability.sacrifice;
    for (const other of actor.abilities) if (other.id !== ability.id) actor.cooldowns[other.id] = 0;
    appendLog(state, { type: "ability", text: `${actor.name} pays ${ability.sacrifice} HP for ${ability.name}.` });
  } else if (ability.revive) {
    if (!target.downed) return { state, ok: false, reason: "Revive requires a downed ally." };
    target.hp = Math.max(1, Math.ceil(target.maxHp * 0.35)); target.downed = false;
    appendLog(state, { type: "heal", text: `${actor.name} revives ${target.name}.` });
  } else if (ability.heal && ability.target === "ally") {
    const healing = rollDamage(state, ability.heal, false).total; applyHealing(state, target, healing);
  } else if (ability.target === "self") {
    applyBuff(actor, ability.buff);
    appendLog(state, { type: "ability", text: `${actor.name} uses ${ability.name}.` });
  } else if (ability.target === "area") {
    const center = target || combat.actors.find((entry) => entry.id === targetId) || actor;
    const targets = combat.actors.filter((entry) => !entry.downed && entry.hp > 0 && manhattan(entry, center) <= (ability.radius || 1));
    for (const entry of targets) {
      if (entry.type !== actor.type && ability.damage) {
        const attack = rollAttack(state, actor, ability, entry);
        if (attack.hit) applyDamage(state, entry, rollDamage(state, ability.damage, attack.crit).total, actor.name);
      }
      if (entry.type === actor.type && ability.heal) applyHealing(state, entry, rollDamage(state, ability.heal, false).total);
      if (entry.type !== actor.type) applyCondition(entry, ability.condition);
    }
  } else if (ability.damage || ability.condition) {
    const attack = rollAttack(state, actor, ability, target);
    if (attack.hit) {
      const damage = rollDamage(state, ability.damage, attack.crit).total;
      if (damage) {
        const dealt = applyDamage(state, target, damage, actor.name);
        if (ability.drain) applyHealing(state, actor, Math.max(1, Math.floor(dealt / 2)));
      }
      applyCondition(target, ability.condition);
      applyBuff(target, ability.buff);
    } else {
      appendLog(state, { type: "miss", text: attack.raw === 1 ? `${actor.name}'s ${ability.name} goes spectacularly wide.` : `${actor.name}'s ${ability.name} misses ${target.name}.` });
    }
  }

  if (ability.cooldown) actor.cooldowns[ability.id] = ability.cooldown;
  if (actor.buffs?.includes("hidden") && ability.damage) actor.buffs = actor.buffs.filter((entry) => entry !== "hidden");
  combat.lastAction = `${actor.name} used ${ability.name}.`;
  return { state: advanceCombatTurn(state), ok: true };
}

function nearestLivingHero(combat, enemy) {
  return combat.actors.filter((actor) => actor.type === "hero" && !actor.downed && actor.hp > 0).sort((a, b) => manhattan(enemy, a) - manhattan(enemy, b))[0] || null;
}

function stepToward(state, actor, target) {
  const options = reachableCellsForAny(state.combat, actor).sort((a, b) => manhattan(a, target) - manhattan(b, target));
  const best = options.find((cell) => manhattan(cell, target) < manhattan(actor, target));
  if (best) { actor.x = best.x; actor.y = best.y; }
}

function reachableCellsForAny(combat, actor) {
  const maxMove = actor.move || 3;
  const seen = new Set([key(actor.x, actor.y)]);
  const queue = [{ x: actor.x, y: actor.y, d: 0 }];
  const output = [];
  while (queue.length) {
    const node = queue.shift();
    if (node.d > 0) output.push(node);
    if (node.d >= maxMove) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = node.x + dx; const y = node.y + dy; const id = key(x, y);
      if (seen.has(id) || !isWalkable(combat.map, x, y) || occupiedBy(combat, x, y, actor.id)) continue;
      seen.add(id); queue.push({ x, y, d: node.d + 1 });
    }
  }
  return output;
}

function enemyAttack(state, enemy, target) {
  const first = rollDieFromState(state.rngState, 20); state.rngState = first.rngState;
  const raw = first.raw; const total = raw + enemy.attack.bonus; const defense = effectiveDefense(target);
  const hit = raw === 20 || (raw !== 1 && total >= defense);
  appendRoll(state, makeRollRecord({ actorName: enemy.name, kind: enemy.attack.name, raw, modifiers: [enemy.attack.bonus], total, target: defense, outcome: raw === 20 ? "critical" : raw === 1 ? "fumble" : hit ? "hit" : "miss" }));
  if (hit) {
    const damage = rollDamage(state, enemy.attack.damage, raw === 20).total;
    applyDamage(state, target, damage, enemy.name);
    applyCondition(target, enemy.attack.condition);
  } else appendLog(state, { type: "miss", text: `${enemy.name} misses ${target.name}.` });
}

export function runEnemyTurn(campaign) {
  let state = clone(campaign);
  const enemy = currentCombatActor(state);
  if (!enemy || enemy.type !== "enemy" || enemy.downed) return advanceCombatTurn(state);
  const target = nearestLivingHero(state.combat, enemy);
  if (!target) return evaluateCombat(state);
  if (!targetInRange(enemy, target, enemy.attack.range)) stepToward(state, enemy, target);
  const refreshedTarget = state.combat.actors.find((entry) => entry.id === target.id);
  if (targetInRange(enemy, refreshedTarget, enemy.attack.range)) enemyAttack(state, enemy, refreshedTarget);
  else appendLog(state, { type: "combat", text: `${enemy.name} advances through the battlefield.` });
  state = advanceCombatTurn(state);
  return state;
}

function resetRoundEffects(actor) {
  actor.buffs = (actor.buffs || []).filter((buff) => !["guarded", "arcane-shield", "sanctuary", "reckless", "inspired", "trailstep", "deflecting"].includes(buff));
  actor.conditions = (actor.conditions || []).filter((condition) => !["staggered", "blinded", "stunned", "distracted"].includes(condition));
}

export function evaluateCombat(campaign) {
  const state = clone(campaign);
  if (!state.combat) return state;
  const heroesAlive = state.combat.actors.some((actor) => actor.type === "hero" && !actor.downed && actor.hp > 0);
  const enemiesAlive = state.combat.actors.some((actor) => actor.type === "enemy" && !actor.downed && actor.hp > 0);
  if (!enemiesAlive) state.combat.victory = "heroes";
  else if (!heroesAlive) state.combat.victory = "enemies";
  return state;
}

export function advanceCombatTurn(campaign) {
  let state = evaluateCombat(campaign);
  const combat = state.combat;
  if (!combat || combat.victory) return state;
  const previous = currentCombatActor(state);
  if (previous) {
    decrementCooldowns(previous);
    resetRoundEffects(previous);
  }
  const total = combat.order.length;
  for (let step = 1; step <= total; step += 1) {
    const nextIndex = (combat.turnIndex + step) % total;
    const next = combat.actors.find((actor) => actor.id === combat.order[nextIndex]);
    if (next && !next.downed && next.hp > 0) {
      if (nextIndex <= combat.turnIndex) combat.round += 1;
      combat.turnIndex = nextIndex;
      return state;
    }
  }
  return evaluateCombat(state);
}

export function endHeroTurn(campaign) {
  const actor = currentCombatActor(campaign);
  if (!actor || actor.type !== "hero") return campaign;
  const state = clone(campaign);
  appendLog(state, { type: "combat", text: `${actor.name} holds position.` });
  return advanceCombatTurn(state);
}

export function finishCombat(campaign) {
  let state = evaluateCombat(campaign);
  if (state.combat?.victory !== "heroes") return state;
  const scene = currentScene(state);
  const combatHeroes = state.combat.actors.filter((actor) => actor.type === "hero");
  state.heroes = state.heroes.map((hero) => {
    const combatHero = combatHeroes.find((entry) => entry.id === hero.id);
    return combatHero ? { ...hero, hp: Math.max(1, combatHero.hp), downed: false, conditions: [], buffs: [], cooldowns: {} } : hero;
  });
  state.stats.combatsWon += 1;
  state.gold += scene?.boss ? 95 : 45;
  state.xp += scene?.boss ? 80 : 35;
  appendLog(state, { type: "victory", text: `Victory. The party gains ${scene?.boss ? 95 : 45} gold.` });
  state.combat = null;
  return moveToScene(state, scene.next);
}

export function recoverFromDefeat(campaign) {
  const state = clone(campaign);
  if (state.combat?.victory !== "enemies") return state;
  state.heroes = state.heroes.map((hero) => ({ ...hero, hp: Math.max(1, Math.ceil(hero.maxHp * 0.5)), downed: false, conditions: [], buffs: [], cooldowns: {} }));
  state.gold = Math.max(0, state.gold - 50);
  state.combat = null;
  appendLog(state, { type: "story", text: "The party wakes later, battered but alive. Someone has taken 50 gold. The adventure continues." });
  return state;
}

export function completeAdventure(campaign) {
  const scene = currentScene(campaign);
  if (scene?.type !== "ending") return campaign;
  const state = clone(campaign);
  state.completed = true;
  state.gold += scene.rewardGold || 0;
  state.xp += scene.rewardXp || 0;
  if (scene.legend) state.legends.push({ text: scene.legend, adventureId: state.adventureId, at: new Date().toISOString() });
  if (state.stats.crits >= 2) state.legends.push({ text: `Rolled ${state.stats.crits} critical hits during ${currentAdventure(state).title}.`, adventureId: state.adventureId, at: new Date().toISOString() });
  return state;
}

export function aiHeroAction(campaign) {
  const state = clone(campaign);
  const actor = currentCombatActor(state);
  if (!actor || actor.type !== "hero" || actor.controller !== "ai" || actor.downed) return state;
  const enemies = state.combat.actors.filter((entry) => entry.type === "enemy" && !entry.downed && entry.hp > 0).sort((a, b) => manhattan(actor, a) - manhattan(actor, b));
  const allies = state.combat.actors.filter((entry) => entry.type === "hero" && !entry.downed && entry.hp > 0);
  const healAbility = actor.abilities.find((ability) => ability.heal && ability.target === "ally" && (actor.cooldowns[ability.id] || 0) === 0);
  const hurtAlly = allies.filter((ally) => ally.hp / ally.maxHp < 0.45).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (healAbility && hurtAlly && targetInRange(actor, hurtAlly, healAbility.range)) return useAbility(state, actor.id, healAbility.id, hurtAlly.id).state;
  const ready = actor.abilities.filter((ability) => ability.damage && ability.target === "enemy" && (actor.cooldowns[ability.id] || 0) === 0);
  const target = enemies[0];
  const attack = ready.find((ability) => target && targetInRange(actor, target, ability.range));
  if (attack) return useAbility(state, actor.id, attack.id, target.id).state;
  if (target) {
    const options = reachableCells(state, actor.id).sort((a, b) => manhattan(a, target) - manhattan(b, target));
    if (options[0]) {
      const moved = moveCombatActor(state, actor.id, options[0].x, options[0].y).state;
      const movedActor = currentCombatActor(moved);
      const movedTarget = moved.combat.actors.find((entry) => entry.id === target.id);
      const movedAttack = movedActor.abilities.find((ability) => ability.damage && ability.target === "enemy" && (movedActor.cooldowns[ability.id] || 0) === 0 && targetInRange(movedActor, movedTarget, ability.range));
      if (movedAttack) return useAbility(moved, movedActor.id, movedAttack.id, movedTarget.id).state;
      return endHeroTurn(moved);
    }
  }
  return endHeroTurn(state);
}

export function runAutomaticTurns(campaign, maxSteps = 32) {
  let state = clone(campaign);
  let steps = 0;
  while (state.combat && !state.combat.victory && steps < maxSteps) {
    const actor = currentCombatActor(state);
    if (!actor) break;
    if (actor.type === "enemy") state = runEnemyTurn(state);
    else if (actor.controller === "ai") state = aiHeroAction(state);
    else break;
    steps += 1;
  }
  return state;
}

export function tileLegend(tile) {
  return ({ "#": "wall", ".": "floor", "~": "water", "F": "fire", "C": "chest" })[tile] || "floor";
}

export function serializeCampaign(campaign) {
  return JSON.stringify(campaign);
}

export function deserializeCampaign(payload) {
  const parsed = JSON.parse(payload);
  if (!parsed || parsed.version !== 1 || !ADVENTURE_BY_ID[parsed.adventureId]) throw new Error("Invalid PixelQuest save file.");
  return parsed;
}

export function validateGameData() {
  const errors = [];
  if (HEROES.length < 12) errors.push("Expected at least 12 pregenerated heroes.");
  for (const hero of HEROES) {
    if (!hero.id || !hero.name || !hero.className) errors.push(`Hero missing identity: ${JSON.stringify(hero)}`);
    if ((hero.abilities || []).length < 5) errors.push(`${hero.name} needs at least 5 abilities.`);
    for (const ability of hero.abilities || []) if (ability.damage) { try { parseDice(ability.damage); } catch (error) { errors.push(`${hero.name}/${ability.name}: ${error.message}`); } }
  }
  if (ADVENTURES.length !== 20) errors.push(`Expected 20 adventures, found ${ADVENTURES.length}.`);
  for (const adventure of ADVENTURES) {
    const ids = new Set(adventure.scenes.map((entry) => entry.id));
    if (!adventure.scenes.some((entry) => entry.type === "combat")) errors.push(`${adventure.title} needs combat.`);
    if (!adventure.scenes.some((entry) => entry.type === "skill")) errors.push(`${adventure.title} needs a skill scene.`);
    if (!adventure.scenes.some((entry) => entry.type === "private")) errors.push(`${adventure.title} needs a private scene.`);
    if (!adventure.scenes.some((entry) => entry.type === "ending")) errors.push(`${adventure.title} needs an ending.`);
    for (const entry of adventure.scenes) {
      for (const ref of [entry.next, entry.successNext, entry.failNext]) if (ref && !ids.has(ref)) errors.push(`${adventure.title}/${entry.id} points to missing scene ${ref}.`);
      for (const choice of entry.choices || []) if (choice.next && !ids.has(choice.next)) errors.push(`${adventure.title}/${entry.id}/${choice.id} points to missing scene ${choice.next}.`);
      if (entry.type === "combat") for (const enemyId of entry.enemies || []) if (!ENEMIES[enemyId]) errors.push(`${adventure.title}/${entry.id} references missing enemy ${enemyId}.`);
      if (entry.map && !MAPS[entry.map]) errors.push(`${adventure.title}/${entry.id} references missing map ${entry.map}.`);
    }
  }
  return errors;
}
