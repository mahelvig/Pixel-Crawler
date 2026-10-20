"use strict";

// ---------- Sprites ----------
// Each letter is a colour from COLOR, a dot is transparent.

const PLAYER_TOP = {
  side: [
    '................',
    '.....KKKKKK.....',
    '....KUUUUUUK....',
    '....KUUUUUUK....',
    '....KUUhhhhK....',
    '....KUhhhKhK....',
    '....KUhhhKhK....',
    '.....KhhhhK.....',
    '....KbSbSbSK....',
    '....KbSbSbSK....',
    '....KbSbSbSK....',
    '....KnnnnnnK....',
  ],
  front: [
    '................',
    '.....KKKKKK.....',
    '....KUUUUUUK....',
    '....KUUUUUUK....',
    '....KUhhhhUK....',
    '....KhKhhKhK....',
    '....KhKhhKhK....',
    '.....KhhhhK.....',
    '....KbSbSbSK....',
    '....KbSbSbSK....',
    '....KbSbSbSK....',
    '....KnnnnnnK....',
  ],
  back: [
    '................',
    '.....KKKKKK.....',
    '....KUUUUUUK....',
    '....KUUUUUUK....',
    '....KUUUUUUK....',
    '....KUUUUUUK....',
    '....KUUUUUUK....',
    '.....KhhhhK.....',
    '....KbSbSbSK....',
    '....KbSbSbSK....',
    '....KbSbSbSK....',
    '....KnnnnnnK....',
  ],
};

const PLAYER_LEGS = {
  stand: [
    '....KnnKKnnK....',
    '....KSSKKSSK....',
    '.....KK..KK.....',
    '................',
  ],
  walk1: [
    '....KnnKKnnK....',
    '....KnnKKSSK....',
    '....KSSK.KK.....',
    '.....KK.........',
  ],
  walk2: [
    '....KnnKKnnK....',
    '....KSSKKnnK....',
    '.....KK.KSSK....',
    '.........KK.....',
  ],
};

const TARGET_ROWS = [
  '................',
  '.....KKKKKK.....',
  '....KWWWWWWK....',
  '...KWrrrrrrWK...',
  '...KWrWWWWrWK...',
  '...KWrWrrWrWK...',
  '...KWrWrrWrWK...',
  '...KWrWWWWrWK...',
  '...KWrrrrrrWK...',
  '....KWWWWWWK....',
  '.....KKKKKK.....',
  '.......KK.......',
  '.......UU.......',
  '.......UU.......',
  '.....KUUUUK.....',
  '................',
];

// The rat is seen from the side, facing right. It is mirrored when it walks left.
const RAT_BODY = [
  '..............',
  '.........KK...',
  '...KKKKKKsgK..',
  '..KggggggggrK.',
  'mKgggggggggggm',
  'm.KssssssssKK.',
];
const RAT_LEGS = [
  ['.m.KK..KK.....', '..............'],
  ['.m..KK..KK....', '..............'],
];

// The goblin uses the same legs as the player, just with green trousers and bare feet.
const GOBLIN_TOP = [
  '................',
  '.....KKKKKK.....',
  '....KllllllK....',
  '..KKKllllllKKK..',
  '..KlllyKlyKllK..',
  '...KKllllllKK...',
  '....KlKKKKlK....',
  '.....KllllK.....',
  '....KUxUUxUK....',
  '....KUUUUUUK....',
  '...KlKUUUUKlK...',
  '....KUUUUUUK....',
];

const HEART_ROWS = [
  '.KK.KK.',
  'KmrKrrK',
  'KrrrrrK',
  '.KrrrK.',
  '..KrK..',
  '...K...',
];

