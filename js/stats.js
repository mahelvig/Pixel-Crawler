"use strict";

// ---------- Statistics, and the buttons of the title screen ----------
// The statistics page shows what has been counted over all runs (saved.stats, see achievements.js and progress.js), in four tabs:
// overview, monsters, bosses and weapons. The title screen has a row of three buttons (upgrades, achievements, statistics)
// and one button that picks the weapon the next run starts with.

// The row of buttons under "Click to start": upgrades, achievements, statistics and the journal (keys U, A, S and J).
const TITLE_LABELS = ['Upgrades', 'Achievements', 'Statistics', 'Journal'];
function titleButtons(y) {
  const labels = TITLE_LABELS;
  const widths = labels.map(l => textWidth(l) + 12), gap = 5, total = widths.reduce((a, b) => a + b, 0) + gap * (labels.length - 1);
  let x = Math.round(BASE_W / 2 - total / 2);
  return labels.map((label, i) => { const b = { x, y, w: widths[i], h: 13 }; x += widths[i] + gap; return b; });
}

const statsButton = y => titleButtons(y)[2];
function overStatsButton(y) { return state === 'title' && inBox(statsButton(y)); }
function drawStatsButton(y) {
  const b = statsButton(y);
  drawButton(b, 'Statistics', overStatsButton(y));
}

const journalButton = y => titleButtons(y)[3];
const overJournalButton = () => state === 'title' && inBox(journalButton(TITLE_SHOP_Y));
function drawJournalButton(y) { drawButton(journalButton(y), 'Journal', overJournalButton()); }

// ---------- The start weapon ----------

const WEAPON_BUTTON_Y = 130;

function weaponButton() {
  const label = 'Start weapon: ' + WEAPONS[chosenStartWeapon()].name + (touch.on ? '' : ' (W)'), w = textWidth(label) + 16;
  return { x: Math.round(BASE_W / 2 - w / 2), y: WEAPON_BUTTON_Y, w, h: 13, label };
}

function overWeaponButton() { return state === 'title' && inBox(weaponButton()); }

function drawWeaponButton() {
  const b = weaponButton();
  drawButton(b, b.label, overWeaponButton());
}

// Switches to the next weapon that has been unlocked.
function cycleStartWeapon() {
  const list = unlockedStarters();
  if (list.length < 2) { sfx('deny'); return; }
  saved.startWeapon = list[(list.indexOf(chosenStartWeapon()) + 1) % list.length];
  saveGame();
  sfx('uiClick');
}

// ---------- The page ----------

const STAT_TABS = ['Overview', 'Monsters', 'Bosses', 'Weapons', 'Bestiary'];
const statsUi = { tab: 0 };

const statsBackButton = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });
function statsTabButton(i) {
  const widths = STAT_TABS.map(t => textWidth(t) + 14);
  let x = 10;
  for (let n = 0; n < i; n++) x += widths[n] + 4;
  return { x, y: 26, w: widths[i], h: 14 };
}

function openStats() {
  state = 'stats';
  statsUi.tab = 0;
  sfx('uiClick');
}

function closeStats() {
  state = 'title';
  sfx('uiClick');
}

function statsTab(delta) {
  statsUi.tab = (statsUi.tab + delta + STAT_TABS.length) % STAT_TABS.length;
  sfx('uiClick');
}

function clickStats() {
  if (inBox(statsBackButton(), 2)) { closeStats(); return; }
  for (let i = 0; i < STAT_TABS.length; i++) {
    if (inBox(statsTabButton(i), 1)) { statsUi.tab = i; sfx('uiClick'); return; }
  }
  if (statsUi.tab === 4) clickBestiary();
}

const formatCount = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
function formatTime(seconds) {
  const m = Math.floor(seconds / 60), h = Math.floor(m / 60);
  return h > 0 ? h + ' h ' + (m % 60) + ' min' : m + ' min';
}

