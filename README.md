# Family Game Room

<p align="center">
  <strong>An 18-game browser-based family game platform spanning cards, boards, local arcade play, and phone-controlled party games.</strong>
</p>

<p align="center">
  <a href="https://github.com/grumpystrongman/familycanasta/actions/workflows/validate.yml"><img alt="Validate" src="https://github.com/grumpystrongman/familycanasta/actions/workflows/validate.yml/badge.svg"></a>
  <img alt="React" src="https://img.shields.io/badge/React-application-149eca?logo=react&logoColor=white">
  <img alt="Firebase" src="https://img.shields.io/badge/Firebase-realtime_rooms-ffca28?logo=firebase&logoColor=black">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-build-646cff?logo=vite&logoColor=white">
  <img alt="Games" src="https://img.shields.io/badge/games-18-1f7a4c">
</p>

<p align="center">
  <a href="https://family-canasta-ce7d2.web.app">Hosted application</a>
  ·
  <a href="#game-catalog">Game catalog</a>
  ·
  <a href="#this-weeks-expansion">This week's expansion</a>
  ·
  <a href="#local-development">Local development</a>
</p>

Family Game Room started as a complete online Canasta table and has grown into a shared game-night platform. Each game keeps its own rules engine and presentation while sharing a central hub, browser deployment, responsive layout infrastructure, Firebase room services where appropriate, and automated validation.

The platform now includes **18 playable games**:

- 9 traditional and family card games.
- 5 strategy / tabletop games.
- 1 local physics arcade game.
- 3 TV-and-phone Party Stage games.

> **Product posture:** Family Game Room is designed for trusted family and friend groups, demonstrations, and controlled beta use. It is not currently positioned as a hardened anonymous public gaming, wagering, or paid competitive platform.

---

## Product overview

![Family Game Room hub](docs/images/family-card-room-hub.png)

The hub discovers installed game modules automatically through Vite. A game owns its route, state machine, UI, rules, and tests; adding one does not require folding its rules into Canasta or another existing engine.

### Core experiences

| Experience | Games | Primary play style |
|---|---|---|
| Classic card room | Canasta, Hearts, Spades, Rummy | Online rooms, robots, private hands |
| Family card expansion | Egyptian Rat Screw, Spoons, Indians / Progressive Spades, Five-Card Draw, Six Card Golf | Online rooms and robot-capable shared table play |
| Tabletop expansion | Hnefatafl, Connect 4, Battleship, Go Fish, Go F' Yourself | Quick robot play or private rooms |
| Local arcade | Chompageddon! | 1–4 players sharing one screen/device |
| Party Stage | Punchline, Last One Alive, Doodle Alibi | TV/shared screen plus phones as controllers |

---

## This week's expansion

The week of **August 10, 2026** expanded Family Game Room from a small card-room collection into a broader family game platform. The following 14 playable games were added this week.

### Party Stage

These games use one shared TV/browser as the stage while players join from their phones. The TV owns the room code, presentation, music, recorded sound effects, short human voice cues, results, and final score presentation. Phones are private controllers for writing, voting, trivia, drawing, and mini-games.

<table>
<tr>
<td width="50%" valign="top">
<strong>Punchline</strong><br>
Comedy prompts, anonymous answers, head-to-head voting, Duel Mode for two players, and a Crowd Pleaser finale.<br><br>
<img alt="Punchline Party Stage" src="docs/images/punchline-entry.png">
</td>
<td width="50%" valign="top">
<strong>Last One Alive</strong><br>
Horror-comedy trivia with hearts, traps, ghosts, resurrection, six micro-games, an escape finale, and 200+ tiered questions.<br><br>
<img alt="Last One Alive Party Stage" src="docs/images/last-one-alive-entry.png">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<strong>Doodle Alibi</strong><br>
Phone drawing, hidden altered prompts, an evidence wall, accusation voting, two-player Detective Mode, and roughly 190 generated case combinations.<br><br>
<img alt="Doodle Alibi Party Stage" src="docs/images/doodle-alibi-entry.png">
</td>
<td width="50%" valign="top">
<strong>Party Stage lifecycle</strong><br>
Rooms support replay in the same room, clean exits back to Family Game Room, stale-session expiration, host-controlled show ending, and reconnect behavior that does not permanently trap a browser in an old game state.
</td>
</tr>
</table>

