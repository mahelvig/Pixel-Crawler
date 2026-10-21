"use strict";

// ---------- The shop: permanent upgrades bought with gold ----------
// Every upgrade has levels, and every level costs more than the one before: base x growth ^ level (UPGRADES in settings.js).
// What has been bought is saved (see progress.js) and works through stat() in every run.

const upgradeLevel = id => saved.upgrades[id] || 0;

// Stars (see STARS in settings.js): how many an upgrade can have, what one adds, and how many it has now.
const wholeStat = u => STAT_INFO[u.stat].format === 'int';
const starMax = id => UPGRADES[id] ? (wholeStat(UPGRADES[id]) ? STARS.wholeMax : STARS.max) : 0;
const starStep = u => wholeStat(u) ? u.step : u.step * STARS.share;
const starsOf = id => Math.max(0, upgradeLevel(id) - UPGRADES[id].max);

// How many levels (and stars) of the stat upgrades have been bought: the dungeon grows tougher with it (see POWER in settings.js).
const upgradeLevels = () => Object.keys(UPGRADES).reduce((n, id) => n + upgradeLevel(id), 0);
const dungeonPower = () => (run ? run.power : upgradeLevels()) || 0;

// What an upgrade adds to its stat: its levels, and its stars at half a level each.
function upgradeEffect(id) {
  const u = UPGRADES[id], level = upgradeLevel(id);
  return u.step * Math.min(level, u.max) + starStep(u) * starsOf(id);
}

// The price of the next level (or star), or null when there is nothing more to buy. Rounded to a multiple of 5.
function upgradeCost(id) {
  const level = upgradeLevel(id);
  if (SPECIALS[id]) return level >= SPECIALS[id].max ? null : SPECIALS[id].costs[level];
  const u = UPGRADES[id];
  if (level < u.max) return Math.max(5, Math.round(u.base * Math.pow(u.growth, level) / 5) * 5);
  const star = level - u.max;
  if (star >= starMax(id)) return null;
  const last = u.base * Math.pow(u.growth, u.max - 1);
  return Math.round(last * (wholeStat(u) ? STARS.wholeCost : STARS.cost) * Math.pow(STARS.growth, star) / 5) * 5;
}

// Returns true if it was bought.
function buyUpgrade(id) {
  const cost = upgradeCost(id);
  if (cost === null || saved.gold < cost) { sfx('deny'); return false; }
  saved.gold -= cost;
  saved.upgrades[id] = upgradeLevel(id) + 1;
  saveGame();
  track('bought');
  sfx('buy');
  return true;
}

// ---------- The shop screen ----------

let shopReturn = 'title', shopNote = { text: '', until: 0 }, shopTab = 0;
const SHOP_TABS = ['Stats', 'Special'];
const SPECIAL_IDS = Object.keys(SPECIALS);
const shopIds = () => shopTab === 0 ? UPGRADE_IDS : SPECIAL_IDS;
const shopTabButton = i => ({ x: 104 + i * 48, y: 5, w: 44, h: 14 });

function setShopTab(i) {
  shopTab = (i + SHOP_TABS.length) % SHOP_TABS.length;
  shopNote = { text: '', until: 0 };
  sfx('uiClick');
}

function openShop() {
  shopReturn = state;
  state = 'shop';
  shopNote = { text: '', until: 0 };
  sfx('uiClick');
}

function closeShop() {
  state = shopReturn;
  sfx('uiClick');
}

const UPGRADE_IDS = Object.keys(UPGRADES);
// on touch screens the upgrades sit in two columns of bigger rows
const shopRow = i => shopTab === 1 ? { x: 10, y: 36 + i * 31, w: 300, h: 28 } : touch.on ? { x: 10 + Math.floor(i / 6) * 154, y: 34 + (i % 6) * 22, w: 146, h: 20 } : { x: 10, y: 34 + i * 11, w: 300, h: 10 };
const shopBackButton = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });

function shopRowUnderMouse() {
  if (!mouse.inside) return -1;
  return shopIds().findIndex((id, i) => { const r = shopRow(i); return mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h; });
}

function clickShop() {
  for (let t = 0; t < SHOP_TABS.length; t++) if (inBox(shopTabButton(t), 1)) { setShopTab(t); return; }
  if (touch.on) { const b = shopBackButton(); if (mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h) { closeShop(); return; } }
  const i = shopRowUnderMouse();
  if (i < 0) return;
  const id = shopIds()[i], u = UPGRADES[id] || SPECIALS[id], cost = upgradeCost(id);
  const star = UPGRADES[id] && upgradeLevel(id) >= u.max;
  if (buyUpgrade(id)) shopNote = { text: 'Bought ' + u.name + (UPGRADES[id] && upgradeLevel(id) > u.max ? ': star ' + starsOf(id) + '.' : ': level ' + upgradeLevel(id) + '.'), until: time + 2.5 };
  else shopNote = { text: cost === null ? u.name + ' is already at the top.' : 'Not enough gold for ' + u.name + (star ? ' (a star)' : '') + '.', until: time + 2.5 };
}

