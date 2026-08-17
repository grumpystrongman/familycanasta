import { SCENARIOS_PER_ROOM, TOTAL_SCENARIO_CARDS } from "./scenarioCatalog.js";

const ROOT="/blackglass";
function fixed(src,canonicalId=null,backgroundSize="cover",backgroundPosition="center",crop=null){return Object.freeze({src,canonicalId,backgroundSize,backgroundPosition,crop});}
function xPos(index,count){return count<=1?"50%":`${(index/(count-1))*100}%`;}
function atlas(src,index,count,canonicalId=null){return fixed(src,canonicalId,`${count*100}% 100%`,`${xPos(index,count)} 50%`,Object.freeze({col:index,row:0,cols:count,rows:1}));}
function gridAtlas(src,col,row,cols,rows,canonicalId=null){const x=cols<=1?50:(col/(cols-1))*100;const y=rows<=1?50:(row/(rows-1))*100;return fixed(src,canonicalId,`${cols*100}% ${rows*100}%`,`${x}% ${y}%`,Object.freeze({col,row,cols,rows}));}

export const BOARD_MASTER_ASSET=`${ROOT}/board-master.jpg`;
const CAST_ATLAS=`${ROOT}/canonical-cast-atlas.jpg`;
const ROOM_ATLAS=`${ROOT}/room-atlas.jpg`;
const WEAPON_ATLAS=`${ROOT}/weapon-atlas.jpg`;

// The seven-cell atlas still contains the retired Mara Voss reference in cell zero so existing
// art does not need to be repacked. The live six-person cast starts at cell one.
export const CHARACTER_ASSETS=Object.freeze({
  "mara-voss":atlas(CAST_ATLAS,0,7,"mara-voss-v2"),
  "dex-vale":atlas(CAST_ATLAS,1,7,"dex-vale-v2"),
  "imani-cross":atlas(CAST_ATLAS,2,7,"imani-cross-v2"),
  "theo-rook":atlas(CAST_ATLAS,3,7,"theo-rook-v2"),
  "june-mercer":atlas(CAST_ATLAS,4,7,"june-mercer-v2"),
  "elias-flint":atlas(CAST_ATLAS,5,7,"elias-flint-v2"),
  "ruby-ash":atlas(CAST_ATLAS,6,7,"ruby-ash-v2"),
});
export const RUBY_VICTIM_SCENE=fixed(`${ROOT}/ruby-victim-base.jpg`,"ruby-ash-v2","cover","center 58%");

export const ROOM_SCENE_ASSETS=Object.freeze({
  greenhouse:gridAtlas(ROOM_ATLAS,0,0,3,3),
  penthouse:gridAtlas(ROOM_ATLAS,1,0,3,3),
  security:gridAtlas(ROOM_ATLAS,2,0,3,3),
  laundry:gridAtlas(ROOM_ATLAS,0,1,3,3),
  atrium:gridAtlas(ROOM_ATLAS,1,1,3,3),
  kitchen:gridAtlas(ROOM_ATLAS,2,1,3,3),
  garage:gridAtlas(ROOM_ATLAS,0,2,3,3),
  nightclub:gridAtlas(ROOM_ATLAS,1,2,3,3),
  boiler:gridAtlas(ROOM_ATLAS,2,2,3,3),
});
export const WEAPON_SCENE_ASSETS=Object.freeze({
  "nail-gun":gridAtlas(WEAPON_ATLAS,0,0,3,2),
  cleaver:gridAtlas(WEAPON_ATLAS,1,0,3,2),
  garrote:gridAtlas(WEAPON_ATLAS,2,0,3,2),
  revolver:gridAtlas(WEAPON_ATLAS,0,1,3,2),
  poison:gridAtlas(WEAPON_ATLAS,1,1,3,2),
  "fire-axe":gridAtlas(WEAPON_ATLAS,2,1,3,2),
});

export const RECONSTRUCTION_COMBINATION_COUNT=TOTAL_SCENARIO_CARDS;
export const RECONSTRUCTIONS_PER_ROOM=SCENARIOS_PER_ROOM;
export function spriteStyle(asset){return asset?{backgroundImage:`url(${asset.src})`,backgroundSize:asset.backgroundSize||"cover",backgroundPosition:asset.backgroundPosition||"center",backgroundRepeat:"no-repeat"}:{}}

// Identity is deterministic: every reconstruction reuses the same canonical atlas cell for each
// person. Killer and victim are distinct; room and weapon plates vary independently.
export function reconstructionAssetSet(suspectId,victimId,methodId,locationId){
  // Compatibility with the original fixed-Ruby three-argument signature.
  if(locationId===undefined){locationId=methodId;methodId=victimId;victimId="ruby-ash";}
  if(suspectId===victimId)throw new Error("Blackglass killer and victim must be different characters.");
  const suspect=CHARACTER_ASSETS[suspectId],victimPortrait=CHARACTER_ASSETS[victimId],victim=victimId==="ruby-ash"?RUBY_VICTIM_SCENE:victimPortrait,weapon=WEAPON_SCENE_ASSETS[methodId],room=ROOM_SCENE_ASSETS[locationId];
  if(!suspect||!victim||!victimPortrait||!weapon||!room)throw new Error("Unknown Blackglass reconstruction asset.");
  return Object.freeze({suspect,victim,victimPortrait,weapon,room,suspectId,victimId,methodId,locationId});
}