### Strategy and tabletop games

<table>
<tr>
<td width="50%" valign="top">
<strong>Hnefatafl</strong><br>
An asymmetric 11×11 Viking siege. Defenders escort the king to a corner while raiders attempt to capture him.<br><br>
<img alt="Hnefatafl" src="docs/images/hnefatafl-entry.png">
</td>
<td width="50%" valign="top">
<strong>Connect 4</strong><br>
Classic 7×6 connect-four play with responsive board rendering and robot blocking/winning logic.<br><br>
<img alt="Connect 4" src="docs/images/connect4-entry.png">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<strong>Battleship</strong><br>
10×10 hidden-fleet play with auto-deployment, hits, misses, sinking, and hunt-style robot targeting.<br><br>
<img alt="Battleship" src="docs/images/battleship-entry.png">
</td>
<td width="50%" valign="top">
<strong>Go Fish</strong><br>
Two-to-six-player book collection with grouped hands, rank asking, fishing, and robot play.<br><br>
<img alt="Go Fish" src="docs/images/gofish-entry.png">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<strong>Go F' Yourself · 18+</strong><br>
An adults-only Go Fish variant with a custom 52-card comedy deck, profanity, raunchy innuendo, and grouped matching sets.<br><br>
<img alt="Go F' Yourself" src="docs/images/go-f-yourself-entry.png">
</td>
<td width="50%" valign="top">
<strong>Chompageddon!</strong><br>
A local physics arcade game for 1–4 players. Four monsters lunge into a bouncing ball pit while balls collide, ricochet, and get captured in real time.<br><br>
<img alt="Chompageddon gameplay" src="docs/images/chompageddon-gameplay.png">
</td>
</tr>
</table>

### Family card expansion

<table>
<tr>
<td width="50%" valign="top">
<strong>Egyptian Rat Screw</strong><br>
Realtime online reaction play with face-card challenges, doubles, sandwiches, tens, marriage, runs, fast slapping, and reconnect-safe action handling.<br><br>
<img alt="Egyptian Rat Screw" src="docs/images/egyptian-rat-screw-entry.png">
</td>
<td width="50%" valign="top">
<strong>Spoons</strong><br>
Pass cards quickly, make four of a kind, grab a spoon, and avoid spelling SPOON as players are eliminated.<br><br>
<img alt="Spoons" src="docs/images/spoons-entry.png">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<strong>Indians / Progressive Spades</strong><br>
A Family Game Room progressive-Spades house variant where a complete low rank disappears after each hand until the compact endgame.<br><br>
<img alt="Indians Progressive Spades" src="docs/images/indians-entry.png">
</td>
<td width="50%" valign="top">
<strong>Five-Card Draw</strong><br>
Family poker with standard hand rankings, draw structure, game points, fixed-size raises, and no real-money wagering.<br><br>
<img alt="Five Card Draw" src="docs/images/five-card-draw-entry.png">
</td>
</tr>
<tr>
<td width="50%" valign="top">
<strong>Six Card Golf</strong><br>
A nine-hole low-score card game with a six-card grid and matching-column cancellation.<br><br>
<img alt="Six Card Golf" src="docs/images/six-card-golf-entry.png">
</td>
<td width="50%" valign="top">
<strong>Built for repeat family play</strong><br>
The expansion games share the same central hub and responsive platform but keep their gameplay engines isolated so a change in one game does not silently change another.
</td>
</tr>
</table>

---

## Original game room

The original four-game collection remains fully available.

