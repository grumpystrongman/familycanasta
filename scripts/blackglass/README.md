# Blackglass card factory

This factory turns the 1,620-entry Blackglass scenario catalog into individual game assets without asking a model to draw the card UI itself.

## Quality/cost ladder

The default route intentionally uses the smallest configured models that can do each model-dependent job:

- Scene generation: `gpt-image-1-mini`, medium quality.
- Visual QA: `gpt-5-nano`, low-detail image inputs.
- Escalation only after a QA failure: `gpt-image-1`, high quality and high input fidelity.

Catalog enumeration, filenames, resuming, card layout, labels, spelling, portraits/room/weapon tiles and final WebP composition are deterministic code and use no language model.

A card is published only after the scene passes the QA gate. A failed escalated scene is recorded but not copied into `public/blackglass/cards`.

## Run one room

```bash
OPENAI_API_KEY=... npm run blackglass:cards -- --room penthouse
```

Each room has exactly 180 cards.

## Run the whole library

```bash
OPENAI_API_KEY=... npm run blackglass:cards -- --all
```

The command is resumable. Existing final cards are skipped. Use `--force` only when intentionally regenerating approved output.

## Dry run

```bash
npm run blackglass:cards:dry -- --room penthouse
```

Dry runs enumerate work and make no OpenAI calls.

## Environment overrides

- `BLACKGLASS_IMAGE_MODEL`
- `BLACKGLASS_QA_MODEL`
- `BLACKGLASS_ESCALATION_IMAGE_MODEL`
- `BLACKGLASS_IMAGE_QUALITY`
- `BLACKGLASS_ESCALATION_QUALITY`
- `BLACKGLASS_CARD_OUTPUT_DIR`
- `BLACKGLASS_CARD_WORK_DIR`
- `BLACKGLASS_KEEP_SCENES=1` to retain intermediate generated scene PNGs

The manual GitHub Actions workflow `.github/workflows/blackglass-card-batch.yml` generates one room at a time, verifies the room reached 180 approved cards, commits the batch to the workflow branch, and retains the result as an Actions artifact. It requires a repository secret named `OPENAI_API_KEY`.
