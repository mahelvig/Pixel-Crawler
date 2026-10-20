"use strict";

// ---------- The bag ----------
// The player has hotbar slots (keys 1-4), more slots in the bag, and six places to wear clothes. In pl.slots they come in
// that order (see BAG.equipStart and GEAR_SLOTS). Weapons go on the hotbar or in storage; clothes go in storage or are worn.
// Ammo is kept per weapon type in pl.ammo, so picking up a weapon you already own just adds ammo.

const hasAmmo = (pl, type) => !!type && (!!WEAPONS[type].infinite || (pl.ammo[type] || 0) > 0);
const ammoText = (pl, type) => WEAPONS[type].infinite ? '∞' : String(pl.ammo[type] || 0);

// Picks a rarity (see pickRarity), then a random weapon of that rarity.
// Weapons with infinite ammo never drop, since you can only ever need one of them.
function randomWeapon() {
  const picked = pickRarity();
  const all = Object.keys(WEAPONS).filter(v => !WEAPONS[v].infinite);
  const candidates = all.filter(v => WEAPONS[v].rarity === picked);
  const list = candidates.length ? candidates : all;
  return list[Math.floor(Math.random() * list.length)];
}

// delayed means the item is not picked up until the player has walked a bit away (used when dropping something).
// ammo is how much ammo the item carries; undefined means the weapon's normal pickup amount. type is a weapon or a piece of clothing.
function createItem(type, x, y, delayed = false, ammo = undefined) {
  return { type, x, y, time: Math.random() * 6, delayed, ammo };
}

function updateActive(pl) {
  const type = pl.slots[pl.active];
  pl.weapon = isWeapon(type) ? type : null;
}

function selectSlot(pl, i) {
  if (i === pl.active) return;
  pl.active = i;
  sfx('switch');
  updateActive(pl);
  pl.recoil = 0;
  pl.cooldown = Math.max(pl.cooldown, BAG.switchTime);
}

// Switches to the next hotbar slot that has a weapon with ammo. Returns false if there is none.
function switchToNextWithAmmo(pl) {
  const n = BAG.hotbarSlots;
  for (let i = 1; i < n; i++) {
    const slot = (pl.active + i) % n;
    if (hasAmmo(pl, pl.slots[slot])) { selectSlot(pl, slot); return true; }
  }
  return false;
}

function updateItems(dt) {
  const pl = world.player, reach = BAG.pickupDistance + stat('pickupRange');
  for (let i = world.items.length - 1; i >= 0; i--) {
    const g = world.items[i];
    g.time += dt;
    const distance = Math.hypot(g.x - pl.x, g.y - pl.y);
    if (g.delayed) {
      if (distance > reach + 8) g.delayed = false;
      continue;
    }
    if (distance > reach) continue;
    if (pickUp(pl, g)) world.items.splice(i, 1);
  }
}

function bagMessage(text) {
  if (time - world.fullMessage < 4) return;
  world.fullMessage = time;
  systemMessage(text, 3);
}

// Returns true if the item was picked up.
function pickUp(pl, g) {
  if (isGear(g.type)) return pickUpGear(pl, g);
  const v = WEAPONS[g.type], color = RARITY[v.rarity].color;
  const gave = g.ammo ?? v.ammoPickup;
  let text;
  if (pl.slots.includes(g.type)) {
    // already owned: the pickup only adds ammo
    if (v.infinite) return false;
    const before = pl.ammo[g.type] || 0;
    if (before >= v.ammoMax) { bagMessage(`You cannot carry any more ${v.name} ammo.`); return false; }
    pl.ammo[g.type] = Math.min(v.ammoMax, before + gave);
    text = `+${pl.ammo[g.type] - before} ammo`;
  } else {
    const free = freeSlot(pl, g.type);
    if (free < 0) { bagMessage(T('Your bag is full. Right-click an item in the bag to drop it.', 'Your bag is full. Tap an item in the bag, then Drop.')); return false; }
    pl.slots[free] = g.type;
    pl.ammo[g.type] = gave || 0;
    updateActive(pl);
    text = v.name;
    if (!world.hasFound) {
      world.hasFound = true;
      systemMessage(T('New weapon! Press 1-4 to switch, or Tab to open your bag.', 'New weapon! Tap the hotbar to switch, or B to open your bag.'));
    }
  }
  sfx(text.startsWith('+') ? 'pickupAmmo' : 'pickupWeapon');
  world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text, life: 1.4, color });
  for (let p = 0; p < 8; p++) particle(g.x, g.y - 6, randRange(-35, 35), randRange(-45, 10), p % 2 ? color : COLOR.W, 0.4);
  return true;
}

