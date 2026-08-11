import http from "node:http";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

const FIREBASE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const RULES_NOTICE = "The deterministic PixelQuest engine owns dice, HP, Defense, movement, inventory, gold, initiative, conditions, cooldowns, rewards, legal actions, and encounter state. Never invent, reroll, change, or contradict those values. You may narrate only what the supplied state permits.";
let certCache = { expiresAt: 0, certs: null };

function json(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function text(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}

function b64urlJson(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function parseMaxAge(value = "") {
  const match = /max-age=(\d+)/i.exec(value);
  return match ? Number(match[1]) : 300;
}

async function firebaseCerts(fetchImpl) {
  if (certCache.certs && Date.now() < certCache.expiresAt) return certCache.certs;
  const response = await fetchImpl(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error(`Unable to load Firebase signing certificates (${response.status}).`);
  const certs = await response.json();
  certCache = {
    certs,
    expiresAt: Date.now() + parseMaxAge(response.headers.get("cache-control")) * 1000,
  };
  return certs;
}

export async function verifyFirebaseIdToken(token, projectId, fetchImpl = fetch) {
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required when DM_AUTH_MODE=firebase.");
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase ID token.");
  const [encodedHeader, encodedPayload, signature] = parts;
  const header = b64urlJson(encodedHeader);
  const payload = b64urlJson(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Invalid Firebase token header.");
  if (payload.aud !== projectId) throw new Error("Firebase token audience mismatch.");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Firebase token issuer mismatch.");
  if (!payload.sub || typeof payload.sub !== "string") throw new Error("Firebase token subject is missing.");
  if (Number(payload.exp || 0) <= now) throw new Error("Firebase token has expired.");
  if (Number(payload.iat || 0) > now + 300) throw new Error("Firebase token issued-at time is invalid.");
  const certs = await firebaseCerts(fetchImpl);
  const cert = certs[header.kid];
  if (!cert) throw new Error("Firebase signing certificate was not found.");
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();
  if (!verifier.verify(cert, Buffer.from(signature, "base64url"))) throw new Error("Firebase token signature is invalid.");
  return payload;
}

function cleanNarration(value, fallback) {
  const textValue = String(value || "").replace(/\s+/g, " ").trim();
  return (textValue || fallback || "The dungeon waits.").slice(0, 1200);
}

function sceneChoices(context) {
  return Array.isArray(context?.scene?.choices) ? context.scene.choices.filter((choice) => choice?.id && choice?.label) : [];
}

function buildPrompt(kind, context, plan = "") {
  const compact = {
    adventure: context?.adventure || null,
    scene: context?.scene || null,
    heroes: context?.heroes || [],
    flags: context?.flags || {},
    gold: Number(context?.gold || 0),
    xp: Number(context?.xp || 0),
    recentEvents: context?.recentEvents || [],
  };
  if (kind === "plan") {
    return `PLAYER PLAN:\n${String(plan).slice(0, 600)}\n\nCURRENT GAME STATE:\n${JSON.stringify(compact)}\n\nMap the player's idea to exactly one supplied scene choice. Preserve the spirit of the idea in narration. Never create a new choice id. Return JSON only.`;
  }
  return `CURRENT GAME STATE:\n${JSON.stringify(compact)}\n\nWrite 2-4 vivid sentences of atmospheric Dungeon Master narration for the current scene. Do not reveal private flags, hidden future facts, exact probabilities, or information not present in the state. Return JSON only.`;
}

function schemaFor(kind, choices) {
  if (kind === "plan") {
    return {
      type: "object",
      properties: {
        narration: { type: "string" },
        accepted: { type: "boolean" },
        choiceId: { type: ["string", "null"], enum: [...choices.map((choice) => choice.id), null] },
      },
      required: ["narration", "accepted", "choiceId"],
      additionalProperties: false,
    };
  }
  return {
    type: "object",
    properties: { narration: { type: "string" } },
    required: ["narration"],
    additionalProperties: false,
  };
}

async function callOllama({ kind, context, plan, ollamaBaseUrl, model, fetchImpl, timeoutMs }) {
  const choices = sceneChoices(context);
  if (kind === "plan" && choices.length === 0) return { narration: "There is no open decision to bend toward that plan.", accepted: false, choiceId: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        system: `You are the Dungeon Master for PixelQuest: The Living Dungeon, a cooperative family fantasy RPG. Be imaginative, concise, fair, and responsive to player choices. ${RULES_NOTICE}`,
        prompt: buildPrompt(kind, context, plan),
        format: schemaFor(kind, choices),
        options: {
          temperature: kind === "plan" ? 0.65 : 0.8,
          top_p: 0.92,
          num_predict: kind === "plan" ? 120 : 80,
        },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
    const payload = await response.json();
    let parsed;
    try { parsed = JSON.parse(payload.response || "{}"); }
    catch { throw new Error("Gemma returned invalid structured JSON."); }
    if (kind === "plan") {
      const validIds = new Set(choices.map((choice) => choice.id));
      const choiceId = validIds.has(parsed.choiceId) ? parsed.choiceId : null;
      return {
        narration: cleanNarration(parsed.narration, "The Dungeon Master weighs the proposal."),
        accepted: Boolean(parsed.accepted && choiceId),
        choiceId,
      };
    }
    return { narration: cleanNarration(parsed.narration, context?.scene?.text) };
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(req, maxBytes = 96 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw Object.assign(new Error("Request body too large."), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw Object.assign(new Error("Invalid JSON body."), { statusCode: 400 }); }
}

function corsHeaders(origin, allowedOrigin) {
  if (!origin) return {};
  if (allowedOrigin === "*" || origin === allowedOrigin) {
    return {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      vary: "Origin",
    };
  }
  return {};
}

export function createDmServer(options = {}) {
  const config = {
    ollamaBaseUrl: String(options.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    model: options.model || process.env.GEMMA_MODEL || "gemma4:12b",
    authMode: options.authMode || process.env.DM_AUTH_MODE || "firebase",
    projectId: options.projectId || process.env.FIREBASE_PROJECT_ID || "",
    allowedOrigin: options.allowedOrigin ?? process.env.DM_ALLOWED_ORIGIN ?? "http://localhost:5173",
    timeoutMs: Number(options.timeoutMs || process.env.DM_TIMEOUT_MS || 30000),
    fetchImpl: options.fetchImpl || fetch,
  };

  return http.createServer(async (req, res) => {
    const origin = req.headers.origin || "";
    const cors = corsHeaders(origin, config.allowedOrigin);
    if (req.method === "OPTIONS") {
      if (origin && !cors["access-control-allow-origin"]) return text(res, 403, "Origin not allowed.");
      res.writeHead(204, cors); return res.end();
    }
    if (origin && !cors["access-control-allow-origin"]) return json(res, 403, { error: "Origin not allowed." });

    try {
      if (req.url === "/health" && req.method === "GET") {
        let ollama = false;
        let installed = false;
        try {
          const response = await config.fetchImpl(`${config.ollamaBaseUrl}/api/tags`);
          if (response.ok) {
            ollama = true;
            const payload = await response.json();
            installed = (payload.models || []).some((entry) => entry.name === config.model || entry.model === config.model || String(entry.name || "").startsWith(`${config.model}:`));
          }
        } catch { /* health reports fallback state */ }
        return json(res, 200, { ok: ollama && installed, ollama, installed, model: config.model, authMode: config.authMode }, cors);
      }

      if (req.url !== "/api/narrate" || req.method !== "POST") return json(res, 404, { error: "Not found." }, cors);
      if (config.authMode === "firebase") {
        const header = String(req.headers.authorization || "");
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!token) return json(res, 401, { error: "Firebase authentication required." }, cors);
        await verifyFirebaseIdToken(token, config.projectId, config.fetchImpl);
      } else if (config.authMode !== "off") {
        throw new Error(`Unsupported DM_AUTH_MODE: ${config.authMode}`);
      }

      const body = await readJson(req);
      const kind = body.kind === "plan" ? "plan" : body.kind === "describe" ? "describe" : null;
      if (!kind || !body.context?.scene || !body.context?.adventure) return json(res, 400, { error: "A valid narration kind and PixelQuest context are required." }, cors);
      const result = await callOllama({ kind, context: body.context, plan: body.plan || "", ...config });
      return json(res, 200, { ...result, provider: "ollama", model: config.model }, cors);
    } catch (error) {
      const status = error.statusCode || (/token|Firebase|authentication/i.test(error.message) ? 401 : error.name === "AbortError" ? 504 : 502);
      return json(res, status, { error: error.name === "AbortError" ? "Gemma DM request timed out." : error.message || "DM service error." }, cors);
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8787);
  createDmServer().listen(port, "0.0.0.0", () => {
    console.log(`PixelQuest Gemma DM listening on :${port}`);
  });
}
