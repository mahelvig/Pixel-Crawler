"use strict";

// ---------- Clothes, hats, shoes, rings and amulets ----------
// The player wears one thing in each of six places (GEAR_SLOTS). They sit in pl.slots after the hotbar and the storage,
// from BAG.equipStart. Every worn item adds its stats (see STAT_INFO), and the rest of the game asks stat('damage') and so on.

const isGear = type => !!GEAR[type];
const isWeapon = type => !!WEAPONS[type];

// The sum of one stat over everything the player wears.
function stat(name) {
  const pl = world && world.player;
  if (!pl) return 0;
  let total = 0;
  for (let i = 0; i < GEAR_SLOTS.length; i++) {
    const type = pl.slots[BAG.equipStart + i], item = GEAR[type];
    if (item && item.stats[name]) total += scaledStat(name, item.stats[name], pl.gearLevel[type]);
  }
  total += progressStat(name) + ruleStat(name);
  return Math.min(total, STAT_INFO[name].cap ?? Infinity);
}

// A stat of a piece of clothing at its upgrade level (0 = as found).
function scaledStat(name, value, level = 0) {
  const v = value * (1 + GEAR_UPGRADE.perLevel * level);
  return STAT_INFO[name].format === 'pct' ? Math.round(v * 1000) / 1000 : Math.round(v);
}

const maxLife = () => Math.max(1, PLAYER.life + stat('maxLife'));

// Picks a rarity by the weights in RARITY. Luck makes the better ones more likely.
function pickRarity() {
  const names = Object.keys(RARITY), luck = stat('luck');
  const weight = n => RARITY[n].weight * (n === 'common' ? 1 : 1 + luck * 2);
  let r = Math.random() * names.reduce((s, n) => s + weight(n), 0);
  for (const n of names) {
    if ((r -= weight(n)) < 0) return n;
  }
  return names[0];
}

// Like pickRarity, but for loot: quality (see LOOT_RARITY) and luck make the better rarities more likely.
function pickLootRarity(quality = 1) {
  const luck = 1 + stat('luck') * 2, names = Object.keys(LOOT_RARITY);
  const w = names.map(n => LOOT_RARITY[n] * (n === 'common' ? 1 : Math.pow(quality, QUALITY_POWER[n]) * luck));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < names.length; i++) if ((r -= w[i]) < 0) return names[i];
  return names[0];
}

function randomGear(rarity, quality = 1) {
  const wanted = rarity || pickLootRarity(quality);
  const order = Object.keys(RARITY);
  // if there is nothing of that rarity, take the next lower one
  for (let i = order.indexOf(wanted); i >= 0; i--) {
    const list = Object.keys(GEAR).filter(id => GEAR[id].rarity === order[i]);
    if (list.length) return list[Math.floor(Math.random() * list.length)];
  }
}

// What an enemy drops: mostly a weapon, sometimes something to wear.
const randomDrop = quality => Math.random() < GEAR_DROP ? randomGear(null, quality) : randomWeapon(quality);

// ---------- Where things may go ----------

// Weapons go on the hotbar or in storage, clothes in storage or in the matching worn place.
function canPlace(type, index) {
  if (!type) return true;
  if (index < BAG.hotbarSlots) return isWeapon(type);
  if (index < BAG.equipStart) return true;
  return isGear(type) && GEAR[type].slot === GEAR_SLOTS[index - BAG.equipStart];
}

// The first empty slot an item can be put in (hotbar and storage only), or -1.
function freeSlot(pl, type) {
  for (let i = isGear(type) ? BAG.hotbarSlots : 0; i < BAG.equipStart; i++) if (!pl.slots[i]) return i;
  return -1;
}

// The place to wear a piece of clothing: an empty one that fits, or else the first one that fits.
function equipSlotFor(pl, type) {
  const indices = [];
  GEAR_SLOTS.forEach((slot, i) => { if (slot === GEAR[type].slot) indices.push(BAG.equipStart + i); });
  return indices.find(i => !pl.slots[i]) ?? indices[0];
}

// ---------- Describing the stats ----------

function formatStat(name, value) {
  const f = STAT_INFO[name].format;
  if (f === 'pct') return '+' + Math.round(value * 100) + '%';
  if (f === 'sec') return '+' + value.toFixed(2).replace(/0$/, '') + 's';
  return '+' + value;
}

// [value, label] for each stat on an item, like ['+10%', 'Damage'].
const statLines = (id, level = 0) => Object.entries(GEAR[id].stats).map(([name, value]) => [formatStat(name, scaledStat(name, value, level)), STAT_INFO[name].label]);

// ---------- Icons ----------
// Each icon is a list of rectangles [x, y, w, h, colour] on a 12x12 grid. The colour is a (main), b (trim) or g (gem).
// A dark outline is drawn first, one pixel around every rectangle.

