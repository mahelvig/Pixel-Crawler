"use strict";

// ---------- Objectives ----------
// Every floor has its own objectives (see MAPS in map.js). When all of them are done the gate to the boss room opens.
//   kill      kill every normal enemy on the floor
//   targets   hit every shooting target
//   destroy   shoot every breakable of one kind (what) to pieces
//   collect   pick up every pickup of one kind (what)
//   killType  kill every enemy of one type (enemy)
//   survive   stay alive for a number of seconds, while new enemies keep arriving
//   cull      kill a number of enemies (count)       killElite   kill every elite on the floor
//   escort    lead a survivor to the way out (see npc.js; prisoners in cages are a destroy objective of the kind cage)
// The objectives of a floor are chosen every time it is built, see rollObjectives below.

const countBy = (list, key) => list.reduce((counts, item) => { counts[item[key]] = (counts[item[key]] || 0) + 1; return counts; }, {});

// The text for the counter on the screen, and whether the objective is done.
function objectiveStatus(o) {
  const w = world, label = o.label;
  const count = (text, n, total) => ({ text: text + ' ' + Math.min(n, total) + '/' + total, done: n >= total });
  switch (o.type) {
    case 'kill': return count('Enemies', w.killed, w.enemyTotal);
    case 'targets': return count(label || 'Targets', w.targetsHit, w.targets.length);
    case 'destroy': return count(label, w.destroyed[o.what] || 0, w.totals.destroy[o.what] || 0);
    case 'collect': return count(label, w.collected[o.what] || 0, w.totals.collect[o.what] || 0);
    case 'killType': return count(label, w.killedByType[o.enemy] || 0, w.totals.killType[o.enemy] || 0);
    case 'cull': return count(label, w.killed, o.count);
    case 'escort': return count(label, w.npcSafe + w.npcLost, w.totals.npcs);
    case 'killElite': return count(label, w.eliteKilled, w.totals.elites);
    case 'survive': return count(label, Math.floor(w.surviveTime), o.seconds);
  }
  return { text: '?', done: true };
}

function objectiveLines() {
  return (world.level.objectives || []).map(objectiveStatus);
}

function updateObjectives(dt) {
  const objectives = world.level.objectives || [];
  const survive = objectives.find(o => o.type === 'survive');
  if (survive && !objectiveStatus(survive).done) {
    world.surviveTime += dt;
    world.waveTime -= dt;
    if (world.waveTime <= 0) { spawnWave(); world.waveTime = 7; }
  }
  let all = true;
  objectives.forEach((o, i) => {
    const status = objectiveStatus(o);
    if (status.done && !world.objectiveDone[i]) {
      world.objectiveDone[i] = true;
      sfx('objective');
      gainExp(EXP.objective);
      track('objective');
      awardGold(EXP.objectiveGold, true);
      if (o.done) systemMessage(o.done);
    }
    if (!status.done) all = false;
  });
  if (all && !world.gateOpen && world.level.gate) openGate();
}

// An enemy that does not count as a kill: called by a nest, a coffin, a boss or a wave.
function spawnMinion(type, x, y, summoner) {
  const minion = createEnemy(type, x, y, world.levelIndex);
  minion.minion = true; minion.summoner = summoner; minion.chasing = true; minion.exclaim = 0.5;
  world.enemies.push(minion);
  puff(x, y);
  sfx('summon', x, y);
  return minion;
}

// A free spot near (x, y) for something that has just appeared.
function freeSpotNear(x, y, type, near, far) {
  const hb = ENEMIES[type].hitbox;
  for (let tries = 0; tries < 12; tries++) {
    const a = randRange(0, Math.PI * 2), d = randRange(near, far), cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    if (!collides(cx, cy, hb.b + 2, hb.h + 2)) return { x: cx, y: cy };
  }
  return { x, y };
}

// Waves of new enemies during a survive objective. They appear out of reach of the player but come straight at them.
function spawnWave() {
  const pl = world.player, lv = world.level;
  sfx('horn');
  const pool = world.surviveTime < 25 ? ['bat', 'bat', 'goblin', 'spitter'] : ['bat', 'goblin', 'spitter', 'ogre'];
  for (let n = 0; n < 2; n++) {
    if (world.enemies.filter(e => e.minion).length >= 10) return;
    const type = pool[Math.floor(Math.random() * pool.length)], hb = ENEMIES[type].hitbox;
    for (let tries = 0; tries < 80; tries++) {
      const x = randRange(24, lv.b * TILE - 24), y = randRange(24, lv.h * TILE - 24), d = Math.hypot(x - pl.x, y - pl.y);
      if (d < 100 || d > 200 || !lv.reach[Math.floor(y / TILE) * lv.b + Math.floor(x / TILE)] || collides(x, y, hb.b + 2, hb.h + 2)) continue;   // anywhere outside the boss room
      spawnMinion(type, x, y, null);
      break;
    }
  }
}

