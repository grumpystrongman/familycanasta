import React from "react";
import { DEFAULT_HOUSE_RULES, normalizeHouseRules } from "../game/houseRules.js";

function Toggle({ label, checked, onChange, help }) {
  return (
    <label className="house-rule-toggle">
      <span><b>{label}</b>{help && <small>{help}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export default function HouseRulesPanel({ value = DEFAULT_HOUSE_RULES, onChange, disabled = false }) {
  const rules = normalizeHouseRules(value);
  const update = (section, patch) => onChange?.({
    ...rules,
    [section]: { ...rules[section], ...patch },
  });
  const updateCanastas = (type, nextValue) => update("winConditions", {
    canastasRequiredToGoOut: {
      ...rules.winConditions.canastasRequiredToGoOut,
      [type]: Math.max(0, Number(nextValue) || 0),
    },
  });

  return (
    <fieldset className="house-rules-panel" disabled={disabled}>
      <legend>House Rules</legend>

      <section>
        <h4>Game variant</h4>
        <label>Variant
          <select value={rules.deckVariation.variant} onChange={(event) => update("deckVariation", { variant: event.target.value })}>
            <option value="Classic">Classic</option>
            <option value="HandAndFoot">Hand &amp; Foot</option>
            <option value="TriplePlay">Triple Play</option>
          </select>
        </label>
      </section>

      <section>
        <h4>Draw &amp; discard</h4>
        <label>Cards drawn
          <select value={rules.drawAndDiscard.drawCount} onChange={(event) => update("drawAndDiscard", { drawCount: Number(event.target.value) })}>
            <option value={1}>1 card</option>
            <option value={2}>2 cards</option>
          </select>
        </label>
        <label>Discard pickup
          <select value={rules.drawAndDiscard.discardTakeLimit} onChange={(event) => update("drawAndDiscard", { discardTakeLimit: event.target.value === "7" ? 7 : "entirePack" })}>
            <option value="entirePack">Entire pile</option>
            <option value="7">Up to 7 cards</option>
          </select>
        </label>
        <Toggle label="Require a natural pair" help="Two natural cards matching the top discard are required." checked={rules.drawAndDiscard.requiresNaturalPairForPack} onChange={(checked) => update("drawAndDiscard", { requiresNaturalPairForPack: checked })} />
      </section>

      <section>
        <h4>Meld constraints</h4>
        <Toggle label="Rule of Five" help="No wild cards until a meld has five natural cards." checked={rules.meldConstraints.ruleOfFiveActive} onChange={(checked) => update("meldConstraints", { ruleOfFiveActive: checked })} />
        <Toggle label="Pure Sevens" help="Seven melds cannot contain wild cards." checked={rules.meldConstraints.pureSevensMandatory} onChange={(checked) => update("meldConstraints", { pureSevensMandatory: checked })} />
        <Toggle label="Pure Aces" help="Ace melds cannot contain wild cards." checked={rules.meldConstraints.pureAcesRule} onChange={(checked) => update("meldConstraints", { pureAcesRule: checked })} />
      </section>

      <section>
        <h4>Going out</h4>
        <label className="total-canastas">
          Total canastas
          <input
            type="number"
            min="1"
            max="10"
            value={rules.winConditions.totalCanastasRequired}
            onChange={(event) => update("winConditions", {
              totalCanastasRequired: Math.max(1, Number(event.target.value) || 1),
            })}
          />
          <small>Minimum completed canastas in any mix. Type-specific minimums below are additional.</small>
        </label>
        <div className="canasta-requirements">
          {["clean", "dirty", "wild"].map((type) => (
            <label key={type}>{type[0].toUpperCase() + type.slice(1)} canastas
              <input type="number" min="0" max="10" value={rules.winConditions.canastasRequiredToGoOut[type]} onChange={(event) => updateCanastas(type, event.target.value)} />
            </label>
          ))}
        </div>
        <Toggle label="Allow final discard to go out" checked={rules.winConditions.allowFinalDiscardToGoOut} onChange={(checked) => update("winConditions", { allowFinalDiscardToGoOut: checked })} />
      </section>
    </fieldset>
  );
}