| Game | Players | Core objective |
|---|---:|---|
| **Canasta** | 2–6 | Build melds and canastas, manage the discard pile, and reach the configured score target. |
| **Hearts** | 4 | Avoid penalty cards—or capture all of them and shoot the moon. |
| **Spades** | 4 | Bid with a partner, make the contract, protect nil, and manage bags. |
| **Basic Rummy** | 2–6 | Build sets and runs, lay off, and empty the hand first. |

The in-app **Learn & Rules** experience provides rules and step-by-step guidance for the installed games. Detailed engine documentation also lives beside individual game modules where appropriate.

---

## Game catalog

| Game | Route | Players | Mode |
|---|---|---:|---|
| Canasta | `?game=canasta` | 2–6 | Online / robots |
| Hearts | `?game=hearts` | 4 | Online / robots |
| Spades | `?game=spades` | 4 | Online / robots |
| Rummy | `?game=rummy` | 2–6 | Online / robots |
| Egyptian Rat Screw | `?game=ers` | 2–6 | Online reaction / robots |
| Spoons | `?game=spoons` | 3–6 | Online / robots |
| Indians / Progressive Spades | `?game=indians` | 4 | Online / robots |
| Five-Card Draw | `?game=poker` | 2–6 | Online / robots |
| Six Card Golf | `?game=golf` | 2–4 | Online / robots |
| Hnefatafl | `?game=hnefatafl` | 2 | Online / robot |
| Connect 4 | `?game=connect4` | 2 | Online / robot |
| Battleship | `?game=battleship` | 2 | Online / robot |
| Go Fish | `?game=gofish` | 2–6 | Online / robots |
| Go F' Yourself · 18+ | `?game=gofyourself` | 2–6 | Online / robots |
| Chompageddon! | `?game=chompageddon` | 1–4 | Local simultaneous arcade |
| Punchline | `?game=punchline` | 2–12 phones | Shared TV + phones |
| Last One Alive | `?game=lastonealive` | 2–12 phones | Shared TV + phones |
| Doodle Alibi | `?game=doodlealibi` | 2–12 phones | Shared TV + phones |

---

## Platform capabilities

### Shared hub and modularity

- Central Family Game Room with stable `?game=<id>` routes.
- Vite `import.meta.glob` game discovery.
- Isolated game folders under `src/games/<game>/`.
- Shared responsive chrome for modular online games.
- Adaptive desktop, iPad, and phone layouts.
- Persistent player nickname and avatar preferences.
- Learn & Rules surfaces that stay available during play.
- Automated test discovery and production builds through GitHub Actions.

### Online rooms

Games using the modular room system support combinations of:

- Firebase anonymous authentication.
- Private room codes.
- Realtime Database synchronization.
- Human and robot seats.
- Presence/disconnect handling.
- Transaction-based actions.
- Firebase-safe state normalization for arrays and sparse collections.
- Quick play against robots without manually building a room first.

Canasta keeps its mature room implementation isolated from the newer modular-game room service.

### Party Stage

Party Stage adds a second realtime interaction model:

```text
            SHARED TV / HOST BROWSER
    ┌──────────────────────────────────┐
    │ room code · music · presentation │
    │ prompts · video · reveals        │
    │ results · scores · winner        │
    └────────────────┬─────────────────┘
                     │ Firebase realtime state
         ┌───────────┼───────────┐
         │           │           │
       PHONE       PHONE       PHONE
      answer       vote        draw
      trivia     mini-game    accuse
```

The host is display-only rather than consuming a player seat. Phones join via room code / QR path and become context-sensitive private controllers.

The current Party Stage audio layer uses recorded assets instead of browser speech synthesis or oscillator-generated music. See [`THIRD_PARTY_AUDIO.md`](THIRD_PARTY_AUDIO.md) for licensing and attribution.

---

## Architecture

