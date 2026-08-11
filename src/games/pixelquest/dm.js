import React, { useEffect, useState } from "react";
import { auth } from "../../firebase.js";
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

export function buildNarratorContext(campaign) {
  const adventure = currentAdventure(campaign);
  const scene = currentScene(campaign);
  return {
    adventure: adventure ? {
      id: adventure.id,
      title: adventure.title,
      subtitle: adventure.subtitle,
      tone: adventure.tone,
    } : null,
    scene: scene ? {
      id: scene.id,
      type: scene.type,
      title: scene.title,
      text: scene.text,
      choices: (scene.choices || []).map(({ id, label, detail }) => ({ id, label, detail })),
    } : null,
    flags: campaign.flags || {},
    heroes: (campaign.heroes || []).map(({ id, name, className, hp, maxHp, controller, downed }) => ({
      id, name, className, hp, maxHp, controller, downed: Boolean(downed),
    })),
    gold: Number(campaign.gold || 0),
    xp: Number(campaign.xp || 0),
    recentEvents: (campaign.log || []).slice(-12).map(({ type, text, private: isPrivate }) => ({
      type,
      text: isPrivate ? "An adventurer made a private decision." : text,
    })),
    immutableRulesNotice: "The deterministic PixelQuest engine owns all dice, HP, Defense, movement, inventory, gold, initiative, conditions, cooldowns, rewards, legal actions, and encounter state. Narration may never alter, invent, reroll, or contradict those values.",
  };
}

function endpointFromEnvironment() {
  const configured = import.meta.env?.VITE_PIXELQUEST_DM_URL;
  return String(configured || "").replace(/\/$/, "");
}

export class GemmaNarrator {
  constructor({ endpoint = endpointFromEnvironment(), fetchImpl = globalThis.fetch, fallback = new LocalNarrator() } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.fallback = fallback;
    this.model = "gemma4:12b";
  }

  get configured() {
    return Boolean(this.endpoint && this.fetchImpl);
  }

  async request(kind, campaign, { plan = "", token = "", signal } = {}) {
    if (!this.configured) throw new Error("Gemma DM service is not configured.");
    const response = await this.fetchImpl(`${this.endpoint}/api/narrate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, context: buildNarratorContext(campaign), plan }),
      signal,
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemma DM request failed (${response.status})${body ? `: ${body.slice(0, 180)}` : ""}`);
    }
    return response.json();
  }

  async describe(campaign, options = {}) {
    if (!this.configured) return this.fallback.describe(campaign);
    try {
      const result = await this.request("describe", campaign, options);
      return String(result?.narration || "").trim() || this.fallback.describe(campaign);
    } catch {
      return this.fallback.describe(campaign);
    }
  }

  async reactToPlan(campaign, plan, options = {}) {
    if (!this.configured) return this.fallback.reactToPlan(campaign, plan);
    try {
      const result = await this.request("plan", campaign, { ...options, plan });
      if (!result?.accepted || !result?.choiceId) return this.fallback.reactToPlan(campaign, plan);
      return {
        accepted: true,
        choiceId: result.choiceId,
        narration: String(result.narration || "The Dungeon Master considers the idea.").trim(),
      };
    } catch {
      return this.fallback.reactToPlan(campaign, plan);
    }
  }

  async health({ signal } = {}) {
    if (!this.configured) return { ok: false, mode: "local", model: null };
    try {
      const response = await this.fetchImpl(`${this.endpoint}/health`, { signal });
      if (!response.ok) return { ok: false, mode: "local", model: null };
      return response.json();
    } catch {
      return { ok: false, mode: "local", model: null };
    }
  }
}

export class LlmNarrator {
  constructor(adapter) {
    this.adapter = adapter;
  }

  async describe(campaign, options = {}) {
    if (!this.adapter) throw new Error("No LLM narrator adapter configured.");
    return this.adapter.describe(campaign, options);
  }
}

export const deterministicNarrator = new LocalNarrator();
export const gemmaNarrator = new GemmaNarrator({ fallback: deterministicNarrator });

function GemmaNarration({ campaign, fallback, kind = "describe", plan = "" }) {
  const [text, setText] = useState(fallback);
  const scene = currentScene(campaign);
  const requestKey = `${campaign.seed}:${scene?.id || "none"}:${kind}:${plan}:${campaign.log?.length || 0}`;

  useEffect(() => {
    setText(fallback);
    if (!gemmaNarrator.configured) return undefined;
    const controller = new AbortController();
    let active = true;
    (async () => {
      try {
        const token = await auth?.currentUser?.getIdToken?.();
        const result = kind === "plan"
          ? await gemmaNarrator.reactToPlan(campaign, plan, { token, signal: controller.signal })
          : await gemmaNarrator.describe(campaign, { token, signal: controller.signal });
        const narration = kind === "plan" ? result?.narration : result;
        if (active && narration) setText(String(narration));
      } catch {
        // Deterministic narration remains visible when the AI service is unavailable.
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [requestKey, fallback]);

  return React.createElement("span", {
    className: "pq-gemma-narration",
    "data-dm-model": gemmaNarrator.configured ? gemmaNarrator.model : "local",
  }, text);
}

class HybridNarrator {
  describe(campaign) {
    const fallback = deterministicNarrator.describe(campaign);
    if (typeof window === "undefined" || !gemmaNarrator.configured) return fallback;
    return React.createElement(GemmaNarration, { campaign, fallback, key: `${campaign.seed}:${currentScene(campaign)?.id}` });
  }

  reactToPlan(campaign, plan) {
    const local = deterministicNarrator.reactToPlan(campaign, plan);
    if (typeof window === "undefined" || !gemmaNarrator.configured) return local;
    return {
      ...local,
      narration: React.createElement(GemmaNarration, {
        campaign,
        plan,
        kind: "plan",
        fallback: local.narration,
        key: `${campaign.seed}:${currentScene(campaign)?.id}:plan:${plan}`,
      }),
    };
  }

  combatQuip(campaign, actorName) {
    return deterministicNarrator.combatQuip(campaign, actorName);
  }
}

export const localNarrator = new HybridNarrator();
