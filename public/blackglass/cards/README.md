# Blackglass scenario cards

This directory is the production destination for the individual Blackglass Hotel reconstruction cards used by the game.

The complete library is deterministic:

- 9 rooms
- 6 killers
- 5 different victims for each killer
- 6 weapons
- 180 cards per room
- 1,620 cards total

Cards are stored by room and use stable filenames such as:

`penthouse/penthouse__june-mercer__ruby-ash__revolver.webp`

The factory is `scripts/blackglass/build-cards.mjs`.

Generation deliberately separates generative work from deterministic work. OpenAI generates only the cinematic scene. The Blackglass border, four identity tiles, labels, names and branding are composed by Sharp so spelling and layout remain stable across the full library. The approved 1122×1402 card design is checked into `public/blackglass/card-template-reference.png` as the visual reference for the compositor.

Cost/quality routing is fail-closed:

1. Generate the scene with the configured economical image model.
2. Run low-detail automated visual QA for both identities, room, weapon, visual quality and family-game safety.
3. If the first scene misses the QA thresholds, regenerate it with the configured escalation image model and stricter identity fidelity.
4. If the escalated scene still fails, do not create the final card. Record the failure under the factory work directory for review/retry.
5. Existing final cards are skipped unless `--force` is used, so interrupted runs are resumable.

Typical commands:

```bash
npm run blackglass:cards:dry -- --room penthouse
npm run blackglass:cards -- --room penthouse
npm run blackglass:cards -- --all
```

`OPENAI_API_KEY` is required for real generation. Model names, output directories, quality levels and concurrency can be overridden with the documented `BLACKGLASS_*` environment variables in the generator.
