// Fictional name pools used only for procedurally generated seed players.
// No real athletes are represented.

export const FIRST_NAMES = [
  "Marcus", "Devon", "Elijah", "Trevor", "Malik", "Jordan", "Xavier", "Isaiah",
  "Dominic", "Caleb", "Antoine", "Terrell", "Bryce", "Julian", "Reggie", "Corey",
  "Andre", "Darius", "Tyrell", "Jamal", "Cole", "Grant", "Hunter", "Mason",
  "Wyatt", "Blake", "Chase", "Nolan", "Owen", "Silas", "Emmett", "Roman",
  "Sawyer", "Jaxon", "Kellen", "Zion", "Amir", "Cyrus", "Dashawn", "Quincy",
  "Rashad", "Sean", "Tyson", "Vernon", "Wesley", "Zeke", "Ashton", "Braylon",
  "Deshawn", "Emory",
] as const;

export const LAST_NAMES = [
  "Whitfield", "Ashe", "Kessler", "Boone", "Marsh", "Calloway", "Dunbar", "Frost",
  "Grier", "Halloway", "Ingram", "Jarrett", "Kingston", "Larkin", "Mercer", "Nash",
  "Osei", "Pruitt", "Quintero", "Rourke", "Sterling", "Thorne", "Underwood", "Vance",
  "Wren", "Xiong", "Yates", "Zamora", "Abbott", "Bishop", "Crane", "Delacroix",
  "Ellery", "Fenwick", "Garrick", "Hollis", "Iverson", "Jessup", "Kane", "Lowell",
  "Monroe", "Nettles", "Ochoa", "Prescott", "Quill", "Ridge", "Slate", "Tremaine",
  "Voss", "Winslow",
] as const;

export const HOMETOWNS = [
  "Wilmington, DE", "Newark, DE", "Dover, DE", "Trenton, NJ", "Camden, NJ",
  "Jersey City, NJ", "Atlanta, GA", "Savannah, GA", "Macon, GA", "Orlando, FL",
  "Tampa, FL", "Jacksonville, FL", "Chicago, IL", "Peoria, IL", "Rockford, IL",
  "Seattle, WA", "Tacoma, WA", "Spokane, WA", "Houston, TX", "Austin, TX",
  "Dallas, TX", "Philadelphia, PA", "Pittsburgh, PA", "Allentown, PA",
] as const;

export const ARCHETYPES: Record<string, string[]> = {
  QB: ["Field General", "Gunslinger", "Dual Threat", "Game Manager"],
  RB: ["Power Back", "Elusive Back", "Workhorse", "Receiving Back"],
  FB: ["Lead Blocker", "Utility Back"],
  WR: ["Deep Threat", "Possession Receiver", "Slot Specialist", "Route Technician"],
  TE: ["Receiving Threat", "In-Line Blocker", "Move Tight End"],
  LT: ["Pass Protector", "Road Grader"], LG: ["Road Grader", "Pulling Guard"],
  C: ["Field General Center", "Anchor"], RG: ["Road Grader", "Pulling Guard"], RT: ["Pass Protector", "Road Grader"],
  LE: ["Speed Rusher", "Run Stuffer"], RE: ["Speed Rusher", "Power Rusher"], DT: ["Nose Tackle", "Interior Disruptor"],
  LOLB: ["Edge Rusher", "Coverage Backer"], MLB: ["Run Stopper", "Sideline to Sideline"], ROLB: ["Edge Rusher", "Coverage Backer"],
  CB: ["Shutdown Corner", "Press Specialist", "Ball Hawk"],
  FS: ["Center Fielder", "Ball Hawk"], SS: ["Box Enforcer", "Hybrid Safety"],
  K: ["Power Leg", "Accurate Kicker"], P: ["Directional Punter", "Big Leg"],
};
