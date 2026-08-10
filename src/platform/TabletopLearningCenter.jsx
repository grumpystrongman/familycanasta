import React, { useEffect, useMemo, useState } from "react";
import "./gameLearningCenter.css";

const GUIDES = Object.freeze({
  gofish: {
    name: "Go Fish", age: "Ages 5+", objective: "Collect more four-of-a-kind books than everyone else.",
    rules: [
      ["Ask", ["On your turn, ask one other player for a rank you already hold.", "If they have any cards of that rank, they must give you all of them and you ask again."]],
      ["Go fish", ["If the player has none, draw one card from the pond.", "If you draw the rank you asked for, you keep the turn; otherwise play moves on."]],
      ["Books", ["Four cards of one rank immediately become a book and leave your hand.", "When all thirteen books are complete, the player with the most books wins."]],
    ],
    tutorial: [
      ["Start with pairs", "Look for ranks you hold two or three of. Those are your fastest paths to a book.", "You may only ask for a rank already in your hand."],
      ["Remember answers", "If someone gives another player several eights, remember who now holds those eights.", "Go Fish rewards a little memory more than luck alone."],
      ["Build books", "Every time you collect all four suits of one rank, the table turns them into a book automatically.", "Most books wins; hand size does not."],
    ],
  },
  gofyourself: {
    name: "Go F' Yourself", age: "18+ only", objective: "Collect complete four-card comedy sets while making everyone at the table question their life choices.",
    rules: [
      ["The matching is real Go Fish", ["Each named set — like Total Regrets, Biological Horrors, Dating Disasters, or Sexual Misadventures — contains exactly four different joke cards.", "On your turn, ask another adult for a set you already hold. If they have any cards from that set, they hand over all of them and you ask again."]],
      ["Go F' Yourself", ["If they have none of that set, the official answer is: Go F' Yourself.", "You draw one card from the pile of bad decisions. Drawing the set you asked for keeps your turn; otherwise play moves on."]],
      ["Complete the disaster", ["Collect all four different cards from one set and it becomes a completed book.", "The 52-card deck contains thirteen four-card sets, so the player with the most completed disasters wins."]],
      ["Adult deck packs", ["The adult card copy is separated from the Go Fish engine, so future 52-card expansion decks can swap in new thirteen-set themes without changing the matching rules.", "Every expansion keeps four different punchlines per set; expansions add comedy, not new matching mechanics."]],
    ],
    tutorial: [
      ["Read the damn card", "Every card has a set name plus its own punchline. Four different cards share that set name.", "The punchlines are different; the set name is what matches."],
      ["Ask for the set", "If you hold any Dating Disasters, you can ask another player: ‘Got any Dating Disasters?’ If they do, you get every Dating Disasters card in their hand.", "You never ask for the individual punchline."],
      ["Finish the train wreck", "Get all four cards in a set and the table books them automatically. The most books wins.", "Dignity, healthy relationships, and browser history are not scored."],
    ],
  },
  connect4: {
    name: "Connect 4", age: "Ages 6+", objective: "Be first to connect four of your checkers in a straight line.",
    rules: [
      ["Drop", ["Players alternate dropping one checker into any non-full column.", "The checker falls to the lowest open space in that column."]],
      ["Connect", ["Four horizontally, vertically, or diagonally wins immediately.", "If the board fills without four connected checkers, the game is a draw."]],
      ["Defense", ["A move can create your own threat or block the opponent's next winning drop.", "The center columns participate in more possible four-in-a-row lines than the edges."]],
    ],
    tutorial: [
      ["Own the center", "Center columns give your checker more ways to connect in every direction.", "A center opening is usually stronger than an edge opening."],
      ["Check the threat", "Before every drop, see whether your opponent already has three with an open winning square.", "Blocking a forced win matters more than building a pretty pattern."],
      ["Create two threats", "Strong positions give you two different winning drops on the next turn.", "Your opponent can block only one column at a time."],
    ],
  },
  battleship: {
    name: "Battleship", age: "Ages 8+", objective: "Find and sink all five ships in the opponent's hidden 10×10 fleet.",
    rules: [
      ["Fleet", ["Each side has Carrier 5, Battleship 4, Cruiser 3, Submarine 3, and Destroyer 2.", "This online table auto-deploys fleets so the shooting starts immediately."]],
      ["Fire", ["Players alternate choosing one enemy coordinate they have not fired at before.", "The table marks every shot as a hit or miss and announces when a ship sinks."]],
      ["Win", ["A ship sinks when every one of its cells has been hit.", "Sink all five enemy ships to win the battle."]],
    ],
    tutorial: [
      ["Spread your search", "Early in the game, space shots apart instead of clustering random misses.", "No ship is smaller than two cells."],
      ["Hunt after a hit", "Once you hit, probe the neighboring squares to discover the ship's direction.", "Ships are straight, never diagonal."],
      ["Track what sank", "The fleet strip shows which of your ships remain afloat, while the enemy grid preserves every shot you've made.", "Do not waste a shot on a coordinate already marked."],
    ],
  },
  hnefatafl: {
    name: "Hnefatafl", age: "Ages 10+", objective: "Attackers capture the king; defenders escort the king to any corner.",
    rules: [
      ["Sides", ["Seat one commands 24 attackers. Seat two commands 12 defenders plus the king.", "Attackers move first, so the game is intentionally asymmetric."]],
      ["Movement", ["Every piece moves any distance orthogonally through open squares, like a chess rook.", "Only the king may occupy the central throne or the four escape corners."]],
      ["Capture and escape", ["Ordinary pieces are captured by sandwiching them between hostile sides.", "The king wins by reaching a corner; attackers win by capturing the king.", "This approachable ruleset omits shield-wall, repetition, and fort variants."]],
    ],
    tutorial: [
      ["Know your job", "Raiders should tighten the net around the king. Defenders should open lanes from the center toward a corner.", "The two sides are not trying to do the same thing."],
      ["Move like a rook", "Long orthogonal moves make the board change quickly. Pieces cannot jump through occupied or restricted squares.", "A distant piece can suddenly become a capture anchor."],
      ["Think in sandwiches", "Before moving, check the square on the far side of nearby enemy pieces.", "A single move can trap and remove an exposed piece."],
    ],
  },
});

