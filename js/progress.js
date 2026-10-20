"use strict";

// ---------- Progress: saving, exp, levels, gold and drops ----------
// Enemies drop exp gems and gold coins that fly to the player. Exp gives levels, and every level gives a perk (perks.js).
// Gold is kept between runs and spent on upgrades in the shop (shop.js). Perks and upgrades work through stat(), the same
// way clothes do (see gear.js).

// ---------- Saved between runs ----------

const saved = { gold: 0, upgrades: {}, bestFloor: 0, runs: 0, ach: {}, stats: emptyStats(), startWeapon: 'rubberBandGun' };
let saveDirty = false;

// Reads what was saved last time. Anything that looks wrong is thrown away, and if the browser will not give us storage
// the game just starts from nothing.
function loadSaved() {
  saved.gold = 0; saved.upgrades = {}; saved.bestFloor = 0; saved.runs = 0; saved.ach = {}; saved.stats = emptyStats(); saved.startWeapon = 'rubberBandGun';
  try {
    const raw = localStorage.getItem('pixelCrawler.save');
    const data = raw && JSON.parse(raw);
    if (data && typeof data === 'object') {
      for (const key of ['gold', 'bestFloor', 'runs']) saved[key] = Math.max(0, Math.floor(Number(data[key]) || 0));
      for (const id in UPGRADES) {
        const level = Math.floor(Number(data.upgrades && data.upgrades[id]) || 0);
        if (level > 0) saved.upgrades[id] = Math.min(level, UPGRADES[id].max);
      }
      for (const a of ACHIEVEMENTS) if (data.ach && data.ach[a.id]) saved.ach[a.id] = 1;
      const st = data.stats || {};
      for (const key of STAT_NAMES) saved.stats[key] = Math.max(0, Math.floor(Number(st[key]) || 0));
      const count = (from, key) => Math.max(0, Math.floor(Number(from && from[key]) || 0));
      for (const type in ENEMIES) {
        if (count(st.killsBy, type) > 0) saved.stats.killsBy[type] = count(st.killsBy, type);
        if (ENEMIES[type].boss && count(st.bossTypes, type) > 0) saved.stats.bossTypes[type] = count(st.bossTypes, type);
        if (count(st.deathsBy, type) > 0) saved.stats.deathsBy[type] = count(st.deathsBy, type);
      }
      if (count(st.deathsBy, 'hazard') > 0) saved.stats.deathsBy.hazard = count(st.deathsBy, 'hazard');
      for (const id in WEAPONS) if (count(st.killsByWeapon, id) > 0) saved.stats.killsByWeapon[id] = count(st.killsByWeapon, id);
      if (typeof data.startWeapon === 'string' && WEAPONS[data.startWeapon]) saved.startWeapon = data.startWeapon;
    }
  } catch (e) { /* nothing saved, or storage is blocked */ }
}

function saveGame() {
  saveDirty = false;
  try { localStorage.setItem('pixelCrawler.save', JSON.stringify(saved)); } catch (e) { /* storage may be blocked */ }
}

// Called when a run ends, by dying or by winning.
function endRun(won = false) {
  saved.runs++;
  saved.bestFloor = Math.max(saved.bestFloor, world.levelIndex + 1);
  track(won ? 'won' : 'dead');
  saveGame();
}

loadSaved();
window.addEventListener('pagehide', saveGame);

// ---------- Exp and gold ----------

const expNeeded = level => Math.round(EXP.first * Math.pow(EXP.growth, level - 1));

function gainExp(amount) {
  const pl = world.player;
  pl.xp += amount * (1 + stat('xpGain'));
  while (pl.xp >= expNeeded(pl.level)) {
    pl.xp -= expNeeded(pl.level);
    pl.level++;
    saved.stats.levels++;
    pl.pending++;
  }
}

// Gold goes straight into the wallet that is kept between runs.
function awardGold(amount, show) {
  const pl = world.player, value = Math.round(amount * (1 + stat('goldGain')));
  saved.gold += value;
  saved.stats.goldEarned += value;
  pl.runGold += value;
  saveDirty = true;
  if (show) world.floatingTexts.push({ x: pl.x, y: pl.y - 26, text: '+' + value + ' gold', life: 1.2, color: COLOR.O });
  return value;
}

// ---------- Gems and coins ----------

