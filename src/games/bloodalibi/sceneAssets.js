function fixed(src,canonicalId=null){return Object.freeze({src,canonicalId});}
export const CHARACTER_ASSETS=Object.freeze({
  "mara-voss":fixed("https://i.pravatar.cc/500?img=47","mara-voss-v1"),
  "dex-vale":fixed("https://i.pravatar.cc/500?img=12","dex-vale-v1"),
  "imani-cross":fixed("https://i.pravatar.cc/500?img=32","imani-cross-v1"),
  "theo-rook":fixed("https://i.pravatar.cc/500?img=53","theo-rook-v1"),
  "june-mercer":fixed("https://i.pravatar.cc/500?img=45","june-mercer-v1"),
  "elias-flint":fixed("https://i.pravatar.cc/500?img=11","elias-flint-v1"),
  "ruby-ash":fixed("https://i.pravatar.cc/500?img=49","ruby-ash-v1"),
});
export const ROOM_SCENE_ASSETS=Object.freeze({
  greenhouse:fixed("https://loremflickr.com/1000/700/greenhouse,night?lock=301"),
  penthouse:fixed("https://loremflickr.com/1000/700/penthouse,hotel?lock=302"),
  security:fixed("https://loremflickr.com/1000/700/security,control-room?lock=303"),
  laundry:fixed("https://loremflickr.com/1000/700/laundry,industrial?lock=304"),
  atrium:fixed("https://loremflickr.com/1000/700/hotel,atrium?lock=305"),
  kitchen:fixed("https://loremflickr.com/1000/700/commercial,kitchen?lock=306"),
  garage:fixed("https://loremflickr.com/1000/700/parking,garage?lock=307"),
  nightclub:fixed("https://loremflickr.com/1000/700/nightclub,interior?lock=308"),
  boiler:fixed("https://loremflickr.com/1000/700/boiler,industrial?lock=309"),
});
export const WEAPON_SCENE_ASSETS=Object.freeze({
  "nail-gun":fixed("https://loremflickr.com/600/450/nail-gun,tool?lock=401"),
  cleaver:fixed("https://loremflickr.com/600/450/cleaver,knife?lock=402"),
  garrote:fixed("https://loremflickr.com/600/450/cable,wire?lock=403"),
  revolver:fixed("https://loremflickr.com/600/450/revolver,antique?lock=404"),
  poison:fixed("https://loremflickr.com/600/450/whiskey,glass?lock=405"),
  "fire-axe":fixed("https://loremflickr.com/600/450/fire,axe?lock=406"),
});
export const RECONSTRUCTION_COMBINATION_COUNT=6*6*9;
export function spriteStyle(asset){return asset?{backgroundImage:`url(${asset.src})`,backgroundSize:"cover",backgroundPosition:"center"}:{}}
// Every combination points to the same immutable character source for that person. Room, method,
// blood/injury treatment and framing change; the actor's face never silently changes.
export function reconstructionAssetSet(suspectId,methodId,locationId){const suspect=CHARACTER_ASSETS[suspectId],victim=CHARACTER_ASSETS["ruby-ash"],weapon=WEAPON_SCENE_ASSETS[methodId],room=ROOM_SCENE_ASSETS[locationId];if(!suspect||!victim||!weapon||!room)throw new Error("Unknown Blackglass reconstruction asset.");return Object.freeze({suspect,victim,weapon,room,methodId,locationId});}
