"use strict";

// ---------- Map ----------
// # wall   = wall with window   . parquet   , kitchen tile   ~ carpet   : concrete
// B bookshelf   P plant   T table   S sofa   b bed   K kitchen counter   O stove   V sink
// F fridge   k crate   @ start   X target (shooting target)   r rat   g goblin   w random weapon
// N rat nest   C coffin   Q TV camera   f fuse   m slime   i bomber   h ghost   n knight   e random clothes
// D gate to the boss room   M boss spawn   > stairs down (hidden until the boss is dead)
// Floors 6 to 8: p saloon boards   l card-table felt   y grass   d dirt   _ sand   R barrel   Y tree   E cactus   I rock
// W poker table   H slot machine   A anthill   x bandit   v card shark   u bouncer   q boar   j hunter   L wolf
// Z ant   z ant soldier   c scorpion

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
  'p': { floor: 'planks' },
  'l': { floor: 'felt' },
  'y': { floor: 'grass' },
  'd': { floor: 'dirt' },
  '_': { floor: 'sand' },
  'R': { furniture: 'barrel' },
  'Y': { furniture: 'tree' },
  'E': { furniture: 'cactus' },
  'I': { furniture: 'rock' },
  'W': { furniture: 'pokertable' },
  'H': { breakable: 'slot' },
  'A': { breakable: 'anthill' },
  'x': { enemy: 'bandit' },
  'v': { enemy: 'cardShark' },
  'u': { enemy: 'bouncer' },
  'q': { enemy: 'boar' },
  'j': { enemy: 'hunter' },
  'L': { enemy: 'wolf' },
  'Z': { enemy: 'ant' },
  'z': { enemy: 'antSoldier' },
  'c': { enemy: 'scorpion' },
};

// The floors, in the order the player goes through them.
const LEVEL_ORDER = ['apartment', 'sewers', 'boiler', 'catacombs', 'studio', 'casino', 'hunting', 'hive'];

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

// ---------- Floors 6 to 8 ----------

// The floor characters that things can be put on.
const FREE_FLOORS = 'plyd_.:,~%&$';

// Paints a rectangle with another floor, leaving walls and furniture alone.
function paintFloor(g, x0, y0, x1, y1, c) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (FREE_FLOORS.includes(g[y][x])) g[y][x] = c;
}

// Like place, but also for floors that are not the main floor of the map.
function putOn(g, list, c) {
  for (const [x, y] of list) {
    if (!FREE_FLOORS.includes(g[y][x])) throw new Error('Map: cannot put ' + c + ' at ' + x + ',' + y + ' (found ' + g[y][x] + ')');
    g[y][x] = c;
  }
}

