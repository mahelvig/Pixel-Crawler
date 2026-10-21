"use strict";

// ---------- Classes ----------
// When the boss of floor 3 is dead, HOME opens the Class Box: three of the five classes are offered and one is chosen for the rest
// of the run. A class adds a few stats (like a piece of clothing would) and gives one ability with a cooldown, used with Space or
// with the round button on a touch screen. The class is carried from floor to floor and kept when a run is continued.

const CLASS_SETTINGS = { offer: true, choices: 3, bossFloor: 2 };   // bossFloor is the index of the floor whose boss opens the box

const CLASSES = {
  brawler: {
    name: 'Brawler', color: 'r', tag: 'Hits first.', stats: { maxLife: 2, damage: 0.1 },
    ability: { name: 'Shockwave', cooldown: 9, text: 'Blasts nearby enemies away and wipes out shots.' },
  },
  engineer: {
    name: 'Engineer', color: 'c', tag: 'Lets things do the work.', stats: { ammoSave: 0.15, pickupRange: 14, luck: 0.05 },
    ability: { name: 'Turret', cooldown: 18, text: 'Builds a turret that shoots for 12 seconds.' },
  },
  runner: {
    name: 'Runner', color: 'l', tag: 'Hard to hit.', stats: { speed: 0.1, crit: 0.08, dodge: 0.06 },
    ability: { name: 'Dash', cooldown: 4, text: 'A quick dash. Nothing can hit you during it.' },
  },
  showman: {
    name: 'Showman', color: 'O', tag: 'Plays to the crowd.', stats: { luck: 0.15, goldGain: 0.15, xpGain: 0.1 },
    ability: { name: 'Showtime', cooldown: 22, text: 'Shoot faster and harder for 6 seconds.' },
  },
  scavenger: {
    name: 'Scavenger', color: 'u', tag: 'Takes everything.', stats: { pickupRange: 22, xpGain: 0.15, killHeal: 0.05 },
    ability: { name: 'Vacuum', cooldown: 14, text: 'Pulls in every gem and coin and heals a heart.' },
  },
};
const CLASS_ORDER = Object.keys(CLASSES);

const ABILITY = {
  shockRadius: 46, shockDamage: 5,
  turretTime: 12, turretRate: 3, turretDamage: 1.5, turretRange: 120, turretMax: 2,
  dashTime: 0.16, dashSpeed: 300, dashSafe: 0.45,
  showTime: 6, showStats: { fireRate: 0.5, damage: 0.25, crit: 0.1 }, showViewers: 15,
  vacuumHeal: 1,
};

const playerClass = pl => (pl && pl.class && CLASSES[pl.class]) || null;

// What the class (and an ability that is running) adds to one stat. progressStat() in perks.js adds this to the clothes.
function classStat(name) {
  const pl = world && world.player, c = playerClass(pl);
  if (!c) return 0;
  let total = c.stats[name] || 0;
  if (pl.buff > 0 && ABILITY.showStats[name]) total += ABILITY.showStats[name];
  return total;
}

// ---------- Offering the choice ----------

// Three different classes, the same ones if the game is closed and opened again (they come from the seed of the run).
function rollClasses() {
  const pool = CLASS_ORDER.slice(), picked = [];
  for (let n = 0; n < CLASS_SETTINGS.choices && pool.length; n++) {
    const i = Math.floor(hash(run.seed, 31 + n, 77) * pool.length);
    picked.push(pool.splice(i, 1)[0]);
  }
  return picked;
}

function openClassPick() {
  state = 'class';
  world.classPick = { choices: rollClasses() };
  mouse.down = false;
  mouse.moving = false;
  sfx('levelup');
}

function chooseClass(i) {
  const pl = world.player, id = world.classPick && world.classPick.choices[i];
  if (!id) return;
  world.classPick = null;
  state = 'playing';
  setClass(pl, id);
  sfx('perk');
  world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: CLASSES[id].name, life: 1.4, color: COLOR[CLASSES[id].color] });
  systemMessage('HOME: Class Box opened. You are a ' + CLASSES[id].name + ' now. ' + T('Press Space', 'Tap the round button') + ' for ' + CLASSES[id].ability.name + '.', 6);
  saveRun();
}

function setClass(pl, id) {
  pl.class = id;
  pl.abilityCd = 0;
  pl.buff = 0;
  const s = saved.stats;
  s.classesUsed[id] = (s.classesUsed[id] || 0) + 1;
  track('class', id);
}

