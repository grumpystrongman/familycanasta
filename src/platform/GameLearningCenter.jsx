import React, { useEffect, useMemo, useState } from "react";
import "./gameLearningCenter.css";

const LEARNING = Object.freeze({
  canasta: {
    name: "Canasta",
    age: "Ages 10+ with help",
    objective: "Build same-rank melds, complete canastas, and score more than the other team.",
    rules: [
      ["Your turn", ["Draw two cards from the stock or legally take the discard pile.", "Meld matching ranks or add cards to your team's melds.", "Discard one card to finish your turn."]],
      ["Melds", ["A meld normally starts with at least three cards of one natural rank.", "Twos and jokers are wild. Natural cards must outnumber wild cards in a mixed meld.", "Seven or more cards of one rank make a canasta; no wilds is clean, one or more wilds is dirty."]],
      ["Special cards", ["Red threes are laid down for bonus points and replaced from the stock when possible.", "Black threes and wild cards affect whether the discard pile is blocked or frozen."]],
      ["Going out", ["Meet the table's opening-meld requirement before your team is fully open.", "Your team must have the required number of canastas before a player can go out.", "Cards left in teammates' hands count against the team when the hand ends."]],
    ],
    tutorial: [
      ["Look at your hand", "Start by grouping matching ranks in your head. Three or more of the same rank are the beginning of a meld.", "Ignore speed. Canasta rewards planning."],
      ["Draw first", "Every normal turn begins by getting cards. The stock is simple; taking the discard pile can be powerful but has extra requirements.", "When learning, draw from the stock until the discard-pile rules feel familiar."],
      ["Build melds", "Put down legal groups of the same rank. Wild cards can help, but do not let wilds outnumber the natural cards.", "A seven-card meld is the big goal: a canasta."],
      ["Watch the discard pile", "The top discard matters because another player may be able to claim the whole pile.", "Discarding a rank your opponent is collecting can be expensive."],
      ["Know when you can go out", "Before emptying your hand, make sure your team has met the table's canasta requirement and any partner-permission rule.", "A great hand can be spoiled by going out illegally."],
    ],
  },
  hearts: {
    name: "Hearts",
    age: "Ages 8+",
    objective: "Finish with the lowest score by avoiding hearts and the queen of spades.",
    rules: [
      ["Scoring", ["Each heart is 1 point. The queen of spades is 13 points.", "Low score wins. If one player takes every heart and the queen of spades, that player shoots the moon and the opponents take 26 points."]],
      ["Passing", ["Pass three cards left, right, across, then hold on the fourth hand.", "All passes stay secret until everyone has chosen."]],
      ["Tricks", ["The two of clubs leads the first trick.", "Follow the suit led whenever you can. Highest card of the led suit wins.", "Hearts cannot be led until broken unless your hand contains only hearts.", "Penalty cards normally cannot be dumped on the first trick if you have a safe alternative."]],
    ],
    tutorial: [
      ["Your goal is backwards", "In Hearts, taking tricks can be bad. You are usually trying to avoid the 14 penalty cards.", "Do not chase every trick just because you can win it."],
      ["Pass with a plan", "High hearts, the queen of spades, and cards that leave you short in a suit are important passing choices.", "Being out of a suit lets you discard dangerous cards later."],
      ["Follow suit", "If clubs are led and you have a club, you must play a club. If you have none, you can usually throw something else.", "That is often when players get rid of the queen of spades."],
      ["Count danger cards", "Keep an eye on whether the queen of spades and many hearts have already appeared.", "The table gets safer as penalty cards disappear."],
    ],
  },
  spades: {
    name: "Spades",
    age: "Ages 10+",
    objective: "Bid how many tricks your partnership can take, then make that contract with spades as permanent trump.",
    rules: [
      ["Teams and bids", ["Four players form two fixed partnerships in alternating seats.", "Each player bids the number of tricks they expect to take. A bid of zero is nil.", "Partners' non-nil bids combine into the team contract."]],
      ["Trick play", ["Follow the suit led whenever possible.", "If you cannot follow suit, you may play any card, including a spade.", "Spades cannot normally be led until broken unless you hold only spades.", "Highest spade wins a trumped trick; otherwise highest card of the led suit wins."]],
      ["Scoring", ["Making the contract scores 10 points per bid trick plus 1 per overtrick.", "Missing the contract loses 10 points per bid trick.", "Overtricks are bags; ten bags cost 100 points.", "Successful nil is +100; failed nil is -100."]],
    ],
    tutorial: [
      ["Estimate your tricks", "Aces, kings with protection, and strong spades are your most obvious winners.", "Start with a conservative bid while learning."],
      ["Follow suit", "The first card sets the suit for the trick. You must follow if you can.", "A spade only trumps when you are out of the led suit."],
      ["Work with your partner", "You do not need to win every trick yourself. Your combined bid is what matters.", "Notice when your partner appears to be protecting a winner or a nil bid."],
      ["Respect bags", "Extra tricks help in the short term but ten accumulated bags cost 100 points.", "Once your contract is safe, avoid unnecessary overtricks."],
    ],
  },
  rummy: {
    name: "Rummy",
    age: "Ages 7+",
    objective: "Make sets and runs and be the first player to empty your hand.",
    rules: [
      ["Turn", ["Draw one card from the stock or the top discard.", "Play legal melds and, after opening, lay cards onto existing melds.", "Discard one card to end the turn unless you legally play your final card."]],
      ["Melds", ["A set is three or four cards of the same rank.", "A run is at least three consecutive cards of the same suit.", "In this table's rules, ace is low only: A-2-3 is legal; Q-K-A is not."]],
      ["Scoring", ["The round winner scores the deadwood left in opponents' hands.", "Aces are 1, number cards are face value, and 10/J/Q/K are 10."]],
    ],
    tutorial: [
      ["Search for groups", "Look for repeated ranks and same-suit sequences before you draw.", "A hand with 5♥ 6♥ and 8♥ is one 7♥ away from a run."],
      ["Draw with purpose", "The visible discard is useful when it completes something immediately. The stock keeps your plan hidden.", "Do not pick up a discard just because it is available."],
      ["Meld, then trim", "Put down completed sets or runs, then discard a card that does the least for your remaining hand.", "High deadwood is expensive if another player goes out."],
    ],
  },
  ers: {
    name: "Egyptian Rat Screw",
    age: "Ages 8+",
    objective: "Win every card by surviving face-card challenges and being first to slap valid patterns.",
    rules: [
      ["Deal and turns", ["Deal the entire 52-card deck as evenly as possible. Keep your stack face down and do not peek.", "On your turn, flip your top card into the center pile."]],
      ["Face-card challenge", ["Jack gives the next player 1 chance to answer with J/Q/K/A; Queen gives 2; King gives 3; Ace gives 4.", "If a new face card or ace appears, the challenge resets and passes on.", "If all chances fail, the player who laid the last face card or ace may collect the pile."]],
      ["Slaps", ["A valid slap wins the center pile immediately.", "This table recognizes doubles, sandwiches, top-bottom matches, marriages (K/Q), pairs totaling 10 with ace worth 1, and four-card ascending or descending runs.", "A bad slap burns one card from your stack to the pile. A player with no cards who bad-slaps is eliminated."]],
      ["Running out", ["Having no cards does not automatically eliminate you. You may slap a valid pattern to get back in.", "The first player to control all 52 cards wins."]],
    ],
    tutorial: [
      ["Flip, do not choose", "Your personal stack stays face down. On your turn you simply reveal the top card.", "This game is about attention and reflexes, not hand management."],
      ["Learn J-Q-K-A", "A jack gives 1 answer card, queen 2, king 3, ace 4. If the challenged player finds another face card, the challenge switches.", "Say '1-2-3-4' out loud when learning."],
      ["Spot doubles first", "The easiest slap is two cards of the same rank in a row. Sandwiches are the same rank with one card between.", "Master those two patterns before worrying about every special slap."],
      ["Slap carefully", "A correct slap wins the pile; a wrong one costs you a card.", "Fast is good, but correct is better."],
    ],
  },
  spoons: {
    name: "Spoons",
    age: "Ages 4+",
    objective: "Make four of a kind, then grab a spoon before someone else leaves you without one.",
    rules: [
      ["Setup", ["Each player gets four cards.", "Put one fewer spoon in the center than there are active players."]],
      ["Passing", ["The dealer takes a new card, keeps four cards, and passes one card left.", "Each player does the same with the card arriving from the right. The last player discards to a trash pile.", "When the draw pile runs out, the trash is reshuffled and play continues."]],
      ["The scramble", ["As soon as a player has four of a kind, that player may grab a spoon.", "Once one spoon is taken, everyone may grab one. You do not need four of a kind to grab after the scramble begins.", "The player without a spoon takes the next letter in S-P-O-O-N. Spell SPOON and you are eliminated."]],
      ["Winning", ["Rounds continue with one fewer active player and one fewer spoon.", "The last player remaining wins."]],
    ],
    tutorial: [
      ["Pick one rank", "With only four cards, choose the rank you have the most of and watch for matching cards coming around.", "Three of a kind means you are one card away."],
      ["Keep four, pass one", "Every card that reaches you gives you a five-card choice. Keep the four you like best and pass the extra.", "Do not let cards pile up; the rhythm matters."],
      ["Watch the spoons", "When anyone makes four of a kind, the center changes instantly. Grab a spoon as soon as you notice.", "After the first spoon moves, everybody is allowed to grab."],
      ["Letters are lives", "Missing one spoon does not end your game immediately. You take the next letter in SPOON.", "You are out only after spelling the whole word."],
    ],
  },
  indians: {
    name: "Indians · Progressive Spades",
    age: "Ages 10+",
    objective: "Play partnership Spades while the deck gets smaller and stronger every hand.",
    rules: [
      ["House variant", ["Indians is the Family Card Room's progressive-Spades house game, not a published standardized Spades variant.", "Hand 1 uses all 52 cards. Hand 2 removes all 2s; then 3s, 4s, and so on through 9s.", "The deck stops shrinking at 20 cards, giving each player five cards. Tied games continue with that five-card deck."]],
      ["Bidding and tricks", ["Four players form fixed partnerships exactly as in Spades.", "Bid from nil up to the number of cards in the current hand.", "Follow suit when able. Spades are permanent trump and cannot normally be led until broken."]],
      ["Scoring", ["Contracts, bags, and nil use the same scoring as the Spades table.", "After the ninth hand, the higher team score wins. If tied, five-card sudden-death hands continue until the tie breaks."]],
    ],
    tutorial: [
      ["Start with normal Spades", "The first hand feels familiar: 13 cards each, partnerships, bidding, and spades as trump.", "If you know Spades, you already know most of the game."],
      ["Notice what vanished", "Each new hand removes a complete low rank. That means fewer total tricks and a higher average card strength.", "A card that felt medium in hand one can become weak later."],
      ["Shrink your bid", "Your maximum possible tricks falls with the hand size, so reassess every round rather than reusing your normal Spades habits.", "Five-card hands are short and unforgiving."],
      ["Remember the missing ranks", "Removed ranks cannot appear in anyone's hand. Use that information to reason about which cards are now high.", "The shrinking deck turns memory into an advantage."],
    ],
  },
  poker: {
    name: "Family Five-Card Draw",
    age: "Ages 10+",
    objective: "Win the pot of game points by making the best five-card poker hand or convincing everyone else to fold.",
    rules: [
      ["Family table", ["This version uses game points only—no money or purchases.", "Each player starts with the same point stack and pays a small ante each hand."]],
      ["Hand flow", ["Each active player receives five private cards.", "There is a betting round, then each remaining player may replace up to three cards.", "A second betting round follows, then remaining players reveal their cards at showdown."]],
      ["Actions", ["Check when nobody has bet, call to match the current bet, raise to increase it, or fold to leave the hand.", "The Family Card Room uses fixed-size raises to keep the choices simple and readable."]],
      ["Hand ranking", ["Highest to lowest: straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, one pair, high card.", "A-2-3-4-5 is the lowest straight. Otherwise ace is high."]],
      ["Winning", ["If everyone but one player folds, that player wins immediately.", "At showdown, the strongest poker hand wins the pot. Tied hands split it."]],
    ],
    tutorial: [
      ["Learn the hand ladder", "Pairs are common; straights and flushes are stronger; full houses and four of a kind are rare.", "Use the hand-ranking reminder until you stop needing it."],
      ["First betting round", "You can stay cautious with a check/call, raise when you like your hand, or fold when the price is not worth it.", "A raise can represent strength even when your cards are only average."],
      ["Choose your draw", "Keep made pairs and strong groups. Replace cards that do not help the hand you are building.", "The table allows up to three replacements."],
      ["Read the draw", "How many cards another player replaces is useful public information. One replacement often suggests a nearly complete hand.", "It is a clue, not proof."],
      ["Showdown", "After the second betting round, remaining hands are compared by standard poker ranking.", "You never have to guess which hand won—the table explains it."],
    ],
  },
  golf: {
    name: "Six Card Golf",
    age: "Ages 8+",
    objective: "Finish nine holes with the lowest score by improving your six-card grid and pairing matching cards in columns.",
    rules: [
      ["Setup", ["Deal six cards face down to each player in two rows of three.", "Each player turns two of their six cards face up. The rest stay hidden even from their owner.", "Turn one stock card face up to start the discard pile."]],
      ["Turn", ["Draw one card from the stock or the discard pile.", "Swap the drawn card for one of your six grid cards, or discard the drawn card.", "A card swapped into your grid stays face up."]],
      ["Ending a hole", ["The hole ends when one player has all six grid cards face up.", "All remaining hidden cards are then revealed for scoring."]],
      ["Scoring", ["Ace = 1, 2 = -2, 3-10 = face value, J/Q = 10, K = 0.", "Two equal ranks in the same vertical column cancel that entire column to zero.", "After nine holes, lowest total score wins."]],
    ],
    tutorial: [
      ["Think low", "Unlike most card games, low numbers are usually good. Kings are excellent because they score zero, and twos score minus two.", "Jacks and queens are expensive at 10."],
      ["Columns matter", "Matching ranks directly above and below each other cancel to zero.", "Sometimes keeping a high card is smart if it completes a pair."],
      ["Use visible information", "You cannot peek at face-down grid cards. Decide whether replacing an unknown card is worth the risk.", "The discard pile gives certainty; the stock gives surprise."],
      ["Know when to finish", "Turning your sixth card face up ends the hole immediately on this table.", "Do not rush to finish if your visible score is still ugly."],
    ],
  },
});

