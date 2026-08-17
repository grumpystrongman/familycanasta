import {reconstructionAssetSet} from "./sceneAssets.js";

export const CRIME_SCENE_WIDTH=1440;
export const CRIME_SCENE_HEIGHT=810;
export const CRIME_SCENE_PIPELINE_VERSION="cinematic-v1";

const METHOD_PLAN=Object.freeze({
  "nail-gun":{blood:.62,weapon:{x:.63,y:.55,w:.18,h:.23,rotation:-.18},victimRotation:1.22,accent:"#8d1f1c",note:"puncture trauma"},
  cleaver:{blood:1,weapon:{x:.61,y:.48,w:.22,h:.27,rotation:.48},victimRotation:1.32,accent:"#ad2420",note:"sharp-force trauma"},
  garrote:{blood:.38,weapon:{x:.66,y:.39,w:.2,h:.19,rotation:.05},victimRotation:1.19,accent:"#79201f",note:"ligature trauma"},
  revolver:{blood:.72,weapon:{x:.35,y:.56,w:.18,h:.2,rotation:-.28},victimRotation:1.26,accent:"#9b2522",note:"ballistic trauma"},
  poison:{blood:.12,weapon:{x:.72,y:.65,w:.14,h:.16,rotation:.08},victimRotation:1.17,accent:"#496d59",note:"toxicology event"},
  "fire-axe":{blood:1,weapon:{x:.58,y:.43,w:.28,h:.34,rotation:.34},victimRotation:1.34,accent:"#b32620",note:"heavy sharp-force trauma"},
});
const ROOM_GRADE=Object.freeze({
  greenhouse:{warm:"#26472f",cool:"#0d1712"},penthouse:{warm:"#6a3c20",cool:"#151018"},security:{warm:"#213846",cool:"#07151f"},laundry:{warm:"#31474c",cool:"#0c171a"},atrium:{warm:"#274944",cool:"#0a1716"},kitchen:{warm:"#554c38",cool:"#181714"},garage:{warm:"#3b352c",cool:"#111316"},nightclub:{warm:"#5a2059",cool:"#100c1d"},boiler:{warm:"#672b19",cool:"#1b0d08"},
});
const imageCache=new Map();
function hash(input){let h=2166136261;for(const c of String(input)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let s=seed||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}}
function clamp(v,min,max){return Math.max(min,Math.min(max,v))}

export function buildCrimeScenePlan({suspectId,methodId,locationId,turn=1}){
  const assets=reconstructionAssetSet(suspectId,methodId,locationId),method=METHOD_PLAN[methodId]||METHOD_PLAN.cleaver,seed=hash(`${suspectId}|${methodId}|${locationId}|${turn}`),random=rng(seed);
  const suspectOnLeft=random()>.22;
  const suspect={x:suspectOnLeft?.035:.665,y:.08,w:.31,h:.79,rotation:(random()-.5)*.035};
  const victim={x:suspectOnLeft?.44:.08,y:.36,w:.52,h:.62,rotation:method.victimRotation+(random()-.5)*.08};
  const weapon={...method.weapon};
  if(!suspectOnLeft)weapon.x=1-weapon.x-weapon.w;
  return Object.freeze({
    key:`${suspectId}:${methodId}:${locationId}:${turn}`,
    seed,assets,suspectId,methodId,locationId,suspect,victim,weapon,
    bloodIntensity:method.blood,accent:method.accent,forensicNote:method.note,
    grade:ROOM_GRADE[locationId]||ROOM_GRADE.atrium,
  });
}