// every frame while playing: the class box when it is due, the cooldown, and whatever the ability is doing
function updateClass(dt) {
  const pl = world.player;
  if (!pl.class) {
    if (!CLASS_SETTINGS.offer || (world.levelIndex < CLASS_SETTINGS.bossFloor + 1 && !(world.levelIndex === CLASS_SETTINGS.bossFloor && world.bossDefeated))) return;
    if ((world.classWait -= dt) <= 0) openClassPick();
    return;
  }
  if (pl.abilityCd > 0) pl.abilityCd -= dt;
  if (pl.buff > 0) {
    pl.buff -= dt;
    if (Math.random() < dt * 40) particle(pl.x + randRange(-6, 6), pl.y - randRange(0, 12), randRange(-8, 8), randRange(-30, -10), Math.random() < 0.5 ? COLOR.O : COLOR.y, 0.5);
  }
  if (pl.dashTime > 0 && Math.random() < 0.9) particle(pl.x + randRange(-3, 3), pl.y - randRange(0, 8), 0, 0, Math.random() < 0.5 ? COLOR.l : COLOR.W, 0.3);
  updateTurrets(dt);
}

// ---------- The abilities ----------

const ABILITIES = {
  brawler(pl) {
    for (let i = world.enemyBullets.length - 1; i >= 0; i--) {
      const b = world.enemyBullets[i];
      if (Math.hypot(b.x - pl.x, b.y - (pl.y - 4)) < ABILITY.shockRadius + 6) world.enemyBullets.splice(i, 1);
    }
    explodeAt({ x: pl.x, y: pl.y - 4, vx: 0, vy: 0, explode: { radius: ABILITY.shockRadius, damage: Math.round(ABILITY.shockDamage * (1 + stat('damage')) * 10) / 10 }, knockbackMult: 3 });
  },
  engineer(pl) {
    while (world.turrets.length >= ABILITY.turretMax) world.turrets.shift();
    // a little in front of the player, if there is room
    let x = pl.x + Math.cos(pl.aim) * 14, y = pl.y + Math.sin(pl.aim) * 14 + 2;
    if (isSolid(world.level, Math.floor(x / TILE), Math.floor((y - 2) / TILE))) { x = pl.x; y = pl.y + 2; }
    world.turrets.push({ x, y, life: ABILITY.turretTime, wait: 0.3, aim: pl.aim });
    puff(x, y);
    sfx('turret', pl.x, pl.y);
  },
  runner(pl) {
    let dx = pl.vx, dy = pl.vy;
    if (Math.hypot(dx, dy) < 20) { dx = Math.cos(pl.aim); dy = Math.sin(pl.aim); }   // standing still: towards where you aim
    const l = Math.hypot(dx, dy) || 1;
    pl.dashX = dx / l * ABILITY.dashSpeed; pl.dashY = dy / l * ABILITY.dashSpeed;
    pl.dashTime = ABILITY.dashTime;
    pl.invulnerable = Math.max(pl.invulnerable, ABILITY.dashSafe);
    sfx('runnerDash');
  },
  showman(pl) {
    pl.buff = ABILITY.showTime;
    addViewers(ABILITY.showViewers);
    for (let p = 0; p < 18; p++) particle(pl.x, pl.y - 6, randRange(-60, 60), randRange(-70, -10), p % 2 ? COLOR.O : COLOR.y, randRange(0.4, 0.8));
    world.floatingTexts.push({ x: pl.x, y: pl.y - 26, text: 'SHOWTIME!', life: 1.2, color: COLOR.O });
  },
  scavenger(pl) {
    for (const d of world.drops) d.vacuum = true;
    pl.life = Math.min(maxLife(), pl.life + ABILITY.vacuumHeal);
    world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: '+' + ABILITY.vacuumHeal, life: 0.9, color: COLOR.l });
    for (let p = 0; p < 14; p++) particle(pl.x + randRange(-14, 14), pl.y - 4 + randRange(-14, 14), 0, 0, p % 2 ? COLOR.u : COLOR.c, 0.35);
  },
};

// Space (or the button). Returns true if the ability went off.
function useAbility() {
  const pl = world.player, c = playerClass(pl);
  if (state !== 'playing' || !c) return false;
  if (pl.abilityCd > 0) { sfx('deny'); return false; }
  ABILITIES[pl.class](pl);
  pl.abilityCd = c.ability.cooldown;
  if (pl.class !== 'runner' && pl.class !== 'engineer') sfx('ability');
  track('ability', pl.class);
  return true;
}

// ---------- Turrets ----------