// Clothes are put on at once if the place for them is empty, otherwise they go into storage.
function pickUpGear(pl, g) {
  const item = GEAR[g.type], color = RARITY[item.rarity].color, place = equipSlotFor(pl, g.type);
  let text;
  if (!pl.slots[place]) {
    pl.slots[place] = g.type;
    text = 'Wearing ' + item.name;
    sfx('equip');
  } else {
    const free = freeSlot(pl, g.type);
    if (free < 0) { bagMessage(T('Your bag is full. Right-click an item in the bag to drop it.', 'Your bag is full. Tap an item in the bag, then Drop.')); return false; }
    pl.slots[free] = g.type;
    text = item.name;
  }
  if (!world.hasFoundGear) {
    world.hasFoundGear = true;
    systemMessage(T('Something to wear! Open your bag (Tab) to see what it does. E puts things on and takes them off.', 'Something to wear! Open your bag (B), tap it, then tap Wear.'), 5);
  }
  sfx('pickupWeapon');
  world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text, life: 1.4, color });
  for (let p = 0; p < 8; p++) particle(g.x, g.y - 6, randRange(-35, 35), randRange(-45, 10), p % 2 ? color : COLOR.W, 0.4);
  return true;
}

// The ammo goes with the weapon, so picking it up again gives back what it had.
function dropItem(i) {
  const pl = world.player, type = pl.slots[i];
  if (!type) return;
  const ammo = isWeapon(type) && !WEAPONS[type].infinite ? (pl.ammo[type] || 0) : undefined;
  if (isWeapon(type)) pl.ammo[type] = 0;
  pl.slots[i] = null;
  updateActive(pl);
  world.items.push(createItem(type, pl.x, pl.y + 2, true, ammo));
}

// Can the two things trade places? Weapons cannot be worn and clothes cannot go on the hotbar.
const canSwap = (a, b) => canPlace(world.player.slots[a], b) && canPlace(world.player.slots[b], a);

function swapSlots(a, b) {
  const p = world.player.slots;
  [p[a], p[b]] = [p[b], p[a]];
  updateActive(world.player);
  if (a >= BAG.equipStart || b >= BAG.equipStart) sfx('equip');
}

// The buttons of the bag on touch screens: there is no Tab, E or right button there.
function bagButtons() {
  const s = BAG_SCREEN, x = s.x + 178, y = s.y + 128;
  return [
    { id: 'close', x: s.x + s.b - 22, y: s.y + 4, w: 18, h: 18, label: 'X' },
    { id: 'wear', x, y, w: 61, h: 20, label: 'Wear' },
    { id: 'drop', x: x + 65, y, w: 61, h: 20, label: 'Drop' },
  ];
}

function clickBagButton() {
  const b = bagButtons().find(r => mouse.x >= r.x - 2 && mouse.x < r.x + r.w + 2 && mouse.y >= r.y - 2 && mouse.y < r.y + r.h + 2);
  const s = BAG_SCREEN, inside = mouse.x >= s.x && mouse.x < s.x + s.b && mouse.y >= s.y && mouse.y < s.y + s.h;
  if (!b) {
    if (!inside) { toggleBag(); return true; }   // a tap outside the bag closes it
    return false;
  }
  if (b.id === 'close') toggleBag();
  else if (b.id === 'wear') equipAtMouse();
  else if (world.holding >= 0 && world.player.slots[world.holding]) { const i = world.holding; dropItem(i); sfx('drop'); world.holding = -1; }
  return true;
}

