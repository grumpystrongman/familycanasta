import React,{useEffect,useRef,useState} from "react";
import {LOCATIONS,METHODS,SUSPECTS,evidenceLabel} from "./engineV3.js";
import {RECONSTRUCTION_COMBINATION_COUNT,reconstructionAssetSet,spriteStyle} from "./sceneAssets.js";
import {CRIME_SCENE_PIPELINE_VERSION,renderCrimeScene} from "./crimeScenePipeline.js";
import {BLACKGLASS_STATIC_CARD_PIPELINE,staticScenarioCardSrc} from "./staticScenarioCards.js";

const LOC=Object.freeze(Object.fromEntries(LOCATIONS.map(x=>[x.id,x])));
const SUS=Object.freeze(Object.fromEntries(SUSPECTS.map(x=>[x.id,x])));
const MET=Object.freeze(Object.fromEntries(METHODS.map(x=>[x.id,x])));

export default function BlackglassReconstruction({scenario,refuter,shown,onClose}){
 const canvasRef=useRef(null);
 const staticSrc=scenario?staticScenarioCardSrc(scenario):"";
 const [useStaticCard,setUseStaticCard]=useState(Boolean(staticSrc));
 const [status,setStatus]=useState("rendering");
 const [renderError,setRenderError]=useState("");
 const room=scenario?LOC[scenario.locationId]:null;
 const suspect=scenario?SUS[scenario.suspectId]:null;
 const victim=scenario?SUS[scenario.victimId||"ruby-ash"]:null;
 const method=scenario?MET[scenario.methodId]:null;
 const a=scenario?reconstructionAssetSet(scenario.suspectId,scenario.victimId||"ruby-ash",scenario.methodId,scenario.locationId):null;

 useEffect(()=>{
  setUseStaticCard(Boolean(staticSrc));
  setStatus("rendering");
  setRenderError("");
 },[staticSrc]);

 useEffect(()=>{
  if(useStaticCard||!scenario||!canvasRef.current)return;
  let active=true;
  setStatus("rendering");
  setRenderError("");
  renderCrimeScene(canvasRef.current,scenario,{
   room:room?.name||scenario.locationId,
   suspect:suspect?.name||scenario.suspectId,
   victim:victim?.name||scenario.victimId||"Ruby Ash",
   method:method?.name||scenario.methodId,
  }).then(()=>{if(active)setStatus("ready")}).catch(error=>{
   console.error("Blackglass cinematic renderer failed",error);
   if(active){setStatus("error");setRenderError(error?.message||"Unable to render reconstruction.")}
  });
  return()=>{active=false};
 },[useStaticCard,scenario?.suspectId,scenario?.victimId,scenario?.methodId,scenario?.locationId,scenario?.turn,room?.name,suspect?.name,victim?.name,method?.name]);

 if(!scenario||!room||!suspect||!victim||!method||!a)return null;
 return <div className="b3-recon-backdrop" role="dialog" aria-modal="true" aria-label="Theory reconstruction">
  <article
   className={`b3-recon method-${scenario.methodId} ${status}`}
   data-testid="blackglass-scenario-modal"
   data-render-status={status}
   data-render-error={renderError}
   data-render-source={useStaticCard?"static-card":"runtime-canvas"}
   data-card-pipeline={useStaticCard?BLACKGLASS_STATIC_CARD_PIPELINE:"fallback"}
   data-card-src={staticSrc}
   data-canonical-suspect={a.suspect.canonicalId}
   data-canonical-victim={a.victim.canonicalId}
   data-pipeline={CRIME_SCENE_PIPELINE_VERSION}
  >
   <button type="button" className="b3-recon-close" onClick={onClose} aria-label="Close reconstruction">×</button>
   <header>
    <small>FORENSIC RECONSTRUCTION · THEORY {scenario.turn}</small>
    <h2>{suspect.name} · {method.name}</h2>
    <p>{room.name} · victim: {victim.name} · one of {RECONSTRUCTION_COMBINATION_COUNT.toLocaleString()} identity-locked scenario cards</p>
   </header>
   <div className={`b3-cinematic-frame ${useStaticCard?"has-static-card":"has-runtime-scene"}`}>
    {useStaticCard?<img
     src={staticSrc}
     className="b3-static-scenario-card"
     data-testid="blackglass-static-scenario-card"
     alt={`${suspect.name}, ${victim.name}, ${room.name}, ${method.name}`}
     onLoad={()=>setStatus("ready")}
     onError={()=>{setUseStaticCard(false);setStatus("rendering");setRenderError("")}}
    />:<>
     <canvas ref={canvasRef} className="b3-crime-scene-canvas" data-testid="blackglass-crime-scene" aria-label={`${suspect.name} with ${method.name} in ${room.name}, victim ${victim.name}`}/>
     {status==="rendering"?<div className="b3-scene-loading"><span/><strong>Reconstructing the scene…</strong></div>:null}
     {status==="error"?<div className="b3-scene-error"><strong>Scene renderer failed</strong><span>{renderError}</span></div>:null}
     <div className="b3-scene-caption">
      <span><i className="b3-caption-thumb person" style={spriteStyle(a.suspect)}/><b>Killer</b>{suspect.name}</span>
      <span><i className="b3-caption-thumb person" style={spriteStyle(a.victimPortrait)}/><b>Victim</b>{victim.name}</span>
      <span><i className="b3-caption-thumb room" style={spriteStyle(a.room)}/><b>Location</b>{room.name}</span>
      <span><i className="b3-caption-thumb weapon" style={spriteStyle(a.weapon)}/><b>Weapon</b>{method.name}</span>
     </div>
    </>}
   </div>
   <footer className={refuter?"refuted":"unresolved"}>
    <div>
     <small>{refuter?"THE THEORY WAS REFUTED":"NO REFUTATION YET"}</small>
     <strong>{refuter?`${refuter.nickname} produced evidence.`:"Nobody at the table could refute this reconstruction."}</strong>
     {shown?<span>Privately shown: {evidenceLabel(shown)}</span>:<span>{RECONSTRUCTION_COMBINATION_COUNT.toLocaleString()} possible cards across the nine room batches.</span>}
    </div>
    <button type="button" onClick={onClose}>Continue investigation</button>
   </footer>
  </article>
 </div>;
}