// pivot is where the hand holds it, muzzle is where the bullet comes out (in sprite pixels)
const WEAPON_IMAGES = {
  baseballBat: {
    rows: [
      '.........KKK.',
      '.KKKKKKKKuuuK',
      'KUUUKKKKKuuuK',
      'KUK......KKK.',
      'KKK..........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [11.5, 1.5],
  },
  revolver: {
    rows: [
      '.KKKKKKKK.',
      'KgSSSSSSgK',
      'KsKKKKKKK.',
      'KUK.......',
      'KKK.......',
    ],
    pivot: [1.5, 2.5],
    muzzle: [9.5, 1.5],
  },
  sniperRifle: {
    rows: [
      '....KKKKKK.....',
      '....KbbbbK.....',
      'KUUUKsssssssssK',
      'KUUK...........',
      'KKKK...........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [14.5, 2.5],
  },
  grenadeLauncher: {
    rows: [
      '.KKKKKKKKK..',
      'KGGGGGGGGGKK',
      'KgGGGGGGGgK.',
      'KUK.........',
      'KKK.........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [11.5, 1.5],
  },
  freezeRay: {
    rows: [
      '..KKKKK....',
      '.KcccccKKK.',
      'KnbbbbbKcWK',
      'KUK........',
      'KKK........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [10.5, 2.5],
  },
  ricochetPistol: {
    rows: [
      '..KKKKKK..',
      '.KyOOOOOKK',
      'KOOKKKKKcK',
      'KOK.......',
      'KKK.......',
    ],
    pivot: [1.5, 2.5],
    muzzle: [9.5, 1.5],
  },
  slingshot: {
    rows: [
      '......K.K',
      '......KUK',
      'KUUUUUUK.',
      'KUK......',
      'KKK......',
    ],
    pivot: [1.5, 2.5],
    muzzle: [8.5, 2.5],
  },
  crossbow: {
    rows: [
      '.........gK',
      '.........gK',
      'KUUUKKKKKgK',
      'KUK......gK',
      'KKK......gK',
    ],
    pivot: [1.5, 2.5],
    muzzle: [10.5, 2.5],
  },
  flamethrower: {
    rows: [
      '..KKK.......',
      '.KooOK......',
      'KsssKKKKKKoO',
      'KUK.........',
      'KKK.........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [11.5, 2.5],
  },
  minigun: {
    rows: [
      '.KKKKKKKKKK..',
      'KssggggggggKK',
      'KsKKKKKKKKKK.',
      'KUK..........',
      'KKK..........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [12.5, 1.5],
  },
  rocketLauncher: {
    rows: [
      'KKKKKKKKKKKK.',
      'KGGGGGGGGGGrK',
      'KGGGGGGGGGGKK',
      'KUK..........',
      'KKK..........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [12.5, 1.5],
  },
  rubberBandGun: {
    rows: [
      'KKKKKKKK.',
      'KuuuuuumK',
      'KUKKKKKK.',
      'KUK......',
      'KKK......',
    ],
    pivot: [1.5, 2.5],
    muzzle: [8.5, 1.5],
  },
  nailGun: {
    rows: [
      '.KKKKKKK..',
      'KOOOOOOOKK',
      'KOOKKKKKgK',
      'KOOK......',
      'KKKK......',
    ],
    pivot: [2, 3],
    muzzle: [9.5, 2],
  },
  potatoCannon: {
    rows: [
      '.KKKKKKKKKKK.',
      'KgSSSSSSSSSgK',
      'KgsssssssssgK',
      '.KKKUUKKKKKK.',
      '...KUUK......',
    ],
    pivot: [4.5, 3.5],
    muzzle: [12.5, 1.5],
  },
  shotgun: {
    rows: [
      'KKKKKKKKKKKKK',
      'KUUUUsSSSSSSK',
      'KUUKKKKKKKKKK',
      'KUK..........',
      'KKK..........',
    ],
    pivot: [1.5, 2.5],
    muzzle: [12.5, 1.5],
  },
  lightningGun: {
    rows: [
      '..KKKKK...',
      'KKnbbbbKKK',
      'KncccccWcK',
      'KnKKKKKKK.',
      'KKK.......',
    ],
    pivot: [1.5, 3],
    muzzle: [9.5, 2],
  },
};

const BULLET_IMAGES = {
  swing: ['.W.', 'WWW', '.W.'],
  slug: ['.o.', 'oyo', '.o.'],
  beam: ['WWW'],
  grenade: ['.GG.', 'GllG', 'GllG', '.GG.'],
  ice: ['.c.', 'cWc', '.c.'],
  spark: ['.y.', 'yWy', '.y.'],
  stone: ['.g.', 'gSg', '.g.'],
  bolt: ['.u.', 'uWu', '.u.'],
  flame: ['.o.', 'oOo', '.o.'],
  tracer: ['oy'],
  rocket: ['rrr', 'rWr', 'rrr'],
  rubberBand: ['.z.', 'z.z', '.z.'],
  nail: ['gWg'],
  potato: ['.uu.', 'utuu', 'uuuU', '.UU.'],
  pellet: ['y'],
  lightning: ['.c.', 'cWc', '.c.'],
};

// The mouse pointer in the bag.
const POINTER_ROWS = [
  'K.....',
  'KK....',
  'KWK...',
  'KWWK..',
  'KWWWK.',
  'KWWWWK',
  'KWWKKK',
  'KKK...',
];

// ---------- Pixel font (3x5, capital letters) ----------
// Rows beyond the five normal ones are accents (for example the ring on Å).

const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'], D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'], F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'], J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'], R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'], T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'], V: ['#.#', '#.#', '#.#', '.#.', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'], X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'], Z: ['###', '..#', '.#.', '#..', '###'],
  'Æ': ['.####', '#.#..', '####.', '#.#..', '#.###'],
  'Ø': ['.###', '#.##', '#.##', '##.#', '###.'],
  'Å': ['.#.', '...', '.#.', '#.#', '###', '#.#', '#.#'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'], 3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'], 9: ['###', '#.#', '###', '..#', '##.'],
  ' ': ['..', '..', '..', '..', '..'],
  '.': ['.', '.', '.', '.', '#'], ',': ['.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '#', '.'], ';': ['.', '#', '.', '#', '#'],
  '!': ['#', '#', '#', '.', '#'], "'": ['#', '#', '.', '.', '.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'], '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'], '=': ['...', '###', '...', '###', '...'],
  '/': ['..#', '..#', '.#.', '#..', '#..'], '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '(': ['.#', '#.', '#.', '#.', '.#'], ')': ['#.', '.#', '.#', '.#', '#.'],
  '[': ['##', '#.', '#.', '#.', '##'], ']': ['##', '.#', '.#', '.#', '##'],
  '"': ['#.#', '#.#', '...', '...', '...'], '×': ['...', '#.#', '.#.', '#.#', '...'],
  '<': ['..#', '.#.', '#..', '.#.', '..#'], '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '∞': ['.....', '.#.#.', '#.#.#', '.#.#.', '.....'],
};

// ---------- Finished images ----------

const PLAYER_IMAGES = {};
for (const direction in PLAYER_TOP) {
  PLAYER_IMAGES[direction] = ['stand', 'walk1', 'stand', 'walk2']
    .map(legs => createSprite([...PLAYER_TOP[direction], ...PLAYER_LEGS[legs]]));
}

// The player in the clothes they wear. The body rows (8-10) take the colours of the coat, the shoes of the legs take the colour of
// the footwear. Each combination is made once and kept (a is the main colour of the item, b the trim, g the gem).
const BODY_PATTERNS = { shirt: 'aaaaaa', coat: 'aabbaa', vest: 'baaaab' };
const dressedFrames = {};
function dressedPlayer(direction, step, body, feet) {
  const key = direction + step + '|' + (body || '') + '|' + (feet || '');
  if (dressedFrames[key]) return dressedFrames[key];
  const top = PLAYER_TOP[direction].slice(), legs = PLAYER_LEGS[['stand', 'walk1', 'stand', 'walk2'][step]].slice();
  if (body) {
    const look = GEAR[body].look, pattern = BODY_PATTERNS[look.shape] || 'aaaaaa';
    for (let r = 8; r <= 10; r++) {
      const cells = pattern.split('');
      if (r === 9 && look.g && direction !== 'back') cells[2] = 'g';
      top[r] = '....K' + cells.map(c => look[c] || look.a).join('') + 'K....';
    }
  }
  if (feet) {
    const look = GEAR[feet].look;
    for (let r = 0; r < legs.length; r++) legs[r] = legs[r].replace(/S/g, look.a);
  }
  return dressedFrames[key] = createSprite([...top, ...legs]);
}

const TARGET_IMAGE = createSprite(TARGET_ROWS);
const TARGET_WHITE = createSilhouette(TARGET_IMAGE, COLOR.W);
// The Landlord is a recoloured goblin: pale skin, a dark suit and a red tie.
const LANDLORD_TOP = GOBLIN_TOP.map(row => row.replace(/l/g, 'h').replace(/y/g, 'W').replace(/U/g, 'k').replace(/x/g, 'r'));

function scaleSprite(source, n) {
  const [c, g] = createCanvas(source.width * n, source.height * n);
  g.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

const BAT_FRAMES = [
  [
    '..K...K..',
    '.KPK.KPK.',
    'KPPPKPPPK',
    '.KPPPPPK.',
    '..KyPyK..',
    '...KKK...',
  ],
  [
    '.........',
    '.........',
    'KK.KKK.KK',
    'KPPPPPPPK',
    '.KPyPyPK.',
    '..KPPPK..',
  ],
];

// Humanoid enemies are the goblin sprite with other colours: top maps goblin colours, legs maps the leg colours.
function recolorRows(rows, map) {
  return rows.map(row => row.replace(/./g, ch => map[ch] || ch));
}

function humanoidFrames(top, legMap, scale, extra) {
  return ['stand', 'walk1', 'stand', 'walk2'].map(legs => {
    const image = createSprite([...recolorRows(GOBLIN_TOP, top), ...recolorRows(PLAYER_LEGS[legs], legMap)]);
    if (extra) extra(image.getContext('2d'));
    return scale > 1 ? scaleSprite(image, scale) : image;
  });
}

// A blob of slime: rx and ry are its size, and squish makes it wider and flatter for the second frame.
function makeSlimeImage(rx, ry, squish) {
  const w = 2 * rx + 3, h = 2 * ry + 3, cx = rx + 1, rx2 = squish ? rx + 1 : rx, ry2 = squish ? ry - 1 : ry, cy = h - 2 - ry2;
  const [c, g] = createCanvas(w, h);
  fillEllipse(g, cx, cy, rx2, ry2, COLOR.K);
  fillEllipse(g, cx, cy, rx2 - 1, ry2 - 1, COLOR.G);
  fillEllipse(g, cx, cy - 1, Math.max(1, rx2 - 2), Math.max(1, ry2 - 2), COLOR.l);
  g.fillStyle = COLOR.W; g.fillRect(cx - 2, cy - ry2 + 2, 2, 1);
  g.fillStyle = COLOR.K; g.fillRect(cx - 2, cy - 1, 1, 2); g.fillRect(cx + 1, cy - 1, 1, 2);
  return c;
}

// A little red imp with a lit fuse on its head.
function makeBomberImage(spark) {
  const [c, g] = createCanvas(12, 13);
  fillEllipse(g, 6, 8, 5, 4, COLOR.R);
  fillEllipse(g, 6, 8, 4, 3, COLOR.r);
  g.fillStyle = COLOR.m; g.fillRect(3, 6, 2, 1);
  g.fillStyle = COLOR.K; g.fillRect(4, 8, 1, 2); g.fillRect(7, 8, 1, 2);
  g.fillStyle = COLOR.y; g.fillRect(4, 8, 1, 1); g.fillRect(7, 8, 1, 1);
  g.fillStyle = COLOR.K; g.fillRect(3, 12, 2, 1); g.fillRect(7, 12, 2, 1);
  g.fillStyle = COLOR.U; g.fillRect(6, 3, 1, 2); g.fillRect(7, 2, 1, 1);
  g.fillStyle = spark ? COLOR.y : COLOR.W; g.fillRect(8, 1, 1, 1); g.fillRect(7, 1, 1, 1);
  return c;
}

const GHOST_FRAMES = [
  [
    '....SSSS....',
    '..SSWWWWSS..',
    '.SWWWWWWWWS.',
    '.SWKKWWKKWS.',
    '.SWKKWWKKWS.',
    '.SWWWWWWWWS.',
    '.SWWWKKWWWS.',
    '.SWWWKKWWWS.',
    '.SWWWWWWWWS.',
    '.SWWWWWWWWS.',
    '.SWWWWWWWWS.',
    '.SSWWSSWWSS.',
    '..S..SS..S..',
  ],
  [
    '....SSSS....',
    '..SSWWWWSS..',
    '.SWWWWWWWWS.',
    '.SWKKWWKKWS.',
    '.SWKKWWKKWS.',
    '.SWWWWWWWWS.',
    '.SWWWKKWWWS.',
    '.SWWWKKWWWS.',
    '.SWWWWWWWWS.',
    '.SWWWWWWWWS.',
    '.SWWWWWWWWS.',
    '.SWSSWWSSWS.',
    '...SS..SS...',
  ],
];

// ---------- Animals and insects (floors 6 to 8) ----------

// An ellipse with a dark outline around it.
function outlinedEllipse(g, cx, cy, rx, ry, color) {
  fillEllipse(g, cx, cy, rx + 1, ry + 1, COLOR.K);
  fillEllipse(g, cx, cy, rx, ry, color);
}

// An ant seen from the side, facing right. o.k makes it bigger, o.body and o.dark are its colours, o.crown gives it a crown.
function makeAntImage(frame, o) {
  const k = o.k || 1, at = v => Math.round(v * k), size = v => Math.max(1, Math.round(v * k));
  const [c, g] = createCanvas(at(14), at(8));
  g.fillStyle = COLOR.K;
  for (const x of [3, 5, 7]) g.fillRect(at(x + (frame ? 1 : 0)), at(6) - 1, size(1), size(2) + 1);
  g.fillRect(at(12), at(1), 1, size(2)); g.fillRect(at(13) - 1, at(0), 1, size(2));   // feelers
  outlinedEllipse(g, at(3), at(4), size(2), size(2), COLOR[o.body]);
  outlinedEllipse(g, at(7), at(4), size(1), size(1), COLOR[o.dark]);
  outlinedEllipse(g, at(10), at(4), size(2), size(2), COLOR[o.body]);
  g.fillStyle = COLOR.W; g.fillRect(at(11), at(3), size(1), size(1));
  g.fillStyle = COLOR.K; g.fillRect(at(12), at(5), size(1), size(1));
  if (o.crown) { g.fillStyle = COLOR.O; g.fillRect(at(9), at(1), size(3), size(1)); g.fillRect(at(9), at(0), size(1), size(1)); g.fillRect(at(11), at(0), size(1), size(1)); }
  return c;
}

// A wolf, facing right.
function makeWolfImage(frame) {
  const [c, g] = createCanvas(18, 11);
  for (const [x, shift] of [[4, 1], [6, -1], [10, -1], [12, 1]]) {
    const lx = x + (frame ? shift : 0);
    g.fillStyle = COLOR.K; g.fillRect(lx - 1, 7, 4, 4);
    g.fillStyle = COLOR.D; g.fillRect(lx, 7, 2, 3);
  }
  g.fillStyle = COLOR.K; g.fillRect(0, 2, 4, 3);                       // tail
  g.fillStyle = COLOR.s; g.fillRect(1, 3, 3, 1);
  outlinedEllipse(g, 8, 5, 6, 3, COLOR.s);                             // body
  g.fillStyle = COLOR.D; g.fillRect(4, 3, 8, 1);
  g.fillStyle = COLOR.g; g.fillRect(5, 7, 6, 1);
  g.fillStyle = COLOR.K; g.fillRect(12, 0, 2, 3); g.fillRect(15, 1, 2, 2);  // ears
  g.fillStyle = COLOR.D; g.fillRect(12, 1, 1, 2); g.fillRect(15, 2, 1, 1);
  outlinedEllipse(g, 14, 4, 2, 2, COLOR.s);                            // head
  g.fillStyle = COLOR.K; g.fillRect(16, 4, 2, 3);
  g.fillStyle = COLOR.g; g.fillRect(16, 5, 1, 1);
  g.fillStyle = COLOR.y; g.fillRect(14, 3, 1, 1);
  g.fillStyle = COLOR.W; g.fillRect(16, 7, 1, 1);
  return c;
}

// A wild boar with tusks, facing right.
function makeBoarImage(frame) {
  const [c, g] = createCanvas(22, 13);
  for (const [x, shift] of [[5, 1], [8, -1], [13, -1], [16, 1]]) {
    const lx = x + (frame ? shift : 0);
    g.fillStyle = COLOR.K; g.fillRect(lx - 1, 9, 4, 4);
    g.fillStyle = COLOR.U; g.fillRect(lx, 9, 2, 3);
  }
  g.fillStyle = COLOR.K; g.fillRect(0, 4, 3, 2);
  outlinedEllipse(g, 10, 6, 8, 4, COLOR.u);                            // body
  g.fillStyle = COLOR.U; g.fillRect(5, 2, 10, 1);
  g.fillRect(4, 3, 3, 1);
  outlinedEllipse(g, 17, 7, 3, 3, COLOR.u);                            // head
  g.fillStyle = COLOR.K; g.fillRect(14, 2, 3, 3);
  g.fillStyle = COLOR.U; g.fillRect(15, 3, 1, 2);
  g.fillStyle = COLOR.K; g.fillRect(19, 7, 3, 4);                      // snout
  g.fillStyle = COLOR.t; g.fillRect(20, 8, 1, 2);
  g.fillStyle = COLOR.W; g.fillRect(19, 10, 1, 2); g.fillRect(17, 11, 1, 1);   // tusks
  g.fillStyle = COLOR.W; g.fillRect(18, 5, 1, 1);
  g.fillStyle = COLOR.K; g.fillRect(19, 5, 1, 1);
  return c;
}

// A scorpion with its tail curled over its back, facing right.
function makeScorpionImage(frame) {
  const [c, g] = createCanvas(16, 12);
  g.fillStyle = COLOR.K;
  for (const x of [5, 7, 9]) g.fillRect(x + (frame ? 1 : 0), 9, 1, 3);
  const tail = [[3, 6, 3, 3], [1, 4, 3, 3], [1, 2, 3, 3], [2, 1, 4, 2], [5, 2, 3, 3]];
  for (const [x, y, w, h] of tail) g.fillRect(x - 1, y - 1, w + 2, h + 2);
  outlinedEllipse(g, 8, 7, 4, 2, COLOR.o);
  g.fillStyle = COLOR.K; g.fillRect(11, 5, 4, 4);
  for (const [x, y, w, h] of tail) { g.fillStyle = COLOR.o; g.fillRect(x, y, w, h); }
  g.fillStyle = COLOR.x; g.fillRect(2, 5, 1, 2); g.fillRect(2, 2, 1, 2);
  g.fillStyle = COLOR.r; g.fillRect(6, 3, 1, 2);                       // the sting
  outlinedEllipse(g, 14, 5, 1, 1, COLOR.o);                            // claws
  outlinedEllipse(g, 14, 9, 1, 1, COLOR.o);
  g.fillStyle = COLOR.o; g.fillRect(11, 6, 3, 2);
  g.fillStyle = COLOR.y; g.fillRect(10, 6, 1, 1);
  return c;
}

// A slot machine with a lever, 14x18.
function makeSlotMachineImage() {
  const [c, g] = createCanvas(14, 18);
  g.fillStyle = COLOR.K; g.fillRect(0, 0, 12, 18); g.fillRect(11, 5, 3, 2); g.fillRect(12, 2, 2, 4);
  g.fillStyle = COLOR.r; g.fillRect(1, 1, 10, 16);
  g.fillStyle = COLOR.R; g.fillRect(1, 15, 10, 2);
  g.fillStyle = COLOR.O; g.fillRect(2, 2, 8, 2);
  g.fillStyle = COLOR.y; g.fillRect(3, 2, 1, 1); g.fillRect(6, 2, 1, 1); g.fillRect(9, 2, 1, 1);
  g.fillStyle = COLOR.K; g.fillRect(2, 5, 8, 5);
  g.fillStyle = COLOR.W; g.fillRect(3, 6, 6, 3);
  g.fillStyle = COLOR.r; g.fillRect(3, 6, 2, 3);
  g.fillStyle = COLOR.O; g.fillRect(5, 6, 2, 3);
  g.fillStyle = COLOR.l; g.fillRect(7, 6, 2, 3);
  g.fillStyle = COLOR.y; g.fillRect(3, 11, 1, 1); g.fillRect(5, 11, 1, 1); g.fillRect(7, 11, 1, 1);
  g.fillStyle = COLOR.K; g.fillRect(3, 13, 6, 3);
  g.fillStyle = COLOR.D; g.fillRect(4, 14, 4, 1);
  g.fillStyle = COLOR.g; g.fillRect(12, 3, 1, 3);
  g.fillStyle = COLOR.r; g.fillRect(12, 2, 2, 2);
  return c;
}

// A mound of sand with a hole in the top, 16x10.
function makeAnthillImage() {
  const [c, g] = createCanvas(16, 10);
  outlinedEllipse(g, 8, 6, 7, 3, COLOR.t);
  fillEllipse(g, 8, 4, 5, 2, COLOR.a);
  g.fillStyle = COLOR.q; g.fillRect(3, 7, 10, 1);
  g.fillStyle = COLOR.K; g.fillRect(6, 3, 4, 2); g.fillRect(7, 5, 2, 1);
  g.fillStyle = COLOR.U; g.fillRect(2, 5, 1, 1); g.fillRect(12, 6, 1, 1); g.fillRect(10, 2, 1, 1); g.fillRect(4, 3, 1, 1);
  return c;
}

const ENEMY_IMAGES = {
  bandit: humanoidFrames({ l: 'h', y: 'W', U: 'u', x: 'r' }, { n: 'U', S: 'u' }, 1, g => {
    // a hat
    g.fillStyle = COLOR.K; g.fillRect(3, 2, 10, 1); g.fillRect(5, 0, 6, 2);
    g.fillStyle = COLOR.u; g.fillRect(4, 2, 8, 1); g.fillRect(6, 1, 4, 1);
  }),
  cardShark: humanoidFrames({ l: 't', y: 'W', U: 'K', x: 'r' }, { n: 'K', S: 'k' }, 1, g => {
    // a green dealer's visor
    g.fillStyle = COLOR.K; g.fillRect(4, 1, 8, 2);
    g.fillStyle = COLOR.G; g.fillRect(5, 1, 6, 1);
  }),
  bouncer: humanoidFrames({ l: 'H', y: 'W', U: 'K', x: 'k' }, { n: 'K', S: 'k' }, 1, g => {
    // dark glasses
    g.fillStyle = COLOR.K; g.fillRect(4, 4, 8, 2);
  }),
  dealer: humanoidFrames({ l: 't', y: 'W', U: 'K', x: 'r' }, { n: 'K', S: 'k' }, 2, g => {
    // a flat hat with a red band
    g.fillStyle = COLOR.K; g.fillRect(3, 0, 10, 3);
    g.fillStyle = COLOR.k; g.fillRect(4, 0, 8, 1);
    g.fillStyle = COLOR.r; g.fillRect(4, 1, 8, 1);
  }),
  hunter: humanoidFrames({ l: 'h', y: 'W', U: 'G', x: 'f' }, { n: 'f', S: 'G' }, 1, g => {
    // a green cap with a feather
    g.fillStyle = COLOR.K; g.fillRect(4, 1, 8, 2);
    g.fillStyle = COLOR.G; g.fillRect(5, 1, 6, 1);
    g.fillStyle = COLOR.r; g.fillRect(10, 0, 1, 2);
  }),
  beastmaster: humanoidFrames({ l: 'h', y: 'W', U: 'G', x: 'u' }, { n: 'U', S: 'G' }, 2, g => {
    // antlers
    g.fillStyle = COLOR.a;
    g.fillRect(3, 0, 1, 3); g.fillRect(2, 0, 1, 1); g.fillRect(12, 0, 1, 3); g.fillRect(13, 0, 1, 1);
  }),
  wolf: [makeWolfImage(0), makeWolfImage(1)],
  boar: [makeBoarImage(0), makeBoarImage(1)],
  ant: [makeAntImage(0, { body: 'U', dark: 'p' }), makeAntImage(1, { body: 'U', dark: 'p' })],
  antSoldier: [makeAntImage(0, { k: 1.4, body: 'x', dark: 'R' }), makeAntImage(1, { k: 1.4, body: 'x', dark: 'R' })],
  antQueen: [makeAntImage(0, { k: 1.4, body: 'x', dark: 'U', crown: true }), makeAntImage(1, { k: 1.4, body: 'x', dark: 'U', crown: true })].map(i => scaleSprite(i, 2)),
  scorpion: [makeScorpionImage(0), makeScorpionImage(1)],
  slime: [makeSlimeImage(6, 4, false), makeSlimeImage(6, 4, true)],
  slimeling: [makeSlimeImage(3, 2, false), makeSlimeImage(3, 2, true)],
  bomber: [makeBomberImage(true), makeBomberImage(false)],
  ghost: GHOST_FRAMES.map(rows => createSprite(rows)),
  knight: humanoidFrames({ l: 'g', y: 'c', U: 'D', x: 'S' }, { n: 's', S: 'g' }, 1, g => {
    // the shield on the side it faces
    g.fillStyle = COLOR.K; g.fillRect(12, 6, 4, 9);
    g.fillStyle = COLOR.g; g.fillRect(13, 7, 2, 7);
    g.fillStyle = COLOR.S; g.fillRect(13, 9, 2, 2);
  }),
  bat: BAT_FRAMES.map(rows => createSprite(rows)),
  spitter: humanoidFrames({ l: 'i', U: 'P', x: 'y' }, { n: 'P', S: 'i' }, 1),
  ogre: humanoidFrames({ l: 'q', y: 'W', U: 'u', x: 'O' }, { n: 'u', S: 'q' }, 2),
  janitor: humanoidFrames({ l: 'h', y: 'W', U: 'n', x: 'y' }, {}, 2),
  boneCollector: humanoidFrames({ l: 'S', U: 'D', x: 'r' }, { n: 'D' }, 2),
  host: humanoidFrames({ l: 't', y: 'W', U: 'P', x: 'O' }, { n: 'P', S: 'a' }, 2),
  landlord: ['stand', 'walk1', 'stand', 'walk2']
    .map(legs => scaleSprite(createSprite([...LANDLORD_TOP, ...PLAYER_LEGS[legs].map(row => row.replace(/n/g, 'k').replace(/S/g, 'D'))]), 2)),
  ratKing: RAT_LEGS.map(legs => scaleSprite(createSprite([...RAT_BODY, ...legs]), 2)),
  rat: RAT_LEGS.map(legs => createSprite([...RAT_BODY, ...legs])),
  goblin: ['stand', 'walk1', 'stand', 'walk2']
    .map(legs => createSprite([...GOBLIN_TOP, ...PLAYER_LEGS[legs].map(row => row.replace(/n/g, 'G').replace(/S/g, 'l'))])),
};
const ENEMY_WHITE = {};
for (const type in ENEMY_IMAGES) ENEMY_WHITE[type] = ENEMY_IMAGES[type].map(b => createSilhouette(b, COLOR.W));
// frozen enemies get an icy blue layer on top
const ENEMY_ICE = {};
for (const type in ENEMY_IMAGES) ENEMY_ICE[type] = ENEMY_IMAGES[type].map(b => createSilhouette(b, COLOR.c));
const HEART_FULL = createSprite(HEART_ROWS);
const HEART_EMPTY = createSprite(HEART_ROWS.map(row => row.replace(/[rm]/g, 'D')));
for (const name in WEAPON_IMAGES) WEAPON_IMAGES[name].image = createSprite(WEAPON_IMAGES[name].rows);
// weapons lying on the floor get an outline in the rarity colour
const WEAPON_GLOW = {};
for (const name in WEAPONS) WEAPON_GLOW[name] = createSilhouette(WEAPON_IMAGES[WEAPONS[name].image].image, RARITY[WEAPONS[name].rarity].color);
const BULLET_SPRITES = {};
for (const name in BULLET_IMAGES) BULLET_SPRITES[name] = createSprite(BULLET_IMAGES[name]);
const POINTER = createSprite(POINTER_ROWS);

const FONT_PIXELS = {};
for (const [ch, rows] of Object.entries(FONT)) {
  const lift = rows.length - 5, px = [];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') px.push(x, y - lift); });
  FONT_PIXELS[ch] = { b: rows[0].length, px };
}

// ---------- Breakables and pickups (drawn from shapes) ----------

// A filled ellipse, one row at a time.
function fillEllipse(g, cx, cy, rx, ry, color) {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1);
  }
}

function makeNestImage() {
  const [c, g] = createCanvas(16, 14);
  fillEllipse(g, 8, 9, 8, 5, COLOR.U);
  fillEllipse(g, 8, 8, 7, 4, COLOR.u);
  for (let i = 0; i < 30; i++) {
    const x = 2 + Math.floor(hash(i, 1, 3) * 12), y = 5 + Math.floor(hash(i, 2, 3) * 8);
    if (((x - 8) / 7) ** 2 + ((y - 8) / 4) ** 2 > 1) continue;
    g.fillStyle = i % 3 === 0 ? COLOR.a : i % 3 === 1 ? COLOR.t : COLOR.S;
    g.fillRect(x, y, i % 3 === 2 ? 2 : 1, 1);
  }
  fillEllipse(g, 8, 8, 4, 2, COLOR.K);
  g.fillStyle = COLOR.z;
  g.fillRect(6, 8, 1, 1); g.fillRect(10, 8, 1, 1);
  return c;
}

function makeCoffinImage() {
  const [c, g] = createCanvas(12, 20);
  const widths = [6, 8, 10, 12, 12, 12, 12, 12, 12, 12, 12, 12, 10, 10, 10, 8, 8, 6, 6, 4];
  widths.forEach((w, y) => {
    const x0 = (12 - w) >> 1;
    g.fillStyle = COLOR.K;
    g.fillRect(x0, y, w, 1);
    if (y > 0 && y < 19) {
      g.fillRect(x0, y, 1, 1); g.fillRect(x0 + w - 1, y, 1, 1);
      g.fillStyle = y % 5 === 0 ? COLOR.U : COLOR.u;
      g.fillRect(x0 + 1, y, w - 2, 1);
    }
  });
  g.fillStyle = COLOR.O;
  g.fillRect(5, 4, 2, 10); g.fillRect(3, 6, 6, 2);
  g.fillStyle = COLOR.K;
  g.fillRect(8, 11, 1, 1); g.fillRect(9, 12, 1, 1); g.fillRect(8, 13, 1, 1);
  return c;
}

function makeCameraImage() {
  const [c, g] = createCanvas(14, 18);
  g.fillStyle = COLOR.K;
  for (let y = 10; y < 18; y++) {
    const spread = Math.round((y - 10) * 5 / 7);
    g.fillRect(7 - spread, y, 1, 1); g.fillRect(7, y, 1, 1); g.fillRect(6 + spread, y, 1, 1);
  }
  g.fillRect(2, 3, 10, 8);
  g.fillStyle = COLOR.D;
  g.fillRect(3, 4, 8, 6);
  g.fillStyle = COLOR.K;
  g.fillRect(4, 1, 6, 2);
  g.fillStyle = COLOR.g;
  g.fillRect(0, 5, 3, 4);
  g.fillStyle = COLOR.W;
  g.fillRect(1, 6, 1, 1);
  g.fillStyle = COLOR.r;
  g.fillRect(9, 5, 2, 2);
  return c;
}

function makeFuseImage() {
  const [c, g] = createCanvas(6, 9);
  g.fillStyle = COLOR.s;
  g.fillRect(1, 0, 4, 2); g.fillRect(1, 7, 4, 2);
  g.fillStyle = COLOR.y;
  g.fillRect(0, 2, 6, 5);
  g.fillStyle = COLOR.W;
  g.fillRect(1, 3, 1, 3);
  g.fillStyle = COLOR.O;
  g.fillRect(4, 3, 1, 3);
  return c;
}

const BREAKABLE_IMAGES = { nest: makeNestImage(), coffin: makeCoffinImage(), camera: makeCameraImage(), slot: makeSlotMachineImage(), anthill: makeAnthillImage() };
const BREAKABLE_WHITE = {};
for (const kind in BREAKABLE_IMAGES) BREAKABLE_WHITE[kind] = createSilhouette(BREAKABLE_IMAGES[kind], COLOR.W);
const FUSE_IMAGE = makeFuseImage();

// ---------- Pressure gauges (the targets in the boiler room) ----------

// A brass pressure gauge on a pipe, 16x16 like the shooting target. The needle points into the red while the
// pressure is wrong, and into the green once it has been hit and fixed.
function makeGaugeImage(needleAngle, fixed) {
  const [c, g] = createCanvas(16, 16);
  const px = (x, y, color) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  // the pipe it sits on, with a flange at the bottom
  g.fillStyle = COLOR.s; g.fillRect(6, 11, 4, 5);
  g.fillStyle = COLOR.g; g.fillRect(6, 11, 1, 5);
  g.fillStyle = COLOR.D; g.fillRect(9, 11, 1, 5);
  g.fillStyle = COLOR.K; g.fillRect(4, 14, 8, 1);
  g.fillStyle = COLOR.g; g.fillRect(4, 13, 8, 1);
  g.fillStyle = COLOR.s; g.fillRect(4, 15, 8, 1);
  // the brass case and the white face
  fillEllipse(g, 8, 6, 6, 6, COLOR.K);
  fillEllipse(g, 8, 6, 5, 5, COLOR.o);
  fillEllipse(g, 8, 6, 4, 4, COLOR.O);
  fillEllipse(g, 8, 6, 3, 3, COLOR.W);
  // the scale: green on the left, yellow at the top, red on the right
  const zone = [[195, COLOR.l], [170, COLOR.l], [145, COLOR.l], [115, COLOR.y], [90, COLOR.y], [65, COLOR.y], [40, COLOR.r], [15, COLOR.r], [-10, COLOR.r]];
  for (const [deg, color] of zone) px(8 + Math.cos(deg * Math.PI / 180) * 3, 6 - Math.sin(deg * Math.PI / 180) * 3, color);
  // the needle
  const a = needleAngle * Math.PI / 180;
  for (let i = 0; i <= 3; i++) px(8 + Math.cos(a) * i, 6 - Math.sin(a) * i, COLOR.K);
  px(8, 6, COLOR.K);
  // a lamp: red while broken, green when fixed
  g.fillStyle = COLOR.K; g.fillRect(12, 0, 4, 4);
  g.fillStyle = fixed ? COLOR.l : COLOR.r; g.fillRect(13, 1, 2, 2);
  if (fixed) { px(13, 1, COLOR.W); }
  return c;
}

const GAUGE_BAD = [makeGaugeImage(28, false), makeGaugeImage(8, false)];
const GAUGE_FIXED = makeGaugeImage(165, true);
const GAUGE_WHITE = { bad: GAUGE_BAD.map(i => createSilhouette(i, COLOR.W)), fixed: createSilhouette(GAUGE_FIXED, COLOR.W) };