function loadImage(src){
  if(imageCache.has(src))return imageCache.get(src);
  const promise=new Promise((resolve,reject)=>{const image=new Image();image.decoding="async";image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`Unable to load scene asset ${src}`));image.src=src});
  imageCache.set(src,promise);return promise;
}
function sourceRect(image,asset){
  const c=asset?.crop;if(!c)return{x:0,y:0,w:image.naturalWidth,h:image.naturalHeight};
  const w=image.naturalWidth/c.cols,h=image.naturalHeight/c.rows;return{x:c.col*w,y:c.row*h,w,h};
}
function coverCrop(source,dw,dh){
  let{x,y,w,h}=source;const src=w/h,dst=dw/dh;
  if(src>dst){const nw=h*dst;x+=(w-nw)/2;w=nw}else{const nh=w/dst;y+=(h-nh)/2;h=nh}
  return{x,y,w,h};
}
function drawAssetCover(ctx,image,asset,x,y,w,h){const s=coverCrop(sourceRect(image,asset),w,h);ctx.drawImage(image,s.x,s.y,s.w,s.h,x,y,w,h)}
function canvas(width,height){const c=document.createElement("canvas");c.width=Math.max(1,Math.round(width));c.height=Math.max(1,Math.round(height));return c}
function drawFeatheredPhoto(ctx,image,asset,box,{rotation=0,brightness=1,saturation=1,contrast=1,edge=.18,shadow=true}={}){
  const w=Math.round(box.w),h=Math.round(box.h),layer=canvas(w,h),lc=layer.getContext("2d");
  lc.filter=`brightness(${brightness}) saturate(${saturation}) contrast(${contrast})`;drawAssetCover(lc,image,asset,0,0,w,h);lc.filter="none";
  lc.globalCompositeOperation="destination-in";const mask=lc.createRadialGradient(w*.5,h*.47,Math.min(w,h)*.24,w*.5,h*.47,Math.max(w,h)*.63);mask.addColorStop(0,"rgba(0,0,0,1)");mask.addColorStop(clamp(1-edge,.45,.9),"rgba(0,0,0,.98)");mask.addColorStop(1,"rgba(0,0,0,0)");lc.fillStyle=mask;lc.fillRect(0,0,w,h);lc.globalCompositeOperation="source-over";
  ctx.save();ctx.translate(box.x+w/2,box.y+h/2);ctx.rotate(rotation);if(shadow){ctx.shadowColor="rgba(0,0,0,.9)";ctx.shadowBlur=34;ctx.shadowOffsetY=18}ctx.drawImage(layer,-w/2,-h/2,w,h);ctx.restore();
}
function drawWeapon(ctx,image,asset,box,rotation,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.translate(box.x+box.w/2,box.y+box.h/2);ctx.rotate(rotation);ctx.shadowColor="rgba(0,0,0,.95)";ctx.shadowBlur=18;ctx.shadowOffsetY=9;const s=coverCrop(sourceRect(image,asset),box.w,box.h);ctx.drawImage(image,s.x,s.y,s.w,s.h,-box.w/2,-box.h/2,box.w,box.h);ctx.restore()}
function roundedRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawBlood(ctx,plan){
  const r=rng(plan.seed^0x9e3779b9),a=plan.bloodIntensity;if(a<=0)return;
  const vx=plan.victim.x*CRIME_SCENE_WIDTH+plan.victim.w*CRIME_SCENE_WIDTH*.51,vy=plan.victim.y*CRIME_SCENE_HEIGHT+plan.victim.h*CRIME_SCENE_HEIGHT*.66;
  ctx.save();ctx.globalCompositeOperation="multiply";const pool=ctx.createRadialGradient(vx,vy,8,vx,vy,210*a+60);pool.addColorStop(0,`rgba(125,0,0,${.72*a})`);pool.addColorStop(.42,`rgba(72,0,0,${.6*a})`);pool.addColorStop(1,"rgba(30,0,0,0)");ctx.fillStyle=pool;ctx.beginPath();ctx.ellipse(vx,vy,230*a+85,90*a+34,(r()-.5)*.3,0,Math.PI*2);ctx.fill();
  const drops=Math.round(28*a);for(let i=0;i<drops;i++){const angle=r()*Math.PI*2,dist=(28+r()*250)*a,rad=1+r()*5*a;ctx.fillStyle=`rgba(${90+Math.floor(r()*45)},0,0,${.32+r()*.48})`;ctx.beginPath();ctx.arc(vx+Math.cos(angle)*dist,vy+Math.sin(angle)*dist*.48,rad,0,Math.PI*2);ctx.fill()}
  ctx.restore();
  ctx.save();ctx.strokeStyle=`rgba(117,0,0,${.72*a})`;ctx.fillStyle=`rgba(112,0,0,${.65*a})`;ctx.lineCap="round";
  if(plan.methodId==="garrote"){ctx.lineWidth=12;ctx.beginPath();ctx.arc(vx-18,vy-118,58,.12*Math.PI,.9*Math.PI);ctx.stroke()}
  if(plan.methodId==="revolver"){ctx.beginPath();ctx.arc(vx+26,vy-108,16,0,Math.PI*2);ctx.fill();for(let i=0;i<9;i++){ctx.lineWidth=2+r()*3;ctx.beginPath();ctx.moveTo(vx+26,vy-108);ctx.lineTo(vx+26+(r()-.5)*170,vy-108+(r()-.5)*150);ctx.stroke()}}
  if(plan.methodId==="nail-gun"){for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(vx-12+i*17,vy-75+(i%2)*13,6,0,Math.PI*2);ctx.fill()}}
  if(plan.methodId==="poison"){ctx.fillStyle="rgba(58,108,76,.22)";ctx.beginPath();ctx.ellipse(vx+40,vy-20,120,60,.2,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
function drawGrain(ctx,seed){const r=rng(seed^0xa53a9d3f);ctx.save();ctx.globalCompositeOperation="soft-light";for(let i=0;i<1800;i++){const a=.015+r()*.045,v=150+Math.floor(r()*105);ctx.fillStyle=`rgba(${v},${v},${v},${a})`;const s=r()<.9?1:2;ctx.fillRect(r()*CRIME_SCENE_WIDTH,r()*CRIME_SCENE_HEIGHT,s,s)}ctx.restore()}
function drawGrade(ctx,plan){
  ctx.save();let g=ctx.createLinearGradient(0,0,CRIME_SCENE_WIDTH,CRIME_SCENE_HEIGHT);g.addColorStop(0,`${plan.grade.cool}bb`);g.addColorStop(.48,"rgba(0,0,0,0)");g.addColorStop(1,`${plan.grade.warm}88`);ctx.globalCompositeOperation="color";ctx.fillStyle=g;ctx.fillRect(0,0,CRIME_SCENE_WIDTH,CRIME_SCENE_HEIGHT);ctx.globalCompositeOperation="source-over";
  const vignette=ctx.createRadialGradient(CRIME_SCENE_WIDTH*.52,CRIME_SCENE_HEIGHT*.46,CRIME_SCENE_HEIGHT*.18,CRIME_SCENE_WIDTH*.52,CRIME_SCENE_HEIGHT*.46,CRIME_SCENE_WIDTH*.69);vignette.addColorStop(0,"rgba(0,0,0,0)");vignette.addColorStop(.58,"rgba(0,0,0,.08)");vignette.addColorStop(1,"rgba(0,0,0,.88)");ctx.fillStyle=vignette;ctx.fillRect(0,0,CRIME_SCENE_WIDTH,CRIME_SCENE_HEIGHT);ctx.restore();drawGrain(ctx,plan.seed);
}
function drawSceneText(ctx,plan,labels){ctx.save();ctx.textBaseline="top";ctx.shadowColor="#000";ctx.shadowBlur=8;ctx.fillStyle="rgba(235,205,148,.86)";ctx.font="700 17px ui-monospace, SFMono-Regular, Menlo, monospace";ctx.fillText("BLACKGLASS // FORENSIC RECONSTRUCTION",28,25);ctx.fillStyle="rgba(255,255,255,.68)";ctx.font="600 13px ui-monospace, SFMono-Regular, Menlo, monospace";ctx.fillText(`${labels.room.toUpperCase()}  ·  ${plan.forensicNote.toUpperCase()}`,28,50);ctx.textAlign="right";ctx.fillStyle="rgba(220,67,58,.92)";ctx.font="800 15px ui-monospace, SFMono-Regular, Menlo, monospace";ctx.fillText(`${labels.suspect.toUpperCase()}  /  ${labels.method.toUpperCase()}`,CRIME_SCENE_WIDTH-28,27);ctx.fillStyle="rgba(255,255,255,.58)";ctx.font="600 12px ui-monospace, SFMono-Regular, Menlo, monospace";ctx.fillText(`VICTIM: RUBY ASH  ·  SCENE ${plan.key}`,CRIME_SCENE_WIDTH-28,51);ctx.restore()}

export async function renderCrimeScene(target,scenario,labels){
  if(!target)throw new Error("Crime scene canvas is required.");
  const plan=buildCrimeScenePlan(scenario),assets=plan.assets;
  const [roomImage,suspectImage,victimImage,weaponImage]=await Promise.all([loadImage(assets.room.src),loadImage(assets.suspect.src),loadImage(assets.victim.src),loadImage(assets.weapon.src)]);
  target.width=CRIME_SCENE_WIDTH;target.height=CRIME_SCENE_HEIGHT;const ctx=target.getContext("2d",{alpha:false});
  ctx.fillStyle="#08090b";ctx.fillRect(0,0,CRIME_SCENE_WIDTH,CRIME_SCENE_HEIGHT);ctx.filter="brightness(.78) contrast(1.14) saturate(.86)";drawAssetCover(ctx,roomImage,assets.room,0,0,CRIME_SCENE_WIDTH,CRIME_SCENE_HEIGHT);ctx.filter="none";
  const suspectBox={x:plan.suspect.x*CRIME_SCENE_WIDTH,y:plan.suspect.y*CRIME_SCENE_HEIGHT,w:plan.suspect.w*CRIME_SCENE_WIDTH,h:plan.suspect.h*CRIME_SCENE_HEIGHT};
  const victimBox={x:plan.victim.x*CRIME_SCENE_WIDTH,y:plan.victim.y*CRIME_SCENE_HEIGHT,w:plan.victim.w*CRIME_SCENE_WIDTH,h:plan.victim.h*CRIME_SCENE_HEIGHT};
  drawFeatheredPhoto(ctx,suspectImage,assets.suspect,suspectBox,{rotation:plan.suspect.rotation,brightness:.88,saturation:.82,contrast:1.12,edge:.2});
  drawBlood(ctx,plan);
  drawFeatheredPhoto(ctx,victimImage,assets.victim,victimBox,{rotation:plan.victim.rotation,brightness:.9,saturation:.9,contrast:1.08,edge:.28});
  const weaponBox={x:plan.weapon.x*CRIME_SCENE_WIDTH,y:plan.weapon.y*CRIME_SCENE_HEIGHT,w:plan.weapon.w*CRIME_SCENE_WIDTH,h:plan.weapon.h*CRIME_SCENE_HEIGHT};drawWeapon(ctx,weaponImage,assets.weapon,weaponBox,plan.weapon.rotation,.94);
  drawGrade(ctx,plan);drawSceneText(ctx,plan,labels);
  target.dataset.sceneKey=plan.key;target.dataset.pipeline=CRIME_SCENE_PIPELINE_VERSION;target.dataset.canonicalSuspect=assets.suspect.canonicalId||"";target.dataset.canonicalVictim=assets.victim.canonicalId||"";return plan;
}