function toggleBag() {
  if (state === 'playing') {
    state = 'bag';
    sfx('bagOpen');
    world.holding = -1;
    mouse.down = false;
  } else if (state === 'bag') {
    state = 'playing';
    sfx('bagClose');
    world.holding = -1;
  }
}

// ---------- The bag screen ----------

const BAG_SCREEN = (() => {
  const s = { x: 4, y: 8, b: 312, h: 164, tile: 22, gap: 3, slots: [] };
  const step = s.tile + s.gap;
  for (let i = 0; i < BAG.hotbarSlots; i++) s.slots.push({ x: s.x + 10 + i * step, y: s.y + 36 });
  for (let i = 0; i < BAG.bagSlots; i++) s.slots.push({ x: s.x + 10 + (i % 4) * step, y: s.y + 74 + Math.floor(i / 4) * step });
  // the six places to wear things: two columns
  GEAR_SLOTS.forEach((slot, i) => s.slots.push({ x: s.x + 118 + (i % 2) * step, y: s.y + 36 + Math.floor(i / 2) * step, label: slot.toUpperCase() }));
  s.info = { x: s.x + 178, y: s.y + 28, b: 126, h: 96 };
  return s;
})();

function slotUnderMouse() {
  const r = BAG_SCREEN.tile;
  return BAG_SCREEN.slots.findIndex(p => mouse.x >= p.x && mouse.x < p.x + r && mouse.y >= p.y && mouse.y < p.y + r);
}

// A click picks an item up, the next click puts it down (swapping with whatever was there).
// Right-click drops the item on the floor.
function clickInBag(button) {
  const i = slotUnderMouse(), slots = world.player.slots;
  if (touch.on && button === 0 && clickBagButton()) return;
  if (button === 2) {
    if (i >= 0 && slots[i]) {
      dropItem(i);
      sfx('drop');
      if (world.holding === i) world.holding = -1;
    }
    return;
  }
  if (button !== 0) return;
  if (i < 0) { world.holding = -1; return; }
  if (world.holding < 0) {
    if (slots[i]) { world.holding = i; sfx('uiClick'); }
  } else {
    if (i !== world.holding) {
      if (!canSwap(world.holding, i)) { sfx('empty'); return; }   // it does not fit there: keep holding it
      swapSlots(world.holding, i);
    }
    world.holding = -1;
  }
}

// Keys 1-4 in the bag move the weapon under the cursor (or the one being held) to that hotbar slot.
function moveToHotbar(goal) {
  const i = world.holding >= 0 ? world.holding : slotUnderMouse();
  if (i < 0 || i === goal || !world.player.slots[i]) return;
  if (!canSwap(i, goal)) { sfx('empty'); return; }
  swapSlots(i, goal);
  world.holding = -1;
}

// E in the bag: put on the piece of clothing under the cursor, or take off the one that is worn.
function equipAtMouse() {
  const pl = world.player, i = world.holding >= 0 ? world.holding : slotUnderMouse();
  if (i < 0 || !pl.slots[i]) return;
  const type = pl.slots[i];
  if (i >= BAG.equipStart) {
    const free = freeSlot(pl, type);
    if (free < 0) { sfx('empty'); return; }
    swapSlots(i, free);
  } else if (isGear(type)) {
    swapSlots(i, equipSlotFor(pl, type));
  } else {
    return;
  }
  world.holding = -1;
}

// ---------- Drawing the bag and items ----------

// The picture of a weapon or a piece of clothing, and the colour of its rarity.
const artOf = type => isGear(type)
  ? { image: GEAR_ICONS[type], color: RARITY[GEAR[type].rarity].color, glow: GEAR_GLOW[type] }
  : { image: WEAPON_IMAGES[WEAPONS[type].image].image, color: RARITY[WEAPONS[type].rarity].color, glow: WEAPON_GLOW[type] };