function updateTurrets(dt) {
  const lv = world.level;
  for (let i = world.turrets.length - 1; i >= 0; i--) {
    const t = world.turrets[i];
    t.life -= dt;
    if (t.life <= 0) { puff(t.x, t.y); world.turrets.splice(i, 1); continue; }
    t.wait -= dt;
    let best = null, bestDist = ABILITY.turretRange;
    for (const f of world.enemies) {
      const d = Math.hypot(f.x - t.x, f.y - (t.y - 4));
      if (d >= bestDist) continue;
      let clear = true;
      for (let s = 1; s < 8 && clear; s++) {
        if (blocksBullets(lv, Math.floor((t.x + (f.x - t.x) * s / 8) / TILE), Math.floor((t.y + (f.y - t.y) * s / 8) / TILE))) clear = false;
      }
      if (clear) { best = f; bestDist = d; }
    }
    if (!best) continue;
    t.aim = Math.atan2(best.y - (t.y - 4), best.x - t.x);
    if (t.wait > 0) continue;
    t.wait = 1 / ABILITY.turretRate;
    const damage = Math.round(ABILITY.turretDamage * (1 + stat('damage')) * 10) / 10;
    world.bullets.push({
      x: t.x + Math.cos(t.aim) * 6, y: t.y - 4 + Math.sin(t.aim) * 6, vx: Math.cos(t.aim) * 220, vy: Math.sin(t.aim) * 220,
      life: ABILITY.turretRange / 220 + 0.1, damage, image: 'tracer', color: '#fee761', knockbackMult: 0.4, hit: null, drop: PLAYER.shotHeight, bounces: 0,
    });
    sfx('fire:minigun', t.x, t.y);
  }
}

function drawTurret(t) {
  const x = Math.round(t.x), y = Math.round(t.y), blink = t.life < 2 && Math.floor(t.life * 8) % 2 === 0;
  if (blink) return;
  shadow(x, y + 1, 10);
  ctx.fillStyle = COLOR.K; ctx.fillRect(x - 5, y - 4, 10, 6);
  ctx.fillStyle = COLOR.s; ctx.fillRect(x - 4, y - 3, 8, 4);
  ctx.fillStyle = COLOR.c; ctx.fillRect(x - 4, y - 3, 8, 1);
  const c = Math.cos(t.aim), s = Math.sin(t.aim), bx = x + Math.round(c * 4), by = y - 6 + Math.round(s * 4);
  ctx.fillStyle = COLOR.K; ctx.fillRect(x - 3, y - 8, 6, 5);
  ctx.fillStyle = COLOR.S; ctx.fillRect(x - 2, y - 7, 4, 3);
  ctx.fillStyle = COLOR.K; ctx.fillRect(bx - 1, by - 1, 3, 3);
  ctx.fillStyle = COLOR.g; ctx.fillRect(bx, by, 1, 1);
}

// ---------- The button and the choice on the screen ----------

// the ability button sits to the right of the hotbar
function abilityRect() {
  const r = 18, m = 2, n = BAG.hotbarSlots;
  const x0 = Math.round(SCREEN_W / 2 - (n * r + (n - 1) * m) / 2);
  return { x: x0 + n * (r + m) + 3, y: SCREEN_H - r - 4, w: r, h: r };
}
const abilityShown = () => state === 'playing' && !!playerClass(world.player);

// a 10 x 10 picture of each ability, drawn from the middle (cx, cy)
const ABILITY_ICONS = {
  brawler(cx, cy, c) {
    ring(cx, cy, 4, c); ring(cx, cy, 2, c);
    ctx.fillStyle = c; ctx.fillRect(cx, cy, 1, 1);
  },
  engineer(cx, cy, c) {
    ctx.fillStyle = c;
    ctx.fillRect(cx - 4, cy + 1, 9, 3); ctx.fillRect(cx - 2, cy - 2, 5, 3); ctx.fillRect(cx + 1, cy - 4, 5, 2);
  },
  runner(cx, cy, c) {
    ctx.fillStyle = c;
    for (const dy of [-3, 0, 3]) { ctx.fillRect(cx - 4, cy + dy, 3, 1); ctx.fillRect(cx - 1, cy + dy, 6, 1); }
    ctx.fillRect(cx + 3, cy - 4, 1, 3); ctx.fillRect(cx + 4, cy - 1, 1, 3); ctx.fillRect(cx + 3, cy + 2, 1, 3);
  },
  showman(cx, cy, c) {
    ctx.fillStyle = c;
    ctx.fillRect(cx, cy - 4, 1, 9); ctx.fillRect(cx - 4, cy, 9, 1);
    ctx.fillRect(cx - 2, cy - 2, 5, 5); ctx.fillStyle = COLOR.K; ctx.fillRect(cx - 1, cy - 1, 3, 3);
    ctx.fillStyle = c; ctx.fillRect(cx, cy, 1, 1);
  },
  scavenger(cx, cy, c) {
    ctx.fillStyle = c;
    ctx.fillRect(cx - 4, cy - 4, 3, 7); ctx.fillRect(cx + 2, cy - 4, 3, 7); ctx.fillRect(cx - 4, cy + 3, 9, 2);
    ctx.fillStyle = COLOR.W; ctx.fillRect(cx - 4, cy - 4, 3, 2); ctx.fillRect(cx + 2, cy - 4, 3, 2);
  },
};

