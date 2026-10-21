"use strict";

// ---------- Boss room, boss and stairs ----------
// When every enemy is dead and every target is hit, the gate to the boss room opens and the boss appears.
// Beating the boss makes a staircase appear, which leads down to the next floor.

function openGate() {
  const lv = world.level;
  world.gateOpen = true;
  world.gateOpenTime = time;
  for (const t of lv.gate.tiles) lv.solid[t.y * lv.b + t.x] = 0;
  const boss = createEnemy(lv.boss, lv.bossSpawn.x, lv.bossSpawn.y, floorTier(world.levelIndex));
  if (isEndless(world.levelIndex)) endlessBoss(boss);
  world.enemies.push(boss);
  bossGuards(boss);
  camera.shake = 4;
  sfx('gate');
  systemMessage('A heavy gate grinds open. Something big is waiting inside.', 5);
  const line = bossStoryLine('gate');
  if (line) systemMessage(fillStory(line), 6);
  const gx = lv.gate.tiles.reduce((s, t) => s + t.x, 0) / lv.gate.tiles.length * TILE + 8, gy = lv.gate.tiles[0].y * TILE + 8;
  for (let p = 0; p < 24; p++) particle(gx + randRange(-16, 16), gy + randRange(-6, 6), randRange(-15, 15), randRange(0, 40), p % 2 ? COLOR.g : COLOR.s, randRange(0.5, 1));
}

function bossDefeated(f) {
  const t = ENEMIES[f.type];
  world.bossDefeated = true;
  world.classWait = 1.5;   // the Class Box, if this was the third floor
  track('boss', f);
  camera.shake = 7;
  spawnDrops('gem', f.x, f.y, EXP.boss * (world.levelIndex + 1));
  spawnDrops('coin', f.x, f.y, EXP.bossGold * (world.levelIndex + 1));
  sfx('stairs', undefined, undefined, 0.9);
  if (world.stairs) { world.stairs.active = true; world.stairs.time = 0; }
  systemMessage((f.eliteName || t.name) + ' is dead. A staircase leads further down.', 5);
  const line = bossStoryLine('death');
  if (line) systemMessage(fillStory(line), 6);
  world.items.push(createItem(t.reward, f.x, f.y + 4));
  world.items.push(createItem(randomGear(null, BOSS_QUALITY), f.x + 10, f.y + 4));   // and something to wear, with a good chance of it being rare, epic or legendary
  if (isEndless(world.levelIndex)) giveBox(depthBelowCore(world.levelIndex) >= 6 ? 'platinum' : 'gold');   // below the Core: a sealed box as well
  // the boss's minions, shots and danger zones disappear with it
  for (const e of [...world.enemies]) if (e.minion) { puff(e.x, e.y); world.enemies.splice(world.enemies.indexOf(e), 1); }
  world.enemyBullets.length = 0;
  world.hazards.length = 0;
  for (let p = 0; p < 30; p++) {
    const v = randRange(0, Math.PI * 2), speed = randRange(30, 110);
    particle(f.x, f.y + t.body.dy, Math.cos(v) * speed, Math.sin(v) * speed, COLOR[t.colors[p % t.colors.length]], randRange(0.4, 0.9));
  }
}

function updateStairs(dt) {
  const s = world.stairs, pl = world.player;
  if (!s || !s.active) return;
  s.time += dt;
  if (s.time > 0.8 && Math.hypot(pl.x - s.x, pl.y - s.y) < 8) nextLevel();
}

// Takes the player down to the next floor, keeping their weapons and ammo. After the last floor the game ends.
function nextLevel() {
  const index = world.levelIndex + 1;
  // below the Core is the season finale, unless it has already been refused
  if (index === LEVEL_ORDER.length && !run.offScript) { mouse.down = false; mouse.moving = false; seasonFinale(); return; }
  goToLevel(index);
}