// Every line of the page is [label, value, colour of the value] (the colour is optional), or [label] for a heading.
function statsLines(tab) {
  const s = saved.stats, sum = obj => Object.values(obj).reduce((a, b) => a + b, 0);
  if (tab === 0) {
    return [
      [['Season', formatCount(37 + s.wins)], ['Runs', formatCount(saved.runs)], ['Deaths', formatCount(s.deaths)], ['Seasons won', formatCount(s.wins)], ['Best floor', formatCount(saved.bestFloor)],
        ['Play time', formatTime(s.playTime)], ['Levels gained', formatCount(s.levels)], ['Gold earned', formatCount(s.goldEarned)], ['Items sold', formatCount(s.sold)], ['Sponsor boxes', formatCount(s.boxes)], ['Tapes found', tapesFound() + ' / ' + LEVEL_ORDER.length]],
      [['Monsters killed', formatCount(s.kills)], ['Bosses defeated', formatCount(sum(s.bossTypes))], ['Elites slain', formatCount(s.elites)], ['People saved', formatCount(s.npcs)], ['Boxes opened', formatCount(s.boxesOpened)], ['Shots fired', formatCount(s.shots)], ['Critical hits', formatCount(s.crits)],
        ['Damage taken', formatCount(s.damageTaken)], ['Distance walked', formatCount(s.walked / TILE) + ' m'], ['Things smashed', formatCount(s.destroyed)], ['Upgrades bought', formatCount(s.bought)]],
    ];
  }
  if (tab === 1) {
    const rows = Object.keys(ENEMIES).filter(id => !ENEMIES[id].boss).map(id => [ENEMIES[id].name, s.killsBy[id] ? formatCount(s.killsBy[id]) : '-', s.killsBy[id] ? COLOR.W : COLOR.D]);
    return [rows.slice(0, 9), rows.slice(9, 18), rows.slice(18)];
  }
  if (tab === 2) {
    const bosses = Object.keys(ENEMIES).filter(id => ENEMIES[id].boss).map(id => [ENEMIES[id].name.replace(/^The /, ''), s.bossTypes[id] ? formatCount(s.bossTypes[id]) + 'x' : '-', s.bossTypes[id] ? COLOR.l : COLOR.D]);
    const killers = Object.keys(s.deathsBy).sort((a, b) => s.deathsBy[b] - s.deathsBy[a]).slice(0, 8)
      .map(id => [ENEMIES[id] ? ENEMIES[id].name : 'Traps and hazards', formatCount(s.deathsBy[id]) + 'x', COLOR.r]);
    return [[['Bosses defeated'], ...bosses.slice(0, 6)], [['Bosses, continued'], ...bosses.slice(6)], [['Killed by'], ...(killers.length ? killers.map(k => [k[0].replace(/^The /, ''), k[1], k[2]]) : [['Nothing yet', '', COLOR.D]])]];
  }
  const weapons = Object.keys(WEAPONS).map(id => {
    const w = WEAPONS[id], kills = s.killsByWeapon[id] || 0, need = MASTERY_KILLS[w.rarity], chosen = chosenStartWeapon() === id;
    const value = w.infinite ? formatCount(kills) : (starterUnlocked(id) ? 'Unlocked' : formatCount(kills) + ' / ' + need);
    return [(chosen ? '> ' : '') + w.name, value, chosen ? COLOR.O : starterUnlocked(id) ? COLOR.l : kills > 0 ? COLOR.W : COLOR.D];
  });
  return [weapons.slice(0, 8), weapons.slice(8)];
}

function drawStats() {
  dim(0.92);
  drawText('Statistics', 10, 8, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawButton(statsBackButton(), 'Back', inBox(statsBackButton()));
  STAT_TABS.forEach((name, i) => {
    const b = statsTabButton(i), on = i === statsUi.tab, hover = inBox(b);
    ctx.fillStyle = on ? 'rgba(58,68,102,0.95)' : 'rgba(24,20,37,0.85)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    border(b.x, b.y, b.w, b.h, on ? COLOR.O : hover ? COLOR.W : COLOR.D);
    drawText(name, b.x + b.w / 2, b.y + 5, on ? COLOR.W : COLOR.g, { align: 'center' });
  });
  if (statsUi.tab === 4) { drawBestiary(); return; }
  const columns = statsLines(statsUi.tab), three = columns.length === 3, xs = three ? [10, 112, 214] : [12, 170], width = three ? 94 : 138;
  columns.forEach((rows, c) => {
    rows.forEach(([label, value, color], i) => {
      const y = 48 + i * (rows.length > 10 ? 10 : 11);
      if (value === undefined) { drawText(label, xs[c], y, COLOR.O); return; }
      drawText(label, xs[c], y, COLOR.g);
      drawText(value, xs[c] + width, y, color || COLOR.W, { align: 'right' });
    });
  });
  if (statsUi.tab === 3) drawText('Kill enough with a weapon to start your runs with it.', BASE_W / 2, 160, COLOR.g, { align: 'center' });
}
