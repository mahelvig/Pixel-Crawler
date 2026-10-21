"use strict";

// ---------- The safe room ----------
// At the start of every floor (the landing at the top of the stairs) a trader has set up shop. Stand next to them and press E (or tap
// Trade) and the game stops: nothing can touch you in the safe room. The trader can
//   open boxes       sponsor boxes (from the viewers, achievements and rescues) are kept in the bag until a trader opens them, and
//                    nobody else can: the box gives a weapon or piece of clothing of the box's rarity. Boxes cannot be bought.
//   sell things      a few things for gold (the stock is new on every floor, and can be rolled again for a price)
//   patch you up     one heart at a time (dear), and ammo for every gun you carry
//   tailor clothes   every level makes a piece of clothing 25% stronger, same as finding a spare
//   buy your junk    storage items for more than they are worth when the bag sells them by itself
//   quest board      what you still have to do on this floor
// and you can save the run and go to the main menu from here. The prices are in SAFE in settings.js. All of it is paid for with the same gold
// as the upgrades (saved.gold), so spending it here means less for the permanent upgrades.

const BOX_ORDER = ['bronze', 'silver', 'gold', 'platinum'];
const BOX_COLORS = { bronze: 't', silver: 'S', gold: 'O', platinum: 'c' };
const emptyBoxBag = () => ({ bronze: 0, silver: 0, gold: 0, platinum: 0 });
const boxCount = pl => BOX_ORDER.reduce((n, t) => n + (pl.boxBag[t] || 0), 0);

// A box goes into the bag of boxes (see the trader).
function giveBox(tier) {
  const pl = world.player;
  pl.boxBag[tier]++;
  world.floatingTexts.push({ x: pl.x, y: pl.y - 30, text: '+' + BOX_TIERS[tier].name, life: 1.6, color: COLOR[BOX_COLORS[tier]] });
  if (!run.boxHint) {
    run.boxHint = true;
    systemMessage(T('Boxes are opened by the trader at the start of each floor. Walk up to them and press E.', 'Boxes are opened by the trader at the start of each floor. Walk up to them and tap Trade.'), 6);
  }
}

const rarityOf = type => isGear(type) ? GEAR[type].rarity : WEAPONS[type].rarity;
const nameOf = type => isGear(type) ? GEAR[type].name : WEAPONS[type].name;

// What happened to something that was put in the bag, in a few words.
function whereIs(pl, type, had) {
  if (had) return isWeapon(type) ? 'ammo added to the one you have' : 'upgraded the one you have';
  const i = pl.slots.indexOf(type);
  if (i < 0) return 'sold, there was no room';
  if (i >= BAG.equipStart) return 'now worn';
  if (i < BAG.hotbarSlots) return 'on your hotbar';
  return 'in your bag';
}

// ---------- The trader on the floor ----------

// A free place close to the start for the trader.
function traderSpot(lv) {
  const sx = Math.floor(lv.start.x / TILE), sy = Math.floor(lv.start.y / TILE);
  let best = null, bestD = Infinity;
  for (let y = sy - 5; y <= sy + 5; y++) for (let x = sx - 5; x <= sx + 5; x++) {
    if (x < 1 || y < 1 || x >= lv.b - 1 || y >= lv.h - 1 || !roomyTile(lv, x, y)) continue;
    const d = Math.hypot(x - sx, y - sy);
    if (d < 2.4 || d >= bestD || lv.enemies.some(e => Math.hypot(e.x / TILE - x, e.y / TILE - y) < 2) || lv.items.some(i => Math.hypot(i.x / TILE - x, i.y / TILE - y) < 1.5)) continue;
    best = { x, y }; bestD = d;
  }
  return best ? { x: best.x * TILE + 8, y: best.y * TILE + 10 } : { x: lv.start.x + 26, y: lv.start.y };
}

const nearTrader = () => !!world.level.trader && Math.hypot(world.player.x - world.level.trader.x, world.player.y - (world.level.trader.y - 4)) < SAFE.range;
const traderDanger = () => world.enemies.some(e => e.chasing && !ENEMIES[e.type].boss && Math.hypot(e.x - world.player.x, e.y - world.player.y) < SAFE.danger) || world.enemies.some(e => ENEMIES[e.type].boss && e.chasing);

