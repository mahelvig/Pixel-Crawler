"use strict";

// ---------- The bestiary ----------
// A tab of the statistics page (see stats.js) with a small picture of every kind of enemy and of every elite trait. Something shows
// up once you have met it (it came into sight, saved.stats.seen and seenElites, see track in achievements.js); the rest are question
// marks. Pick one to read what it does and what the dungeon thinks of it.

const ENEMY_LORE = {
  rat: 'A rat. The oldest employee in the dungeon and the most reliable. It has never once been promoted.',
  goblin: 'Goblins do the dungeon\'s paperwork, mostly by stabbing it into you. Unionised, in theory.',
  bat: 'Fast, fragile and extremely rude. Do not look it in the eyes. It has several.',
  spitter: 'Keeps its distance and spits whatever the building\'s plumbing was holding. Aim for the face. Not yours.',
  ogre: 'The superintendent\'s nephew, before. Hits like an eviction. Slow, so please use that.',
  slime: 'Leftover from a leak nobody reported. When it dies it falls apart into smaller, angrier problems.',
  slimeling: 'A little piece of a slime. It has all of the grudge and none of the size.',
  ghost: 'A former tenant who still owes rent. Floats through walls and ignores the lease and the laws of physics.',
  bomber: 'A cheerful fellow with a short fuse and a shorter career. Please do not hug it.',
  knight: 'Armour from the lost-and-found. The shield stops shots from the front. The back is not listed.',
  bandit: 'Casino regular with a knife and a grudge about the buffet. Quick on his feet, light on his wallet.',
  cardShark: 'Deals you a hand, then deals you a hand. Bad odds either way. Keeps its distance and counts your cards.',
  bouncer: 'Not on the list. You are not on the list. He is very large and very sure about the list.',
  boar: 'Snorts, shakes, then charges across the room. The shaking is the warning. Use it.',
  hunter: 'Wears a lot of camouflage and is still easy to spot. Shoots from range and hates being shot back.',
  wolf: 'Fast, hungry and under the impression you are dinner. The viewers love the wolves. The wolves do not love you.',
  ant: 'One ant is a nuisance. The hive does not believe in one ant. Small, quick, and always more of them.',
  antSoldier: 'An ant with a promotion and an attitude. Armoured, annoyed and carrying the colony\'s complaints.',
  scorpion: 'Prefers ranged complaints. Stings from a safe distance, which is cowardly and very effective.',
  landlord: 'Owns the building, the lease and now the dungeon. His favourite phrase is "not my responsibility".',
  ratKing: 'A crown of cheese wrappers and a court of rats. Unfortunately he is the legitimate king.',
  janitor: 'Has cleaned this dungeon for forty years and has opinions about the mess you are about to make.',
  boneCollector: 'Collects bones. Has a lot. Would like one of yours to complete the set.',
  host: 'Hosts the show you are starring in. Loves an audience. Hates a surprise guest, which is you.',
  dealer: 'The house always wins. The dealer is the house. The house is on your back now.',
  beastmaster: 'Runs the hunting grounds with a whistle and a leash. The leash is for show. The animals are not.',
  snowman: 'Built by somebody with a lot of free time and a grudge. Throws snowballs. The snowballs have rocks in them.',
  yeti: 'Not a myth, a municipal employee. Charges from across the room, then looks surprised that you are not frozen.',
  santa: 'Works one day a year and has strong feelings about the other 364. His list has one name on it. It is yours.',
  guard: 'Behind a riot shield and behind on his rent. The front is armoured. The back, as ever, is not.',
  inmate: 'Serving 40 years for something he swears was a misunderstanding. Wants out. You are, regrettably, in the way.',
  warden: 'Has run this block for thirty years and has not once been wrong, according to the warden.',
  tome: 'A book that was never returned and has become bitter about it. Flies, flaps, and fires three pages at a time.',
  scribe: 'Writes everything down, including your death. Prefers to do it from a safe distance.',
  archivist: 'Keeps the forbidden section forbidden. You are in the forbidden section. This is a problem for you.',
  drone: 'A flying camera with a gun, because the viewers asked for a closer shot. Fast, jumpy and always filming.',
  sentry: 'Armoured, patient and programmed to say nothing. It does not say nothing. It says it with three bullets.',
  overseer: 'The eye of the dungeon. It has watched every floor and every death. You are, it admits, its favourite.',
  antQueen: 'The mother of the hive. Every ant in the dungeon answers to her. She did not ask for this either.',
};

