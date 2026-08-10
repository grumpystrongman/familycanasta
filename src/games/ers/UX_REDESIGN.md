# Egyptian Rat Screw online UX redesign

This implementation treats ERS as a real-time online reaction game rather than a turn-based card table.

## Interaction model

- **Flip** is available only to the current player.
- **Slap** is available to every non-eliminated player whenever a live center card exists, including players with zero cards who are trying to slap back in.
- The visible top card itself is a slap target, and desktop players can also use **Space** to slap and **F / Enter** to flip.
- The table never announces that the current pile is slappable. Players must recognize the pattern themselves.

## Online fairness

Every slap includes the ID of the top card the player actually saw. If the pile changes before that request reaches the transaction, the slap is rejected without a burn penalty. This prevents network latency from converting a legitimate reaction into a false slap.

Completed face-card challenges use a short 1.1 second online reaction window and then auto-award the pile. There is no manual Claim button that can stall an online table indefinitely.

Only the host browser drives robot actions so several connected clients do not submit the same bot move. Robot slaps use a human-scale variable delay rather than reacting instantly.

## Readability

The playfield prioritizes:

1. large current center card;
2. the three preceding live cards for double/sandwich/run recognition;
3. a persistent challenge meter;
4. clear player/card-count state;
5. persistent Flip and Slap actions;
6. a collapsible slap-pattern refresher.

Burn cards are tracked under the live pile and are not displayed as live pattern cards, matching their role as dead penalty cards.

## Research direction

The design follows common digital ERS patterns: dominant center pile, simple Flip/Slap controls, explicit face-card challenge counts, readable rules, and human-scale AI timing. It also adds transaction-safe stale-slap handling specifically for online multiplayer.