function StepCard({ step, index, total }) {
  return (
    <article className="learning-step-card">
      <small>STEP {index + 1} OF {total}</small>
      <h3>{step[0]}</h3>
      <p>{step[1]}</p>
      <div className="learning-tip"><strong>Remember:</strong> {step[2]}</div>
    </article>
  );
}

export default function GameLearningCenter({ gameId }) {
  const guide = LEARNING[gameId] || LEARNING.canasta;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("tutorial");
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    setOpen(false);
  }, [gameId]);

  const tutorial = guide.tutorial || [];
  const safeStep = Math.min(step, Math.max(0, tutorial.length - 1));
  const progress = useMemo(() => tutorial.length ? ((safeStep + 1) / tutorial.length) * 100 : 0, [safeStep, tutorial.length]);

  return (
    <aside className="game-learning-center" aria-label={`${guide.name} learning center`}>
      <button type="button" className="learning-launch" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        🎓 Learn & Rules
      </button>
      {open ? (
        <section className="learning-panel" role="dialog" aria-label={`Learn ${guide.name}`}>
          <header>
            <div><small>FAMILY CARD ROOM</small><h2>{guide.name}</h2><span>{guide.age}</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close learning center">×</button>
          </header>
          <nav>
            <button type="button" className={tab === "tutorial" ? "active" : ""} onClick={() => setTab("tutorial")}>Learn to play</button>
            <button type="button" className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>Full rules</button>
          </nav>
          {tab === "tutorial" ? (
            <div className="learning-tutorial">
              <p className="learning-objective">{guide.objective}</p>
              <div className="learning-progress" aria-label={`Tutorial progress ${safeStep + 1} of ${tutorial.length}`}><span style={{ width: `${progress}%` }} /></div>
              <StepCard step={tutorial[safeStep]} index={safeStep} total={tutorial.length} />
              <div className="learning-step-actions">
                <button type="button" disabled={safeStep === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>
                {safeStep < tutorial.length - 1 ? <button type="button" className="primary" onClick={() => setStep((value) => Math.min(tutorial.length - 1, value + 1))}>Next</button> : <button type="button" className="primary" onClick={() => setOpen(false)}>Start playing</button>}
              </div>
            </div>
          ) : (
            <div className="learning-rules">
              <p className="learning-objective">{guide.objective}</p>
              {guide.rules.map(([heading, items]) => (
                <section key={heading}><h3>{heading}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </aside>
  );
}

export { LEARNING };