```text
src/
├── HubApp.jsx                    # central catalog and route selection
├── games/
│   ├── canasta/                  # adapter to the original Canasta app
│   ├── hearts/
│   ├── spades/
│   ├── rummy/
│   ├── ers/
│   ├── spoons/
│   ├── indians/
│   ├── poker/
│   ├── golf/
│   ├── hnefatafl/
│   ├── connect4/
│   ├── battleship/
│   ├── gofish/
│   ├── gofyourself/
│   ├── chompageddon/
│   ├── punchline/
│   ├── lastonealive/
│   └── doodlealibi/
├── platform/
│   ├── ModularGameChrome.jsx
│   ├── useModularTable.js
│   ├── modularRoomService.js
│   └── party/                    # Party Stage room/audio/show infrastructure
└── App.jsx                       # mature original Canasta application
```

### Design principle

The repository deliberately avoids one giant universal rules engine. A drawing game, an asymmetric Viking board game, a realtime slap game, and Canasta do not need the same state model. Shared services handle common platform behavior; rules remain local to each game.

---

## Local development

### Requirements

- Node.js 22 recommended.
- npm.
- A Firebase project for online room functionality.

### Install and run

```bash
npm install
npm run dev
```

Vite prints the local application URL. Open the hub and choose a game, or use a direct game route such as:

```text
http://localhost:5173/?game=connect4
http://localhost:5173/?game=chompageddon
http://localhost:5173/?game=punchline
```

### Firebase web configuration

The application reads Firebase configuration from Vite environment variables. Configure the matching values for the Firebase project used by the deployment:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

Do not commit secrets that do not belong in a public web client. Firebase web configuration itself is public client configuration; database authorization belongs in Firebase rules.

---

## Testing

Run full test discovery:

```bash
npm test
```

Build the production bundle:

```bash
npm run build
```

The `Validate` GitHub Actions workflow runs targeted regression groups, full Node test discovery, and the Vite production build.

### README screenshot capture

The repository also contains a Playwright screenshot job:

```bash
node scripts/capture-readme-screenshots.mjs
```

`.github/workflows/readme-screenshots.yml` starts the application, captures the game surfaces, and uploads the PNG set as the `readme-screenshots` workflow artifact. Stable README images are committed under `docs/images/` so they do not disappear when workflow artifacts expire.

---

## Deployment

The production site is currently hosted through Firebase Hosting:

**https://family-canasta-ce7d2.web.app**

Typical deployment flow:

```bash
npm run build
npm run firebase:login
npm run firebase:deploy
```

Review Firebase Realtime Database rules before deploying room-service changes. A UI deployment does not replace database authorization.

---

## Security and privacy

Family Game Room is built around private family/friend use rather than hostile anonymous competition.

Current protections include:

- Firebase authentication for realtime rooms.
- Room membership checks in database rules.
- Transaction-based action validation for multiplayer state updates.
- Private card/drawing/controller information kept off shared TV surfaces when gameplay requires secrecy.
- Host controls for starting/ending rooms and removing players where supported.

A public commercial launch would still require additional work such as abuse prevention, moderation, account recovery, stronger identity controls, rate limiting, observability, formal privacy/legal review, and anti-cheat design appropriate to the game.

---

## Third-party assets

Party Stage uses freely licensed recorded audio assets. Licensing and attribution are documented in [`THIRD_PARTY_AUDIO.md`](THIRD_PARTY_AUDIO.md).

Chompageddon includes its own committed visual assets under `public/assets/chompageddon/`.

---

## Extending Family Game Room

A new game normally follows this pattern:

1. Add `src/games/<game-id>/index.jsx`.
2. Keep the rule/state engine inside that game directory.
3. Reuse shared platform services only when the interaction model actually fits them.
4. Add the game to the hub catalog.
5. Add Learn & Rules content.
6. Add executable regression tests.
7. Add a screenshot target to `scripts/capture-readme-screenshots.mjs`.
8. Run the full test suite and production build.

The core rule is simple: **share platform capabilities, not accidental game assumptions.**

---

## Repository status

Family Game Room is under active development. The fastest-changing areas are Party Stage production quality, game depth, mobile/tablet usability, and the breadth of family-game experiences available from the central hub.