// The button that shows up while you stand next to the trader.
function tradeButton() {
  const w = 74;
  return { x: Math.round(SCREEN_W / 2 - w / 2), y: SCREEN_H - 43, w, h: 13 };
}
const tradeButtonShown = () => state === 'playing' && nearTrader();

function tryTrade() {
  if (!tradeButtonShown()) return;
  if (traderDanger()) { sfx('deny'); world.floatingTexts.push({ x: world.player.x, y: world.player.y - 24, text: 'Too dangerous!', life: 1, color: COLOR.r }); return; }
  morrisTalk(openSafeRoom);
}

function drawTrader() {
  const t = world.level.trader;
  if (!t) return;
  const x = Math.round(t.x), y = Math.round(t.y), frames = NPC_IMAGES[NPC_LOOKS.length - 1], image = frames[0], top = y - image.height + 4;
  // a rug, a lantern and a crate of stock
  ctx.fillStyle = COLOR.K; ctx.fillRect(x - 15, y - 3, 30, 12);
  ctx.fillStyle = COLOR.R; ctx.fillRect(x - 14, y - 2, 28, 10);
  ctx.fillStyle = COLOR.O; ctx.fillRect(x - 14, y - 2, 28, 1); ctx.fillRect(x - 14, y + 7, 28, 1);
  ctx.fillStyle = COLOR.r; ctx.fillRect(x - 12, y, 24, 6);
  const toward = world.player.x < t.x ? -1 : 1;
  ctx.save();
  ctx.translate(x, 0);
  if (toward < 0) ctx.scale(-1, 1);
  ctx.drawImage(image, -8, top + 1 + (Math.sin(time * 2) > 0.7 ? 1 : 0));
  ctx.restore();
  ctx.fillStyle = COLOR.K; ctx.fillRect(x + 8, y - 8, 7, 8);
  ctx.fillStyle = COLOR.u; ctx.fillRect(x + 9, y - 7, 5, 6);
  ctx.fillStyle = COLOR.U; ctx.fillRect(x + 9, y - 4, 5, 1);
  ctx.fillStyle = COLOR.K; ctx.fillRect(x - 15, y - 12, 3, 9);
  ctx.fillStyle = COLOR.y; ctx.fillRect(x - 14, y - 15, 1, 1); ctx.fillRect(x - 15, y - 14, 3, 2);
  ctx.globalAlpha = 0.22 + 0.08 * Math.sin(time * 5); ctx.fillStyle = COLOR.y; ctx.fillRect(x - 18, y - 17, 9, 9); ctx.globalAlpha = 1;
  drawText('MORRIS', x, top - 9, COLOR.y, { align: 'center' });
  if (morrisPending()) {
    // he has something to tell you
    drawText('!', x, top - 18 - (Math.sin(time * 6) > 0 ? 1 : 0), COLOR.y, { align: 'center' });
    if (state === 'playing' && !world.morrisCalled && Math.hypot(world.player.x - t.x, world.player.y - t.y) < 90) {
      world.morrisCalled = true;
      world.floatingTexts.push({ x: t.x, y: top - 14, text: 'Psst, 4B!', life: 1.8, color: COLOR.y });
    }
  }
}

// The little button on the screen next to the trader, and the boxes you carry.
function drawTradeHud() {
  const pl = world.player;
  let x = 4;
  const py = SCREEN_H - (pl.weapon ? 31 : 24);
  for (const tier of BOX_ORDER) {
    if (!pl.boxBag[tier]) continue;
    drawBoxIcon(tier, x, py - 21);
    drawText('x' + pl.boxBag[tier], x + 10, py - 20, COLOR[BOX_COLORS[tier]]);
    x += 12 + textWidth('x' + pl.boxBag[tier]) + 4;
  }
  if (x > 4) drawText(T('open at the trader', 'open at the trader'), x, py - 20, COLOR.s);
  if (!tradeButtonShown()) return;
  const b = tradeButton(), blocked = traderDanger(), hover = !touch.on && mouse.inside && mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h;
  ctx.fillStyle = 'rgba(24,20,37,0.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
  border(b.x, b.y, b.w, b.h, blocked ? COLOR.r : hover ? COLOR.W : COLOR.O);
  drawText(blocked ? 'Too dangerous' : T('Trade (E)', 'Trade'), b.x + b.w / 2, b.y + 4, blocked ? COLOR.r : hover ? COLOR.W : COLOR.O, { align: 'center' });
}

