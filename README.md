# Family Canasta Online

A mobile-first React and Firebase multiplayer Canasta application.

## Current capabilities

- Firebase anonymous authentication
- Six-character private room codes
- Realtime lobby membership and presence
- Team selection
- Optional Google Meet link
- Realtime table chat
- Random first dealer
- Clockwise dealer rotation
- Shared deal state with private player hands
- Animated dealing
- Two- and three-deck configuration
- Responsive desktop and phone interface
- Firebase Hosting and Realtime Database configuration

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

The included `.env` is configured for the `family-canasta-ce7d2` Firebase web app.

## Firebase requirements

- Anonymous Authentication enabled
- Realtime Database created
- Database URL: `https://family-canasta-ce7d2-default-rtdb.firebaseio.com`

## Deploy

```bash
npm run build
npx firebase login
npx firebase use family-canasta-ce7d2
npx firebase deploy
```

Expected hosting URL:

```text
https://family-canasta-ce7d2.web.app
```

## Development status

The online room, lobby, presence, chat, dealer, private hand, and dealing foundations are implemented. The next gameplay milestone is the authoritative Firebase transaction layer for drawing, discard-pile pickup, melding, discarding, canasta validation, going out, scoring, and starting the next hand.
