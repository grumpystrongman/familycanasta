const makeSet = (name, collection, clubs, diamonds, hearts, spades) => Object.freeze({
  name,
  collection,
  cards: Object.freeze({ clubs, diamonds, hearts, spades }),
});

export const BAD_DECISIONS_DECK = Object.freeze({
  id: "bad-decisions",
  name: "The Bad Decisions Deck",
  tagline: "52 tiny reasons your therapist drinks.",
  sets: Object.freeze({
    "2": makeSet(
      "Total Regrets",
      "Pure Raunch & Chaos",
      "A Text to Your Ex at 3:07 AM That Just Says ‘u up?’",
      "A Dynamic Duo of Chlamydia and Regret",
      "An Accidental Nude Sent to the Family Group Chat",
      "A Search History That Makes Incognito Mode Feel Judgy",
    ),
    "3": makeSet(
      "Family Disappointments",
      "Pure Raunch & Chaos",
      "A Disappointed Sigh From Your Mother After She Meets Your Date",
      "A Father Who Went Out for Milk and Apparently Found a New Family",
      "A Living-Room Brawl That Started With Monopoly and Ended With Police Lights",
      "A Trust Fund Vaporized on Crypto, Ketosis, and One Very Stupid Boat",
    ),
    "4": makeSet(
      "Biological Horrors",
      "Pure Raunch & Chaos",
      "A Loud Wet Fart During the Quiet Part of a Funeral",
      "A Surprise Shart Ten Minutes Into a First Date",
      "A Single Nose Hair Long Enough to Have Its Own Credit Score",
      "A Mysterious Rash Exactly Where You Really Do Not Want Questions",
    ),
    "5": makeSet(
      "Dating Disasters",
      "Pure Raunch & Chaos",
      "A First Date at Waffle House That Somehow Ends at Urgent Care",
      "A Dating Profile Photo Taken Three Presidents Ago",
      "Getting Ghosted by Someone Who Still Uses Your Netflix Password",
      "Matching Couple Tattoos Two Weeks Before the Breakup",
    ),
    "6": makeSet(
      "Office Misery",
      "Corporate Slaves & Daily Grinds",
      "A Reply-All Email That Nukes Your Career Before Lunch",
      "Mandatory Team Building on Saturday With a Man Named Brent Holding a Trust Fall Clipboard",
      "A Passive-Aggressive Microwave Note Written Like a Hostage Negotiation",
      "A Performance Review That Uses ‘Opportunity’ Seventeen Times and ‘Raise’ Zero Times",
    ),
    "7": makeSet(
      "Financial Ruin",
      "Corporate Slaves & Daily Grinds",
      "A Maxed-Out Credit Card Declined While Your Date Watches",
      "Student Loans That Will Outlive Your Knees, Your Hairline, and Possibly Civilization",
      "A Bank Balance of $1.42 With Three Autopays Circling Like Sharks",
      "Buying Meme Stock at the Exact Moment the Internet Stops Believing in It",
    ),
    "8": makeSet(
      "Modern Existential Dread",
      "Corporate Slaves & Daily Grinds",
      "A Complete Emotional Collapse Because the Coffee Shop Is Out of Oat Milk",
      "A 2:13 AM Ceiling-Staring Session Featuring Every Mistake Since Seventh Grade",
      "One Tiny Lie That Now Requires a Spreadsheet and Three Accomplices",
      "Thirty-Seven Half-Empty Water Bottles Quietly Becoming Your Personality",
    ),
    "9": makeSet(
      "Physical Decline",
      "Mid-Life Crisis & Millennial Malaise",
      "A Knee Crack So Loud the Dog Checks on You",
      "A Two-Beer Hangover Requiring Electrolytes, Ibuprofen, and a Written Apology",
      "Getting Weirdly Excited About Fiber Because Apparently This Is Who You Are Now",
      "Lower Back Pain Triggered by Sleeping Slightly Wrong",
    ),
    "10": makeSet(
      "Sexual Misadventures",
      "Pure Raunch & Chaos",
      "A Condom Wrapper Found by the One Relative Who Never Minds Their Business",
      "A Sex Toy Delivery Box Left on the Porch With Absolutely Zero Discretion",
      "A Walk of Shame Interrupted by Your Neighbor Walking Their Golden Retriever",
      "A Bedroom Playlist That Accidentally Shuffles Into a True-Crime Podcast",
    ),
    J: makeSet(
      "Social Failure",
      "Mid-Life Crisis & Millennial Malaise",
      "A Group Chat That Gets Suspiciously Quiet Every Time You Type",
      "Finding Out About the Party From Photos Posted While the Party Is Still Happening",
      "A Desperate Thirst Trap That Gets Two Likes: Your Mom and a Bot",
      "Canceling Plans You Begged Everyone to Make Because Now You Have to Put on Pants",
    ),
    Q: makeSet(
      "Tech Incompetence",
      "Generation Gap",
      "A Full-Volume FaceTime Call From a Public Restroom Stall",
      "A Facebook Rant Correcting ‘Your’ While Using ‘You’re’ Wrong",
      "Forty-Five Minutes of Zoom Followed by ‘Can You Hear Me Now?’",
      "A Desktop With So Many Icons Windows Has Started Stacking Them Vertically",
    ),
    K: makeSet(
      "Nerd Rage",
      "Subcultural Chaos",
      "A Star Wars Canon Argument Violent Enough to Frighten the Bartender",
      "A Miniature You Spent Nine Hours Painting Before Dropping It Face-First Into Carpet",
      "A Rules Lawyer Explaining Why Nobody Is Technically Allowed to Have Fun",
      "A Steam Library Large Enough to Qualify as an Estate Asset and Still Nothing to Play",
    ),
    A: makeSet(
      "High-Octane Bad Decisions",
      "Subcultural Chaos",
      "A Rented Electric Scooter Wipeout Directly in Front of a Bachelorette Party",
      "A Fresh Dent in a Vintage Vanagon Followed by the Sentence ‘It’ll Buff Out’",
      "A Fishing Lure Buried in Your Own Finger While Everyone Else Keeps Fishing",
      "A Power-Pole Failure at the Exact Moment You Were Bragging About the Power-Pole",
    ),
  }),
});

export const ADULT_DECK_PACKS = Object.freeze({
  [BAD_DECISIONS_DECK.id]: BAD_DECISIONS_DECK,
});

export const DEFAULT_ADULT_DECK = BAD_DECISIONS_DECK;

export function rankLabelsForDeck(deck = DEFAULT_ADULT_DECK) {
  return Object.freeze(Object.fromEntries(Object.entries(deck.sets).map(([rank, set]) => [rank, set.name])));
}

export function cardLabelForDeck(deck, card) {
  return deck?.sets?.[card?.rank]?.cards?.[card?.suit] || "A Bad Decision With No Alibi";
}

export function collectionForRank(deck, rank) {
  return deck?.sets?.[rank]?.collection || "Bad Decisions";
}
