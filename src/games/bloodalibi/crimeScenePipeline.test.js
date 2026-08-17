import test from "node:test";
import assert from "node:assert/strict";
import {CRIME_SCENE_HEIGHT,CRIME_SCENE_PIPELINE_VERSION,CRIME_SCENE_WIDTH,buildCrimeScenePlan} from "./crimeScenePipeline.js";
import {LOCATIONS,METHODS,SUSPECTS} from "./engineV3.js";

test("cinematic renderer targets the game reconstruction frame",()=>{assert.equal(CRIME_SCENE_WIDTH,1440);assert.equal(CRIME_SCENE_HEIGHT,810);assert.equal(CRIME_SCENE_PIPELINE_VERSION,"cinematic-v2-1620")});

test("all 1,620 scene plans remain identity locked and bounded",()=>{let count=0;for(const killer of SUSPECTS)for(const victim of SUSPECTS){if(killer.id===victim.id)continue;for(const method of METHODS)for(const room of LOCATIONS){const plan=buildCrimeScenePlan({suspectId:killer.id,victimId:victim.id,methodId:method.id,locationId:room.id,turn:11});assert.equal(plan.assets.suspect.canonicalId,`${killer.id}-v2`);assert.equal(plan.assets.victim.canonicalId,`${victim.id}-v2`);for(const box of [plan.suspect,plan.victim,plan.weapon]){assert.ok(box.x>=0&&box.y>=0&&box.w>0&&box.h>0);assert.ok(box.x+box.w<=1.02);assert.ok(box.y+box.h<=1.04)}assert.ok(plan.bloodIntensity>=0&&plan.bloodIntensity<=.2);count++}}assert.equal(count,1620)});

test("scene staging is deterministic and includes victim identity in the key",()=>{const a=buildCrimeScenePlan({suspectId:"elias-flint",victimId:"ruby-ash",methodId:"cleaver",locationId:"penthouse",turn:7}),b=buildCrimeScenePlan({suspectId:"elias-flint",victimId:"ruby-ash",methodId:"cleaver",locationId:"penthouse",turn:7}),c=buildCrimeScenePlan({suspectId:"elias-flint",victimId:"june-mercer",methodId:"cleaver",locationId:"penthouse",turn:7});assert.deepEqual(a,b);assert.notEqual(a.key,c.key);assert.notEqual(a.assets.victim.canonicalId,c.assets.victim.canonicalId)});