// The button on the title and end screens that opens the shop.
const TITLE_SHOP_Y = 114, END_SHOP_Y = 134;

function shopButton(y) {
  // on the title screen the three buttons share a row (see titleButtons in stats.js)
  if (y === TITLE_SHOP_Y) return titleButtons(y)[0];
  const w = textWidth(T('Upgrades (U)', 'Upgrades')) + 16;
  return { x: Math.round(BASE_W / 2 - w / 2), y, w, h: 13 };
}

function overShopButton(y) {
  const b = shopButton(y);
  return mouse.inside && mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h;
}

function drawShopButton(y) {
  const b = shopButton(y), hover = overShopButton(y);
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  border(b.x, b.y, b.w, b.h, hover ? COLOR.W : COLOR.O);
  drawText(y === TITLE_SHOP_Y ? 'Upgrades' : T('Upgrades (U)', 'Upgrades'), b.x + b.w / 2, b.y + 4, hover ? COLOR.W : COLOR.O, { align: 'center' });
}

function drawShop() {
  const over = shopRowUnderMouse();
  dim(0.9);
  drawText('Upgrades', 10, 8, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawText(saved.gold + ' gold', touch.on ? BASE_W - 64 : BASE_W - 10, 12, COLOR.O, { align: 'right' });
  if (touch.on) {
    const b = shopBackButton();
    ctx.fillStyle = 'rgba(24,20,37,0.85)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    border(b.x, b.y, b.w, b.h, COLOR.O);
    drawText('Back', b.x + b.w / 2, b.y + 6, COLOR.W, { align: 'center' });
  }
  SHOP_TABS.forEach((name, t) => {
    const b = shopTabButton(t), on = t === shopTab, hover = inBox(b, 1);
    ctx.fillStyle = on ? 'rgba(58,68,102,0.95)' : 'rgba(24,20,37,0.85)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    border(b.x, b.y, b.w, b.h, on ? COLOR.O : hover ? COLOR.W : COLOR.D);
    drawText(name, b.x + b.w / 2, b.y + 5, on ? COLOR.W : COLOR.g, { align: 'center' });
  });
  drawText(shopTab === 0 ? 'They last for ever. At the top you can add stars, for more gold each.' : 'These change how every run begins.', 10, 24, COLOR.g);
  shopIds().forEach((id, i) => {
    const r = shopRow(i), cost = upgradeCost(id);
    if (i === over) { ctx.fillStyle = 'rgba(58,68,102,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    if (shopTab === 1) {
      const sp = SPECIALS[id], level = upgradeLevel(id);
      border(r.x, r.y, r.w, r.h, i === over ? COLOR.W : COLOR.D);
      drawText(sp.name, r.x + 6, r.y + 5, level >= sp.max ? COLOR.O : COLOR.W);
      drawText('Lv ' + level + '/' + sp.max, r.x + 90, r.y + 5, COLOR.g);
      drawText(level >= sp.max ? sp.texts[sp.max - 1] : sp.texts[level], r.x + 6, r.y + 16, level >= sp.max ? COLOR.g : COLOR.l);
      if (cost === null) drawText('MAX', r.x + r.w - 6, r.y + 5, COLOR.O, { align: 'right' });
      else drawText(cost + ' gold', r.x + r.w - 6, r.y + 5, saved.gold >= cost ? COLOR.y : COLOR.r, { align: 'right' });
      return;
    }
    const u = UPGRADES[id], level = upgradeLevel(id), stars = starsOf(id), atTop = level >= u.max;
    const rowY = touch.on ? r.y + 3 : r.y + 2, statX = touch.on ? r.x + 4 : r.x + 130, statY = touch.on ? r.y + 11 : r.y + 2;
    if (touch.on) border(r.x, r.y, r.w, r.h, i === over ? COLOR.W : COLOR.D);
    drawText(u.name, r.x + 4, rowY, stars ? COLOR.c : atTop ? COLOR.O : COLOR.W);
    drawText(atTop ? 'Lv ' + u.max + ' +' + stars : 'Lv ' + level + '/' + u.max, touch.on ? r.x + 70 : r.x + 90, rowY, atTop ? COLOR.O : COLOR.g);
    drawText(formatStat(u.stat, atTop ? starStep(u) : u.step) + ' ' + STAT_INFO[u.stat].label, statX, statY, atTop ? COLOR.c : COLOR.l);
    if (cost === null) drawText('MAX', r.x + r.w - 4, touch.on ? r.y + 11 : rowY, COLOR.O, { align: 'right' });
    else drawText(cost + ' gold', r.x + r.w - 4, touch.on ? r.y + 11 : rowY, saved.gold >= cost ? COLOR.y : COLOR.r, { align: 'right' });
  });
  drawText(time < shopNote.until ? shopNote.text : T('Click to buy.   Arrows: page.   Esc: back', 'Tap to buy.') + '   Dungeon +' + Math.round(upgradeLevels() * POWER.life * 100) + '% tougher', BASE_W / 2, 170, time < shopNote.until ? COLOR.y : COLOR.g, { align: 'center' });
}
