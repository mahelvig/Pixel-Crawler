"use strict";

// ---------- Objectives ----------
// Every floor has its own objectives (see MAPS in map.js). When all of them are done the gate to the boss room opens.
//   kill      kill every normal enemy on the floor
//   targets   hit every shooting target
//   destroy   shoot every breakable of one kind (what) to pieces
//   collect   pick up every pickup of one kind (what)
//   killType  kill every enemy of one type (enemy)
//   survive   stay alive for a number of seconds, while new enemies keep arriving

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
  const gateY = lv.gate ? lv.gate.tiles[0].y * TILE : lv.h * TILE;
  for (let n = 0; n < 2; n++) {
    if (world.enemies.filter(e => e.minion).length >= 10) return;
    const type = pool[Math.floor(Math.random() * pool.length)], hb = ENEMIES[type].hitbox;
    for (let tries = 0; tries < 40; tries++) {
      const x = randRange(24, lv.b * TILE - 24), y = randRange(24, gateY - 8), d = Math.hypot(x - pl.x, y - pl.y);
      if (d < 100 || d > 200 || collides(x, y, hb.b + 2, hb.h + 2)) continue;
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
  ctx.drawImage(FUSE_IMAGE, x - 3, y - 7 + bob);
  if (Math.floor(p.time * 3) % 4 === 0) { ctx.fillStyle = COLOR.W; ctx.fillRect(x + 3, y - 8 + bob, 1, 1); }
}