// Moves the player to another floor, keeping their weapons and ammo.
function goToLevel(index) {
  saved.tutorialDone = true;
  const old = world.player;
  sfx('descend');
  world = newWorld(index);
  const pl = world.player;
  pl.slots = old.slots; pl.ammo = old.ammo; pl.gearLevel = old.gearLevel; pl.starter = old.starter; pl.fame = old.fame; pl.fameIdle = old.fameIdle; pl.boxes = old.boxes; pl.boxBag = old.boxBag; pl.active = old.active; pl.weapon = old.weapon;
  pl.xp = old.xp; pl.level = old.level; pl.pending = old.pending; pl.perks = old.perks; pl.runGold = old.runGold; pl.class = old.class; pl.revived = old.revived;
  pl.lastMax = old.lastMax;
  floorStarted();
  pl.life = Math.min(maxLife(), old.life + 1);
  // the tutorial is only for the first floor
  world.hasWalked = world.hasShot = world.hasFound = world.hasFoundGear = world.goalShown = true;
  world.helpAlpha = 0;
  camera.x = clamp(pl.x - SCREEN_W / 2, 0, Math.max(0, world.level.b * TILE - SCREEN_W));
  camera.y = clamp(pl.y - SCREEN_H / 2, 0, Math.max(0, world.level.h * TILE - SCREEN_H));
  camera.shake = 0;
  systemMessage('Floor ' + (index + 1) + ': ' + world.level.name + (isEndless(index) ? ', off script' : '') + '. You recover a heart.');
  systemMessage(world.level.briefing || 'Complete the objectives to open the boss gate.', 6);
  storyFloor(index);
  saveRun();
}

// ---------- Boss attacks ----------

// A small cloud of smoke where something appears or disappears.
function puff(x, y) {
  for (let p = 0; p < 8; p++) particle(x, y - 4, randRange(-25, 25), randRange(-30, 5), p % 2 ? COLOR.g : COLOR.S, randRange(0.3, 0.6));
}

function say(f, text) {
  if (!text) return;
  world.floatingTexts.push({ x: f.x, y: f.y - ENEMY_IMAGES[f.type][0].height + 2, text, life: 1.6, color: COLOR.y });
}

// ---------- Shooting ----------

function aimAt(f, t) {
  const pl = world.player;
  return Math.atan2(pl.y - 4 - (f.y + t.body.dy), pl.x - f.x);
}

function fireAt(f, t, angle, speed, damage) {
  world.enemyBullets.push({ x: f.x, y: f.y + t.body.dy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 3, damage, drop: -t.body.dy, by: f.type });
}

function fireFan(f, t, n, speed, damage) {
  const base = aimAt(f, t), arc = 0.2 * (n - 1);
  for (let i = 0; i < n; i++) fireAt(f, t, n === 1 ? base + randRange(-0.08, 0.08) : base - arc / 2 + arc * i / (n - 1), speed, damage);
}

function fireRing(f, t, n, speed, damage) {
  const base = aimAt(f, t) + f.moveIndex * 0.4;
  for (let i = 0; i < n; i++) fireAt(f, t, base + Math.PI * 2 * i / n, speed, damage);
}

// Spitters spit a single shot at the player.
function enemyShoot(f, t) {
  sfx(t.shootSound || 'spit', f.x, f.y);
  fireFan(f, t, t.shots, t.shotSpeed, t.shotDamage + f.bonusDamage);
}

// ---------- Boss moves ----------

const BOSS_MOVES = {
  fan(f, t, p) {
    fireFan(f, t, p.shots + (f.enraged ? 2 : 0), p.speed, p.damage);
    sfx('bossFan', f.x, f.y);
    camera.shake = Math.max(camera.shake, 1);
  },
  ring(f, t, p) {
    fireRing(f, t, p.shots + (f.enraged ? 4 : 0), p.speed, p.damage);
    sfx('bossRing', f.x, f.y);
    camera.shake = Math.max(camera.shake, 1);
  },
  // Calls enemies that fight on the boss's side. They do not count as kills. Returns false if there is no room for more.
  summon(f, t, p) {
    const n = Math.min(p.count, p.max - world.enemies.filter(e => e.summoner === f).length);
    if (n <= 0) return false;
    const hb = ENEMIES[p.type].hitbox;
    for (let i = 0; i < n; i++) {
      let x = f.x, y = f.y;
      for (let tries = 0; tries < 12; tries++) {
        const a = randRange(0, Math.PI * 2), d = randRange(18, 36), cx = f.x + Math.cos(a) * d, cy = f.y + Math.sin(a) * d;
        if (!collides(cx, cy, hb.b + 2, hb.h + 2)) { x = cx; y = cy; break; }
      }
      const minion = createEnemy(p.type, x, y, world.levelIndex);
      minion.minion = true; minion.summoner = f; minion.chasing = true; minion.exclaim = 0.5;
      world.enemies.push(minion);
      puff(x, y);
    }
    return true;
  },
  dash(f, t, p) {
    f.dashWindup = p.windup;
    sfx('dashWind', f.x, f.y);
    f.exclaim = p.windup;
  },
  teleport(f, t) {
    f.teleportTime = 0.45;
    sfx('teleport', f.x, f.y);
    puff(f.x, f.y);
  },
  // Danger zones that blink for a moment before they go off. The first is right where the player stands.
  hazards(f, t, p) {
    const pl = world.player;
    sfx('hazardWarn');
    for (let i = 0; i < p.count; i++) {
      let x = pl.x, y = pl.y;
      if (i > 0) {
        const a = randRange(0, Math.PI * 2), d = randRange(20, 55);
        if (!isSolid(world.level, Math.floor((pl.x + Math.cos(a) * d) / TILE), Math.floor((pl.y + Math.sin(a) * d) / TILE))) {
          x = pl.x + Math.cos(a) * d; y = pl.y + Math.sin(a) * d;
        }
      }
      world.hazards.push({ x, y, radius: p.radius, age: 0, warn: p.warn, active: p.active, damage: p.damage, color: COLOR[p.color], hitTime: 0, by: f.type });
    }
  },
};

