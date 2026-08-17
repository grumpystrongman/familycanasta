export const BLACKGLASS_ASSET_ROOT = "/blackglass";
export const BLACKGLASS_ATLASES = Object.freeze({
  cast: `${BLACKGLASS_ASSET_ROOT}/canonical-cast-atlas.jpg`,
  rooms: `${BLACKGLASS_ASSET_ROOT}/room-atlas.jpg`,
  weapons: `${BLACKGLASS_ASSET_ROOT}/weapon-atlas.jpg`,
});
function sprite(atlas,col,row,cols,rows,canonicalId=null){ return Object.freeze({atlas,col,row,cols,rows,canonicalId}); }

export const CHARACTER_ASSETS = Object.freeze({
  "mara-voss": sprite(BLACKGLASS_ATLASES.cast,0,0,7,1,"mara-voss-v1"),
  "dex-vale": sprite(BLACKGLASS_ATLASES.cast,1,0,7,1,"dex-vale-v1"),
  "imani-cross": sprite(BLACKGLASS_ATLASES.cast,2,0,7,1,"imani-cross-v1"),
  "theo-rook": sprite(BLACKGLASS_ATLASES.cast,3,0,7,1,"theo-rook-v1"),
  "june-mercer": sprite(BLACKGLASS_ATLASES.cast,4,0,7,1,"june-mercer-v1"),
  "elias-flint": sprite(BLACKGLASS_ATLASES.cast,5,0,7,1,"elias-flint-v1"),
  "ruby-ash": sprite(BLACKGLASS_ATLASES.cast,6,0,7,1,"ruby-ash-v1"),
});
export const ROOM_SCENE_ASSETS = Object.freeze({
  greenhouse:sprite(BLACKGLASS_ATLASES.rooms,0,0,3,3), penthouse:sprite(BLACKGLASS_ATLASES.rooms,1,0,3,3), security:sprite(BLACKGLASS_ATLASES.rooms,2,0,3,3),
  laundry:sprite(BLACKGLASS_ATLASES.rooms,0,1,3,3), atrium:sprite(BLACKGLASS_ATLASES.rooms,1,1,3,3), kitchen:sprite(BLACKGLASS_ATLASES.rooms,2,1,3,3),
  garage:sprite(BLACKGLASS_ATLASES.rooms,0,2,3,3), nightclub:sprite(BLACKGLASS_ATLASES.rooms,1,2,3,3), boiler:sprite(BLACKGLASS_ATLASES.rooms,2,2,3,3),
});
export const WEAPON_SCENE_ASSETS = Object.freeze({
  cleaver:sprite(BLACKGLASS_ATLASES.weapons,0,0,3,2), "nail-gun":sprite(BLACKGLASS_ATLASES.weapons,1,0,3,2), garrote:sprite(BLACKGLASS_ATLASES.weapons,2,0,3,2),
  revolver:sprite(BLACKGLASS_ATLASES.weapons,0,1,3,2), poison:sprite(BLACKGLASS_ATLASES.weapons,1,1,3,2), "fire-axe":sprite(BLACKGLASS_ATLASES.weapons,2,1,3,2),
});
export const RECONSTRUCTION_COMBINATION_COUNT = 6 * 6 * 9;

export function spriteStyle(asset){
  if(!asset) return {};
  const x=asset.cols<=1?50:(asset.col/(asset.cols-1))*100;
  const y=asset.rows<=1?50:(asset.row/(asset.rows-1))*100;
  return { backgroundImage:`url(${asset.atlas})`, backgroundSize:`${asset.cols*100}% ${asset.rows*100}%`, backgroundPosition:`${x}% ${y}%` };
}

// One immutable atlas tile per person is the identity lock. Lighting, room, blood, pose framing
// and weapon treatment can change, but the underlying face/actor never does.
export function reconstructionAssetSet(suspectId,methodId,locationId){
  const suspect=CHARACTER_ASSETS[suspectId], victim=CHARACTER_ASSETS["ruby-ash"], weapon=WEAPON_SCENE_ASSETS[methodId], room=ROOM_SCENE_ASSETS[locationId];
  if(!suspect||!victim||!weapon||!room) throw new Error("Unknown Blackglass reconstruction asset.");
  return Object.freeze({suspect,victim,weapon,room,methodId,locationId});
}