// A total is split into the biggest gems or coins that fit: 32 becomes 25 + 5 + 1 + 1.
function spawnDrops(kind, x, y, total) {
  const values = kind === 'gem' ? EXP.gemValues : EXP.coinValues;
  let rest = Math.round(total);
  while (rest > 0) {
    const value = values.find(v => v <= rest);
    rest -= value;
    world.drops.push({ kind, value, x, y, vx: randRange(-60, 60), vy: randRange(-60, 60), age: 0 });
    if (world.drops.length > EXP.maxDrops) collectDrop(world.drops.shift());   // too many on the floor: the oldest is taken at once
  }
}

function collectDrop(d) {
  if (d.kind === 'gem') { gainExp(d.value); sfx('gem'); }
  else { awardGold(d.value); sfx('coin'); }
  const color = d.kind === 'gem' ? COLOR.c : COLOR.O;
  for (let p = 0; p < 3; p++) particle(d.x, d.y, randRange(-25, 25), randRange(-35, 0), color, 0.25);
}

// Drops slide a little, then wait. Close to the player they are pulled in, faster the nearer they are.
function updateDrops(dt) {
  const pl = world.player, lv = world.level, radius = EXP.magnet + stat('pickupRange');
  for (let i = world.drops.length - 1; i >= 0; i--) {
    const d = world.drops[i];
    d.age += dt;
    const dx = pl.x - d.x, dy = pl.y - 4 - d.y, distance = Math.hypot(dx, dy) || 1;
    if (d.age > 0.3 && distance < radius) {
      const speed = 120 + (radius - distance) * 8;
      d.vx = dx / distance * speed; d.vy = dy / distance * speed;
      d.x += d.vx * dt; d.y += d.vy * dt;
    } else {
      const friction = Math.exp(-dt * 5);
      d.vx *= friction; d.vy *= friction;
      const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt;
      if (isSolid(lv, Math.floor(nx / TILE), Math.floor(d.y / TILE))) d.vx *= -0.3; else d.x = nx;
      if (isSolid(lv, Math.floor(d.x / TILE), Math.floor(ny / TILE))) d.vy *= -0.3; else d.y = ny;
    }
    if (distance < 6) {
      collectDrop(d);
      world.drops.splice(i, 1);
    }
  }
  if (saveDirty && (world.saveTime = (world.saveTime || 0) + dt) > 3) { world.saveTime = 0; saveGame(); }
}

// ---------- Drawing ----------

// A little diamond for exp and a round coin for gold. The bigger the value, the bigger it is.
function makeGem(color, r) {
  const [c, g] = createCanvas(2 * r + 1, 2 * r + 1);
  for (const [grow, paint] of [[0, COLOR.K], [-1, COLOR[color]]]) {
    g.fillStyle = paint;
    for (let y = -r; y <= r; y++) {
      const half = r - Math.abs(y) + grow;
      if (half >= 0) g.fillRect(r - half, r + y, 2 * half + 1, 1);
    }
  }
  g.fillStyle = COLOR.W;
  g.fillRect(r - 1, r - 1, 1, 1);
  return c;
}

function makeCoin(color, r) {
  const [c, g] = createCanvas(2 * r + 3, 2 * r + 3);
  fillEllipse(g, r + 1, r + 1, r + 1, r + 1, COLOR.K);
  fillEllipse(g, r + 1, r + 1, r, r, COLOR[color]);
  g.fillStyle = COLOR.W;
  g.fillRect(r, r, 1, 1);
  return c;
}

const GEM_SPRITES = { 1: makeGem('c', 2), 5: makeGem('l', 3), 25: makeGem('m', 4) };
const COIN_SPRITES = { 1: makeCoin('u', 1), 5: makeCoin('S', 2), 25: makeCoin('O', 3) };

function drawDrop(d) {
  const image = (d.kind === 'gem' ? GEM_SPRITES : COIN_SPRITES)[d.value];
  const bob = Math.round(Math.sin(time * 5 + d.x) * 1);
  ctx.drawImage(image, Math.round(d.x) - (image.width >> 1), Math.round(d.y) - (image.height >> 1) + bob);
}

// The exp bar along the bottom edge, the level and the gold.
function drawProgressHud() {
  const pl = world.player, need = expNeeded(pl.level);
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(0, SCREEN_H - 2, SCREEN_W, 2);
  ctx.fillStyle = COLOR.c;
  ctx.fillRect(0, SCREEN_H - 2, Math.round(SCREEN_W * Math.min(1, pl.xp / need)), 2);
  drawText('Lv ' + pl.level, SCREEN_W - 5, SCREEN_H - 18, COLOR.c, { align: 'right' });
  drawText(saved.gold + ' gold', SCREEN_W - 5, SCREEN_H - 27, COLOR.O, { align: 'right' });
}