// Puts n of something on free floor inside a rectangle, at places picked by a fixed pattern (so the map is the same every time).
function sprinkle(g, c, n, x0, y0, x1, y1, seed) {
  // (hash lives in graphics.js, which is loaded after the maps are built)
  const hash = (x, y, s) => {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  let done = 0;
  for (let i = 0; done < n && i < n * 80; i++) {
    const x = x0 + Math.floor(hash(i, seed, 1) * (x1 - x0 + 1)), y = y0 + Math.floor(hash(seed, i, 2) * (y1 - y0 + 1));
    if (!FREE_FLOORS.includes(g[y][x])) continue;
    g[y][x] = c;
    done++;
  }
  if (done < n) throw new Error('Map: only room for ' + done + ' of ' + n + ' ' + c);
}

// Floor 6: a casino. A walled gaming hall with poker tables and a bar in the middle, and a long corridor around it.
function casinoRows() {
  const g = emptyGrid(48, 26, 'p');
  paintFloor(g, 14, 5, 33, 19, 'l');
  hWall(g, 4, 13, 34, [[21, 26]]);
  hWall(g, 20, 13, 34, [[21, 26]]);
  vWall(g, 13, 4, 20, [[10, 14]]);
  vWall(g, 34, 4, 20, [[10, 14]]);
  putOn(g, [[3, 3]], '@');
  putOn(g, Array.from({ length: 16 }, (_, i) => [16 + i, 6]), 'K');
  for (const [x0, y0] of [[17, 9], [27, 9], [17, 14], [27, 14]]) putOn(g, [[x0, y0], [x0 + 1, y0], [x0 + 2, y0], [x0 + 3, y0], [x0, y0 + 1], [x0 + 1, y0 + 1], [x0 + 2, y0 + 1], [x0 + 3, y0 + 1]], 'W');
  putOn(g, [[2, 9], [2, 16], [45, 9], [45, 16]], 'H');
  putOn(g, [[6, 22], [7, 22], [41, 22], [42, 22], [44, 2], [10, 2], [38, 6], [8, 12], [5, 13]], 'R');
  putOn(g, [[18, 18], [31, 18], [24, 11]], 'k');
  sprinkle(g, 'x', 7, 1, 1, 46, 24, 11);
  sprinkle(g, 'v', 4, 1, 1, 46, 24, 12);
  sprinkle(g, 'u', 3, 1, 1, 46, 24, 13);
  sprinkle(g, 'g', 3, 1, 1, 46, 24, 14);
  sprinkle(g, 'i', 3, 1, 1, 46, 24, 15);
  sprinkle(g, 'w', 3, 1, 1, 46, 24, 16);
  sprinkle(g, 'e', 2, 1, 1, 46, 24, 17);
  return gridRows(g);
}

// Floor 7: an open hunting ground of grass and trees, cut into three strips by two long hedges.
// You walk along the first strip, through a gap, back along the second, and through another gap to the third.
function huntingRows() {
  const g = emptyGrid(52, 28, 'y');
  hWall(g, 9, 1, 50, [[40, 44]]);
  hWall(g, 18, 1, 50, [[4, 8]]);
  paintFloor(g, 2, 2, 44, 4, 'd'); paintFloor(g, 41, 5, 43, 12, 'd'); paintFloor(g, 6, 12, 43, 14, 'd');
  paintFloor(g, 5, 15, 7, 21, 'd'); paintFloor(g, 5, 20, 40, 22, 'd'); paintFloor(g, 24, 23, 27, 26, 'd');
  putOn(g, [[3, 3]], '@');
  for (const [cx, cy] of [[12, 6], [22, 3], [30, 6], [36, 2], [10, 14], [20, 12], [30, 16], [47, 14], [12, 24], [20, 20], [34, 24], [46, 22], [47, 5], [3, 12], [14, 21]]) {
    putOn(g, [[cx, cy], [cx + 1, cy], [cx, cy + 1]], 'Y');
  }
  putOn(g, [[26, 6], [27, 6], [16, 15], [38, 12], [28, 21], [42, 25], [8, 6]], 'I');
  putOn(g, [[28, 8], [8, 4], [24, 16], [36, 11], [16, 24]], 'X');
  sprinkle(g, 'L', 8, 1, 1, 50, 26, 21);
  sprinkle(g, 'q', 5, 1, 1, 50, 26, 22);
  sprinkle(g, 'j', 5, 1, 1, 50, 26, 23);
  sprinkle(g, 's', 2, 1, 1, 50, 26, 24);
  sprinkle(g, 'a', 3, 1, 1, 50, 26, 25);
  sprinkle(g, 'w', 3, 1, 1, 50, 26, 26);
  sprinkle(g, 'e', 2, 1, 1, 50, 26, 27);
  return gridRows(g);
}

// Floor 8: a hive of sand chambers, eight rooms joined by narrow tunnels, with a tunnel along the bottom.
function hiveRows() {
  const g = emptyGrid(52, 28, '_');
  vWall(g, 13, 1, 25, [[6, 8], [17, 19]]);
  vWall(g, 26, 1, 25, [[11, 13], [21, 23]]);
  vWall(g, 39, 1, 25, [[5, 7], [15, 17]]);
  hWall(g, 13, 1, 50, [[5, 9], [18, 21], [30, 34], [44, 47]]);
  putOn(g, [[3, 3]], '@');
  putOn(g, [[8, 10], [20, 4], [33, 18], [45, 22]], 'A');
  putOn(g, [[5, 2], [10, 11], [18, 9], [23, 17], [30, 3], [36, 10], [43, 4], [48, 11], [6, 20], [16, 24], [29, 25], [48, 18], [34, 22]], 'E');
  putOn(g, [[11, 5], [22, 11], [31, 8], [43, 9], [4, 16], [16, 17], [24, 21], [36, 16], [46, 25], [8, 24]], 'I');
  sprinkle(g, 'Z', 14, 1, 1, 50, 26, 31);
  sprinkle(g, 'z', 4, 1, 1, 50, 26, 32);
  sprinkle(g, 'c', 5, 1, 1, 50, 26, 33);
  sprinkle(g, 'o', 1, 1, 1, 50, 26, 34);
  sprinkle(g, 'w', 3, 1, 1, 50, 26, 35);
  sprinkle(g, 'e', 2, 1, 1, 50, 26, 36);
  return gridRows(g);
}

MAPS.casino = {
  name: 'The Desperado Club', boss: 'dealer', rows: addBossRoom(casinoRows(), 'p'),
  briefing: 'The house cheats. Smash the four slot machines (something lives inside them), then deal with the card sharks.',
  objectives: [
    { type: 'destroy', what: 'slot', label: 'Machines', done: 'All machines smashed. The house is furious.' },
    { type: 'killType', enemy: 'cardShark', label: 'Sharks', done: 'The card sharks are dead. The house loses, for once.' },
  ],
};
MAPS.hunting = {
  name: 'The Hunting Grounds', boss: 'beastmaster', rows: addBossRoom(huntingRows(), 'y'),
  briefing: 'Hunter or hunted? Shoot the five trophy boards and thin out the wolf pack. Mind the boars.',
  objectives: [
    { type: 'targets', label: 'Trophies', done: 'All trophies claimed. Somebody will be annoyed.' },
    { type: 'killType', enemy: 'wolf', label: 'Wolves', done: 'The pack is gone. The forest is quiet. Too quiet.' },
  ],
};
MAPS.hive = {
  name: 'The Scorched Hive', boss: 'antQueen', rows: addBossRoom(hiveRows(), '_'),
  briefing: 'The hive never stops sending ants. Destroy all four anthills and kill the soldiers.',
  objectives: [
    { type: 'destroy', what: 'anthill', label: 'Anthills', done: 'The anthills are rubble. The queen is not pleased.' },
    { type: 'killType', enemy: 'antSoldier', label: 'Soldiers', done: 'No more soldiers. Only the queen is left.' },
  ],
};
