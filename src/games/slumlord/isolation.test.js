import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gameSource = await readFile(new URL("./GameBoard.jsx", import.meta.url), "utf8");
const indexSource = await readFile(new URL("./index.jsx", import.meta.url), "utf8");
const styles = await readFile(new URL("./n64-overrides.css", import.meta.url), "utf8");
const themes = await readFile(new URL("./themes.css", import.meta.url), "utf8");
const chaos = await readFile(new URL("./chaos.js", import.meta.url), "utf8");
const districts = await readFile(new URL("./districts.js", import.meta.url), "utf8");
const districtStyles = await readFile(new URL("./districts.css", import.meta.url), "utf8");
const botAutomation = await readFile(new URL("./botAutomation.js", import.meta.url), "utf8");

test("Slum Lord is a local full-board module with no party-stage dependency", () => {
  assert.match(indexSource, /GameBoard/);
  assert.doesNotMatch(gameSource, /PartyStage|partyRoom|usePartyRoom|phone|controller/i);
  assert.doesNotMatch(gameSource, /firebase/i);
});

test("Slum Lord defaults to one human versus one CPU landlord", () => {
  assert.match(gameSource, /useState\(2\)/);
  assert.match(gameSource, /name:\s*"You",\s*isBot:\s*false/);
  assert.match(gameSource, /name:\s*"CPU Landlord",\s*isBot:\s*true/);
  assert.match(indexSource, /1 human \+ CPU by default/);
});

test("Slum Lord maps its 36 spaces to a ten-by-ten perimeter", () => {
  assert.match(gameSource, /gridRow:\s*10,\s*gridColumn:\s*10\s*-\s*id/);
  assert.match(gameSource, /gridColumn:\s*10\s*}/);
  assert.match(styles, /repeat\(8,\s*1fr\)/);
});

test("Slum Lord exposes tactical movement and property-management choices on one screen", () => {
  for (const label of ["Roll normally", "Cruise slow", "Sketchy cab", "End turn", "Trade", "Auction", "Mortgage", "Improve", "rent scheme"]) {
    assert.match(gameSource, new RegExp(label, "i"));
  }
  assert.match(chaos, /district-weighted inspection crackdown/i);
  assert.match(chaos, /Blight Improvement Assessment/i);
  assert.match(gameSource, /Tenant pressure/i);
});

test("Slum Lord gives every property district a mechanical personality", () => {
  for (const archetype of ["Repair Trap", "Complaint Corridor", "Family Block", "Vice Economy", "Crew Territory", "Quiet Money", "Gentrification Machine", "Vertical Chaos"]) {
    assert.match(districts, new RegExp(archetype));
  }
  assert.match(chaos, /portfolioInspectionExposure/);
  assert.match(chaos, /applyNeighborhoodIncident/);
});

test("Slum Lord schedules the bot that actually owes the next action", () => {
  assert.match(gameSource, /botActionActor\(state\)/);
  assert.match(gameSource, /runBotStep\(current\)/);
  assert.match(botAutomation, /state\.auction\.currentBidderId/);
  assert.match(botAutomation, /state\.pendingTrade\.toId/);
  assert.doesNotMatch(gameSource, /if \(!player\?\.isBot\) return undefined/);
});

test("Slum Lord uses both side rails for readable game information", () => {
  assert.match(gameSource, /sl-left-rail/);
  assert.match(gameSource, /NeighborhoodFeed/);
  assert.match(districtStyles, /grid-template-columns:\s*215px\s+minmax\(610px,\s*1fr\)\s+370px/);
  assert.match(districtStyles, /\.sl-panel-header h3 \{[^}]*font-size:\s*24px/s);
  assert.match(districtStyles, /\.sl-property-facts b \{[^}]*font-size:\s*16px/s);
  assert.match(districtStyles, /\.sl-district-card > p \{[^}]*font-size:\s*13px/s);
});

test("Slum Lord replaces round caps with objective-based endings", () => {
  assert.doesNotMatch(gameSource, /15 rounds|25 rounds|40 rounds/i);
  assert.match(chaos, /Last Landlord Standing/);
  assert.match(chaos, /Build an Empire/);
  assert.match(chaos, /Own the Block/);
});

test("Slum Lord offers three cosmetic N64-style board themes", () => {
  for (const theme of ["Concrete Jungle", "Sunset Motel", "Toxic Tenement"]) {
    assert.match(indexSource, new RegExp(theme));
  }
  for (const className of ["sl-theme-concrete", "sl-theme-sunset", "sl-theme-toxic"]) {
    assert.match(themes, new RegExp(className));
  }
});
