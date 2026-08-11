import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { once } from "node:events";
import { createDmServer } from "./server.mjs";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  if (!server.listening) return;
  server.close();
  await once(server, "close");
}

function context() {
  return {
    adventure: { id: "bells-blackhollow", title: "The Bells of Blackhollow", tone: "gothic horror" },
    scene: {
      id: "chapel-choice",
      type: "party-choice",
      title: "The Ruined Chapel",
      text: "Rain needles through the broken roof.",
      choices: [
        { id: "crypt", label: "Search the crypt", detail: "Follow the cold draft below." },
        { id: "bell", label: "Inspect the bell", detail: "Study the cracked mechanism." },
      ],
    },
    heroes: [{ id: "vanguard", name: "Mara", className: "Vanguard", hp: 31, maxHp: 40 }],
    flags: { priestLied: true },
    recentEvents: [{ type: "decision", text: "The party entered through the orchard." }],
    gold: 120,
    xp: 40,
  };
}

function fakeOllama() {
  let lastGenerate = null;
  const server = http.createServer(async (req, res) => {
    if (req.url === "/api/tags") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ models: [{ name: "gemma4:12b", model: "gemma4:12b" }] }));
    }
    if (req.url === "/api/generate" && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      lastGenerate = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const isPlan = String(lastGenerate.prompt).includes("PLAYER PLAN:");
      const response = isPlan
        ? { narration: "The old chimney is narrow, but it can carry the party toward the crypt route.", accepted: true, choiceId: "crypt" }
        : { narration: "Rain whispers through the ruined chapel while the cracked bell sways without wind." };
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ model: "gemma4:12b", response: JSON.stringify(response), done: true }));
    }
    res.writeHead(404); res.end();
  });
  return { server, getLastGenerate: () => lastGenerate };
}

test("health confirms Ollama and Gemma 4 12B are installed", async () => {
  const ollama = fakeOllama();
  const ollamaUrl = await listen(ollama.server);
  const dm = createDmServer({ ollamaBaseUrl: ollamaUrl, authMode: "off", allowedOrigin: "*" });
  const dmUrl = await listen(dm);
  try {
    const response = await fetch(`${dmUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      ollama: true,
      installed: true,
      model: "gemma4:12b",
      authMode: "off",
    });
  } finally {
    await close(dm); await close(ollama.server);
  }
});

test("describe sends immutable rules to Gemma and returns structured narration", async () => {
  const ollama = fakeOllama();
  const ollamaUrl = await listen(ollama.server);
  const dm = createDmServer({ ollamaBaseUrl: ollamaUrl, authMode: "off", allowedOrigin: "*" });
  const dmUrl = await listen(dm);
  try {
    const response = await fetch(`${dmUrl}/api/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "describe", context: context() }),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.match(body.narration, /ruined chapel/i);
    assert.equal(body.model, "gemma4:12b");
    const sent = ollama.getLastGenerate();
    assert.equal(sent.model, "gemma4:12b");
    assert.equal(sent.stream, false);
    assert.match(sent.system, /deterministic PixelQuest engine owns dice/i);
    assert.equal(sent.format.type, "object");
  } finally {
    await close(dm); await close(ollama.server);
  }
});

test("freeform plans can only map to an authored scene choice", async () => {
  const ollama = fakeOllama();
  const ollamaUrl = await listen(ollama.server);
  const dm = createDmServer({ ollamaBaseUrl: ollamaUrl, authMode: "off", allowedOrigin: "*" });
  const dmUrl = await listen(dm);
  try {
    const response = await fetch(`${dmUrl}/api/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "plan", plan: "Climb down the chimney", context: context() }),
    });
    const body = await response.json();
    assert.equal(body.accepted, true);
    assert.equal(body.choiceId, "crypt");
    const ids = ollama.getLastGenerate().format.properties.choiceId.enum;
    assert.deepEqual(ids, ["crypt", "bell", null]);
  } finally {
    await close(dm); await close(ollama.server);
  }
});

test("production auth rejects narration without a Firebase token", async () => {
  const dm = createDmServer({ ollamaBaseUrl: "http://127.0.0.1:1", authMode: "firebase", projectId: "family-test", allowedOrigin: "*" });
  const dmUrl = await listen(dm);
  try {
    const response = await fetch(`${dmUrl}/api/narrate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "describe", context: context() }),
    });
    assert.equal(response.status, 401);
    assert.match((await response.json()).error, /authentication required/i);
  } finally {
    await close(dm);
  }
});
