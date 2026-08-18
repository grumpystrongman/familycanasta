# Blackglass scenario-card factory

This is the production pipeline for the **1,620** Blackglass Hotel reconstruction cards:

- 9 rooms
- 6 killers
- 5 possible victims for each killer (the victim can never be the killer)
- 6 weapons

`9 × 6 × 5 × 6 = 1,620`

## Design goals

1. Preserve the approved Blackglass card layout and canonical cast.
2. Keep every reconstruction family-game appropriate: implied mystery only, with no blood, wounds, gore, strangulation, active attack, weapon/body contact, sexual content, or children.
3. Use code—not an LLM—for enumeration, filenames, labels, card layout, retries, manifests, and verification.
4. Use the smallest model that can do each job without sacrificing the approved look:
   - room/weapon reference art: `gpt-image-1-mini`
   - canonical character portraits: `gpt-image-1`
   - scenario scenes: `gpt-image-1`, because high input fidelity is required to preserve recurring character faces
   - visual QA: `gpt-5-nano` with low-detail image inputs
5. Start scene generation at `medium` quality. Only a failed QA scene is regenerated at `high` quality.
6. Never overwrite a completed final card unless its file is deliberately removed.

## Canonical references

The pipeline is self-contained. On the first run it generates and persists six canonical character portraits, nine room references, and six weapon references. Character portraits use `gpt-image-1` because face consistency matters; room and prop references use `gpt-image-1-mini`.

If `public/games/bloodalibi/references/canonical-cast-atlas.jpg` is present, `blackglass:prepare-references` crops that atlas instead and the generated scenes inherit those exact recurring faces. This optional override is the path for locking an externally approved cast atlas without changing any card IDs.

## Proper build order

```bash
npm install
export OPENAI_API_KEY="..."

npm run blackglass:manifest
npm run blackglass:prepare-references
npm run blackglass:reference-art
npm run blackglass:scenes
npm run blackglass:compose
npm run blackglass:verify
```

Or run the entire chain:

```bash
npm run blackglass:build-cards
```

## Start with one room

The intended production cadence is room-by-room, 180 cards at a time:

```bash
BLACKGLASS_ROOM=penthouse npm run blackglass:build-cards
BLACKGLASS_ROOM=greenhouse npm run blackglass:build-cards
BLACKGLASS_ROOM=security npm run blackglass:build-cards
BLACKGLASS_ROOM=laundry npm run blackglass:build-cards
BLACKGLASS_ROOM=atrium npm run blackglass:build-cards
BLACKGLASS_ROOM=kitchen npm run blackglass:build-cards
BLACKGLASS_ROOM=garage npm run blackglass:build-cards
BLACKGLASS_ROOM=nightclub npm run blackglass:build-cards
BLACKGLASS_ROOM=boiler npm run blackglass:build-cards
```

For a small pilot:

```bash
BLACKGLASS_ROOM=penthouse BLACKGLASS_LIMIT=10 npm run blackglass:build-cards
```

## Output

Generated scene art:

`public/games/bloodalibi/scenes/<room>/<scenario-id>.webp`

Final individual game cards:

`public/games/bloodalibi/cards/<room>/<scenario-id>.webp`

Example:

`public/games/bloodalibi/cards/penthouse/penthouse__june-mercer__ruby-ash__revolver.webp`

The game uses the same deterministic ID via `src/games/bloodalibi/scenarioCards.js`, so a theory and final solution can display their exact reconstruction card without loading the rest of the 1,620-card library.

## Quality gate

Every generated scene is compared to its canonical reference sheet. A scene must:

- score at least 92/100 overall
- score at least 88/100 for identity likeness
- score at least 88/100 for Blackglass style
- have the correct room and weapon
- have exactly two adults
- pass the family-safety checks

A failed first pass is regenerated at high image quality. A second failure is stopped for manual review; it is not composed into a final card.

`blackglass:verify` also rejects missing cards, wrong card dimensions, and byte-identical duplicate cards.

## GitHub Actions

`.github/workflows/blackglass-cards.yml` provides a manual room/limit run. It requires an `OPENAI_API_KEY` repository secret. By default it uploads generated cards as a workflow artifact. Set `persist=true` only when you want the workflow to commit generated assets back to its branch.
