import { currentAdventure, currentScene } from "./engine.js";

const OPENERS = [
  "The torchlight catches something the dark was hoping you would miss.",
  "For one quiet second, nobody moves. Then the world makes the next move for you.",
  "Somewhere nearby, wood creaks even though there is no wind.",
  "The road ahead looks ordinary in exactly the way dangerous roads often do.",
  "The party has enough time for one good decision and several terrible ones.",
];

function hash(text) {
  let value = 0;
  for (const char of String(text || "")) value = ((value << 5) - value + char.charCodeAt(0)) | 0;
  return Math.abs(value);
}

export class LocalNarrator {
  constructor({ voice = "classic" } = {}) {
    this.voice = voice;
  }

  describe(campaign) {
    const scene = currentScene(campaign);
    const adventure = currentAdventure(campaign);
    if (!scene || !adventure) return "The story waits in darkness.";
    const opener = OPENERS[hash(`${campaign.seed}:${scene.id}`) % OPENERS.length];
    if (scene.type === "combat") return `${opener} ${scene.text}`;
    if (scene.type === "ending") return scene.text;
    return `${scene.text} ${opener}`;
  }

  reactToPlan(campaign, plan) {
    const scene = currentScene(campaign);
    if (!scene?.choices?.length) return { accepted: false, narration: "There is no room to improvise here." };
    const index = hash(`${campaign.seed}:${scene.id}:${plan}`) % scene.choices.length;
    const choice = scene.choices[index];
    return {
      accepted: true,
      choiceId: choice.id,
      narration: `The Dungeon Master considers “${plan}.” The world can bend that idea toward ${choice.label.toLowerCase()}, but consequences may change how the route feels.`,
    };
  }

  combatQuip(campaign, actorName) {
    const scene = currentScene(campaign);
    const lines = [
      `${actorName} gets exactly one heartbeat before ${scene?.title || "the fight"} becomes personal.`,
      `Dust, sparks, and bad intentions fill the air around ${actorName}.`,
      `${actorName}'s turn. Somewhere, a monster immediately regrets several life choices.`,
    ];
    return lines[hash(`${campaign.rngState}:${actorName}`) % lines.length];
  }
}

export class LlmNarrator {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async describe(campaign) {
    if (!this.adapter) throw new Error("No LLM narrator adapter configured.");
    return this.adapter.describe({
      adventure: currentAdventure(campaign),
      scene: currentScene(campaign),
      flags: campaign.flags,
      heroes: campaign.heroes.map(({ id, name, className, hp, maxHp }) => ({ id, name, className, hp, maxHp })),
      immutableRulesNotice: "Narration may describe outcomes but may not alter dice, HP, Defense, inventory, gold, initiative, or validated engine commands.",
    });
  }
}

export const localNarrator = new LocalNarrator();
