import React, { useMemo, useState } from "react";
import "./gameLearningCenter.css";

const BLACKGLASS_GUIDE = Object.freeze({
  name: "Blackglass: Blood & Alibi",
  age: "2–6 investigators",
  objective: "Identify the hidden suspect, weapon, and room before the other investigators solve the case.",
  rules: [
    ["Case setup", [
      "One suspect, one weapon, and one room are secretly chosen as the solution.",
      "Every other suspect, weapon, and room card is dealt to the investigators as private alibi evidence.",
      "Any card in your hand cannot be part of the solution.",
    ]],
    ["Your turn", [
      "A normal turn begins in the roll phase. Roll one die, then move through highlighted corridor spaces up to the number rolled.",
      "Entering a room costs movement and immediately ends movement so you can investigate there.",
      "Occupied corridor spaces block movement. You may stop in a corridor, but doing so ends your turn.",
      "If you begin your turn inside a room, you may investigate that room without rolling. Rooms with a secret passage may use it instead of rolling.",
    ]],
    ["Test a theory", [
      "You must be inside a room to test a theory.",
      "Choose a suspect and a weapon. The room in the theory is always the room you are currently investigating.",
      "Starting with the next investigator in turn order, the first player who can refute the theory must privately show you one matching alibi card. If they have more than one match, they choose which card to show.",
      "If nobody can refute the theory, make a note of it. That is strong information, but it is not an automatic win.",
      "After the theory is resolved, your turn ends.",
    ]],
    ["Use the detective notebook", [
      "Your private hand and any cards shown directly to you are proven alibis and are never in the solution.",
      "Use the notebook to mark possibilities, watch suspicious cards, and rule out evidence you can prove is innocent.",
      "The deduction desk highlights how many suspects, weapons, and rooms are still possible. When only one remains in a category, that is your live candidate.",
      "Information shown to another investigator stays private unless you can infer it from later play.",
    ]],
    ["Final accusation and winning", [
      "On your active turn, you may make a final accusation naming one suspect, one weapon, and one room.",
      "If all three match the hidden solution, you solve the murder and win immediately.",
      "A wrong accusation removes you from future investigative turns, although your evidence can still matter when other investigators test theories.",
      "If only one active investigator remains after failed accusations, that investigator wins.",
    ]],
    ["Secret passages", [
      "The Rooftop Greenhouse connects to the Boiler Room.",
      "The Security Office connects to the Parking Garage.",
      "Using a secret passage moves you directly to the linked room and puts you into the investigation phase for that room.",
    ]],
  ],
  tutorial: [
    ["Start with what you know", "Look at your private alibi cards first. Every one of those cards is impossible as part of the hidden solution, so mark them as proven in your notebook.", "Your own hand is your safest information."],
    ["Get into rooms", "Roll and move through the hotel. Entering a room ends movement and lets you test a theory there. If you start in a room, you can investigate it again or use an available secret passage.", "The room you occupy becomes the room in your theory."],
    ["Test focused theories", "Pick a suspect and weapon that give you useful information. The first investigator able to refute must privately show one matching card.", "A shown card proves that exact card is innocent; no refutation is also important evidence."],
    ["Narrow the three categories", "Use your hand, shown alibis, and the notebook to reduce suspects, weapons, and rooms. The deduction desk shows how many possibilities remain in each category.", "You are solving three separate elimination problems that combine into one answer."],
    ["Accuse only when ready", "A final accusation can win the case immediately, but a wrong one removes you from active investigation. Wait until your suspect, weapon, and room all line up.", "A theory gathers evidence. An accusation risks the game."],
  ],
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

export default function BlackglassLearningCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("tutorial");
  const [step, setStep] = useState(0);
  const tutorial = BLACKGLASS_GUIDE.tutorial;
  const safeStep = Math.min(step, tutorial.length - 1);
  const progress = useMemo(() => ((safeStep + 1) / tutorial.length) * 100, [safeStep, tutorial.length]);

  return (
    <aside className="game-learning-center" aria-label={`${BLACKGLASS_GUIDE.name} learning center`}>
      <button type="button" className="learning-launch" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        🎓 Learn & Rules
      </button>
      {open ? (
        <section className="learning-panel" role="dialog" aria-label={`Learn ${BLACKGLASS_GUIDE.name}`}>
          <header>
            <div><small>BLACKGLASS HOTEL</small><h2>{BLACKGLASS_GUIDE.name}</h2><span>{BLACKGLASS_GUIDE.age}</span></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close learning center">×</button>
          </header>
          <nav>
            <button type="button" className={tab === "tutorial" ? "active" : ""} onClick={() => setTab("tutorial")}>Learn to play</button>
            <button type="button" className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}>Full rules</button>
          </nav>
          {tab === "tutorial" ? (
            <div className="learning-tutorial">
              <p className="learning-objective">{BLACKGLASS_GUIDE.objective}</p>
              <div className="learning-progress" aria-label={`Tutorial progress ${safeStep + 1} of ${tutorial.length}`}><span style={{ width: `${progress}%` }} /></div>
              <StepCard step={tutorial[safeStep]} index={safeStep} total={tutorial.length} />
              <div className="learning-step-actions">
                <button type="button" disabled={safeStep === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</button>
                {safeStep < tutorial.length - 1 ? <button type="button" className="primary" onClick={() => setStep((value) => Math.min(tutorial.length - 1, value + 1))}>Next</button> : <button type="button" className="primary" onClick={() => setOpen(false)}>Start playing</button>}
              </div>
            </div>
          ) : (
            <div className="learning-rules">
              <p className="learning-objective">{BLACKGLASS_GUIDE.objective}</p>
              {BLACKGLASS_GUIDE.rules.map(([heading, items]) => (
                <section key={heading}><h3>{heading}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </aside>
  );
}

export { BLACKGLASS_GUIDE };
