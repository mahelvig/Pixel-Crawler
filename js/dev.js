"use strict";

// ---------- Developer mode ----------
// For testing the floors quickly. Press ` (the key under Esc) to switch it on and cycle the help panel, or open
// index.html#dev to start with it on. While it is on, the keys in DEV_KEYS work during play.

const dev = { on: false, help: true, god: false, ammo: false, noclip: false, fast: false, teleport: 0 };

// start with it on when the address ends in #dev or has ?dev
if (typeof location !== 'undefined' && /(^|[#?&])dev\b/.test(String(location.hash) + String(location.search))) dev.on = true;

// ` goes from off, to on with help, to on without help, and back to off
function devCycle() {
  if (!dev.on) { dev.on = true; dev.help = true; }
  else if (dev.help) dev.help = false;
  else dev.on = false;
  if (dev.on && world) systemMessage('Developer mode ' + (dev.help ? 'on' : 'on, help hidden') + '.', 2);
}

const devNote = text => systemMessage('DEV: ' + text, 2);

// ---------- Actions ----------

// Takes the player to any floor right away, keeping their weapons.
function devGoto(index) {
  const i = clamp(index, 0, LEVEL_ORDER.length - 1);
  goToLevel(i);
  devNote('floor ' + (i + 1) + ', ' + world.level.name);
}

// Does what each objective asks for, so the gate opens.
function devCompleteObjectives() {
  const w = world;
  for (const o of w.level.objectives) {
    if (o.type === 'kill') for (const f of [...w.enemies]) if (!f.minion && !ENEMIES[f.type].boss) killEnemy(f);
    if (o.type === 'targets') for (const t of w.targets) hitTarget(t, { x: t.x, y: t.y, vx: 1, vy: 0, damage: 1 });
    if (o.type === 'destroy') for (const b of [...w.breakables]) if (b.kind === o.what) destroyBreakable(b);
    if (o.type === 'collect') {
      for (const p of [...w.pickups]) if (p.kind === o.what) { w.pickups.splice(w.pickups.indexOf(p), 1); w.collected[p.kind] = (w.collected[p.kind] || 0) + 1; }
    }
    if (o.type === 'killType') for (const f of [...w.enemies]) if (f.type === o.enemy && !f.minion) killEnemy(f);
    if (o.type === 'survive') w.surviveTime = o.seconds;
  }
  updateObjectives(0);
}

function devBoss() {
  if (!world.gateOpen) devCompleteObjectives();
  if (!world.gateOpen && world.level.gate) openGate();
  return world.enemies.find(f => ENEMIES[f.type].boss);
}

function devKillBoss() {
  const boss = devBoss();
  if (boss) hitEnemy(boss, { x: boss.x, y: boss.y, vx: 1, vy: 0, damage: 99999, knockbackMult: 1 });
  devNote(boss ? 'boss killed' : 'no boss here');
}

// Clears the floor completely and goes down the stairs.
function devSkipFloor() {
  devKillBoss();
  if (world.stairs) { world.stairs.active = true; world.stairs.time = 1; }
  devNote('skipping the floor');
  nextLevel();
}

function devKillAll() {
  for (const f of [...world.enemies]) if (!ENEMIES[f.type].boss) killEnemy(f);
  devNote('all enemies dead');
}

function devGiveWeapons() {
  const pl = world.player;
  for (const type of Object.keys(WEAPONS)) {
    if (!pl.slots.includes(type)) {
      const free = freeSlot(pl, type);
      if (free < 0) break;
      pl.slots[free] = type;
    }
    pl.ammo[type] = WEAPONS[type].ammoMax || 0;
  }
  updateActive(pl);
  devNote('every weapon, full ammo');
}

// Puts on the best clothes there are: the legendary things first, then the best of the rest.
function devDress() {
  const pl = world.player, rank = id => ['common', 'rare', 'legendary'].indexOf(GEAR[id].rarity);
  const best = Object.keys(GEAR).sort((a, b) => rank(b) - rank(a));
  GEAR_SLOTS.forEach((slot, i) => {
    const used = pl.slots.slice(BAG.equipStart, BAG.equipStart + i);
    const id = best.find(g => GEAR[g].slot === slot && !used.includes(g));
    if (id) pl.slots[BAG.equipStart + i] = id;
  });
  devNote('wearing the best clothes');
}

// Cycles through the places that matter on a floor: the stairs, the boss, the gate and the start.
function devTeleport() {
  const lv = world.level, pl = world.player;
  const places = [['stairs', lv.stairs], ['boss room', lv.bossSpawn], ['gate', lv.gate && { x: lv.gate.tiles[0].x * TILE + TILE, y: lv.gate.tiles[0].y * TILE - 8 }], ['start', lv.start]].filter(p => p[1]);
  const [name, spot] = places[dev.teleport++ % places.length];
  pl.x = spot.x; pl.y = spot.y; pl.vx = pl.vy = 0;
  camera.x = clamp(pl.x - SCREEN_W / 2, 0, Math.max(0, lv.b * TILE - SCREEN_W));
  camera.y = clamp(pl.y - SCREEN_H / 2, 0, Math.max(0, lv.h * TILE - SCREEN_H));
  devNote('teleported to the ' + name);
}

const devToggle = (key, name) => () => { dev[key] = !dev[key]; devNote(name + (dev[key] ? ' on' : ' off')); };

// code: [label for the help panel, what it does, name of the flag it toggles (to show ON or OFF)]
const DEV_KEYS = {
  BracketLeft: ['[', 'floor down', () => devGoto(world.levelIndex - 1)],
  BracketRight: [']', 'floor up', () => devGoto(world.levelIndex + 1)],
  KeyN: ['N', 'skip this floor', devSkipFloor],
  KeyO: ['O', 'do the objectives', () => { devCompleteObjectives(); devNote('objectives done'); }],
  KeyB: ['B', 'kill the boss', devKillBoss],
  KeyK: ['K', 'kill all enemies', devKillAll],
  KeyT: ['T', 'teleport', devTeleport],
  KeyH: ['H', 'heal', () => { world.player.life = maxLife(); devNote('healed'); }],
  KeyL: ['L', 'all weapons', devGiveWeapons],
  KeyJ: ['J', 'gold +500', () => { saved.gold += 500; saveGame(); devNote('+500 gold'); }],
  KeyZ: ['Z', 'level up', () => { gainExp(expNeeded(world.player.level) - world.player.xp + 0.001); devNote('level up'); }],
  KeyY: ['Y', 'wear the best', devDress],
  KeyG: ['G', 'god mode', devToggle('god', 'god mode'), 'god'],
  KeyU: ['U', 'unlimited ammo', devToggle('ammo', 'unlimited ammo'), 'ammo'],
  KeyV: ['V', 'walk through walls', devToggle('noclip', 'noclip'), 'noclip'],
  KeyF: ['F', 'fast', devToggle('fast', 'fast'), 'fast'],
};

// Returns true if the key was a developer key (so the game should ignore it).
function devKey(code) {
  if (!dev.on || state !== 'playing' || !DEV_KEYS[code]) return false;
  DEV_KEYS[code][2]();
  return true;
}

// ---------- The panel ----------

function drawDevPanel() {
  if (!dev.on) return;
  const lines = [];
  lines.push(['DEV  floor ' + (world.levelIndex + 1) + '/' + LEVEL_ORDER.length + '  enemies ' + world.enemies.length, COLOR.y]);
  if (dev.help) {
    for (const [code, [key, label, , flag]] of Object.entries(DEV_KEYS)) {
      const on = flag && dev[flag];
      lines.push([key + ' ' + label + (flag ? (on ? '  ON' : '  off') : ''), on ? COLOR.l : COLOR.S]);
    }
    lines.push(['` hide help', COLOR.g]);
  }
  const w = Math.max(...lines.map(l => textWidth(l[0]))) + 8, x = 4, y = world.helpAlpha > 0 ? 44 : 4;
  ctx.fillStyle = 'rgba(24,20,37,0.8)';
  ctx.fillRect(x, y, w, lines.length * 8 + 4);
  border(x, y, w, lines.length * 8 + 4, COLOR.y);
  lines.forEach(([text, color], i) => drawText(text, x + 4, y + 4 + i * 8, color, { shadow: null }));
}
