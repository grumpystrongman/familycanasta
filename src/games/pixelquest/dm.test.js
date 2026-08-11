import assert from "node:assert/strict";
import test from "node:test";
import { buildNarratorContext, GemmaNarrator, LocalNarrator, localNarrator } from "./dm.js";
import { createCampaign, moveToScene } from "./engine.js";

function campaignAt(sceneId = null) {
  let campaign = createCampaign({ adventureId: "bells-blackhollow", heroIds: ["brom-stoneguard"], controllers: ["human"], seed: "dm-test" });
  if (sceneId && campaign.sceneId !== sceneId) campaign = moveToScene(campaign, sceneId);
  return campaign;
}

test("narrator context omits private choice content and preserves immutable rules boundary", () => {
  const campaign = campaignAt();
  campaign.log.push({ id: "secret", type: "secret", text: "Brom stole the black key.", private: true });
  const context = buildNarratorContext(campaign);
  assert.match(context.immutableRulesNotice, /deterministic PixelQuest engine owns all dice/i);
  assert.equal(context.recentEvents.at(-1).text, "An adventurer made a private decision.");
  assert.doesNotMatch(JSON.stringify(context), /stole the black key/i);
});

test("GemmaNarrator sends authenticated structured context to the DM service", async () => {
  const campaign = campaignAt();
  let request;
  const narrator = new GemmaNarrator({
    endpoint: "https://dm.example.test",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ narration: "The rain draws silver lines across the old road.", model: "gemma4:12b" }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const result = await narrator.describe(campaign, { token: "firebase-token" });
  assert.match(result, /silver lines/i);
  assert.equal(request.url, "https://dm.example.test/api/narrate");
  assert.equal(request.options.headers.authorization, "Bearer firebase-token");
  const body = JSON.parse(request.options.body);
  assert.equal(body.kind, "describe");
  assert.equal(body.context.adventure.id, "bells-blackhollow");
  assert.equal(body.context.heroes.length, 1);
});

test("GemmaNarrator degrades to deterministic narration when the service fails", async () => {
  const campaign = campaignAt();
  const fallback = new LocalNarrator();
  const narrator = new GemmaNarrator({
    endpoint: "https://dm.example.test",
    fallback,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  assert.equal(await narrator.describe(campaign), fallback.describe(campaign));
});

test("existing localNarrator remains synchronous in non-browser tests", () => {
  const result = localNarrator.describe(campaignAt());
  assert.equal(typeof result, "string");
  assert.ok(result.length > 20);
});
