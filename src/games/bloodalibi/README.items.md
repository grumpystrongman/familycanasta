# Blackglass reusable scenario artwork

Blackglass now composes a proposed scenario from three reusable visual items instead of generating a unique image for every possible combination:

- 6 suspect portraits
- 6 weapon cards
- 9 room cards

The runtime maps the selected `suspectId`, `methodId`, and `locationId` through `itemAssets.js` and renders those three assets together. This keeps the artwork deterministic, makes every proposal immediately available, and avoids maintaining 1,620 generated full-scene cards.

Asset paths are under `public/games/bloodalibi/items/`.
