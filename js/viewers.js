"use strict";

// ---------- The viewers ----------
// The dungeon is a show, and the audience likes what it sees. Playing with style (killing in quick runs, critical hits, smashing
// things, finishing objectives, beating bosses without a scratch) fills the viewers meter. When it is full, the sponsors send a
// box (bronze, silver, gold or platinum, see BOX_TIERS) and the meter starts over, a little harder to fill every time. If nothing
// exciting happens for a while the viewers get bored and the meter drains. The numbers are in VIEWERS in settings.js.
// The meter, and how many boxes have come this run, live on the player (pl.fame, pl.boxes) and follow them down the stairs.

// How much the meter has to hold for the next box.
const viewersNeed = pl => Math.min(VIEWERS.maxNeed, VIEWERS.base + VIEWERS.perBox * pl.boxes);

function addViewers(amount) {
  if (!world || state !== 'playing') return;
  const pl = world.player;
  if (!saved.stats.boxes && !run.viewersHint) {
    run.viewersHint = true;
    systemMessage('The viewers are watching! Kill with style and your sponsors will send a box.', 5);
  }
  pl.fame = Math.min(viewersNeed(pl), pl.fame + amount);
  pl.fameIdle = 0;
  if (pl.fame >= viewersNeed(pl)) sponsorBox(pl);
}

// What the meter reacts to (the events come from track in achievements.js).
const VIEWER_EVENTS = { crit: 'crit', destroyed: 'destroy', objective: 'objective', target: 'target' };

function viewerReaction(event) {
  const amount = VIEWERS[VIEWER_EVENTS[event]];
  if (amount) addViewers(amount);
}

// Picks the tier of a box: better ones get more likely on deeper floors and with luck.
function pickBoxTier() {
  const luck = 1 + stat('luck'), weights = Object.keys(VIEWERS.tiers).map(t => VIEWERS.tiers[t] * (t === 'bronze' ? 1 : luck) + VIEWERS.tierPerFloor[t] * world.levelIndex);
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  const names = Object.keys(VIEWERS.tiers);
  for (let i = 0; i < names.length; i++) if ((r -= weights[i]) < 0) return names[i];
  return names[0];
}

function sponsorBox(pl) {
  const tier = pickBoxTier();
  pl.fame = 0;
  pl.boxes++;
  run.boxes++;
  dropBox(tier);
  sfx('objective');
  world.floatingTexts.push({ x: pl.x, y: pl.y - 26, text: 'SPONSOR BOX!', life: 1.4, color: COLOR.m });
  for (let p = 0; p < 12; p++) particle(pl.x, pl.y - 8, randRange(-45, 45), randRange(-60, 0), p % 2 ? COLOR.m : COLOR.y, 0.5);
  systemMessage('The viewers love you! Your sponsors send a ' + BOX_TIERS[tier].name + '.', 4);
  track('box');
}

// every frame while playing: the viewers get bored if nothing happens
function updateViewers(dt) {
  const pl = world.player;
  pl.fameIdle += dt;
  if (pl.fameIdle > VIEWERS.idle && pl.fame > 0) pl.fame = Math.max(0, pl.fame - VIEWERS.decay * dt);
}

// the meter at the bottom right, above the gold
function drawViewers() {
  const pl = world.player, need = viewersNeed(pl), share = pl.fame / need;
  const w = 60, x = SCREEN_W - 5 - w, y = SCREEN_H - 41;
  const millions = (0.4 + 5.6 * share + 0.3 * pl.boxes).toFixed(1) + 'M';
  ctx.fillStyle = 'rgba(24,20,37,0.6)';
  ctx.fillRect(x - 4, y - 11, w + 8, 18);
  drawText('Viewers', x, y - 8, COLOR.m);
  drawText(millions, SCREEN_W - 5, y - 8, COLOR.S, { align: 'right' });
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(x - 1, y - 1, w + 2, 6);
  border(x - 1, y - 1, w + 2, 6, share > 0.85 && Math.floor(time * 6) % 2 === 0 ? COLOR.y : COLOR.D);
  ctx.fillStyle = share > 0.85 ? COLOR.y : COLOR.m;
  ctx.fillRect(x, y, Math.round(w * share), 4);
}
