import test from "node:test";
import assert from "node:assert/strict";
import {CHARACTER_ASSETS,RECONSTRUCTION_COMBINATION_COUNT,RECONSTRUCTIONS_PER_ROOM,reconstructionAssetSet} from "./sceneAssets.js";
import {SCENARIO_CATALOG,SCENARIOS_BY_ROOM,TOTAL_SCENARIO_CARDS} from "./scenarioCatalog.js";
import {LOCATIONS,METHODS,SUSPECTS} from "./engineV3.js";

test("all 1,620 reconstruction cards resolve",()=>{let count=0;for(const room of LOCATIONS){assert.equal(SCENARIOS_BY_ROOM[room.id].length,180);for(const killer of SUSPECTS)for(const victim of SUSPECTS){if(killer.id===victim.id)continue;for(const method of METHODS){const a=reconstructionAssetSet(killer.id,victim.id,method.id,room.id);assert.ok(a.suspect.src);assert.ok(a.victim.src);assert.ok(a.victimPortrait.src);assert.ok(a.weapon.src);assert.ok(a.room.src);assert.equal(a.suspect.canonicalId,`${killer.id}-v2`);assert.equal(a.victim.canonicalId,`${victim.id}-v2`);count++}}}assert.equal(RECONSTRUCTIONS_PER_ROOM,180);assert.equal(count,RECONSTRUCTION_COMBINATION_COUNT);assert.equal(count,TOTAL_SCENARIO_CARDS);assert.equal(count,1620);assert.equal(SCENARIO_CATALOG.length,1620)});

test("killer and victim identities remain locked and distinct",()=>{for(const killer of SUSPECTS)for(const victim of SUSPECTS){if(killer.id===victim.id)continue;const expectedKiller=CHARACTER_ASSETS[killer.id],expectedVictim=CHARACTER_ASSETS[victim.id];for(const method of METHODS.slice(0,2))for(const room of LOCATIONS.slice(0,2)){const a=reconstructionAssetSet(killer.id,victim.id,method.id,room.id);assert.strictEqual(a.suspect,expectedKiller);assert.strictEqual(a.victimPortrait,expectedVictim);assert.notEqual(a.suspect.canonicalId,a.victim.canonicalId)}}});

test("same person cannot be both killer and victim",()=>{assert.throws(()=>reconstructionAssetSet("dex-vale","dex-vale","cleaver","penthouse"),/different characters/)});
