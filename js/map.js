"use strict";

// ---------- Map ----------
// # wall   = wall with window   . parquet   , kitchen tile   ~ carpet   : concrete
// B bookshelf   P plant   T table   S sofa   b bed   K kitchen counter   O stove   V sink
// F fridge   k crate   @ start   X target (shooting target)   r rat   g goblin   w random weapon
// N rat nest   C coffin   Q TV camera   f fuse   m slime   i bomber   h ghost   n knight   e random clothes
// D gate to the boss room   M boss spawn   > stairs down (hidden until the boss is dead)

const MAPS = {
  apartment: {
    name: 'The Apartment',
    boss: 'landlord',
    rows: [
      '########################################',
      '###==##==######==#####==#######==#######',
      '#BBB....e.P#P.....BBB.....P#FKOVVKK,,,,#',
      '#......r...#...............#,,,,,,,,r,,#',
      '#.bb.......#....~~~~~~~....#,,,,,,,,,,,#',
      '#.bb...w...#....~~TTT~~....#,,,,TT,,,,,#',
      '#.bb.......#....~~~~~~~....#,,,,TT,,,,,#',
      '#..........#....~SSSSS~....#,,,,,,,,,w,#',
      '#...........................,,,,,,,,,,,#',
      '#..................@........,,,,,,,r,,,#',
      '#P.........#...............#,,,,,,,,,,P#',
      '#####..###########...###########..######',
      '#P....................................P#',
      '#...r..............................r...#',
      '#......................................#',
      '##################....##################',
      '#::::::::::::::::::::::::::::::::::::::#',
      '#::k::::::::g::::::::::::::g::::::::k::#',
      '#::::::::X:::::::::X:::::::::X:::::::::#',
      '#:::::::r:::::::::::::::g::::::r:::::::#',
      '#::::kk::::::::::::::::::::::::::kk::::#',
      '#:::::::::::::X::::::::::X:::::::::::::#',
      '#::::::::::::::::::::::::::::::::::::w:#',
      '########################################',
    ],
  },
};

const TILE_TYPES = {
  '#': { wall: true },
  '=': { wall: true, hasWindow: true },
  '.': { floor: 'parquet' },
  ',': { floor: 'kitchenTile' },
  '~': { floor: 'carpet' },
  ':': { floor: 'concrete' },
  'B': { furniture: 'bookshelf' },
  'P': { furniture: 'plant' },
  'T': { furniture: 'table' },
  'S': { furniture: 'sofa' },
  'b': { furniture: 'bed' },
  'K': { furniture: 'counter' },
  'O': { furniture: 'stove' },
  'V': { furniture: 'sink' },
  'F': { furniture: 'fridge' },
  'k': { furniture: 'crate' },
  '@': { start: true },
  'X': { target: true },
  'r': { enemy: 'rat' },
  'g': { enemy: 'goblin' },
  'w': { item: true },
  'a': { enemy: 'bat' },
  's': { enemy: 'spitter' },
  'o': { enemy: 'ogre' },
  'e': { gear: true },
  'm': { enemy: 'slime' },
  'i': { enemy: 'bomber' },
  'h': { enemy: 'ghost' },
  'n': { enemy: 'knight' },
  '%': { floor: 'metal' },
  '&': { floor: 'stone' },
  '$': { floor: 'marble' },
  'D': { gate: true },
  'M': { bossSpawn: true },
  '>': { stairs: true },
  'N': { breakable: 'nest' },
  'C': { breakable: 'coffin' },
  'Q': { breakable: 'camera' },
  'f': { pickup: 'fuse' },
};

// The floors, in the order the player goes through them.
const LEVEL_ORDER = ['apartment', 'sewers', 'boiler', 'catacombs', 'studio'];

// Every floor ends in a sealed boss room: a gate, a room with the boss, and the stairs down behind it.
function bossRoomRows(w, floor) {
  const mid = w >> 1;
  const blank = '#' + floor.repeat(w - 2) + '#';
  const put = (row, x, c) => row.slice(0, x) + c + row.slice(x + 1);
  return [
    '#'.repeat(mid - 1) + 'DD' + '#'.repeat(w - mid - 1),
    blank,
    put(put(put(put(blank, 3, 'k'), 4, 'k'), w - 5, 'k'), w - 4, 'k'),
    blank,
    put(blank, mid, 'M'),
    blank,
    put(blank, mid, '>'),
    put(put(blank, 3, 'k'), w - 4, 'k'),
    '#'.repeat(w),
  ];
}

