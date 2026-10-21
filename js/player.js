"use strict";

// ---------- Player ----------

// slots is the hotbar slots followed by the bag, ammo is the ammo per weapon type, active is the selected
// hotbar slot, and weapon is the weapon in that slot (null means empty hands)
function createPlayer(x, y) {
  const slots = new Array(BAG.equipStart + GEAR_SLOTS.length).fill(null);
  const start = chosenStartWeapon();
  slots[0] = start;
  return {
    starter: start, fame: 0, fameIdle: 0, boxes: 0, boxBag: emptyBoxBag(),
    x, y, vx: 0, vy: 0, aim: 0, animTime: 0,
    slots, ammo: {}, gearLevel: {}, active: 0, weapon: slots[0], cooldown: 0, recoil: 0, muzzleFlash: 0,
    life: PLAYER.life, lastMax: PLAYER.life, invulnerable: 0,
    xp: 0, level: 1, pending: 0, perks: {}, runGold: 0,
    revived: false, class: null, abilityCd: 0, buff: 0, dashTime: 0, dashX: 0, dashY: 0,
  };
}

function hand(pl) {
  return { x: Math.round(pl.x + Math.cos(pl.aim) * 3), y: Math.round(pl.y - 4 + Math.sin(pl.aim) * 2) };
}

function muzzle(pl) {
  const wi = WEAPON_IMAGES[WEAPONS[pl.weapon].image], h = hand(pl);
  const mirror = Math.cos(pl.aim) < 0 ? -1 : 1;
  const lx = wi.muzzle[0] - wi.pivot[0] - pl.recoil, ly = (wi.muzzle[1] - wi.pivot[1]) * mirror;
  const c = Math.cos(pl.aim), s = Math.sin(pl.aim);
  return { x: h.x + lx * c - ly * s, y: h.y + lx * s + ly * c };
}

function updatePlayer(dt) {
  const pl = world.player;
  // wearing something with Max life adds the hearts at once; taking it off cuts them again
  const cap = maxLife();
  if (cap !== pl.lastMax) {
    if (cap > pl.lastMax) pl.life += cap - pl.lastMax;
    pl.life = Math.min(pl.life, cap);
    pl.lastMax = cap;
  }
  let ix = 0, iy = 0;
  if (OPTIONS.rightClickMove) {
    // hold the right mouse button to walk towards the cursor (WASD is off in this mode)
    if (mouse.moving) {
      const dx = Math.round(camera.x) + mouse.x - pl.x, dy = Math.round(camera.y) + mouse.y - pl.y;
      if (Math.hypot(dx, dy) > 3) { ix = dx; iy = dy; }
    }
  } else if (touch.on) {
    const v = stickVector(touch.move);
    ix = v.x * v.mag; iy = v.y * v.mag;
  } else {
    if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) iy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) iy += 1;
  }
  const len = Math.max(1, Math.hypot(ix, iy));
  ix /= len; iy /= len;

  const t = 1 - Math.exp(-PLAYER.acceleration * dt);
  const topSpeed = PLAYER.speed * (dev.on && dev.fast ? 2.5 : 1) * (1 + stat('speed'));
  if (pl.dashTime > 0) {   // the Runner's dash: a fixed speed, whatever the stick says
    pl.dashTime -= dt;
    pl.vx = pl.dashX; pl.vy = pl.dashY;
  } else {
    pl.vx += (ix * topSpeed - pl.vx) * t;
    pl.vy += (iy * topSpeed - pl.vy) * t;
  }
  if (Math.abs(pl.vx) < 0.5 && ix === 0) pl.vx = 0;
  if (Math.abs(pl.vy) < 0.5 && iy === 0) pl.vy = 0;
  const { b, h } = PLAYER.hitbox;
  const fromX = pl.x, fromY = pl.y;
  moveAxis(pl, pl.vx * dt, 'x', iy, b, h);
  moveAxis(pl, pl.vy * dt, 'y', ix, b, h);
  world.walkedDistance += Math.hypot(pl.x - fromX, pl.y - fromY);

  pl.aim = touch.on ? aimAngle(pl) : Math.atan2(Math.round(camera.y) + mouse.y - (pl.y - 4), Math.round(camera.x) + mouse.x - pl.x);
  const speed = Math.hypot(pl.vx, pl.vy);
  const stepBefore = Math.floor(pl.animTime * 2);
  pl.animTime = speed > 8 ? pl.animTime + dt * 9 * (speed / PLAYER.speed) : 0;
  if (pl.animTime > 0 && Math.floor(pl.animTime * 2) !== stepBefore) sfx('step');

  const v = WEAPONS[pl.weapon];
  pl.recoil *= Math.exp(-dt * 18);
  pl.muzzleFlash -= dt;
  pl.invulnerable -= dt;
  pl.cooldown -= dt;
  if (!(mouse.down || touchFiring()) || !v) pl.cooldown = Math.max(pl.cooldown, 0);
  else if (pl.cooldown <= 0) {
    if (hasAmmo(pl, pl.weapon)) {
      fire(pl, v);
      pl.cooldown += 1 / (v.shotsPerSec * (1 + stat('fireRate')) * starterPower(pl, pl.weapon));
    } else {
      // empty: switch to something that still has ammo, or tell the player
      sfx('empty');
      if (!switchToNextWithAmmo(pl)) world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: 'NO AMMO', life: 0.8, color: COLOR.r });
      pl.cooldown = 0.35;
    }
  }
}