const ELITE_LORE = {
  swift: 'Moves and strikes faster than it should. The dungeon calls it "performance related pay".',
  juggernaut: 'Built like a vending machine and just as hard to push around. Lots of life. Be patient.',
  vicious: 'Hits harder and notices you from further away. Has been told it has anger issues. Disagrees, loudly.',
  volatile: 'Explodes when it dies. This is a feature, and it is on the packaging. Back away before the last shot.',
  regenerating: 'Mends itself when left alone. If you stop shooting it to reload, it takes that personally.',
  summoner: 'Calls bats whenever it has a free moment. Treat it like a bad manager: remove it first.',
};

// every entry of the book: normal enemies, then bosses, then the elite traits
const bestiaryEntries = () => [
  ...Object.keys(ENEMIES).filter(id => !ENEMIES[id].boss).map(id => ({ kind: 'enemy', id })),
  ...Object.keys(ENEMIES).filter(id => ENEMIES[id].boss).map(id => ({ kind: 'enemy', id })),
  ...Object.keys(ELITES).map(id => ({ kind: 'elite', id })),
];

function bestiaryMet(e) {
  const s = saved.stats;
  return e.kind === 'elite' ? !!s.seenElites[e.id] : !!(s.seen[e.id] || s.killsBy[e.id] || s.bossTypes[e.id]);
}

const bestiary = { sel: 0 };
const BESTIARY_COLUMNS = 9, BESTIARY_ROWS = 5, CELL = 18, CELL_STEP = 19;
const bestiaryCell = i => ({ x: 10 + (i % BESTIARY_COLUMNS) * CELL_STEP, y: 48 + Math.floor(i / BESTIARY_COLUMNS) * CELL_STEP, w: CELL, h: CELL });

function clickBestiary() {
  const n = bestiaryEntries().length;
  for (let i = 0; i < n; i++) if (inBox(bestiaryCell(i))) { bestiary.sel = i; sfx('uiClick'); return; }
}

function bestiaryMove(delta) {
  const n = bestiaryEntries().length;
  bestiary.sel = (bestiary.sel + delta + n) % n;
  sfx('uiClick');
}

// a picture of the enemy that fits in a box of the given size
function drawEnemyPicture(type, x, y, size, scale) {
  const image = ENEMY_IMAGES[type][0], fit = Math.min(scale, size / Math.max(image.width, image.height)), w = Math.round(image.width * fit), h = Math.round(image.height * fit);
  ctx.drawImage(image, Math.round(x + (size - w) / 2), Math.round(y + (size - h) / 2), w, h);
}

function drawEliteMark(id, x, y, size) {
  const color = COLOR[ELITES[id].color], c = Math.floor(size / 2);
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(x + c - 5, y + c - 1, 11, 3); ctx.fillRect(x + c - 1, y + c - 5, 3, 11);
  ctx.fillStyle = color;
  ctx.fillRect(x + c - 4, y + c, 9, 1); ctx.fillRect(x + c, y + c - 4, 1, 9);
  ctx.fillRect(x + c - 1, y + c - 1, 3, 3);
}

// How strong an enemy is, in a few numbers.
function enemyFacts(id) {
  const t = ENEMIES[id], hit = Math.max(t.damage || 0, t.shotDamage || 0, t.bomber ? t.bomber.damage : 0, t.dash ? t.dash.damage : 0);
  return 'Life ' + t.life + '  Dmg ' + hit;
}