// Replaces the bottom wall of a map with the boss room.
function addBossRoom(rows, floor) {
  return [...rows.slice(0, -1), ...bossRoomRows(rows[0].length, floor)];
}

// ---------- Map building helpers ----------

// An empty room: walls around the edge and the floor character everywhere else.
function emptyGrid(w, h, floor) {
  const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : floor)));
  g.floor = floor;
  return g;
}

// A wall along y (or x) from one end to the other, except for the gaps (lists of [from, to]).
function hWall(g, y, x0, x1, gaps) {
  for (let x = x0; x <= x1; x++) if (!gaps.some(([a, b]) => x >= a && x <= b)) g[y][x] = '#';
}

function vWall(g, x, y0, y1, gaps) {
  for (let y = y0; y <= y1; y++) if (!gaps.some(([a, b]) => y >= a && y <= b)) g[y][x] = '#';
}

// Puts a character on every [x, y] in the list. Only free floor can be written to, so mistakes show up at once.
function place(g, list, c) {
  for (const [x, y] of list) {
    if (g[y][x] !== g.floor) throw new Error('Map: cannot place ' + c + ' at ' + x + ',' + y + ' (found ' + g[y][x] + ')');
    g[y][x] = c;
  }
}

const gridRows = g => g.map(row => row.join(''));

// Floor 2: three corridors joined by gaps in two long walls.
function sewerRows() {
  const g = emptyGrid(40, 24, ':');
  hWall(g, 7, 1, 38, [[6, 7], [30, 31]]);
  hWall(g, 15, 1, 38, [[18, 19], [34, 35]]);
  place(g, [[3, 3]], '@');
  place(g, [[12, 2], [25, 4], [34, 2], [5, 10], [14, 12], [24, 9], [33, 13], [5, 18], [16, 21], [30, 17]], 'r');
  place(g, [[20, 5], [20, 11], [36, 10], [12, 19], [26, 20], [36, 18]], 'g');
  place(g, [[22, 2], [8, 13], [30, 10], [22, 21]], 'N');
  place(g, [[36, 5], [3, 9], [37, 21]], 'w');
  place(g, [[8, 2], [9, 2], [28, 5], [10, 9], [11, 9], [26, 13], [20, 17], [21, 17], [8, 21]], 'k');
  place(g, [[15, 4], [28, 12], [10, 17], [33, 20]], 'm');
  place(g, [[3, 21]], 'e');
  return gridRows(g);
}

// Floor 3: three chambers side by side, with pillars. Bats, spitters and goblins.
function boilerRows() {
  const g = emptyGrid(40, 24, '%');
  vWall(g, 13, 1, 22, [[5, 6], [16, 17]]);
  vWall(g, 26, 1, 22, [[10, 11], [19, 20]]);
  place(g, [[6, 6], [6, 17], [20, 6], [20, 17], [33, 6], [33, 17]], '#');
  place(g, [[3, 3]], '@');
  place(g, [[8, 4], [18, 8], [30, 4], [34, 12], [8, 16], [36, 5]], 'a');
  place(g, [[7, 12], [20, 12], [35, 18], [22, 19]], 's');
  place(g, [[4, 19], [20, 3], [30, 20], [36, 8], [16, 21], [30, 12]], 'g');
  place(g, [[10, 9], [22, 15], [28, 6]], 'r');
  place(g, [[5, 8], [18, 19], [22, 3], [36, 14]], 'X');
  place(g, [[2, 14], [16, 2], [24, 20], [38, 12]], 'f');
  place(g, [[10, 20], [23, 10], [38, 3]], 'w');
  place(g, [[9, 14], [10, 14], [17, 12], [30, 14], [31, 14], [23, 19], [3, 15]], 'k');
  place(g, [[10, 4], [22, 10], [32, 16]], 'i');
  place(g, [[24, 16]], 'n');
  place(g, [[38, 20]], 'e');
  return gridRows(g);
}

// Floor 4: four winding corridors. Ogres join the others.
function catacombRows() {
  const g = emptyGrid(40, 24, '&');
  hWall(g, 6, 1, 38, [[3, 4], [20, 21], [36, 37]]);
  hWall(g, 12, 1, 38, [[10, 11], [28, 29]]);
  hWall(g, 18, 1, 38, [[4, 5], [22, 23], [35, 36]]);
  place(g, [[3, 3]], '@');
  place(g, [[10, 3], [25, 2], [14, 9], [36, 15], [15, 20]], 'a');
  place(g, [[16, 4], [22, 9], [5, 15], [20, 21]], 's');
  place(g, [[30, 3], [34, 9], [18, 14], [8, 21]], 'g');
  place(g, [[8, 9], [26, 16], [30, 21]], 'o');
  place(g, [[24, 2], [36, 9], [6, 15], [26, 20]], 'C');
  place(g, [[38, 2], [2, 9], [38, 16]], 'w');
  place(g, [[12, 2], [13, 2], [28, 9], [29, 9], [12, 15], [34, 16], [16, 20], [17, 20]], 'k');
  place(g, [[14, 3], [30, 8], [10, 14], [24, 20]], 'h');
  place(g, [[20, 15], [34, 4]], 'n');
  place(g, [[2, 20]], 'e');
  return gridRows(g);
}