function fire(pl, v) {
  const type = pl.weapon;
  pl.recoil = v.recoil;
  pl.muzzleFlash = 0.06;
  camera.shake = Math.max(camera.shake, v.shake);
  world.hasShot = true;
  sfx('fire:' + type, pl.x, pl.y);
  const m = muzzle(pl);
  // Do not shoot through a wall that is between the player and the gun. Walls are checked at floor level: shots fly
  // PLAYER.shotHeight pixels above the floor, so standing right up against a wall must not block them.
  const h = PLAYER.shotHeight;
  for (let i = 1; i <= 8; i++) {
    const px = pl.x + (m.x - pl.x) * i / 8, py = pl.y + (m.y + h - pl.y) * i / 8;
    if (blocksBullets(world.level, Math.floor(px / TILE), Math.floor(py / TILE))) { splash(px, py - h, v.flash, pl.aim); return; }
  }
  // clothes make every shot stronger, and some shots are critical hits that do double
  const crit = Math.random() < stat('crit'), mult = (1 + stat('damage')) * (crit ? 2 : 1) * starterPower(pl, type);
  if (crit) {
    world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: 'CRIT!', life: 0.7, color: COLOR.O });
    track('crit');
    sfx('crit');
  }
  // perks can add bullets; a weapon that aims straight then gets a little spread so they do not fly on top of each other
  const extra = stat('multishot'), spread = extra > 0 ? Math.max(v.spread, 8) : v.spread;
  for (let i = 0; i < v.bulletsPerShot + extra; i++) {
    const angle = pl.aim + (Math.random() - 0.5) * spread * Math.PI / 180;
    world.bullets.push({
      x: m.x, y: m.y, vx: Math.cos(angle) * v.bulletSpeed, vy: Math.sin(angle) * v.bulletSpeed,
      life: v.range / v.bulletSpeed, damage: Math.round(v.damage * mult * 10) / 10, image: v.bullet, color: v.flash,
      knockbackMult: v.knockbackMult, hit: v.pierce || stat('pierce') > 0 ? [] : null, explode: v.explode && { radius: v.explode.radius, damage: Math.round(v.explode.damage * mult * 10) / 10 }, drop: PLAYER.shotHeight,
      weapon: type, bounces: (v.bounce || 0) + stat('bounce'), slow: v.slow, armorPierce: v.armorPierce,
    });
  }
  track('shot');
  if (!isInfinite(pl, type) && !(dev.on && dev.ammo) && !(Math.random() < stat('ammoSave'))) {
    pl.ammo[type] -= 1;
    if (pl.ammo[type] <= 0) {
      world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: WEAPONS[type].name + ' used up', life: 1.2, color: COLOR.r });
      sfx('outOfAmmo');
      track('empty');
      useUp(pl, type);
    }
  }
}

