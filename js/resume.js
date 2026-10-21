"use strict";

// ---------- Continue a run ----------
// The run is saved now and then (every few seconds, when the game is hidden, and when a new floor starts) in its own place in
// localStorage, apart from the permanent progress in progress.js. Continuing starts the floor you were on from its beginning
// again, with everything the player carries: weapons, ammo, clothes, level, perks, hearts and the viewers meter.
// Dying or winning ends the run and throws the save away. Whatever is read back is checked, since anything could be in storage.

const runKey = (i = activeSlot) => slotKey('run', i);
const RUN_SAVE_EVERY = 8;   // seconds
let lastRunSave = 0;

const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(v) || 0)));

// Reads and checks the saved run. Returns null if there is none or it does not look right.
function readRun() {
  try {
    const d = JSON.parse(localStorage.getItem(runKey()));
    if (!d || typeof d !== 'object' || !Array.isArray(d.slots) || d.slots.length !== BAG.equipStart + GEAR_SLOTS.length) return null;
    const run = {
      floor: clampInt(d.floor, 0, d.offScript ? 999 : LEVEL_ORDER.length - 1),
      seed: clampInt(d.seed, 0, 1e6), season: clampInt(d.season, 37, 9999), cycle: clampInt(d.cycle, 0, CYCLE.maxCycle),
      offScript: d.offScript === true, seasonWon: d.seasonWon === true, finale: d.finale === true,
      life: Math.max(1, Number(d.life) || 1),
      slots: d.slots.map((t, i) => (typeof t === 'string' && (isWeapon(t) || isGear(t)) && canPlace(t, i)) ? t : null),
      ammo: {}, gearLevel: {}, perks: {}, boxBag: emptyBoxBag(),
      class: typeof d.class === 'string' && CLASSES[d.class] ? d.class : null,
      starter: typeof d.starter === 'string' && WEAPONS[d.starter] ? d.starter : 'rubberBandGun',
      fame: Math.max(0, Number(d.fame) || 0), boxes: clampInt(d.boxes, 0, 999),
      active: clampInt(d.active, 0, BAG.hotbarSlots - 1),
      xp: Math.max(0, Number(d.xp) || 0), level: clampInt(d.level, 1, 99), pending: clampInt(d.pending, 0, 50), runGold: clampInt(d.runGold, 0, 1e9),
    };
    for (const tier of BOX_ORDER) run.boxBag[tier] = clampInt(d.boxBag && d.boxBag[tier], 0, 99);
    for (const id in WEAPONS) if (d.ammo && d.ammo[id] > 0) run.ammo[id] = clampInt(d.ammo[id], 0, WEAPONS[id].ammoMax || 0);
    for (const id in GEAR) if (d.gearLevel && d.gearLevel[id] > 0) run.gearLevel[id] = clampInt(d.gearLevel[id], 0, GEAR_UPGRADE.maxLevel);
    for (const id in PERKS) if (!PERKS[id].effect && d.perks && d.perks[id] > 0) run.perks[id] = clampInt(d.perks[id], 0, PERKS[id].max);
    return run;
  } catch (e) { return null; }
}

let savedRun = readRun();   // what the title screen offers to continue

function saveRun() {
  if (!world || !['playing', 'pause', 'bag', 'levelup', 'safe', 'story', 'class', 'map'].includes(state) || world.player.life <= 0) return;
  const pl = world.player;
  const data = { floor: world.levelIndex, life: pl.life, slots: pl.slots, ammo: pl.ammo, gearLevel: pl.gearLevel, perks: pl.perks, starter: pl.starter, fame: pl.fame, boxes: pl.boxes,
    active: pl.active, xp: pl.xp, level: pl.level, pending: pl.pending, runGold: pl.runGold, boxBag: pl.boxBag,
    class: pl.class,
    seed: run.seed, season: run.season, cycle: run.cycle, offScript: run.offScript, seasonWon: run.seasonWon, finale: run.finale };
  lastRunSave = time;
  try { localStorage.setItem(runKey(), JSON.stringify(data)); } catch (e) { return; /* storage may be blocked */ }
  savedRun = readRun();
}

function clearRun() {
  savedRun = null;
  try { localStorage.removeItem(runKey()); } catch (e) { /* storage may be blocked */ }
}

// From the pause menu: the run is saved, and the title screen offers to continue it.
function leaveToMenu() {
  saveRun();
  world = newWorld(0);
  state = 'title';
  mouse.down = false;
  mouse.moving = false;
  sfx('uiClick');
}

// every frame while playing
function updateRunSave() {
  if (time - lastRunSave > RUN_SAVE_EVERY) saveRun();
}

function resumeRun() {
  const d = savedRun;
  if (!d) return;
  resetRun();
  Object.assign(run, { seed: d.seed, season: d.season, cycle: d.cycle, offScript: d.offScript, seasonWon: d.seasonWon });
  world = newWorld(d.floor);
  floorStarted();
  const pl = world.player;
  Object.assign(pl, { slots: d.slots, ammo: d.ammo, gearLevel: d.gearLevel, perks: d.perks, starter: d.starter, fame: d.fame, boxes: d.boxes, active: d.active,
    xp: d.xp, level: d.level, pending: d.pending, runGold: d.runGold, boxBag: d.boxBag, class: d.class });
  for (const type of pl.slots.slice()) if (isWeapon(type) && !isInfinite(pl, type) && !(pl.ammo[type] > 0)) useUp(pl, type);   // empty weapons are gone
  updateActive(pl);
  pl.lastMax = maxLife();
  pl.life = Math.min(d.life, pl.lastMax);
  world.hasWalked = world.hasShot = world.hasFound = world.hasFoundGear = true;
  world.helpAlpha = 0;
  camera.x = clamp(pl.x - SCREEN_W / 2, 0, Math.max(0, world.level.b * TILE - SCREEN_W));
  camera.y = clamp(pl.y - SCREEN_H / 2, 0, Math.max(0, world.level.h * TILE - SCREEN_H));
  state = 'playing';
  lastRunSave = time;
  sfx('start');
  systemMessage('Welcome back. Floor ' + (d.floor + 1) + ' starts over, and you keep everything you carry.', 5);
  systemMessage(world.level.briefing || 'Complete the objectives to open the boss gate.', 6);
  if (d.finale) seasonFinale();   // the run was left at the finale: offer it again
}

// ---------- The buttons of the title screen ----------

const RUN_BUTTON_Y = 90;
function runButtons() {
  const labels = ['Continue: floor ' + (savedRun.floor + 1) + T(' (C)', ''), 'New run' + T(' (N)', '')];
  const widths = labels.map(l => textWidth(l) + 20), gap = 8, total = widths[0] + widths[1] + gap;
  const x = Math.round(BASE_W / 2 - total / 2);
  return [{ x, y: RUN_BUTTON_Y, w: widths[0], h: 17, label: labels[0] }, { x: x + widths[0] + gap, y: RUN_BUTTON_Y, w: widths[1], h: 17, label: labels[1] }];
}
const overContinue = () => state === 'title' && !!savedRun && inBox(runButtons()[0]);
const overNewRun = () => state === 'title' && !!savedRun && inBox(runButtons()[1]);

function drawRunButtons() {
  runButtons().forEach((b, i) => {
    drawButton(b, b.label, i === 0 ? overContinue() : overNewRun());
    if (i === 0) border(b.x, b.y, b.w, b.h, COLOR.O);
  });
}

window.addEventListener('pagehide', saveRun);
