# Slum Lord

**Slum Lord** is a single-screen property-trading board game built as an isolated game module inside Family Game Room. It uses the familiar rhythm of moving around a square board, buying properties, collecting rent, trading, upgrading, mortgaging, surviving bad events, and bankrupting rivals, but the presentation and rules are original to this project.

The satire is aimed at predatory property-management behavior and neglected buildings, not at the people who live in them.

## Screenshots

### Default solo setup

Opening Slum Lord now defaults to **one human vs one CPU landlord**. Nothing has to be configured to start a two-player solo match.

![Slum Lord default human vs CPU setup](../../../docs/images/slumlord-setup.png)

### Full board experience

The game is intentionally a full digital tabletop rather than a host/phone party game. The entire board, both player balances, ownership, rent information, dice, turn controls, upgrades, and recent events remain visible on one screen.

![Slum Lord full board gameplay](../../../docs/images/slumlord-gameplay.png)

### Alternate N64-style palette

Board themes change the palette while keeping exactly the same geometry and information hierarchy.

![Slum Lord Sunset Motel theme](../../../docs/images/slumlord-sunset.png)

## Default play mode

The default configuration is:

- **2 players**
- **Player 1:** local human (`You`)
- **Player 2:** CPU landlord
- **Standard game:** 25 rounds
- **Theme:** Concrete Jungle

The setup screen still supports 2–4 total players. Any seat can be changed between local human and CPU before the game begins.

## Visual direction

Slum Lord deliberately uses a **late-1990s console / Nintendo 64-inspired visual language** without trying to imitate a specific copyrighted game or asset set.

The design rules are simple:

- Fixed, readable tabletop camera instead of a cinematic camera that hides spaces.
- Chunky low-poly-style pieces with oversized colored bases.
- Hard-edged shadows and simple materials rather than photorealistic textures.
- Large dice and obvious active-player highlighting.
- Strong district color bands and owner markers directly on properties.
- Upgrades rendered on the property space instead of hidden in a submenu.
- Property deed, current rent, mortgage value, and ownership visible beside the board.
- Minimal visual noise so the player can understand the board in one glance.

## Board themes

Themes are cosmetic only. They do not alter prices, rent, AI decisions, cards, or board layout. The chosen theme is saved in local storage for the next session.

| Theme | Look |
|---|---|
| **Concrete Jungle** | Gray-blue city backdrop, tan board, muted municipal palette. This is the default. |
| **Sunset Motel** | Warm stucco, dusty orange board tones, purple dusk panels, retro roadside color. |
| **Toxic Tenement** | Deep asphalt greens, lime industrial signage, olive board tones, high-contrast utility look. |

The theme selector stays available during play so the palette can be changed without restarting the game.

## Core game loop

1. Roll two dice and move around the 36-space perimeter.
2. Buy an available property or send it to auction.
3. Pay rent when landing on another landlord's property.
4. Complete district sets to increase rent and unlock upgrades.
5. Upgrade properties, mortgage assets, trade with opponents, and manage cash flow.
6. Draw Street Luck and Code Inspection events.
7. Deal with Housing Court, fees, the Cash Stash, inspections, and other board spaces.
8. Survive debt by selling upgrades or mortgaging property before declaring bankruptcy.
9. Win by being the last landlord standing or by holding the highest net worth when the configured round limit ends.

## CPU landlord

CPU seats play directly through the same rules engine as human seats. The AI can:

- roll and complete turns automatically;
- evaluate property purchases;
- participate in auctions;
- upgrade owned property;
- respond to trade offers;
- raise cash when in debt;
- mortgage and liquidate when necessary;
- continue the match without a second device or browser.

The CPU is intentionally fast enough to keep a solo game moving, with a short visible thinking delay between actions.

## Board structure

Slum Lord uses a **36-space loop** on a 10×10 perimeter. The four major spaces land on true corners so the board reads immediately as a tabletop game.

Property information is split between the board and the deed rail:

- **Board space:** district color, property name, price, owner flag, mortgage state, upgrades, player pieces.
- **Deed rail:** purchase price, owner, current rent, mortgage value, full rent ladder, and legal property actions.
- **Player rail:** cash, net worth, current turn, CPU/local status, court status, and bankruptcy status.
- **Turn console:** active player, location, dice, roll/end-turn controls, court actions, and trading.

## Game length

Four match lengths are supported:

- **Quick:** 15 rounds
- **Standard:** 25 rounds
- **Long:** 40 rounds
- **Last landlord standing:** no round limit

At a round limit, the winner is determined by net worth. In elimination play, the last solvent landlord wins.

## Architecture

Everything specific to Slum Lord lives under:

```text
src/games/slumlord/
```

Key files:

```text
GameBoard.jsx        full single-screen board UI and CPU turn orchestration
data.js              board spaces, districts, cards, tokens, static values
engine.js            authoritative rules and state transitions
engine.test.js       rules regression coverage
isolation.test.js    framework/isolation and single-screen assertions
styles.css           primary board styling
n64-overrides.css    late-90s console geometry/readability refinements
themes.css           cosmetic board palettes and theme switcher styling
index.jsx            Family Game Room module entrypoint
```

Slum Lord does **not** use Party Stage, phone controllers, a host screen, or Firebase game state. It is a local board game that runs entirely in the shared Family Game Room application shell.

## Screenshot automation

The repository includes a dedicated Playwright capture workflow for Slum Lord. On pull requests that change the game, GitHub Actions builds the branch, opens the real game UI, verifies the solo defaults, captures the setup and gameplay screens, switches themes, and commits the generated PNG files into `docs/images/` on the PR branch.

That means the screenshots above are generated from the actual application rather than hand-built mockups.

## Validation

The project-level validation workflow runs the full test suite and production build on pull requests. Slum Lord's own tests cover core board behavior and isolation from the phone/host game framework.