function drawBoxIcon(tier, x, y) {
  const color = COLOR[BOX_COLORS[tier]];
  ctx.fillStyle = COLOR.K; ctx.fillRect(x, y + 2, 9, 7);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y + 3, 7, 5);
  ctx.fillStyle = COLOR.K; ctx.fillRect(x, y + 4, 9, 1);
  ctx.fillStyle = COLOR.W; ctx.fillRect(x + 4, y + 2, 1, 7);
  ctx.fillStyle = COLOR.K; ctx.fillRect(x + 1, y + 1, 7, 1);
}

// ---------- The services ----------

// the Haggler upgrade: 5% off everything Morris sells, for every level
const haggle = gold => Math.max(1, Math.round(gold * (1 - 0.05 * upgradeLevel('haggler'))));
const priceBuy = type => haggle(Math.max(5, Math.round(SAFE.buy[rarityOf(type)] * (1 + SAFE.buyFloor * world.levelIndex) / 5) * 5));
const priceSell = (pl, type) => Math.round(SELL_VALUE[rarityOf(type)] * SAFE.sellBonus) + (isGear(type) ? (pl.gearLevel[type] || 0) * SAFE.sellLevel : 0);
const priceHeart = () => haggle(Math.ceil(SAFE.heart * (1 + SAFE.heartFloor * world.levelIndex)));
const priceReroll = () => haggle(Math.round(SAFE.reroll * Math.pow(SAFE.rerollGrowth, world.rerolls)));
const priceTailor = (type, level) => haggle(Math.round(SAFE.tailor * (level + 1) * (1 + 0.6 * RARITY_RANK[GEAR[type].rarity]) / 5) * 5);

// What every gun you carry would need to be full: gold, and the number of shots.
function ammoBill(pl) {
  let gold = 0, shots = 0;
  for (const type of pl.slots) {
    if (!isWeapon(type) || isInfinite(pl, type)) continue;
    const missing = WEAPONS[type].ammoMax - (pl.ammo[type] || 0);
    if (missing > 0) { shots += missing; gold += Math.ceil(missing * SAFE.ammo[WEAPONS[type].rarity]); }
  }
  return { gold: gold > 0 ? haggle(gold) : 0, shots };
}

const heartsMissing = pl => Math.max(0, maxLife() - pl.life);

function makeStock(index = world.levelIndex) {
  const stock = [], quality = SAFE.quality + (isEndless(index) ? depthBelowCore(index) * 0.25 : 0);   // better stock below the Core
  for (let tries = 0; stock.length < SAFE.stock && tries < 60; tries++) {
    const type = randomDrop(quality);
    if (!stock.some(s => s.type === type)) stock.push({ type, sold: false });
  }
  return stock;
}

// Pays. Returns false (with a sound) if there is not enough gold.
function pay(gold) {
  if (gold <= 0 || saved.gold < gold) { sfx('deny'); safeNote('Not enough gold.'); return false; }
  saved.gold -= gold;
  saveDirty = true;
  sfx('buy');
  return true;
}

let safeUi = { tab: 0, note: { text: '', until: 0 }, opened: null, hover: -1 };
const safeNote = text => { safeUi.note = { text, until: time + 3 }; };