// ---------- Breakables: nests, coffins, cameras ----------

function hitBreakable(b, k) {
  sfx('woodHit', b.x, b.y);
  b.life -= k.damage;
  b.flash = 0.08;
  b.wobble = 1;
  world.floatingTexts.push({ x: b.x + randRange(-3, 3), y: b.y - 12, text: String(k.damage), life: 0.8 });
  const colors = BREAKABLES[b.kind].colors;
  for (let p = 0; p < 4; p++) particle(k.x, k.y, randRange(-40, 40), randRange(-40, 20), COLOR[colors[p % colors.length]], 0.3);
  if (b.life <= 0) destroyBreakable(b);
}

function destroyBreakable(b) {
  const def = BREAKABLES[b.kind], lv = world.level;
  world.breakables.splice(world.breakables.indexOf(b), 1);
  sfx('smash', b.x, b.y);
  lv.solid[Math.floor(b.y / TILE) * lv.b + Math.floor(b.x / TILE)] = 0;
  world.destroyed[b.kind] = (world.destroyed[b.kind] || 0) + 1;
  if (def.rescue) freePrisoner(b);
  track('destroyed');
  camera.shake = Math.max(camera.shake, 2.5);
  for (let p = 0; p < 20; p++) {
    const a = randRange(0, Math.PI * 2), s = randRange(20, 90);
    particle(b.x, b.y, Math.cos(a) * s, Math.sin(a) * s, COLOR[def.colors[p % def.colors.length]], randRange(0.3, 0.7));
  }
  if (def.release) {
    world.floatingTexts.push({ x: b.x, y: b.y - 16, text: 'SOMETHING WAS INSIDE!', life: 1.4, color: COLOR.y });
    for (let i = 0; i < def.release.count; i++) {
      const spot = freeSpotNear(b.x, b.y, def.release.type, 4, 14);
      spawnMinion(def.release.type, spot.x, spot.y, null);
    }
  }
}

function updateBreakables(dt) {
  const pl = world.player;
  for (const b of world.breakables) {
    b.flash -= dt;
    b.wobble *= Math.exp(-dt * 6);
    const spawn = BREAKABLES[b.kind].spawn;
    if (!spawn) continue;
    b.timer -= dt;
    if (b.timer > 0) continue;
    // a nest only sends out rats while the player is close, and never more than its limit at a time
    const alive = world.enemies.filter(e => e.summoner === b).length;
    if (Math.hypot(pl.x - b.x, pl.y - b.y) < spawn.range && alive < spawn.max) {
      const spot = freeSpotNear(b.x, b.y, spawn.type, 14, 24);
      spawnMinion(spawn.type, spot.x, spot.y, b);
      b.timer = spawn.every / (1 + 0.1 * world.levelIndex);
    } else {
      b.timer = 1;
    }
  }
}

// ---------- Pickups: fuses ----------

function updatePickups(dt) {
  const pl = world.player;
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const p = world.pickups[i];
    p.time += dt;
    if (Math.hypot(pl.x - p.x, pl.y - p.y) > BAG.pickupDistance + stat('pickupRange')) continue;
    world.pickups.splice(i, 1);
    world.collected[p.kind] = (world.collected[p.kind] || 0) + 1;
    if (world.level.dark) { world.flickerTime = 1.2; sfx('lights'); }
    sfx('fuse');
    world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: '+1 ' + PICKUPS[p.kind].name.toUpperCase(), life: 1.2, color: COLOR.y });
    for (let n = 0; n < 8; n++) particle(p.x, p.y - 4, randRange(-35, 35), randRange(-45, 10), n % 2 ? COLOR.y : COLOR.W, 0.4);
  }
}

// ---------- Drawing ----------

function drawBreakable(b) {
  const def = BREAKABLES[b.kind], image = b.flash > 0 ? BREAKABLE_WHITE[b.kind] : BREAKABLE_IMAGES[b.kind];
  const x = Math.round(b.x + Math.sin(time * 40) * b.wobble * 1.5), bottom = Math.round(b.y) + 8;
  shadow(Math.round(b.x), bottom - 2, def.w);
  ctx.drawImage(image, x - (image.width >> 1), bottom - image.height);
  if (b.life < b.maxLife) {
    const bb = 10, top = bottom - image.height;
    ctx.fillStyle = COLOR.K;
    ctx.fillRect(Math.round(b.x) - bb / 2 - 1, top - 4, bb + 2, 3);
    ctx.fillStyle = COLOR.r;
    ctx.fillRect(Math.round(b.x) - bb / 2, top - 3, Math.ceil(bb * b.life / b.maxLife), 1);
  }
}

