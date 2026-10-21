"use strict";

// ---------- Enemies ----------

// How many times the whole dungeon has been beaten: the dungeon gets harder every time (see CYCLE).
const dungeonCycle = () => run ? run.cycle : Math.min(CYCLE.maxCycle, saved.stats.wins);

// Turns an enemy into an elite with one of the traits in ELITES.
function makeElite(f, id) {
  const e = ELITES[id];
  f.elite = id;
  f.eliteName = e.name + ' ' + ENEMIES[f.type].name;
  f.life = f.maxLife = Math.ceil(f.maxLife * e.life);
  if (id === 'swift') { f.speedMult *= 1.45; f.cooldownMult = Math.max(0.5, f.cooldownMult * 0.65); }
  if (id === 'vicious') { f.bonusDamage += 2; f.sightMult *= 1.3; }
  if (id === 'juggernaut') f.knockMult = 0.3;
  if (id === 'summoner') f.summonTime = 3;
  if (id === 'regenerating') f.regenIdle = 0;
  return f;
}

// Picks the elites of a new floor (see ELITE).
function pickElites(list, floor) {
  const normal = list.filter(f => !ENEMIES[f.type].boss), picked = [];
  const mult = ruleMult('eliteMult'), cap = Math.min(0.7, ELITE.maxChance * Math.max(1, mult));
  for (const f of normal) if (Math.random() < Math.min(cap, (ELITE.chance + ELITE.perTier * f.tier) * mult)) picked.push(f);
  if (!picked.length && normal.length && floor >= ELITE.guaranteeFrom) picked.push(normal[Math.floor(Math.random() * normal.length)]);
  for (const f of picked) {
    const ids = Object.keys(ELITES).filter(id => !(id === 'volatile' && ENEMIES[f.type].bomber));
    makeElite(f, ids[Math.floor(Math.random() * ids.length)]);
  }
}

function createEnemy(type, x, y, tier = 0) {
  const t = ENEMIES[type], cycle = dungeonCycle();
  tier += cycle * CYCLE.cycleTiers;
  const k = t.boss ? 0 : tier, kLife = k > DIFFICULTY.softCap ? DIFFICULTY.softCap + (k - DIFFICULTY.softCap) * 0.5 : k;   // deep floors grow slower
  const life = Math.max(1, Math.ceil(t.life * (1 + DIFFICULTY.lifeStep * kLife) * (t.boss ? 1 + CYCLE.bossLifeStep * cycle : ruleMult('enemyLife'))));
  return {
    type, x, y, vx: 0, vy: 0, pushX: 0, pushY: 0, life, maxLife: life, tier,
    speedMult: (1 + DIFFICULTY.speedStep * Math.min(k, DIFFICULTY.speedCap)) * ruleMult('enemySpeed'), sightMult: 1 + DIFFICULTY.sightStep * Math.min(k, DIFFICULTY.speedCap),
    cooldownMult: Math.max(0.5, 1 - DIFFICULTY.cooldownStep * k), bonusDamage: Math.floor(Math.min(k, DIFFICULTY.damageCap) / DIFFICULTY.damageEvery) + (t.boss ? Math.floor(cycle / CYCLE.bossDamageEvery) : 0),
    moveTime: 1.5, moveIndex: 0, dashWindup: 0, dashTime: 0, dashX: 0, dashY: 0, teleportTime: 0, minion: false, summoner: null,
    chasing: false, exclaim: 0, windup: 0, cooldown: 0, hitFlash: 0, slowTime: 0, fuse: 0, ghost: !!t.ghost,
    animTime: 0, direction: hash(x, y, 4) < 0.5 ? -1 : 1,
    wanderTime: hash(x, y, 5) * 2, wanderX: 0, wanderY: 0, shootTime: 1.5, enraged: false, shotCount: 0,
  };
}

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

const inBody = (f, x, y) => {
  const k = ENEMIES[f.type].body;
  return Math.abs(x - f.x) <= k.b / 2 && Math.abs(y - (f.y + k.dy)) <= k.h / 2;
};