function openBoxAt(tier) {
  const pl = world.player;
  if (!pl.boxBag[tier]) { sfx('deny'); safeNote('You have no ' + BOX_TIERS[tier].name + '.'); return; }
  pl.boxBag[tier]--;
  const rarity = BOX_TIERS[tier].rarity, type = Math.random() < 0.5 ? randomGear(rarity) : weaponOfRarity(rarity);
  const had = pl.slots.includes(type);
  pickUp(pl, createItem(type, pl.x, pl.y));
  safeUi.opened = { type, tier, where: whereIs(pl, type, had) };
  sfx('levelup');
  track('boxOpened');
}

function buyStock(i) {
  const s = world.stock[i], pl = world.player;
  if (!s || s.sold) return;
  if (!pay(priceBuy(s.type))) return;
  s.sold = true;
  const had = pl.slots.includes(s.type);
  pickUp(pl, createItem(s.type, pl.x, pl.y));
  safeNote(nameOf(s.type) + ': ' + whereIs(pl, s.type, had) + '.');
}

function rerollStock() {
  if (!pay(priceReroll())) return;
  world.rerolls++;
  world.stock = makeStock();
  safeNote('New stock. The old stock has been "returned to the sponsors".');
}

function healOne() {
  const pl = world.player;
  if (heartsMissing(pl) <= 0) { sfx('deny'); safeNote('You are already at full health.'); return; }
  if (!pay(priceHeart())) return;
  pl.life += 1;
  sfx('heal');
  safeNote('Patched up: +1 heart. The plaster was not cheap.');
}

function refillAmmo() {
  const pl = world.player, bill = ammoBill(pl);
  if (bill.shots === 0) { sfx('deny'); safeNote('Everything you carry is already full.'); return; }
  if (!pay(bill.gold)) return;
  for (const type of pl.slots) if (isWeapon(type) && !isInfinite(pl, type)) pl.ammo[type] = WEAPONS[type].ammoMax;
  sfx('pickupAmmo');
  safeNote('Ammo refilled: ' + bill.shots + ' shots.');
}

// The pieces of clothing you carry, worn first.
function tailorList(pl) {
  const list = [];
  for (let i = BAG.equipStart; i < pl.slots.length; i++) if (pl.slots[i]) list.push({ slot: i, worn: true });
  for (let i = BAG.hotbarSlots; i < BAG.equipStart; i++) if (isGear(pl.slots[i])) list.push({ slot: i, worn: false });
  return list;
}

function tailorAt(entry) {
  const pl = world.player, type = pl.slots[entry.slot], level = pl.gearLevel[type] || 0;
  if (level >= GEAR_UPGRADE.maxLevel) { sfx('deny'); safeNote(GEAR[type].name + ' is already at the top level.'); return; }
  if (!pay(priceTailor(type, level))) return;
  pl.gearLevel[type] = level + 1;
  sfx('equip');
  safeNote(GEAR[type].name + ' is now level ' + (level + 2) + '.');
}

function sellAt(slot) {
  const pl = world.player, type = pl.slots[slot];
  if (!type) return;
  const price = priceSell(pl, type);
  pl.slots[slot] = null;
  if (isWeapon(type)) pl.ammo[type] = 0; else delete pl.gearLevel[type];
  saved.gold += price;
  saveDirty = true;
  track('sold');
  sfx('buy');
  safeNote('Sold ' + nameOf(type) + ' for ' + price + ' gold.');
}

// Everything in the bag that is no good to you: clothes no better than what you wear.
const junkSlots = pl => { const list = []; for (let i = BAG.hotbarSlots; i < BAG.equipStart; i++) if (pl.slots[i] && storedScore(pl, i) < 0) list.push(i); return list; };

function sellJunk() {
  const pl = world.player, list = junkSlots(pl);
  if (!list.length) { sfx('deny'); safeNote('Nothing in your bag is junk. Impressive.'); return; }
  let total = 0;
  for (const i of list) { total += priceSell(pl, pl.slots[i]); const type = pl.slots[i]; pl.slots[i] = null; delete pl.gearLevel[type]; track('sold'); }
  saved.gold += total;
  saveDirty = true;
  sfx('buy');
  safeNote('Sold ' + list.length + ' things for ' + total + ' gold.');
}

// ---------- The screen ----------