// Floor 5: a studio with a stage in the middle and a hall on each side.
function studioRows() {
  const g = emptyGrid(40, 24, '$');
  vWall(g, 10, 1, 22, [[8, 14]]);
  vWall(g, 29, 1, 22, [[8, 14]]);
  hWall(g, 5, 11, 28, [[18, 21]]);
  hWall(g, 17, 11, 28, [[18, 21]]);
  place(g, [[14, 11], [25, 11]], '#');
  place(g, [[3, 3]], '@');
  place(g, [[4, 5], [5, 18], [14, 20], [25, 20], [37, 3]], 'a');
  place(g, [[6, 10], [24, 3], [20, 13], [35, 12]], 's');
  place(g, [[15, 2], [13, 8], [26, 14], [20, 21], [33, 18]], 'g');
  place(g, [[3, 14], [16, 9], [34, 6]], 'o');
  place(g, [[4, 9], [22, 2], [20, 20], [36, 16]], 'Q');
  place(g, [[2, 2], [24, 12], [38, 21]], 'w');
  place(g, [[8, 6], [8, 7], [31, 6], [31, 7], [12, 7], [27, 15], [12, 15]], 'k');
  place(g, [[18, 8], [22, 14]], 'i');
  place(g, [[7, 16], [36, 10]], 'n');
  place(g, [[18, 3], [32, 20]], 'h');
  place(g, [[6, 3], [35, 4]], 'm');
  place(g, [[38, 2], [2, 21]], 'e');
  return gridRows(g);
}

// Each floor has its own objectives (see objectives.js). done is the message shown when one is completed.
MAPS.apartment.rows = addBossRoom(MAPS.apartment.rows, ':');
MAPS.apartment.objectives = [
  { type: 'kill', done: 'All vermin cleared. The viewers are pleased. For now.' },
  { type: 'targets', label: 'Targets', done: 'All five targets hit. Impressive. Almost.' },
];
MAPS.sewers = {
  name: 'The Sewers', boss: 'ratKing', rows: addBossRoom(sewerRows(), ':'),
  briefing: 'Rat nests keep sending out rats. Destroy all four.',
  objectives: [{ type: 'destroy', what: 'nest', label: 'Nests', done: 'All nests destroyed. The rats are furious.' }],
};
MAPS.boiler = {
  name: 'The Boiler Room', boss: 'janitor', rows: addBossRoom(boilerRows(), '%'), targetStyle: 'gauge',
  dark: { level: 0.93, fix: 'fuse' },   // the floor is dark until all the fuses are found
  briefing: 'The power is out and it is dark. Find four fuses to bring the lights back, and shoot the four pressure gauges.',
  objectives: [
    { type: 'collect', what: 'fuse', label: 'Fuses', done: 'All fuses found. The lights flicker on.' },
    { type: 'targets', label: 'Gauges', done: 'The pressure is back to normal. Mostly.' },
  ],
};
MAPS.catacombs = {
  name: 'The Catacombs', boss: 'boneCollector', rows: addBossRoom(catacombRows(), '&'),
  briefing: 'Smash the four coffins, but expect company. Then hunt down the three ogres.',
  objectives: [
    { type: 'destroy', what: 'coffin', label: 'Coffins', done: 'All coffins smashed. Nobody rests in peace.' },
    { type: 'killType', enemy: 'ogre', label: 'Ogres', done: 'The ogres are dead. The crypt falls silent.' },
  ],
};
MAPS.studio = {
  name: 'The Studio', boss: 'host', rows: addBossRoom(studioRows(), '$'),
  briefing: 'Smash the four cameras and survive sixty seconds on air. New contestants keep arriving.',
  objectives: [
    { type: 'destroy', what: 'camera', label: 'Cameras', done: 'All cameras are gone. The audience boos.' },
    { type: 'survive', seconds: 60, label: 'On air', done: 'The broadcast is over. Time for the finale.' },
  ],
};