// Is there a clear line of sight between two points? Only walls block it, you can see over furniture.
function canSee(ax, ay, bx, by) {
  const lv = world.level, step = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
  for (let i = 1; i < step; i++) {
    const x = ax + (bx - ax) * i / step, y = ay + (by - ay) * i / step;
    if (isWall(lv, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

// Can a figure with this hitbox walk in a straight line from a to b without colliding?
function clearPath(ax, ay, bx, by, b, h) {
  const step = Math.ceil(Math.hypot(bx - ax, by - ay) / 4);
  for (let i = 1; i <= step; i++) {
    if (collides(ax + (bx - ax) * i / step, ay + (by - ay) * i / step, b + 2, h + 2)) return false;
  }
  return true;
}

// How many tiles it is from each tile to the player, so enemies find their way around walls and furniture.
// Only recalculated when the player enters a new tile.
function updatePathMap() {
  const lv = world.level, pl = world.player;
  const start = Math.floor(pl.y / TILE) * lv.b + Math.floor(pl.x / TILE);
  if (start === world.pathMapTile) return;
  world.pathMapTile = start;
  const map = world.pathMap || (world.pathMap = new Int16Array(lv.b * lv.h));
  map.fill(-1);
  map[start] = 0;
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const r = queue[i], x = r % lv.b, y = (r / lv.b) | 0;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = x + dx, ny = y + dy;
      if (isSolid(lv, nx, ny) || map[ny * lv.b + nx] !== -1) continue;
      if (dx && dy && (isSolid(lv, x + dx, y) || isSolid(lv, x, y + dy))) continue;   // do not cut across corners
      map[ny * lv.b + nx] = map[r] + 1;
      queue.push(ny * lv.b + nx);
    }
  }
}

// Next point the enemy should walk towards: straight at the player if the way is clear, otherwise the next tile in the path map.
function pathTo(f, tb = ENEMIES[f.type].hitbox) {
  const lv = world.level, pl = world.player;
  if (clearPath(f.x, f.y, pl.x, pl.y, tb.b, tb.h)) return pl;
  const tx = Math.floor(f.x / TILE), ty = Math.floor(f.y / TILE);
  let best = world.pathMap[ty * lv.b + tx], goal = null;
  for (const [dx, dy] of NEIGHBORS) {
    const nx = tx + dx, ny = ty + dy;
    if (isSolid(lv, nx, ny)) continue;
    if (dx && dy && (isSolid(lv, tx + dx, ty) || isSolid(lv, tx, ty + dy))) continue;
    const d = world.pathMap[ny * lv.b + nx];
    if (d >= 0 && (best < 0 || d < best)) { best = d; goal = { x: nx * TILE + 8, y: ny * TILE + 8 }; }
  }
  return goal || pl;
}

function wake(f) {
  if (f.chasing) return;
  f.chasing = true;
  f.exclaim = 0.7;
  sfx('alert', f.x, f.y);
}

function pushEnemy(f, dx, dy) {
  const { b, h } = ENEMIES[f.type].hitbox;
  moveAxis(f, dx, 'x', 1, b, h);
  moveAxis(f, dy, 'y', 1, b, h);
}

function updateEnemies(dt) {
  const pl = world.player;
  updatePathMap();
  for (const f of [...world.enemies]) {
    if (!world.enemies.includes(f)) continue;   // killed earlier in this frame
    const t = ENEMIES[f.type];
    const dx = pl.x - f.x, dy = pl.y - f.y, distance = Math.hypot(dx, dy) || 1;
    if (!f.seen && distance < 150 && canSee(f.x, f.y - 4, pl.x, pl.y - 4)) { f.seen = true; track('seen', f); }
    f.cooldown -= dt;
    if (f.slowTime > 0) f.slowTime -= dt;
    if (f.elite === 'regenerating' && f.life < f.maxLife && (f.regenIdle += dt) > ELITE.regenDelay) f.life = Math.min(f.maxLife, f.life + f.maxLife * ELITE.regenRate * (t.boss ? 0.2 : 1) * dt);
    if (f.elite === 'summoner' && f.chasing && (f.summonTime -= dt) <= 0) {
      f.summonTime = ELITE.summonEvery;
      if (world.enemies.filter(e => e.summoner === f).length < ELITE.summonMax) { const spot = freeSpotNear(f.x, f.y, 'bat', 6, 14); spawnMinion('bat', spot.x, spot.y, f); }
    }
    if (f.fuse > 0) {
      f.fuse -= dt;
      if (f.fuse <= 0) { killEnemy(f); continue; }   // the bomber goes off
    }

    // spitters shoot now and then
    if (!t.boss && t.shots && f.chasing && f.windup <= 0) {
      f.shootTime -= dt;
      if (f.shootTime <= 0 && canSee(f.x, f.y - 4, pl.x, pl.y - 4)) {
        enemyShoot(f, t);
        f.shootTime = t.shootInterval * Math.max(0.6, 1 - DIFFICULTY.cooldownStep * f.tier);
      }
    }
    // bosses pick a move every few seconds
    if (t.boss && f.chasing && f.windup <= 0 && f.dashWindup <= 0 && f.dashTime <= 0 && f.teleportTime <= 0) {
      f.moveTime -= dt;
      if (f.moveTime <= 0 && canSee(f.x, f.y - 4, pl.x, pl.y - 4)) {
        bossMove(f, t);
        f.moveTime = t.moveInterval * (f.enraged ? 0.65 : 1);
      }
    }

    if (!f.chasing && distance < t.sight * f.sightMult && (t.ghost || canSee(f.x, f.y - 4, pl.x, pl.y - 4))) wake(f);
    else if (f.chasing && distance > t.forget) f.chasing = false;

    let ix = 0, iy = 0, speed = t.speed * f.speedMult;
    if (f.enraged) speed *= 1.35;
    if (f.slowTime > 0) speed *= t.boss ? 0.8 : 0.4;
    if (f.teleportTime > 0) {
      // vanishing, then reappearing somewhere else
      f.teleportTime -= dt;
      if (f.teleportTime <= 0) finishTeleport(f, t);
    } else if (f.dashWindup > 0) {
      // stands still and shakes, then charges in a straight line
      f.dashWindup -= dt;
      if (f.dashWindup <= 0) {
        f.dashTime = t.dash.time;
        sfx('dash', f.x, f.y);
        f.dashX = dx / distance; f.dashY = dy / distance;
      }
    } else if (f.dashTime > 0) {
      f.dashTime -= dt;
      ix = f.dashX; iy = f.dashY; speed = t.dash.speed;
      if (distance < t.dash.hit) damagePlayer(t.dash.damage, f);
    } else if (f.windup > 0) {
      // stands still and winds up, then lunges forward
      f.windup -= dt;
      if (f.windup <= 0) {
        f.cooldown = t.cooldown * f.cooldownMult;
        f.pushX += dx / distance * 70;
        f.pushY += dy / distance * 70;
        sfx('swipe', f.x, f.y);
        if (distance < t.range + 5) damagePlayer(t.damage + f.bonusDamage, f);
      }
    } else if (f.chasing) {
      if (t.bomber && f.fuse <= 0 && distance < 16) { f.fuse = t.bomber.fuse; sfx('bombFuse', f.x, f.y); }
      let move = false;
      // chargers (boars) run at the player from a distance, after a moment of shaking
      if (t.dash && f.cooldown <= 0 && distance < t.dashRange && distance > t.range + 12 && canSee(f.x, f.y - 4, pl.x, pl.y - 4)) {
        f.dashWindup = t.dash.windup;
        f.cooldown = t.dashCooldown * f.cooldownMult;
        sfx('dashWind', f.x, f.y);
        f.exclaim = t.dash.windup;
      }
      if (t.keepAway) {
        // ranged enemies keep their distance: back off when too close, close in when too far or out of sight
        if (distance < t.keepAway * 0.7) { ix = -dx / distance; iy = -dy / distance; }
        else if (distance > t.keepAway || !canSee(f.x, f.y - 4, pl.x, pl.y - 4)) move = true;
      } else if (distance < t.range && f.cooldown <= 0) f.windup = t.windup;
      else if (distance > t.range * 0.6) move = true;
      if (move) {
        const m = t.ghost ? pl : pathTo(f), mx = m.x - f.x, my = m.y - f.y, l = Math.hypot(mx, my) || 1;
        ix = mx / l; iy = my / l;
        if (t.flutter) {
          // flying enemies swerve from side to side
          const s = Math.sin(time * 7 + f.wanderTime * 5) * t.flutter;
          [ix, iy] = [ix - iy * s, iy + ix * s];
        }
      }
    } else if (!t.boss) {
      // wanders around until it sees you
      f.wanderTime -= dt;
      if (f.wanderTime <= 0) {
        f.wanderTime = randRange(1, 2.5);
        const v = randRange(0, Math.PI * 2), walk = Math.random() < 0.5;
        f.wanderX = walk ? Math.cos(v) : 0;
        f.wanderY = walk ? Math.sin(v) : 0;
      }
      ix = f.wanderX; iy = f.wanderY; speed *= 0.3;
    }

    const a = 1 - Math.exp(-10 * dt), damping = Math.exp(-10 * dt);
    f.vx += (ix * speed - f.vx) * a;
    f.vy += (iy * speed - f.vy) * a;
    f.pushX *= damping; f.pushY *= damping;
    const { b, h } = t.hitbox;
    const fromX = f.x, fromY = f.y;
    moveAxis(f, (f.vx + f.pushX) * dt, 'x', iy, b, h);
    moveAxis(f, (f.vy + f.pushY) * dt, 'y', ix, b, h);

    const moved = Math.hypot(f.x - fromX, f.y - fromY);
    f.animTime = moved / dt > 4 ? f.animTime + moved / 6 : 0;
    if (f.chasing || f.windup > 0) f.direction = dx < 0 ? -1 : 1;
    else if (Math.abs(f.vx) > 2) f.direction = Math.sign(f.vx);
  }

  // enemies push each other apart so they do not clump together
  const fs = world.enemies;
  for (let i = 0; i < fs.length; i++) {
    for (let j = i + 1; j < fs.length; j++) {
      const a = fs[i], b = fs[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d >= 9 || d === 0) continue;
      const p = (9 - d) / 2 / d;
      pushEnemy(a, -dx * p, -dy * p);
      pushEnemy(b, dx * p, dy * p);
    }
  }
}

// A bomber blows up when it dies, whether the player shot it or it reached them.
function bomberBoom(f, t) {
  const b = t.bomber, pl = world.player;
  world.blasts.push({ x: f.x, y: f.y - 4, radius: b.radius, time: 0 });
  camera.shake = Math.max(camera.shake, 3);
  sfx('explosion', f.x, f.y);
  for (let p = 0; p < 18; p++) {
    const a = randRange(0, Math.PI * 2), s = randRange(20, 100);
    particle(f.x, f.y - 4, Math.cos(a) * s, Math.sin(a) * s, [COLOR.O, COLOR.o, COLOR.r, COLOR.y][p % 4], randRange(0.25, 0.5));
  }
  if (Math.hypot(pl.x - f.x, pl.y - f.y) < b.radius) damagePlayer(b.damage + f.bonusDamage, f);
}

function hitEnemy(f, k) {
  const t = ENEMIES[f.type];
  // a shield cuts down the damage of shots that come from the side the enemy faces (they fly the other way), unless they pierce armour or explode
  let damage = k.damage, blocked = false;
  if (t.armor && !k.explosion && !k.armorPierce && Math.sign(k.vx) === -f.direction) { damage *= t.armor; blocked = true; }
  f.life -= damage;
  if (k.weapon) f.lastWeapon = k.weapon;
  f.hitFlash = 0.08;
  f.regenIdle = 0;
  sfx(t.boss ? 'bossHit' : 'hit', f.x, f.y);
  if (blocked) sfx('clang', f.x, f.y);
  if (k.slow) { f.slowTime = Math.max(f.slowTime, t.boss ? k.slow / 2 : k.slow); sfx('iceHit', f.x, f.y); }
  wake(f);
  if (t.boss && !f.enraged && f.life < f.maxLife / 2) {
    f.enraged = true;
    camera.shake = Math.max(camera.shake, 4);
    systemMessage(t.name + ' is furious!', 3);
    sfx('bossRoar');
  }
  const l = Math.hypot(k.vx, k.vy) || 1;
  const knock = t.knockback * k.knockbackMult * (f.knockMult ?? 1);
  f.pushX += k.vx / l * knock;
  f.pushY += k.vy / l * knock;
  world.floatingTexts.push({ x: f.x + randRange(-3, 3), y: f.y + t.body.dy - t.body.h / 2 - 6, text: blocked ? 'CLANG' : String(k.damage), life: 0.8, color: blocked ? COLOR.S : undefined });
  for (let p = 0; p < 4; p++) particle(k.x, k.y, -k.vx * 0.2 + randRange(-40, 40), -k.vy * 0.2 + randRange(-40, 40), p % 2 ? COLOR.r : COLOR[t.colors[0]], 0.3);
  if (f.life <= 0) killEnemy(f);
}

function killEnemy(f) {
  const t = ENEMIES[f.type], center = f.y + t.body.dy;
  if (f.lastWeapon) track('weaponKill', f);
  world.enemies.splice(world.enemies.indexOf(f), 1);
  sfx(t.boss ? 'bossDie' : 'die:' + f.type, f.x, f.y);
  if (t.bomber) bomberBoom(f, t);
  if (t.splits) {
    // a slime falls apart into smaller ones, which do not count as kills
    sfx('slimeSplit', f.x, f.y);
    for (let i = 0; i < t.splits.count; i++) {
      const spot = freeSpotNear(f.x, f.y, t.splits.type, 3, 10);
      spawnMinion(t.splits.type, spot.x, spot.y, null);
    }
  }
  if (!t.boss) { track('killAny'); track('kill', f); }
  if (f.elite) {
    if (!f.minion) world.eliteKilled++;
    track('elite', f);
    world.floatingTexts.push({ x: f.x, y: f.y - 22, text: 'ELITE DOWN!', life: 1.4, color: COLOR[ELITES[f.elite].color] });
    for (let p = 0; p < 14; p++) particle(f.x, center, randRange(-70, 70), randRange(-70, 30), COLOR[ELITES[f.elite].color], 0.5);
    if (f.elite === 'volatile') bomberBoom(f, { bomber: ELITE.blast });
  }
  if (!t.boss && !f.minion) {
    world.killed++;
    world.killedByType[f.type] = (world.killedByType[f.type] || 0) + 1;
  }
  // exp gems and gold coins; things that were called by a boss or a nest give much less, and no gold
  if (!t.boss) {
    const exp = Math.round(f.maxLife * EXP.perLife * (f.minion ? 0.25 : 1) * (f.elite ? ELITE.expMult : 1));
    spawnDrops('gem', f.x, f.y - 3, Math.max(exp, f.minion ? 0 : 1));
    if (!f.minion) spawnDrops('coin', f.x, f.y - 3, Math.max(1, Math.round(exp * EXP.goldPerExp * (f.elite ? ELITE.goldMult / ELITE.expMult : 1))));
  }
  if (ruleOn('volatile') && !t.boss && !t.bomber && f.elite !== 'volatile') bomberBoom(f, { bomber: { radius: 26, damage: 1 } });   // the floor rule Everything Explodes
  if (Math.random() < stat('volatile')) explodeAt({ x: f.x, y: f.y - 4, vx: 0, vy: 0, explode: { radius: 34, damage: 4 }, knockbackMult: 1 });
  // some clothes heal a heart now and then when an enemy dies
  const owner = world.player;
  if (!t.boss && owner.life < maxLife() && Math.random() < stat('killHeal')) {
    owner.life++;
    world.floatingTexts.push({ x: owner.x, y: owner.y - 18, text: '+1', life: 0.9, color: COLOR.l });
    sfx('heal');
  }
  camera.shake = Math.max(camera.shake, 1.5);
  for (let p = 0; p < 14; p++) {
    const v = randRange(0, Math.PI * 2), speed = randRange(20, 80);
    particle(f.x, center, Math.cos(v) * speed, Math.sin(v) * speed, COLOR[t.colors[p % t.colors.length]], randRange(0.3, 0.6));
  }
  // a bloodstain stays on the floor
  for (let p = 0; p < 10; p++) {
    world.stains.push({ x: Math.round(f.x + randRange(-5, 5)), y: Math.round(f.y + randRange(-3, 2)), color: p < 6 ? COLOR.R : COLOR.r });
  }
  if (t.boss) { bossDefeated(f); return; }
  if (world.killed === 1 && !f.minion) {
    // the first kill always drops a weapon
    systemMessage('First blood. The dungeon is feeling generous: have a weapon.');
    world.items.push(createItem(randomWeapon(), f.x, f.y));
  } else if (f.elite ? Math.random() < ELITE.dropChance : Math.random() < t.dropChance * (1 + DIFFICULTY.dropStep * f.tier + stat('luck')) * (f.minion ? 0.5 : 1)) {
    world.items.push(createItem(randomDrop(f.elite ? (t.quality || 1) + ELITE.quality : t.quality), f.x, f.y));
  }
}

function damagePlayer(damage, from) {
  const pl = world.player;
  if (pl.invulnerable > 0 || state !== 'playing' || (dev.on && dev.god)) return;
  if (damage > 0 && Math.random() < stat('dodge')) {
    world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: 'DODGE', life: 0.7, color: COLOR.c });
    sfx('dodge');
    pl.invulnerable = 0.3;
    return;
  }
  if (damage > 0) damage = Math.max(1, Math.ceil(damage * ruleMult('enemyDamage')) - stat('armor'));
  pl.life = Math.max(0, pl.life - damage);
  track('hurt', damage);
  world.lastHitBy = from && (ENEMIES[from.type] ? from.type : from.by) || 'hazard';
  pl.invulnerable = PLAYER.invulnerableTime + stat('invuln');
  sfx('hurt');
  const v = Math.atan2(pl.y - from.y, pl.x - from.x);
  pl.vx += Math.cos(v) * PLAYER.knockback;
  pl.vy += Math.sin(v) * PLAYER.knockback;
  camera.shake = Math.max(camera.shake, 3);
  world.hurtFlash = 0.35;
  world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: '-' + damage, life: 0.8, color: COLOR.r });
  for (let p = 0; p < 6; p++) particle(pl.x, pl.y - 4, randRange(-50, 50), randRange(-50, 50), COLOR.r, 0.35);
  if (pl.life <= 0 && !pl.revived && upgradeLevel('secondWind') > 0) {
    // the Second Wind upgrade: once a run you get back up
    pl.revived = true;
    pl.life = Math.min(maxLife(), SECOND_WIND_HEARTS[upgradeLevel('secondWind')]);
    pl.invulnerable = 2.5;
    sfx('levelup');
    camera.shake = 6;
    explodeAt({ x: pl.x, y: pl.y - 4, vx: 0, vy: 0, explode: { radius: 54, damage: 3 }, knockbackMult: 3 });
    for (const b of world.enemyBullets) if (Math.hypot(b.x - pl.x, b.y - pl.y) < 70) b.life = 0;
    world.floatingTexts.push({ x: pl.x, y: pl.y - 26, text: 'SECOND WIND!', life: 1.6, color: COLOR.O });
    systemMessage('HOME: That was a death. It has been disallowed. Once.', 5);
    return;
  }
  if (pl.life <= 0) die();
}

function die() {
  const pl = world.player;
  state = 'dead';
  endRun();
  sfx('playerDie');
  world.deathTime = time;
  mouse.down = false;
  camera.shake = 5;
  for (let p = 0; p < 24; p++) {
    const v = randRange(0, Math.PI * 2), speed = randRange(20, 90);
    particle(pl.x, pl.y - 5, Math.cos(v) * speed, Math.sin(v) * speed, [COLOR.r, COLOR.R, COLOR.b, COLOR.h][p % 4], randRange(0.4, 0.9));
  }
  for (let p = 0; p < 14; p++) {
    world.stains.push({ x: Math.round(pl.x + randRange(-6, 6)), y: Math.round(pl.y + randRange(-3, 3)), color: p < 8 ? COLOR.R : COLOR.r });
  }
}