const SAFE_TABS = ['Boxes', 'Shop', 'Care', 'Tailor', 'Sell', 'Board'];
const TRADER_LINES_DEEP = ['Off the map now, 4B. The stock is improvising too.', 'Deeper than anybody. Mind the rules.', 'HOME keeps changing the floors. I keep the prices.', 'No script down here. Just stairs, and me.'];
const TRADER_LINES = ['Everything here is legally owned. Mostly.', 'No refunds. No questions. No witnesses.', 'The viewers cannot see in here. Take your time.', 'I do not ask where you got it. I just ask for gold.', 'Careful with the merchandise. It bites.'];

function openSafeRoom() {
  state = 'safe';
  const lines = isEndless(world.levelIndex) ? TRADER_LINES_DEEP : TRADER_LINES;
  safeUi = { tab: 0, note: { text: '', until: 0 }, opened: null, hover: -1, line: lines[Math.floor(Math.random() * lines.length)] };
  mouse.down = false; mouse.moving = false;
  sfx('bagOpen');
  saveRun();
}

function closeSafeRoom() {
  state = 'playing';
  sfx('bagClose');
}

function safeTab(delta) {
  safeUi.tab = (safeUi.tab + delta + SAFE_TABS.length) % SAFE_TABS.length;
  safeUi.opened = null;
  sfx('uiClick');
}

const safeBackButton = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });
function safeTabButton(i) {
  const widths = SAFE_TABS.map(t => textWidth(t) + 12);
  let x = 10;
  for (let n = 0; n < i; n++) x += widths[n] + 3;
  return { x, y: 26, w: widths[i], h: 14 };
}

// ---- one button per thing that can be clicked: { id, rect, action } built the same way for drawing and clicking ----
function safeButtons() {
  const pl = world.player, list = [];
  const add = (rect, action, draw) => list.push({ rect, action, draw });
  const tab = safeUi.tab;
  if (tab === 0) {
    BOX_ORDER.forEach((tier, i) => {
      const y = 48 + i * 21;
      add({ x: 164, y, w: 146, h: 17 }, () => openBoxAt(tier), (r, hover) => drawButton(r, pl.boxBag[tier] > 0 ? 'Open' : 'None to open', hover && pl.boxBag[tier] > 0));
    });
  } else if (tab === 1) {
    world.stock.forEach((s, i) => add({ x: 10 + i * 76, y: 46, w: 72, h: 86 }, () => buyStock(i), null));
    add({ x: 10, y: 138, w: 130, h: 15 }, rerollStock, (r, hover) => drawButton(r, 'Roll new stock: ' + priceReroll() + 'g', hover));
  } else if (tab === 2) {
    add({ x: 10, y: 48, w: 300, h: 21 }, healOne, null);
    add({ x: 10, y: 72, w: 300, h: 21 }, refillAmmo, null);
    add({ x: 10, y: 96, w: 300, h: 21 }, () => { closeSafeRoom(); leaveToMenu(); }, null);
  } else if (tab === 3) {
    tailorList(pl).slice(0, 10).forEach((entry, i) => add({ x: 10, y: 56 + i * 11, w: 300, h: 10 }, () => tailorAt(entry), null));
  } else if (tab === 4) {
    for (let i = 0; i < BAG.bagSlots; i++) {
      const slot = BAG.hotbarSlots + i;
      add({ x: 10 + (i % 4) * 25, y: 56 + Math.floor(i / 4) * 25, w: 22, h: 22 }, () => sellAt(slot), null);
    }
    add({ x: 10, y: 136, w: 98, h: 15 }, sellJunk, (r, hover) => drawButton(r, 'Sell junk (' + junkSlots(pl).length + ')', hover));
  }
  return list;
}

function clickSafeRoom() {
  if (inBox(safeBackButton(), 2)) { closeSafeRoom(); return; }
  for (let i = 0; i < SAFE_TABS.length; i++) if (inBox(safeTabButton(i), 1)) { safeTab(i - safeUi.tab); return; }
  const hit = safeButtons().find(b => inBox(b.rect));
  if (hit) hit.action();
}