function bossMove(f, t) {
  const kind = t.randomMoves ? t.moves[Math.floor(Math.random() * t.moves.length)] : t.moves[f.moveIndex % t.moves.length];
  f.moveIndex++;
  let p = t[kind];
  // a summon that has no room left becomes the boss's fan instead
  if (BOSS_MOVES[kind](f, t, p) === false && t.fan) { p = t.fan; BOSS_MOVES.fan(f, t, p); }
  say(f, p.say);
}

// The second half of a teleport: appears at a free spot near the player, in sight, and fires its fan.
function finishTeleport(f, t) {
  const pl = world.player, hb = t.hitbox;
  for (let tries = 0; tries < 40; tries++) {
    const a = randRange(0, Math.PI * 2), d = randRange(55, 105), x = pl.x + Math.cos(a) * d, y = pl.y + Math.sin(a) * d;
    if (collides(x, y, hb.b + 2, hb.h + 2) || !canSee(x, y - 4, pl.x, pl.y - 4)) continue;
    f.x = x; f.y = y;
    break;
  }
  f.vx = f.vy = 0;
  f.exclaim = 0.4;
  sfx('teleport', f.x, f.y);
  puff(f.x, f.y);
  if (t.fan) BOSS_MOVES.fan(f, t, t.fan);
}

function updateHazards(dt) {
  const pl = world.player;
  for (let i = world.hazards.length - 1; i >= 0; i--) {
    const z = world.hazards[i];
    z.age += dt;
    if (z.age >= z.warn + z.active) { world.hazards.splice(i, 1); continue; }
    if (z.age < z.warn) continue;
    if (!z.went) { z.went = true; sfx('hazardGo', z.x, z.y); }
    if (Math.random() < 0.4) particle(z.x + randRange(-z.radius, z.radius) * 0.8, z.y + randRange(-z.radius, z.radius) * 0.5, 0, randRange(-25, -10), z.color, 0.5);
    z.hitTime -= dt;
    if (z.hitTime <= 0 && Math.hypot(pl.x - z.x, pl.y - 3 - z.y) < z.radius) {
      damagePlayer(z.damage, z);
      z.hitTime = 0.6;
    }
  }
}

function updateEnemyBullets(dt) {
  const pl = world.player, lv = world.level;
  for (let i = world.enemyBullets.length - 1; i >= 0; i--) {
    const k = world.enemyBullets[i];
    k.life -= dt;
    k.x += k.vx * dt; k.y += k.vy * dt;
    let gone = k.life <= 0;
    if (!gone && blocksBullets(lv, Math.floor(k.x / TILE), Math.floor((k.y + (k.drop || 0)) / TILE))) {
      splash(k.x - k.vx * dt, k.y - k.vy * dt, COLOR.o, Math.atan2(k.vy, k.vx));
      gone = true;
    } else if (!gone && Math.abs(k.x - pl.x) < 5 && Math.abs(k.y - (pl.y - 5)) < 6) {
      damagePlayer(k.damage, k);
      gone = true;
    } else if (!gone) {
      const victim = world.npcs.find(n => n.state !== 'safe' && Math.abs(k.x - n.x) < 5 && Math.abs(k.y - (n.y - 5)) < 6);
      if (victim) { if (victim.hurtTime <= 0) hurtNpc(victim, 1); gone = true; }
    }
    if (gone) world.enemyBullets.splice(i, 1);
  }
}

// ---------- Drawing ----------

