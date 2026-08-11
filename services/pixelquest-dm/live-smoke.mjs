import assert from "node:assert/strict";

const baseUrl = process.env.PIXELQUEST_DM_URL || "http://127.0.0.1:8787";

const health = await fetch(`${baseUrl}/health`);
assert.equal(health.status, 200, "DM health endpoint must respond");
const healthBody = await health.json();
assert.equal(healthBody.ok, true, `Gemma health failed: ${JSON.stringify(healthBody)}`);
assert.equal(healthBody.model, "gemma4:12b");
assert.equal(healthBody.installed, true);

const context = {
  adventure: { id: "bells-blackhollow", title: "The Bells of Blackhollow", subtitle: "The dead remember the bells", tone: "gothic horror" },
  scene: {
    id: "chapel-road",
    type: "story",
    title: "The Road to Blackhollow",
    text: "Rain falls over the abandoned road. Far away, a church bell rings once.",
    choices: [],
  },
  heroes: [
    { id: "brom", name: "Brom Stoneguard", className: "Vanguard", hp: 40, maxHp: 40, controller: "human", downed: false },
  ],
  flags: {},
  recentEvents: [],
  gold: 0,
  xp: 0,
};

const response = await fetch(`${baseUrl}/api/narrate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ kind: "describe", context }),
});
assert.equal(response.status, 200, `Narration request failed: ${await response.text()}`);
const body = await response.json();
assert.equal(body.model, "gemma4:12b");
assert.equal(body.provider, "ollama");
assert.ok(typeof body.narration === "string" && body.narration.length >= 20, "Gemma must return useful narration");
assert.ok(body.narration.length <= 1200, "Narration must stay within the service output boundary");
console.log(JSON.stringify({ health: healthBody, narration: body.narration }, null, 2));