const GEAR_SHAPES = {
  cap: [[2, 3, 8, 5, 'a'], [3, 2, 6, 1, 'a'], [6, 8, 6, 2, 'b'], [2, 7, 8, 1, 'b']],
  beanie: [[2, 3, 8, 6, 'a'], [3, 2, 6, 1, 'a'], [2, 7, 8, 2, 'b'], [5, 0, 2, 2, 'g']],
  helmet: [[2, 3, 8, 6, 'a'], [3, 2, 6, 1, 'a'], [1, 8, 10, 2, 'b'], [5, 4, 2, 2, 'g']],
  tophat: [[3, 0, 6, 8, 'a'], [3, 5, 6, 1, 'g'], [1, 8, 10, 2, 'b']],
  crown: [[1, 4, 10, 5, 'a'], [1, 2, 2, 2, 'a'], [5, 1, 2, 3, 'a'], [9, 2, 2, 2, 'a'], [5, 6, 2, 2, 'g']],
  foil: [[5, 0, 2, 2, 'a'], [4, 2, 4, 2, 'a'], [3, 4, 6, 2, 'a'], [2, 6, 8, 2, 'a'], [1, 8, 10, 2, 'b']],
  wizard: [[5, 0, 2, 2, 'a'], [4, 2, 4, 2, 'a'], [3, 4, 6, 2, 'a'], [2, 6, 8, 2, 'a'], [0, 8, 12, 2, 'b'], [5, 4, 2, 2, 'g']],
  shirt: [[3, 2, 6, 9, 'a'], [1, 2, 2, 4, 'a'], [9, 2, 2, 4, 'a'], [4, 1, 4, 1, 'b'], [4, 6, 2, 2, 'g']],
  coat: [[2, 1, 8, 10, 'a'], [0, 2, 2, 6, 'a'], [10, 2, 2, 6, 'a'], [5, 1, 2, 10, 'b'], [3, 6, 1, 1, 'g'], [8, 6, 1, 1, 'g']],
  vest: [[2, 1, 8, 10, 'a'], [3, 1, 1, 10, 'b'], [8, 1, 1, 10, 'b'], [5, 5, 2, 2, 'g']],
  shoe: [[2, 4, 4, 5, 'a'], [6, 6, 5, 3, 'a'], [2, 9, 9, 1, 'b'], [3, 5, 2, 1, 'g']],
  boot: [[2, 1, 4, 8, 'a'], [6, 6, 5, 3, 'a'], [2, 9, 9, 1, 'b'], [2, 1, 4, 1, 'b']],
  rocket: [[2, 1, 4, 8, 'a'], [6, 6, 5, 3, 'a'], [2, 9, 9, 1, 'b'], [0, 10, 3, 2, 'g']],
  band: [[3, 5, 6, 1, 'a'], [2, 6, 1, 3, 'a'], [9, 6, 1, 3, 'a'], [3, 9, 6, 1, 'a'], [5, 3, 2, 2, 'g']],
  pendant: [[2, 0, 1, 2, 'b'], [3, 2, 1, 2, 'b'], [8, 0, 1, 2, 'b'], [7, 2, 1, 2, 'b'], [4, 4, 1, 1, 'b'], [6, 4, 1, 1, 'b'], [4, 5, 4, 5, 'a'], [5, 6, 2, 3, 'g']],
  heart: [[3, 4, 2, 2, 'a'], [7, 4, 2, 2, 'a'], [3, 5, 6, 3, 'a'], [4, 8, 4, 1, 'a'], [5, 9, 2, 1, 'a'], [5, 0, 2, 3, 'b']],
  magnet: [[3, 3, 2, 7, 'a'], [7, 3, 2, 7, 'a'], [3, 8, 6, 2, 'a'], [3, 2, 2, 2, 'b'], [7, 2, 2, 2, 'b']],
  clover: [[5, 3, 2, 2, 'a'], [3, 5, 2, 2, 'a'], [7, 5, 2, 2, 'a'], [5, 7, 2, 2, 'a'], [5, 5, 2, 2, 'g'], [5, 9, 1, 2, 'b']],
  whistle: [[3, 4, 6, 4, 'a'], [8, 5, 3, 2, 'a'], [4, 8, 2, 1, 'a'], [4, 2, 4, 1, 'b']],
};

function makeGearIcon(look) {
  const [c, g] = createCanvas(12, 12);
  const rects = GEAR_SHAPES[look.shape];
  g.fillStyle = COLOR.K;
  for (const [x, y, w, h] of rects) g.fillRect(x - 1, y - 1, w + 2, h + 2);
  for (const [x, y, w, h, key] of rects) {
    g.fillStyle = COLOR[look[key] || look.a];
    g.fillRect(x, y, w, h);
  }
  return c;
}

const GEAR_ICONS = {}, GEAR_GLOW = {};
for (const id in GEAR) {
  GEAR_ICONS[id] = makeGearIcon(GEAR[id].look);
  GEAR_GLOW[id] = createSilhouette(GEAR_ICONS[id], RARITY[GEAR[id].rarity].color);
}