function drawItem(g) {
  const art = artOf(g.type), image = art.image;
  const x = Math.round(g.x), bob = Math.round(Math.sin(g.time * 3) * 1.5);
  const bx = x - (image.width >> 1), by = Math.round(g.y) - 9 + bob;
  shadow(x, Math.round(g.y), 8);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.drawImage(art.glow, bx + dx, by + dy);
  ctx.drawImage(image, bx, by);
  // a little sparkle now and then
  const flash = (g.time * 1.5) % 2;
  if (flash < 0.2) {
    ctx.fillStyle = COLOR.W;
    ctx.fillRect(bx + Math.floor(flash * 5 * image.width), by - 1, 1, 1);
  }
}

// ammo is the text in the top right corner of the slot (empty for none), red when it is "0".
// An empty place for clothes shows what goes there.
function drawSlot(x, y, r, type, edge, badge, options = {}) {
  const { alpha = 1, ammo = '', label = '' } = options;
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(x, y, r, r);
  border(x, y, r, r, edge);
  if (type) {
    const art = artOf(type);
    ctx.globalAlpha = alpha;
    ctx.drawImage(art.image, x + ((r - art.image.width) >> 1), y + ((r - art.image.height) >> 1) + 1);
    ctx.fillStyle = art.color;
    ctx.fillRect(x + 2, y + r - 3, r - 4, 1);
    ctx.globalAlpha = 1;
  } else if (label) {
    drawText(label, x + r / 2, y + r / 2 - 2, COLOR.D, { align: 'center', shadow: null });
  }
  if (badge) drawText(badge, x + 2, y + 2, COLOR.g, { shadow: null });
  if (ammo) drawText(ammo, x + r - 2, y + 2, ammo === '0' ? COLOR.r : COLOR.y, { align: 'right', shadow: null });
}

// the hotbar at the bottom centre of the screen
function drawHotbar(pl) {
  const r = 18, m = 2, n = BAG.hotbarSlots;
  const x0 = Math.round(SCREEN_W / 2 - (n * r + (n - 1) * m) / 2), y0 = SCREEN_H - r - 4;
  for (let i = 0; i < n; i++) {
    const type = pl.slots[i];
    drawSlot(x0 + i * (r + m), y0, r, type, i === pl.active ? COLOR.y : COLOR.D, String(i + 1), { ammo: type ? ammoText(pl, type) : '' });
  }
}

