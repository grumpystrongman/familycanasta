# Basic Rummy rules implemented

This module implements Basic Rummy, also commonly called Straight Rummy.

## Sources reviewed

- Pagat, “Basic Rummy”: https://www.pagat.com/rummy/rummy.html
- Bicycle Cards, Rummy rules reference: https://bicyclecards.com/how-to-play/rummy-rum/

## Players, deck, and deal

- Two through six players use one standard 52-card deck without jokers.
- Two players receive 10 cards each.
- Three or four players receive 7 cards each.
- Five or six players receive 6 cards each.
- The next card starts the discard pile and the remaining cards form the stock.

## Turn sequence

A normal turn has three parts:

1. Draw exactly one card from the stock or the top of the discard pile.
2. Optionally play one or more melds and, after opening with a meld of your own, lay cards onto existing melds.
3. Discard exactly one card to end the turn.

A player may go out without discarding when all remaining cards are legally melded or laid off. If the stock empties, the discard pile beneath its top card is shuffled to form a new stock.

## Melds

- A set contains three or four cards of the same rank.
- A run contains at least three consecutive cards of the same suit.
- Ace is low only in this first release: A-2-3 is valid; Q-K-A and K-A-2 are not.
- A player must first place a valid meld of their own before laying cards onto any table meld.
- A layoff must leave the complete table group as a valid set or run.

## Going out and scoring

- A player goes out by legally removing every card from their hand.
- The winner scores the combined value of all cards left in opponents’ hands.
- Aces score 1.
- Number cards score face value.
- Tens and face cards score 10.
- The first player to reach 100 cumulative points wins after the completed round.

## Deliberate exclusions

- Gin Rummy and Oklahoma Gin
- 500 Rummy discard-pile pickup and scoring
- Jokers and wild cards
- Multiple decks
- High ace or wraparound runs
- Mandatory opening-point thresholds