function drawPickup(p) {
  const bob = Math.round(Math.sin(p.time * 4) * 1.5), x = Math.round(p.x), y = Math.round(p.y);
  shadow(x, y + 5, 6);
  ctx.globalAlpha = 0.25 + 0.1 * Math.sin(p.time * 6);
  ctx.fillStyle = COLOR.y;
  ctx.fillRect(x - 5, y - 8 + bob, 10, 12);
  ctx.globalAlpha = 1;
  const image = p.kind === 'chip' ? CHIP_IMAGE : FUSE_IMAGE;
  ctx.drawImage(image, x - (image.width >> 1), y - 7 + bob);
  if (Math.floor(p.time * 3) % 4 === 0) { ctx.fillStyle = COLOR.W; ctx.fillRect(x + 3, y - 8 + bob, 1, 1); }
}

// ---------- Choosing the objectives of a floor ----------
// Every floor has the objectives drawn into its map (map.objectives), but they are only some of the candidates: each time the floor is
// built it picks two (three from the fifth floor) out of those and a few that fit any floor: gathering sponsor chips that are
// scattered about, killing every elite, killing a share of the enemies, surviving for a while, or killing every enemy of a kind.
// Floors with the lights out always keep the fuses. The briefing is written from the choice.

const objectiveCount = floor => floor >= 4 ? 3 : 2;
const objectiveKey = o => o.type + ':' + (o.what || o.enemy || '');
const pluralOf = name => name.endsWith('f') ? name.slice(0, -1) + 'ves' : name.endsWith('s') ? name : name + 's';

// A tile with room around it that the player can walk to from the start.
const roomyTile = (lv, x, y) => {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isSolid(lv, x + dx, y + dy)) return false;
  return lv.reach[y * lv.b + x] === 1;
};

// Places for things on the floor: at least minStart tiles from the start, spacing tiles from each other and 3 tiles from the avoid list.
function spotsAway(lv, want, minStart, spacing, avoid = []) {
  const sx = Math.floor(lv.start.x / TILE), sy = Math.floor(lv.start.y / TILE), spots = [];
  for (let tries = 0; tries < 800 && spots.length < want; tries++) {
    const x = 1 + Math.floor(Math.random() * (lv.b - 2)), y = 1 + Math.floor(Math.random() * (lv.h - 2));
    if (!roomyTile(lv, x, y) || Math.hypot(x - sx, y - sy) < minStart || spots.some(s => Math.hypot(s.x - x, s.y - y) < spacing) || avoid.some(s => Math.hypot(s.x - x, s.y - y) < 3)) continue;
    if (lv.enemies.some(e => Math.hypot(e.x / TILE - x, e.y / TILE - y) < 2.5)) continue;   // not on top of somebody
    spots.push({ x, y });
  }
  return spots;
}