function drawBag() {
  const s = BAG_SCREEN, pl = world.player, r = s.tile, over = slotUnderMouse();
  dim(0.6);
  ctx.fillStyle = 'rgba(24,20,37,0.95)';
  ctx.fillRect(s.x, s.y, s.b, s.h);
  border(s.x, s.y, s.b, s.h, COLOR.D);
  ctx.fillStyle = COLOR.O;
  ctx.fillRect(s.x, s.y, 2, s.h);
  drawText('Bag', s.x + 10, s.y + 7, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawText('Hotbar', s.x + 10, s.y + 28, COLOR.S);
  drawText('Storage', s.x + 10, s.y + 66, COLOR.S);
  drawText('Wearing', s.x + 118, s.y + 28, COLOR.S);

  s.slots.forEach((p, i) => {
    const type = pl.slots[i];
    const edge = i === world.holding ? COLOR.W : i === over ? COLOR.g : i === pl.active ? COLOR.y : COLOR.D;
    drawSlot(p.x, p.y, r, type, edge, i < BAG.hotbarSlots ? String(i + 1) : '',
      { alpha: i === world.holding ? 0.3 : 1, ammo: type && isWeapon(type) ? ammoText(pl, type) : '', label: p.label });
  });

  drawInfo(over >= 0 ? pl.slots[over] : world.holding >= 0 ? pl.slots[world.holding] : null, over >= 0);

  if (touch.on) {
    for (const r of bagButtons()) {
      ctx.fillStyle = 'rgba(24,20,37,0.85)'; ctx.fillRect(r.x, r.y, r.w, r.h);
      border(r.x, r.y, r.w, r.h, r.id === 'close' ? COLOR.r : COLOR.O);
      drawText(r.label, r.x + r.w / 2, r.y + r.h / 2 - 3, COLOR.W, { align: 'center' });
    }
  }
  drawText(T('Click: move   1-4: hotbar   E: wear   Right-click: drop   Tab: close', 'Tap an item, then a slot to move it. Wear and Drop use the item you hold.'),
    s.x + s.b / 2, s.y + s.h - 11, COLOR.g, { align: 'center' });

  // the item being held follows the mouse
  if (world.holding >= 0 && mouse.inside) {
    ctx.drawImage(artOf(pl.slots[world.holding]).image, Math.floor(mouse.x) + 4, Math.floor(mouse.y) + 6);
  }
}

function drawInfo(type, overSlot) {
  const f = BAG_SCREEN.info, pl = world.player;
  ctx.fillStyle = 'rgba(38,43,68,0.6)';
  ctx.fillRect(f.x, f.y, f.b, f.h);
  if (!type) {
    border(f.x, f.y, f.b, f.h, COLOR.D);
    const text = overSlot ? 'Empty slot.' : 'Point at an item to see what it does.';
    wrapLines(text, f.b - 12).forEach((l, i) => drawText(l, f.x + 6, f.y + 6 + i * 8, COLOR.g));
    return;
  }
  if (isGear(type)) { drawGearInfo(type, f); return; }
  const v = WEAPONS[type], rarityInfo = RARITY[v.rarity], image = WEAPON_IMAGES[v.image].image;
  border(f.x, f.y, f.b, f.h, rarityInfo.color);
  ctx.drawImage(image, f.x + 6, f.y + 6, image.width * 2, image.height * 2);
  drawText(v.name, f.x + 6, f.y + 20, COLOR.W);
  drawText(rarityInfo.name, f.x + 6, f.y + 28, rarityInfo.color);
  const lines = [
    ['Damage', v.bulletsPerShot > 1 ? `${v.damage} x ${v.bulletsPerShot}` : String(v.damage), COLOR.S],
    ['Shots / sec', String(v.shotsPerSec), COLOR.S],
    ['Range', String(v.range), COLOR.S],
    ['Ammo', v.infinite ? '∞' : `${pl.ammo[type] || 0} / ${v.ammoMax}`, hasAmmo(pl, type) ? COLOR.y : COLOR.r],
  ];
  lines.forEach(([name, value, color], i) => {
    drawText(name, f.x + 6, f.y + 40 + i * 8, COLOR.g);
    drawText(value, f.x + f.b - 6, f.y + 40 + i * 8, color, { align: 'right' });
  });
  wrapLines(v.description, f.b - 12).forEach((l, i) => drawText(l, f.x + 6, f.y + 72 + i * 8, COLOR.a));
}

// Clothes: the name, the rarity, where it is worn, what it does and a line about it.
function drawGearInfo(type, f) {
  const item = GEAR[type], rarityInfo = RARITY[item.rarity];
  border(f.x, f.y, f.b, f.h, rarityInfo.color);
  ctx.drawImage(GEAR_ICONS[type], f.x + f.b - 30, f.y + 6, 24, 24);
  wrapLines(item.name, f.b - 42).forEach((l, i) => drawText(l, f.x + 6, f.y + 6 + i * 8, COLOR.W));
  drawText(rarityInfo.name + ' ' + item.slot, f.x + 6, f.y + 24, rarityInfo.color);
  statLines(type).forEach(([value, label], i) => {
    drawText(label, f.x + 6, f.y + 38 + i * 8, COLOR.g);
    drawText(value, f.x + f.b - 6, f.y + 38 + i * 8, COLOR.l, { align: 'right' });
  });
  wrapLines(item.description, f.b - 12).forEach((l, i) => drawText(l, f.x + 6, f.y + 66 + i * 8, COLOR.a));
}
