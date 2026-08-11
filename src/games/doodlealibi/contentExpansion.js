const EXTRA_PAIRS = [
  ["toaster", "microwave"], ["lighthouse", "wizard tower"], ["submarine", "whale"], ["snowman", "penguin"],
  ["fire truck", "food truck"], ["mailbox", "birdhouse"], ["volcano", "birthday cake"], ["spaceship", "airplane"],
  ["octopus", "spider"], ["bee", "tiny helicopter"], ["crown", "birthday hat"], ["treasure chest", "toolbox"],
  ["campfire", "birthday candles"], ["skateboard", "surfboard"], ["tent", "circus tent"], ["hot-air balloon", "giant light bulb"],
  ["mermaid", "scuba diver"], ["knight", "hockey goalie"], ["mushroom", "umbrella"], ["palm tree", "giant feather"],
  ["school bus", "banana car"], ["snow globe", "fish bowl"], ["trophy", "fancy goblet"], ["rocket", "giant pencil"],
];

const EXTRA_SCENARIOS = [
  { line: "trying very hard to look normal", twist: "Add a tiny hat that makes no sense", suspectTwist: "Add a suspicious pair of sunglasses" },
  { line: "having the worst Monday imaginable", twist: "Add a spilled drink nearby", suspectTwist: "Add a broken alarm clock nearby" },
  { line: "at an awkward birthday party", twist: "Add one sad balloon", suspectTwist: "Add one aggressively cheerful party horn" },
  { line: "escaping from something off-screen", twist: "Add speed lines and one dropped shoe", suspectTwist: "Add speed lines and a rolling suitcase" },
  { line: "pretending to be extremely wealthy", twist: "Add an oversized gold chain", suspectTwist: "Add an absurdly tiny limousine" },
  { line: "on a terrible first date", twist: "Add a wilted flower", suspectTwist: "Add a bill nobody wants to pay" },
];

export const DOODLE_EXTRA_CASES = EXTRA_PAIRS.flatMap(([common, suspect], pairIndex) => EXTRA_SCENARIOS.map((scenario, scenarioIndex) => ({
  id: `extra-${pairIndex}-${scenarioIndex}`,
  common: `Draw a ${common} ${scenario.line}.`,
  suspect: `Draw a ${suspect} ${scenario.line}.`,
  base: `Draw a ${common} ${scenario.line}.`,
  twistCommon: scenario.twist,
  twistSuspect: scenario.suspectTwist,
})));