function StepCard({ step, index, total }) {
  return <article className="learning-step-card"><small>STEP {index + 1} OF {total}</small><h3>{step[0]}</h3><p>{step[1]}</p><div className="learning-tip"><strong>Remember:</strong> {step[2]}</div></article>;
}

export default function TabletopLearningCenter({ gameId }) {
  const guide = GUIDES[gameId];
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("tutorial");
  const [step, setStep] = useState(0);
  useEffect(() => { setStep(0); setOpen(false); }, [gameId]);
  const tutorial = guide?.tutorial || [];
  const safeStep = Math.min(step, Math.max(0, tutorial.length - 1));
  const progress = useMemo(() => tutorial.length ? ((safeStep + 1) / tutorial.length) * 100 : 0, [safeStep, tutorial.length]);
  if (!guide) return null;
  return (
    <aside className="game-learning-center" aria-label={`${guide.name} learning center`}>
      <button type="button" className="learning-launch" onClick={() => setOpen((value) => !value)} aria-expanded={open}>🎓 Learn & Rules</button>
      {open ? <section className="learning-panel" role="dialog" aria-label={`Learn ${guide.name}`}>
        <header><div><small>FAMILY GAME ROOM</small><h2>{guide.name}</h2><span>{guide.age}</span></div><button type="button" onClick={() => setOpen(false)} aria-label="Close learning center">×</button></header>
        <nav><button type="button" className={tab === "tutorial" ? "active" : ""} onClick={() => setTab("tutorial")}>Learn to play</button><button type="button" className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>Full rules</button></nav>
        {tab === "tutorial" ? <div className="learning-tutorial"><p className="learning-objective">{guide.objective}</p><div className="learning-progress" aria-label={`Tutorial progress ${safeStep + 1} of ${tutorial.length}`}><span style={{ width: `${progress}%` }} /></div><StepCard step={tutorial[safeStep]} index={safeStep} total={tutorial.length} /><div className="learning-step-actions"><button type="button" disabled={safeStep === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>{safeStep < tutorial.length - 1 ? <button type="button" className="primary" onClick={() => setStep((value) => Math.min(tutorial.length - 1, value + 1))}>Next</button> : <button type="button" className="primary" onClick={() => setOpen(false)}>Start playing</button>}</div></div> : <div className="learning-rules"><p className="learning-objective">{guide.objective}</p>{guide.rules.map(([heading, items]) => <section key={heading}><h3>{heading}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>)}</div>}
      </section> : null}
    </aside>
  );
}
