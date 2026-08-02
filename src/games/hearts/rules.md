# Hearts rules implemented

This module implements standard four-player American Hearts.

## Sources reviewed

- Pagat, “Hearts”: https://www.pagat.com/reverse/hearts.html
- Bicycle Cards, Hearts rules reference: https://bicyclecards.com/how-to-play/hearts/

## Table and objective

- Four individual players use one standard 52-card deck with aces high and no trump.
- The goal is to finish with the lowest total score.
- Each heart is one penalty point. The queen of spades is 13 penalty points.
- The game ends after a hand in which any player reaches or exceeds 100. The lowest score wins.

## Passing

The pass cycle repeats by hand:

1. Three cards left.
2. Three cards right.
3. Three cards across.
4. Hold; no passing.

All passes are simultaneous. A player cannot see incoming cards until all players have submitted their outgoing cards.

## Trick play

- The player holding the two of clubs leads it to the first trick.
- Players must follow the led suit when able.
- Hearts and the queen of spades cannot be discarded on the first trick while the player has a non-penalty alternative.
- Hearts cannot be led until a heart has been discarded on an earlier trick, unless the leader holds only hearts.
- The highest card of the led suit wins the trick and leads next.

## Scoring and shooting the moon

At the end of the hand, captured penalty cards are counted. A player capturing all 13 hearts and the queen of spades has shot the moon. This implementation applies the common rule that the shooter receives zero and every opponent receives 26 points.

## Deliberate exclusions

- Partnership Hearts
- Kitty variants for other player counts
- Jack of diamonds bonus
- Spot Hearts
- Optional choice to subtract 26 from the shooter instead of adding 26 to opponents