function updateBullets(dt) {
  const lv = world.level;
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const k = world.bullets[i];
    k.life -= dt;
    const speed = Math.hypot(k.vx, k.vy), step = Math.max(1, Math.ceil(speed * dt / 3));
    let gone = false;
    if (k.explode) particle(k.x - k.vx * 0.02, k.y - k.vy * 0.02, randRange(-8, 8), randRange(-8, 8), Math.random() < 0.5 ? COLOR.g : COLOR.o, 0.35);
    for (let s = 0; s < step && !gone; s++) {
      const dx = k.vx * dt / step, dy = k.vy * dt / step, ground = k.y + (k.drop || 0);
      if (k.bounces > 0 && blocksBullets(lv, Math.floor((k.x + dx) / TILE), Math.floor((ground + dy) / TILE))) {
        // a bouncing bullet turns around at the wall instead of stopping
        const hitX = blocksBullets(lv, Math.floor((k.x + dx) / TILE), Math.floor(ground / TILE));
        const hitY = blocksBullets(lv, Math.floor(k.x / TILE), Math.floor((ground + dy) / TILE));
        if (hitX || !hitY) k.vx = -k.vx;
        if (hitY || !hitX) k.vy = -k.vy;
        k.bounces--;
        sfx('bounce', k.x, k.y);
        for (let p = 0; p < 3; p++) particle(k.x, k.y, randRange(-30, 30), randRange(-30, 30), k.color, 0.2);
        continue;
      }
      k.x += dx;
      k.y += dy;
      // bullets that pierce enemies remember who they hit, so each is only hit once
      const foe = world.enemies.find(f => inBody(f, k.x, k.y) && !(k.hit && k.hit.includes(f)));
      const dummy = !foe && world.targets.find(b => Math.abs(k.x - b.x) <= TILE / 2 && Math.abs(k.y - b.y) <= b.h / 2);
      const crate = !foe && !dummy && world.breakables.find(b => Math.abs(k.x - b.x) <= TILE / 2 && Math.abs(k.y - (b.y + 8 - BREAKABLES[b.kind].h / 2)) <= BREAKABLES[b.kind].h / 2);
      if (foe) {
        hitEnemy(foe, k);
        if (k.hit) k.hit.push(foe);
        else gone = true;
      }
      else if (dummy) { hitTarget(dummy, k); gone = true; }
      else if (crate) { hitBreakable(crate, k); gone = true; }
      else if (blocksBullets(lv, Math.floor(k.x / TILE), Math.floor((k.y + (k.drop || 0)) / TILE))) {
        splash(k.x - k.vx * dt / step, k.y - k.vy * dt / step, k.color, Math.atan2(k.vy, k.vx));
        gone = true;
      }
    }
    if (!gone && k.life <= 0) {
      for (let p = 0; p < 3; p++) particle(k.x, k.y, randRange(-20, 20), randRange(-20, 20), k.color, 0.25);
      gone = true;
    }
    if (gone) {
      if (k.explode) explodeAt(k);
      world.bullets.splice(i, 1);
    }
  }
}

// An exploding bullet hurts every enemy and target within the radius, whether or not it hit one directly.
function explodeAt(k) {
  const ex = k.explode, speed = Math.hypot(k.vx, k.vy) || 1;
  const x = k.x - k.vx / speed * 3, y = k.y - k.vy / speed * 3;
  sfx('explosion', x, y);
  camera.shake = Math.max(camera.shake, 3);
  world.blasts.push({ x, y, radius: ex.radius, time: 0 });
  for (let p = 0; p < 26; p++) {
    const a = randRange(0, Math.PI * 2), s = randRange(20, 110);
    particle(x, y, Math.cos(a) * s, Math.sin(a) * s, [COLOR.O, COLOR.o, COLOR.r, COLOR.y, COLOR.g][p % 5], randRange(0.25, 0.6));
  }
  for (const f of [...world.enemies]) {
    const e = ENEMIES[f.type], dx = f.x - x, dy = f.y + e.body.dy - y, d = Math.hypot(dx, dy);
    if (d > ex.radius + e.body.b / 2) continue;
    hitEnemy(f, { x, y, vx: dx / (d || 1) * 50, vy: dy / (d || 1) * 50, damage: ex.damage, knockbackMult: k.knockbackMult, explosion: true, weapon: k.weapon });
  }
  for (const t of world.targets) {
    if (Math.hypot(t.x - x, t.y - y) <= ex.radius + 8) hitTarget(t, { x, y, vx: t.x - x, vy: t.y - y, damage: ex.damage });
  }
  for (const b of [...world.breakables]) {
    if (Math.hypot(b.x - x, b.y - y) <= ex.radius + 8) hitBreakable(b, { x, y, vx: b.x - x, vy: b.y - y, damage: ex.damage });
  }
}

function hitTarget(dummy, k) {
  const gauge = dummy.style === 'gauge';
  sfx(gauge ? 'gaugeHit' : 'targetHit', dummy.x, dummy.y);
  dummy.hitFlash = 0.08;
  dummy.wobble = 1;
  dummy.direction = Math.sign(k.vx) || 1;
  world.floatingTexts.push({ x: dummy.x + randRange(-3, 3), y: dummy.y - 10, text: String(k.damage), life: 0.8 });
  for (let p = 0; p < 5; p++) particle(k.x, k.y, -k.vx * 0.2 + randRange(-40, 40), -k.vy * 0.2 + randRange(-40, 40), gauge ? (p % 2 ? COLOR.S : COLOR.W) : (p % 2 ? COLOR.W : COLOR.r), 0.3);
  if (!dummy.hit) {
    if (gauge) world.floatingTexts.push({ x: dummy.x, y: dummy.y - 16, text: 'FIXED', life: 1.2, color: COLOR.l });
    dummy.hit = true;
    world.targetsHit++;
    track('target');
  }
}
