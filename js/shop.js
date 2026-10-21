"use strict";

// ---------- The shop: permanent upgrades bought with gold ----------
// Every upgrade has levels, and every level costs more than the one before: base x growth ^ level (UPGRADES in settings.js).
// What has been bought is saved (see progress.js) and works through stat() in every run.

const upgradeLevel = id => saved.upgrades[id] || 0;

// The price of the next level, or null when it is at the top. Rounded to a multiple of 5.
function upgradeCost(id) {
  const u = UPGRADES[id], level = upgradeLevel(id);
  if (level >= u.max) return null;
  return Math.max(5, Math.round(u.base * Math.pow(u.growth, level) / 5) * 5);
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

let shopReturn = 'title', shopNote = { text: '', until: 0 };

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
const shopRow = i => touch.on ? { x: 10 + Math.floor(i / 6) * 154, y: 34 + (i % 6) * 22, w: 146, h: 20 } : { x: 10, y: 34 + i * 11, w: 300, h: 10 };
const shopBackButton = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });

function shopRowUnderMouse() {
  if (!mouse.inside) return -1;
  return UPGRADE_IDS.findIndex((id, i) => { const r = shopRow(i); return mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h; });
}

function clickShop() {
  if (touch.on) { const b = shopBackButton(); if (mouse.x >= b.x && mouse.x < b.x + b.w && mouse.y >= b.y && mouse.y < b.y + b.h) { closeShop(); return; } }
  const i = shopRowUnderMouse();
  if (i < 0) return;
  const id = UPGRADE_IDS[i], u = UPGRADES[id], cost = upgradeCost(id);
  if (buyUpgrade(id)) shopNote = { text: 'Bought ' + u.name + ': level ' + upgradeLevel(id) + '.', until: time + 2.5 };
  else shopNote = { text: cost === null ? u.name + ' is already at the top.' : 'Not enough gold for ' + u.name + '.', until: time + 2.5 };
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
  drawText('They last for ever, and every level costs more than the one before.', 10, 24, COLOR.g);
  UPGRADE_IDS.forEach((id, i) => {
    const r = shopRow(i), u = UPGRADES[id], level = upgradeLevel(id), cost = upgradeCost(id);
    if (i === over) { ctx.fillStyle = 'rgba(58,68,102,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    const rowY = touch.on ? r.y + 3 : r.y + 2, statX = touch.on ? r.x + 4 : r.x + 130, statY = touch.on ? r.y + 11 : r.y + 2;
    if (touch.on) border(r.x, r.y, r.w, r.h, i === over ? COLOR.W : COLOR.D);
    drawText(u.name, r.x + 4, rowY, level >= u.max ? COLOR.O : COLOR.W);
    drawText('Lv ' + level + '/' + u.max, touch.on ? r.x + 70 : r.x + 90, rowY, COLOR.g);
    drawText(formatStat(u.stat, u.step) + ' ' + STAT_INFO[u.stat].label, statX, statY, COLOR.l);
    if (cost === null) drawText('MAX', r.x + r.w - 4, touch.on ? r.y + 11 : rowY, COLOR.O, { align: 'right' });
    else drawText(cost + ' gold', r.x + r.w - 4, touch.on ? r.y + 11 : rowY, saved.gold >= cost ? COLOR.y : COLOR.r, { align: 'right' });
  });
  drawText(time < shopNote.until ? shopNote.text : T('Click an upgrade to buy it.   Esc: back', 'Tap an upgrade to buy it.'), BASE_W / 2, 170, time < shopNote.until ? COLOR.y : COLOR.g, { align: 'center' });
}