// The quest with other people from floor NPC.fromFloor: a survivor to lead out, or prisoners to free.
function npcQuest(lv, normal, floor) {
  const options = [];
  const spot = spotsAway(lv, 1, 14, 0);
  if (spot.length) {
    options.push({ o: { type: 'escort', label: 'Escort', done: 'Everybody who could be saved was saved. The viewers pretend to care.' }, spots: spot, kind: 'escort' });
  }
  const cages = spotsAway(lv, floor >= 10 ? NPC.cagesDeep : NPC.cages, 12, 12);
  if (cages.length >= 2) {
    options.push({ o: { type: 'destroy', what: 'cage', label: 'Prisoners', done: 'The prisoners are free. The guards are not, any more.' }, spots: cages, kind: 'rescue' });
  }
  if (!options.length) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function placeNpcQuest(lv, quest, normal, floor) {
  const names = NPC.names.slice().sort(() => Math.random() - 0.5);
  if (quest.kind === 'escort') {
    const s = quest.spots[0];
    lv.npcs.push({ x: s.x * TILE + 8, y: s.y * TILE + 8, name: names[0], look: Math.floor(Math.random() * (NPC_LOOKS.length - 1)) });
    lv.exit = { x: lv.start.x, y: lv.start.y };
    return;
  }
  const types = [...new Set(normal.map(f => f.type))];
  quest.spots.forEach((s, i) => {
    lv.breakables.push({ kind: 'cage', x: s.x * TILE + 8, y: s.y * TILE + 8, life: BREAKABLES.cage.life, maxLife: BREAKABLES.cage.life, flash: 0, wobble: 0, timer: 2, name: names[i % names.length] });
    lv.solid[s.y * lv.b + s.x] = 1;
    // a few enemies stand guard next to it
    for (let n = 0, tries = 0; n < NPC.guards && tries < 40; tries++) {
      const gx = s.x + Math.round(randRange(-3, 3)), gy = s.y + Math.round(randRange(-3, 3));
      if ((gx === s.x && gy === s.y) || !roomyTile(lv, gx, gy)) continue;
      lv.enemies.push(createEnemy(types[Math.floor(Math.random() * types.length)], gx * TILE + 8, gy * TILE + 10, floor));
      n++;
    }
  });
}

function rollObjectives(map, lv, floor) {
  const normal = lv.enemies.filter(f => !ENEMIES[f.type].boss), elites = normal.filter(f => f.elite).length;
  const candidates = (map.objectives || []).map(o => ({ o: { ...o }, weight: 3, keep: o.type === 'collect' && !!lv.dark }));
  // the people of the dungeon (from floor 9): always one quest
  const quest = floor >= NPC.fromFloor - 1 ? npcQuest(lv, normal, floor) : null;
  const avoid = quest ? quest.spots : [];
  const chips = spotsAway(lv, 4, 9, 8, avoid);
  if (chips.length >= 3) candidates.push({ o: { type: 'collect', what: 'chip', label: 'Chips', done: 'All chips collected. The sponsors are mildly impressed.' }, weight: 2.5, chips });
  if (elites > 0) candidates.push({ o: { type: 'killElite', label: 'Elites', done: 'The elites are dead. Management has been informed.' }, weight: 2.5 });
  if (normal.length >= 8) candidates.push({ o: { type: 'cull', count: Math.round(normal.length * 0.6), label: 'Enemies', done: 'The numbers are down. The rest are nervous.' }, weight: 2 });
  candidates.push({ o: { type: 'survive', seconds: 40 + floor * 3, label: 'Survive', done: 'You lasted. The dungeon is slightly offended.' }, weight: 1.2 });
  const kinds = {};
  for (const f of normal) kinds[f.type] = (kinds[f.type] || 0) + 1;
  const types = Object.keys(kinds).filter(t => kinds[t] >= 3);
  if (types.length) {
    const type = types[Math.floor(Math.random() * types.length)];
    candidates.push({ o: { type: 'killType', enemy: type, label: pluralOf(ENEMIES[type].name), done: 'Every ' + ENEMIES[type].name.toLowerCase() + ' is gone. A moment of silence. A short one.' }, weight: 1.5 });
  }
  const pool = candidates.filter((c, i) => candidates.findIndex(d => objectiveKey(d.o) === objectiveKey(c.o)) === i);
  const picked = pool.filter(c => c.keep);
  if (quest) { picked.push(quest); placeNpcQuest(lv, quest, normal, floor); }
  while (picked.length < objectiveCount(floor)) {
    const left = pool.filter(c => !picked.includes(c) && !(c.o.type === 'cull' && picked.some(p => p.o.type === 'kill')) && !(c.o.type === 'kill' && picked.some(p => p.o.type === 'cull')));
    if (!left.length) break;
    let r = Math.random() * left.reduce((sum, c) => sum + c.weight, 0);
    picked.push(left.find(c => (r -= c.weight) < 0) || left[0]);
  }
  for (const c of picked) if (c.chips) for (const s of c.chips) lv.pickups.push({ kind: 'chip', x: s.x * TILE + 8, y: s.y * TILE + 8, time: Math.random() * 6 });
  lv.objectives = picked.map(c => c.o);
  lv.briefing = (lv.dark ? 'The power is out and it is dark. ' : '') + 'Objectives: ' + lv.objectives.map(o => describeObjective(o, lv)).join(', ') + '.';
}

// What an objective asks for, in a few words (for the briefing).
function describeObjective(o, lv) {
  const label = (o.label || '').toLowerCase();
  switch (o.type) {
    case 'kill': return 'kill every enemy';
    case 'cull': return 'kill ' + o.count + ' enemies';
    case 'targets': return 'hit all ' + lv.targets.length + ' ' + label;
    case 'destroy': return o.what === 'cage' ? 'free all ' + lv.breakables.filter(b => b.kind === 'cage').length + ' prisoners' : 'destroy all ' + lv.breakables.filter(b => b.kind === o.what).length + ' ' + label;
    case 'collect': return 'collect all ' + lv.pickups.filter(p => p.kind === o.what).length + ' ' + label;
    case 'killType': return 'kill all ' + lv.enemies.filter(f => f.type === o.enemy).length + ' ' + label;
    case 'killElite': return 'kill ' + (lv.enemies.filter(f => f.elite).length === 1 ? 'the elite' : 'all elites');
    case 'survive': return 'survive ' + o.seconds + ' seconds';
    case 'escort': return 'find ' + lv.npcs[0].name + ' and lead them to the exit';
  }
  return label;
}