function drawBestiary() {
  const entries = bestiaryEntries(), sel = entries[bestiary.sel], s = saved.stats;
  entries.forEach((e, i) => {
    const c = bestiaryCell(i), met = bestiaryMet(e), on = i === bestiary.sel, hover = inBox(c);
    ctx.fillStyle = 'rgba(24,20,37,0.85)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    border(c.x, c.y, c.w, c.h, on ? COLOR.O : hover ? COLOR.W : (e.kind === 'enemy' && ENEMIES[e.id].boss) ? COLOR.s : COLOR.D);
    if (!met) drawText('?', c.x + c.w / 2, c.y + 6, COLOR.D, { align: 'center', shadow: null });
    else if (e.kind === 'enemy') drawEnemyPicture(e.id, c.x + 2, c.y + 2, c.w - 4, 1);
    else drawEliteMark(e.id, c.x, c.y, c.w);
  });
  const met = entries.filter(bestiaryMet).length;
  drawText('Met ' + met + ' of ' + entries.length, 10, 48 + BESTIARY_ROWS * CELL_STEP + 3, COLOR.g);
  drawText('Click an entry to read about it.', 10, 48 + BESTIARY_ROWS * CELL_STEP + 13, COLOR.D);

  // the page about the chosen one
  const px = 180, py = 46, pw = 130, ph = 114, known = bestiaryMet(sel);
  ctx.fillStyle = 'rgba(38,43,68,0.6)';
  ctx.fillRect(px, py, pw, ph);
  const boss = sel.kind === 'enemy' && ENEMIES[sel.id].boss, color = sel.kind === 'elite' ? COLOR[ELITES[sel.id].color] : boss ? COLOR.O : COLOR.S;
  border(px, py, pw, ph, known ? color : COLOR.D);
  if (!known) {
    drawText('???', px + 6, py + 6, COLOR.D, { scale: 2 });
    wrapLines('You have not met this one yet. Keep crawling.', pw - 12).forEach((l, i) => drawText(l, px + 6, py + 26 + i * 8, COLOR.g));
    return;
  }
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(px + 5, py + 5, 32, 32);
  border(px + 5, py + 5, 32, 32, COLOR.D);
  if (sel.kind === 'enemy') drawEnemyPicture(sel.id, px + 7, py + 7, 28, 2);
  else drawEliteMark(sel.id, px + 5, py + 5, 32);
  const tx = px + 42;
  if (sel.kind === 'enemy') {
    const t = ENEMIES[sel.id], count = boss ? (s.bossTypes[sel.id] || 0) : (s.killsBy[sel.id] || 0);
    wrapLines(t.name, pw - 48).forEach((l, i) => drawText(l, tx, py + 6 + i * 8, COLOR.W));
    drawText(boss ? 'Boss' : 'Monster', tx, py + 22, color);
    drawText(boss ? 'Beaten ' + count + 'x' : 'Killed ' + formatCount(count), tx, py + 30, COLOR.g);
    drawText(enemyFacts(sel.id) + '  Spd ' + t.speed, px + 6, py + 42, COLOR.y);
    wrapLines(ENEMY_LORE[sel.id] || '', pw - 12).forEach((l, i) => drawText(l, px + 6, py + 54 + i * 8, COLOR.a));
  } else {
    const e = ELITES[sel.id];
    drawText(e.name, tx, py + 6, color);
    drawText('Elite trait', tx, py + 14, COLOR.S);
    drawText(e.life + 'x life', tx, py + 22, COLOR.g);
    wrapLines(ELITE_LORE[sel.id], pw - 12).forEach((l, i) => drawText(l, px + 6, py + 44 + i * 8, COLOR.a));
    drawText('Any normal enemy can have it.', px + 6, py + ph - 10, COLOR.g);
  }
}