function drawAbilityButton() {
  const pl = world.player, c = playerClass(pl);
  if (!c) return;
  const b = abilityRect(), color = COLOR[c.color], ready = pl.abilityCd <= 0, active = pl.buff > 0 || pl.dashTime > 0;
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ABILITY_ICONS[pl.class](b.x + 9, b.y + 9, ready || active ? color : COLOR.g);
  if (!ready) {
    // the cooldown fills the button from the top
    ctx.fillStyle = 'rgba(24,20,37,0.7)';
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, Math.round((b.h - 2) * pl.abilityCd / c.ability.cooldown));
  }
  border(b.x, b.y, b.w, b.h, ready ? (Math.floor(time * 3) % 2 && !active ? COLOR.W : color) : COLOR.D);
  if (ready) drawText(T('Space', 'Tap'), b.x + b.w / 2, b.y - 8, color, { align: 'center' });
  else drawText(String(Math.ceil(pl.abilityCd)), b.x + b.w / 2, b.y - 8, COLOR.g, { align: 'center' });
}

// the three cards of the Class Box
const classCard = i => ({ x: 11 + i * 102, y: 34, w: 94, h: 122 });

function classUnderMouse() {
  if (!mouse.inside || !world.classPick) return -1;
  return world.classPick.choices.findIndex((id, i) => { const c = classCard(i); return mouse.x >= c.x && mouse.x < c.x + c.w && mouse.y >= c.y && mouse.y < c.y + c.h; });
}

function clickClass() {
  const i = classUnderMouse();
  if (i >= 0) chooseClass(i);
}

function drawClassPick() {
  const over = classUnderMouse();
  dim(0.78);
  drawText('CLASS BOX', BASE_W / 2, 7, COLOR.O, { scale: 2, align: 'center', shadow: COLOR.x });
  drawText('HOME says congratulations on floor three. Pick a class for this run.', BASE_W / 2, 24, COLOR.S, { align: 'center' });
  world.classPick.choices.forEach((id, i) => {
    const c = classCard(i), cl = CLASSES[id], color = COLOR[cl.color], hover = i === over;
    ctx.fillStyle = hover ? 'rgba(58,68,102,0.95)' : 'rgba(24,20,37,0.95)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    border(c.x, c.y, c.w, c.h, hover ? COLOR.W : color);
    ctx.fillStyle = color;
    ctx.fillRect(c.x, c.y, c.w, 2);
    drawText(String(i + 1), c.x + 6, c.y + 7, COLOR.g);
    drawText(cl.name, c.x + 16, c.y + 7, COLOR.W);
    drawText(cl.tag, c.x + 6, c.y + 18, color);
    Object.entries(cl.stats).forEach(([name, value], n) => {
      drawText(formatStat(name, value) + ' ' + STAT_INFO[name].label, c.x + 6, c.y + 30 + n * 8, COLOR.l);
    });
    const ay = c.y + 30 + 3 * 8 + 5;
    ctx.fillStyle = COLOR.D; ctx.fillRect(c.x + 6, ay - 3, c.w - 12, 1);
    ABILITY_ICONS[id](c.x + 11, ay + 7, color);
    drawText(cl.ability.name, c.x + 20, ay + 2, color);
    drawText(cl.ability.cooldown + ' s', c.x + 20, ay + 10, COLOR.g);
    wrapLines(cl.ability.text, c.w - 12).forEach((l, n) => drawText(l, c.x + 6, ay + 20 + n * 8, COLOR.a));
  });
  drawText(T('Click a card or press 1, 2 or 3', 'Tap a card'), BASE_W / 2, 164, COLOR.g, { align: 'center' });
}