// The gate is drawn on top of the map while it is closed, and slides up into the wall when it opens.
function drawGate() {
  const g = world.level.gate;
  if (!g) return;
  const p = world.gateOpen ? clamp((time - world.gateOpenTime) / 1.2, 0, 1) : 0;
  if (p >= 1) return;
  // drawn lying down; a gate in a wall that runs up and down is drawn the same way with the axes swapped
  const vertical = g.tiles.length > 1 && g.tiles[0].x === g.tiles[1].x;
  const x0 = 0, y0 = 0, w = g.tiles.length * TILE, h = Math.round(TILE * (1 - p));
  ctx.save();
  ctx.translate(g.tiles[0].x * TILE, g.tiles[0].y * TILE);
  if (vertical) ctx.transform(0, 1, 1, 0, 0, 0);
  ctx.beginPath();
  ctx.rect(x0, y0, w, h);
  ctx.clip();
  const top = y0 - (TILE - h);
  ctx.fillStyle = COLOR.k;
  ctx.fillRect(x0, top, w, TILE);
  ctx.fillStyle = COLOR.g;
  for (let x = x0 + 2; x < x0 + w - 1; x += 4) ctx.fillRect(x, top, 2, TILE);
  ctx.fillStyle = COLOR.s;
  ctx.fillRect(x0, top + 3, w, 2);
  ctx.fillRect(x0, top + 11, w, 2);
  ctx.fillStyle = COLOR.D;
  ctx.fillRect(x0, top, w, 1);
  ctx.fillRect(x0, top + TILE - 1, w, 1);
  // a lamp over the middle: red while locked, green while opening
  ctx.fillStyle = world.gateOpen ? COLOR.l : (Math.floor(time * 2) % 2 ? COLOR.r : COLOR.R);
  ctx.fillRect(x0 + w / 2 - 1, top + 6, 2, 2);
  ctx.restore();
}

function drawStairs(s) {
  const p = clamp(s.time / 0.8, 0, 1), x = Math.round(s.x) - 8, y = Math.round(s.y) - 8;
  ctx.globalAlpha = p;
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(x, y, TILE, TILE);
  [COLOR.S, COLOR.g, COLOR.s, COLOR.D].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + 2 + i, y + 2 + i * 3, 12 - i * 2, 3);
    ctx.fillStyle = COLOR.K;
    ctx.fillRect(x + 2 + i, y + 4 + i * 3, 12 - i * 2, 1);
  });
  ctx.globalAlpha = 1;
  const bob = Math.round(Math.sin(time * 5) * 1.5);
  drawText('v', x + 8, y - 9 + bob, COLOR.y, { align: 'center', alpha: p });
}

// Danger zones: a blinking outline while they warn, then a filled, pulsing disc while they hurt.
function drawHazards() {
  for (const z of world.hazards) {
    const cx = Math.round(z.x), cy = Math.round(z.y), r = z.radius;
    ctx.fillStyle = z.color;
    if (z.age >= z.warn) {
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(time * 14);
      for (let y = -r; y <= r; y++) {
        const half = Math.floor(Math.sqrt(r * r - y * y));
        ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    if (z.age >= z.warn || Math.floor(time * 10) % 2 === 0) {
      for (let i = 0; i < 40; i++) {
        const a = Math.PI * 2 * i / 40;
        ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
      }
    }
  }
}

function drawEnemyBullets() {
  for (const k of world.enemyBullets) {
    const x = Math.round(k.x), y = Math.round(k.y);
    ctx.fillStyle = COLOR.o;
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.fillStyle = Math.floor(time * 20) % 2 ? COLOR.y : COLOR.W;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawBossBar() {
  const f = world.enemies.find(e => ENEMIES[e.type].boss && e.chasing);
  if (!f) return;
  const t = ENEMIES[f.type], w = 140, x = Math.round((SCREEN_W - w) / 2), y = 12;
  drawText(f.eliteName || t.name, SCREEN_W / 2, 4, f.elite ? COLOR[ELITES[f.elite].color] : COLOR.W, { align: 'center' });
  ctx.fillStyle = 'rgba(24,20,37,0.9)';
  ctx.fillRect(x - 2, y - 2, w + 4, 9);
  ctx.fillStyle = f.enraged ? COLOR.o : COLOR.r;
  ctx.fillRect(x, y, Math.ceil(w * Math.max(0, f.life) / f.maxLife), 5);
  border(x - 2, y - 2, w + 4, 9, COLOR.D);
}
