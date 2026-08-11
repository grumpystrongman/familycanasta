import { currentCombatActor, endHeroTurn, isWalkable, manhattan } from "./engine.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

function actorAt(combat, x, y) {
  return combat.actors.find((actor) => !actor.downed && actor.hp > 0 && actor.x === x && actor.y === y) || null;
}

function abilityFor(actor, abilityId) {
  return actor?.abilities?.find((ability) => ability.id === abilityId) || null;
}

function append(state, text, type = "ability") {
  state.log = [...(state.log || []), { id: `special-${Date.now()}-${Math.random()}`, type, text }].slice(-120);
}

export function useTileAbility(campaign, actorId, abilityId, x, y) {
  let state = clone(campaign);
  const actor = currentCombatActor(state);
  if (!state.combat || !actor || actor.id !== actorId || actor.type !== "hero") return { state, ok: false, reason: "Not that hero's turn." };
  const ability = abilityFor(actor, abilityId);
  if (!ability || ability.target !== "tile") return { state, ok: false, reason: "That is not a tile ability." };
  if ((actor.cooldowns?.[ability.id] || 0) > 0) return { state, ok: false, reason: "That ability is cooling down." };
  if (!isWalkable(state.combat.map, x, y)) return { state, ok: false, reason: "That tile cannot be targeted." };
  if (manhattan(actor, { x, y }) > ability.range) return { state, ok: false, reason: "That tile is out of range." };

  if (ability.movement) {
    if (actorAt(state.combat, x, y)) return { state, ok: false, reason: "That tile is occupied." };
    actor.x = x;
    actor.y = y;
    actor.cooldowns[ability.id] = ability.cooldown || 0;
    append(state, `${actor.name} uses ${ability.name} and crosses the battlefield in a blur.`);
    state.combat.lastAction = `${actor.name} used ${ability.name}.`;
    return { state: endHeroTurn(state), ok: true };
  }

  state.combat.objects ||= [];
  if (ability.summon === "turret") {
    const target = state.combat.actors
      .filter((entry) => entry.type === "enemy" && !entry.downed && entry.hp > 0 && manhattan(entry, { x, y }) <= 4)
      .sort((a, b) => manhattan(a, { x, y }) - manhattan(b, { x, y }))[0];
    state.combat.objects.push({ id: `turret-${Date.now()}`, type: "turret", x, y, ownerId: actor.id, ttl: 3 });
    if (target) {
      const damage = 5;
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0) {
        target.downed = true;
        state.stats.monstersDefeated += 1;
      }
      append(state, `${actor.name} deploys a Pocket Turret. It immediately tags ${target.name} for ${damage} damage.`);
    } else append(state, `${actor.name} deploys a Pocket Turret to cover the lane.`);
  } else if (ability.summon === "trap") {
    const occupyingEnemy = actorAt(state.combat, x, y);
    state.combat.objects.push({ id: `trap-${Date.now()}`, type: "trap", x, y, ownerId: actor.id, ttl: 4 });
    if (occupyingEnemy?.type === "enemy") {
      if (!occupyingEnemy.conditions.includes("rooted")) occupyingEnemy.conditions.push("rooted");
      append(state, `${actor.name}'s Spring Snare snaps shut beneath ${occupyingEnemy.name}.`);
    } else append(state, `${actor.name} arms a Spring Snare on the chosen tile.`);
  } else return { state, ok: false, reason: "This tile ability has no implemented effect." };

  actor.cooldowns[ability.id] = ability.cooldown || 0;
  state.combat.lastAction = `${actor.name} used ${ability.name}.`;
  return { state: endHeroTurn(state), ok: true };
}