function drawSafeRoom() {
  const pl = world.player;
  dim(0.93);
  drawText('Safe Room', 10, 8, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawText(saved.gold + ' gold', BASE_W - 62, 10, COLOR.O, { align: 'right' });
  drawButton(safeBackButton(), 'Back', inBox(safeBackButton()));
  SAFE_TABS.forEach((name, i) => {
    const b = safeTabButton(i), on = i === safeUi.tab, hover = inBox(b);
    ctx.fillStyle = on ? 'rgba(58,68,102,0.95)' : 'rgba(24,20,37,0.85)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    border(b.x, b.y, b.w, b.h, on ? COLOR.O : hover ? COLOR.W : COLOR.D);
    drawText(name, b.x + b.w / 2, b.y + 5, on ? COLOR.W : COLOR.g, { align: 'center' });
  });
  const tab = safeUi.tab, buttons = safeButtons();
  const hoverOf = id => buttons[id] && inBox(buttons[id].rect);
  if (tab === 0) drawBoxesTab(pl, buttons);
  else if (tab === 1) drawStockTab(pl, buttons);
  else if (tab === 2) drawCareTab(pl, buttons);
  else if (tab === 3) drawTailorTab(pl, buttons);
  else if (tab === 4) drawSellTab(pl, buttons);
  else drawBoardTab();
  const note = time < safeUi.note.until;
  drawText(note ? safeUi.note.text : (safeUi.line || ''), BASE_W / 2, 169, note ? COLOR.y : COLOR.g, { align: 'center' });
}

function drawBoxesTab(pl, buttons) {
  BOX_ORDER.forEach((tier, i) => {
    const y = 48 + i * 21, color = COLOR[BOX_COLORS[tier]];
    ctx.fillStyle = 'rgba(24,20,37,0.85)'; ctx.fillRect(10, y, 300, 17); border(10, y, 300, 17, COLOR.D);
    drawBoxIcon(tier, 15, y + 4);
    drawText(BOX_TIERS[tier].name, 30, y + 6, color);
    drawText('x' + pl.boxBag[tier], 104, y + 6, pl.boxBag[tier] ? COLOR.W : COLOR.D);
    drawText(RARITY[BOX_TIERS[tier].rarity].name, 122, y + 6, RARITY[BOX_TIERS[tier].rarity].color);
  });
  for (let b = 0; b < buttons.length; b++) buttons[b].draw(buttons[b].rect, inBox(buttons[b].rect));
  if (safeUi.opened) {
    const o = safeUi.opened, r = RARITY[rarityOf(o.type)], y = 136;
    ctx.fillStyle = 'rgba(38,43,68,0.6)'; ctx.fillRect(10, y, 300, 28); border(10, y, 300, 28, r.color);
    const art = artOf(o.type);
    ctx.drawImage(art.image, 16, y + 6, art.image.width * 2, art.image.height * 2);
    drawText(nameOf(o.type), 48, y + 5, COLOR.W);
    drawText(r.name + (isGear(o.type) ? ' ' + GEAR[o.type].slot : ' weapon') + ', ' + o.where, 48, y + 13, r.color);
    if (isGear(o.type)) { const l = statLines(o.type, 0)[0]; if (l) drawText(l[0] + ' ' + l[1], 48, y + 21, COLOR.l); }
  } else {
    drawText('Boxes can only be opened here. The viewers insist.', 10, 138, COLOR.g);
    drawText('You have ' + boxCount(pl) + ' sealed ' + (boxCount(pl) === 1 ? 'box.' : 'boxes.'), 10, 148, boxCount(pl) ? COLOR.y : COLOR.D);
  }
}

function drawStockTab(pl, buttons) {
  world.stock.forEach((s, i) => {
    const r = buttons[i].rect, hover = inBox(r), rar = RARITY[rarityOf(s.type)], price = priceBuy(s.type), art = artOf(s.type);
    ctx.fillStyle = hover && !s.sold ? 'rgba(58,68,102,0.9)' : 'rgba(24,20,37,0.85)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    border(r.x, r.y, r.w, r.h, s.sold ? COLOR.D : hover ? COLOR.W : rar.color);
    if (s.sold) { drawText('SOLD', r.x + r.w / 2, r.y + 38, COLOR.D, { align: 'center', scale: 2 }); return; }
    ctx.drawImage(art.image, r.x + r.w / 2 - art.image.width, r.y + 5, art.image.width * 2, art.image.height * 2);
    wrapLines(nameOf(s.type), r.w - 6).slice(0, 2).forEach((l, k) => drawText(l, r.x + r.w / 2, r.y + 26 + k * 8, COLOR.W, { align: 'center' }));
    drawText(rar.name, r.x + r.w / 2, r.y + 43, rar.color, { align: 'center' });
    if (isGear(s.type)) statLines(s.type, 0).slice(0, 2).forEach(([value, label], k) => drawText(value + ' ' + label, r.x + r.w / 2, r.y + 53 + k * 8, COLOR.l, { align: 'center' }));
    else { const v = WEAPONS[s.type]; drawText('Dmg ' + (v.bulletsPerShot > 1 ? v.damage + 'x' + v.bulletsPerShot : v.damage), r.x + r.w / 2, r.y + 53, COLOR.S, { align: 'center' }); drawText(v.shotsPerSec + ' shots/s', r.x + r.w / 2, r.y + 61, COLOR.S, { align: 'center' }); }
    drawText(price + 'g', r.x + r.w / 2, r.y + r.h - 10, saved.gold >= price ? COLOR.y : COLOR.r, { align: 'center' });
  });
  const reroll = buttons[world.stock.length];
  reroll.draw(reroll.rect, inBox(reroll.rect));
  drawText('A new stock is shown on every floor.', 150, 143, COLOR.D);
}

function drawCareTab(pl, buttons) {
  const bill = ammoBill(pl), missing = heartsMissing(pl);
  const rows = [
    ['Patch you up: 1 heart', missing > 0 ? priceHeart() + 'g' : 'full', missing > 0 ? 'One plaster, one pat on the back, one very large invoice.' : 'You are at full health.', missing > 0 && saved.gold >= priceHeart()],
    ['Refill all your ammo', bill.shots ? bill.gold + 'g' : 'full', bill.shots ? 'Fills every gun you carry: ' + bill.shots + ' shots.' : 'Every gun you carry is full.', bill.shots > 0 && saved.gold >= bill.gold],
    ['Save and go to the main menu', '', 'Your run is saved. Continue it later from the main menu.', true],
  ];
  rows.forEach(([label, cost, text, can], i) => {
    const r = buttons[i].rect, hover = inBox(r);
    ctx.fillStyle = hover ? 'rgba(58,68,102,0.9)' : 'rgba(24,20,37,0.85)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    border(r.x, r.y, r.w, r.h, hover ? COLOR.W : COLOR.D);
    drawText(label, r.x + 6, r.y + 4, COLOR.W);
    drawText(text, r.x + 6, r.y + 12, COLOR.g);
    if (cost) drawText(cost, r.x + r.w - 6, r.y + 4, can ? COLOR.y : cost === 'full' ? COLOR.D : COLOR.r, { align: 'right' });
  });
}

function drawTailorTab(pl, buttons) {
  const list = tailorList(pl).slice(0, 10);
  if (!list.length) { drawText('You are not carrying any clothes. The tailor is bored.', 10, 56, COLOR.g); return; }
  drawText('Every level makes a piece of clothing 25% stronger.', 10, 45, COLOR.g);
  list.forEach((entry, i) => {
    const r = buttons[i].rect, type = pl.slots[entry.slot], level = pl.gearLevel[type] || 0, hover = inBox(r), maxed = level >= GEAR_UPGRADE.maxLevel;
    if (hover) { ctx.fillStyle = 'rgba(58,68,102,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    drawText(GEAR[type].name, r.x + 4, r.y + 2, RARITY[GEAR[type].rarity].color);
    drawText(entry.worn ? 'worn' : 'in bag', r.x + 120, r.y + 2, entry.worn ? COLOR.l : COLOR.g);
    drawText('Lv ' + (level + 1) + (maxed ? ' (top)' : ' > ' + (level + 2)), r.x + 170, r.y + 2, COLOR.S);
    if (maxed) drawText('MAX', r.x + r.w - 4, r.y + 2, COLOR.O, { align: 'right' });
    else { const price = priceTailor(type, level); drawText(price + 'g', r.x + r.w - 4, r.y + 2, saved.gold >= price ? COLOR.y : COLOR.r, { align: 'right' }); }
  });
}

function drawSellTab(pl, buttons) {
  drawText('Click something in your bag to sell it. The trader pays more than the bag does.', 10, 45, COLOR.g);
  let hovered = -1;
  for (let i = 0; i < BAG.bagSlots; i++) {
    const r = buttons[i].rect, slot = BAG.hotbarSlots + i, type = pl.slots[slot], hover = inBox(r);
    if (hover) hovered = slot;
    drawSlot(r.x, r.y, r.w, type, hover ? COLOR.W : COLOR.D, '', { ammo: type && isWeapon(type) ? ammoText(pl, type) : (type && pl.gearLevel[type] ? '+' + pl.gearLevel[type] : '') });
  }
  const sellJ = buttons[BAG.bagSlots];
  sellJ.draw(sellJ.rect, inBox(sellJ.rect));
  const type = hovered >= 0 ? pl.slots[hovered] : null;
  ctx.fillStyle = 'rgba(38,43,68,0.6)'; ctx.fillRect(124, 56, 186, 96);
  if (!type) { border(124, 56, 186, 96, COLOR.D); drawText('Point at something to see what it is worth.', 130, 62, COLOR.g); return; }
  const r = RARITY[rarityOf(type)], art = artOf(type);
  border(124, 56, 186, 96, r.color);
  ctx.drawImage(art.image, 130, 62, art.image.width * 2, art.image.height * 2);
  drawText(nameOf(type), 164, 62, COLOR.W);
  drawText(r.name, 164, 70, r.color);
  if (isGear(type)) statLines(type, pl.gearLevel[type] || 0).slice(0, 3).forEach(([value, label], k) => drawText(value + ' ' + label, 130, 88 + k * 8, COLOR.l));
  else { const v = WEAPONS[type]; drawText('Damage ' + v.damage, 130, 88, COLOR.S); drawText('Ammo ' + ammoText(pl, type) + ' / ' + v.ammoMax, 130, 96, COLOR.y); }
  drawText('Sells for ' + priceSell(pl, type) + ' gold', 130, 136, COLOR.O);
  if (storedScore(pl, hovered) < 0) drawText('Junk: no better than what you wear.', 130, 120, COLOR.r);
}

function drawBoardTab() {
  const lines = objectiveLines();
  drawText(world.level.name, 10, 46, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawText('Still to do on this floor:', 10, 66, COLOR.g);
  lines.forEach((o, i) => drawText((o.done ? 'DONE  ' : '      ') + o.text, 14, 78 + i * 10, o.done ? COLOR.l : COLOR.W));
  const y = 78 + lines.length * 10 + 6, left = world.enemies.filter(e => !e.minion && !ENEMIES[e.type].boss).length, elites = world.enemies.filter(e => e.elite).length;
  drawText(world.gateOpen ? 'The boss gate is open.' : 'The boss gate opens when everything is done.', 14, y, world.gateOpen ? COLOR.O : COLOR.g);
  (world.level.rules || []).forEach((id, i) => drawText('Rule: ' + FLOOR_RULES[id].name + '. ' + FLOOR_RULES[id].text, 14, y + 30 + i * 10, COLOR.m));
  drawText(left + ' enemies left on the floor' + (elites ? ', ' + elites + ' of them elite.' : '.'), 14, y + 10, COLOR.g);
  drawText('Viewers: ' + (0.4 + 5.6 * world.player.fame / viewersNeed(world.player) + 0.3 * world.player.boxes).toFixed(1) + 'M, and sponsors sent ' + world.player.boxes + ' boxes.', 14, y + 20, COLOR.m);
}
