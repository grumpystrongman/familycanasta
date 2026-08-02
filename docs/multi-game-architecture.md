# Family Card Room architecture

## Goal

Add independently developed card games without changing the existing Canasta engine, room service, board, rules, or enhancements.

## Boundary

The browser starts in `HubApp.jsx`. The hub discovers game entry points with:

```js
import.meta.glob("./games/*/index.jsx")
```

Each game owns one directory under `src/games/<game-id>/`. Installing a game means adding its directory. No central registry file must be edited, which keeps the Hearts, Spades, and Rummy pull requests independent.

Canasta is registered by `src/games/canasta/index.jsx`, which only re-exports the existing `src/App.jsx`. Existing Canasta code remains the source of truth.

## URL contract

- `/` opens the central game hub.
- `/?game=canasta` opens the existing Canasta application.
- `/?game=hearts`, `/?game=spades`, and `/?game=rummy` load their isolated modules when installed.

The hub uses a full navigation when a game is selected. This ensures the existing Canasta enhancement bootstrap runs exactly as it did before and only on the Canasta route.

## Game module contract

Every game folder must contain `index.jsx` with a default React component. A game may export metadata and any number of private engine, service, style, and test files from the same folder.

Recommended structure:

```text
src/games/hearts/
  index.jsx
  HeartsGame.jsx
  engine.js
  engine.test.js
  rules.md
  styles.css
```

## Pull request strategy

1. **Game hub foundation** — central selector, module discovery, isolated Canasta adapter.
2. **Hearts** — complete Hearts module and tests.
3. **Spades** — complete Spades module and tests.
4. **Rummy** — complete Basic/Straight Rummy module and tests.

The game PRs branch from the hub foundation and only add files below their own game directory. This prevents one game's rules from becoming a dependency of another game.

## Non-negotiable Canasta protections

- Do not move or rename `src/App.jsx`.
- Do not change files under `src/game/` for another game's rules.
- Do not change `src/services/roomService.js` for another game.
- Do not mount Canasta DOM enhancements outside the Canasta route.
- Keep all existing Canasta tests in the full test run.
