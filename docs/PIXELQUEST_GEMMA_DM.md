# PixelQuest Gemma 4 Dungeon Master

PixelQuest can use a self-hosted **Gemma 4 12B** model through Ollama for live scene narration while keeping the deterministic game engine authoritative.

## Architecture

```text
Player browser
  -> Firebase anonymous ID token
  -> PixelQuest DM service (:8787)
  -> Ollama private network (:11434)
  -> gemma4:12b

Firebase Realtime Database remains the shared campaign truth.
The LLM cannot mutate dice, HP, Defense, movement, inventory, gold, initiative,
conditions, cooldowns, rewards, legal actions, or encounter state.
```

The browser never talks to Ollama directly. In production, the DM service validates the player's Firebase ID token before sending a prompt to Gemma. If the DM service or model is unavailable, PixelQuest immediately keeps the deterministic local narration and gameplay continues.

## Install and run

Requirements:

- Docker Engine with Docker Compose
- Enough RAM/VRAM for the Ollama `gemma4:12b` package
- The same Firebase project ID used by Family Game Room

Create an environment file or export these variables:

```bash
export FIREBASE_PROJECT_ID=family-canasta-ce7d2
export DM_ALLOWED_ORIGIN=https://family-canasta-ce7d2.web.app
export DM_AUTH_MODE=firebase
```

Start the stack:

```bash
docker compose -f docker-compose.gemma.yml up -d
```

The `gemma-install` one-shot service runs:

```bash
ollama pull gemma4:12b
```

and verifies that the model appears in `ollama list` before the PixelQuest DM service starts.

Point the Vite application at the service:

```bash
VITE_PIXELQUEST_DM_URL=https://your-pixelquest-dm-host.example.com
```

Rebuild/deploy the Vite application after changing `VITE_PIXELQUEST_DM_URL`.

## Local development

For local-only testing without Firebase token verification:

```bash
export DM_AUTH_MODE=off
export DM_ALLOWED_ORIGIN=http://localhost:5173
docker compose -f docker-compose.gemma.yml up -d
```

Then use:

```bash
VITE_PIXELQUEST_DM_URL=http://localhost:8787 npm run dev
```

`DM_AUTH_MODE=off` is intended only for trusted local development.

## Service endpoints

### `GET /health`

Reports whether Ollama is reachable and whether the configured model is installed.

Example response:

```json
{
  "ok": true,
  "ollama": true,
  "installed": true,
  "model": "gemma4:12b",
  "authMode": "firebase"
}
```

### `POST /api/narrate`

Accepts structured PixelQuest context and either `describe` or `plan` narration requests. Production requests require a valid Firebase ID token in the `Authorization: Bearer ...` header.

The service uses Ollama structured output schemas. Freeform plans can only map to one of the authored choice IDs supplied by the current scene; a model-generated unknown choice ID is rejected.

## Safety and rules boundary

The DM prompt always states that PixelQuest's deterministic engine owns game truth. The service also enforces additional boundaries:

- private log entries are replaced with a generic private-decision marker before model context is created;
- only current authored scene choices are eligible for a plan mapping;
- narration is length-bounded;
- model output must parse as structured JSON;
- requests time out instead of hanging a game indefinitely;
- AI failure falls back to deterministic narration rather than blocking the party.

## Validation

Run the fast local test suite:

```bash
npm run pixelquest:dm:test
```

The full repository validation also discovers these tests through `npm test`.

The dedicated **PixelQuest Gemma Live Smoke** GitHub workflow installs Ollama on a clean Linux runner, pulls the actual `gemma4:12b` model, starts the DM service, checks `/health`, and sends a real Blackhollow narration request through Gemma. It is intentionally not a normal every-commit job because the model download is several gigabytes.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_PIXELQUEST_DM_URL` | empty | Browser-visible DM service URL. Empty means deterministic narration only. |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Private Ollama API URL used by the server. |
| `GEMMA_MODEL` | `gemma4:12b` | Ollama model name. |
| `DM_AUTH_MODE` | `firebase` | `firebase` for production; `off` only for local development. |
| `FIREBASE_PROJECT_ID` | empty | Required when Firebase token verification is enabled. |
| `DM_ALLOWED_ORIGIN` | `http://localhost:5173` | Allowed browser origin for CORS. |
| `DM_TIMEOUT_MS` | `30000` | Maximum Ollama request duration. |
| `PIXELQUEST_DM_PORT` | `8787` | Host port used by Docker Compose. |
