# Spades rules implemented

This module implements standard four-player partnership Spades.

## Sources reviewed

- Pagat, “Spades”: https://www.pagat.com/auctionwhist/spades.html
- Spades.net standard rules guide: https://www.spades.net/spades-rules

## Table and objective

- Four players sit in fixed partnerships: seats 1 and 3 against seats 2 and 4.
- One standard 52-card deck is dealt completely, giving each player 13 cards.
- Spades are always trump.
- The first team to at least 500 points after a completed hand wins, provided it has the higher score.

## Bidding

- Bidding begins left of the dealer and proceeds clockwise.
- Each player bids zero through thirteen.
- Zero is a nil bid: the player promises to win no tricks.
- The team contract is the sum of its partners’ non-nil bids.

## Trick play

- The player left of the dealer leads the first trick.
- Players must follow the led suit when able.
- A player who cannot follow may play any card, including a spade.
- Spades cannot be led until broken by being played on another suit, unless the leader holds only spades.
- The highest spade wins a trick containing trump; otherwise the highest card of the led suit wins.

## Scoring

- A team that makes its contract receives 10 points per contracted trick plus one point for each overtrick (bag).
- A team that fails its contract loses 10 points per contracted trick.
- Every ten accumulated bags causes a 100-point penalty and removes ten bags.
- A successful nil is worth +100; a failed nil is worth -100.
- Tricks won by a nil bidder still count toward the partnership’s contract and bags.

## Deliberate exclusions

- Blind nil and blind bids
- Joker/Joker/Deuce high variants
- Partnership or board bidding variants
- Reneging penalties beyond preventing illegal plays in the interface
- Alternate 200/250-point short games
