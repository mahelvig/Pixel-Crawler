"use strict";

// ---------- Saves ----------
// Three saves, each with its own name, progress and run to continue (the keys are in progress.js). The button at the top left of the
// title screen shows the one in use and opens this screen, where a save can be picked, renamed or erased. Erasing the save that is in use
// starts the whole game over: gold, upgrades, achievements, statistics and story are all gone, and the new crawler gets a name.
// Names are asked for with the browser's own prompt box, so they can be typed on a phone as well.

let slotsUi = { erase: -1, until: 0, note: '', noteUntil: 0 };

// Asks for a name and keeps it. An empty answer (or cancel) keeps the old name, or the default one.
function askName(current = saved.name) {
  let answer = null;
  if (typeof prompt === 'function') {
    try { answer = prompt('Name your crawler (up to ' + NAME_MAX + ' letters)', current || DEFAULT_NAME); } catch (e) { answer = null; }
  }
  saved.name = cleanName(answer) || cleanName(current) || DEFAULT_NAME;
  mouse.down = false;
  mouse.moving = false;
  saveGame();
}

// What the screen says about a save, or null if nothing has been saved there. The save in use is read from the game itself.
function slotInfo(i) {
  if (i === activeSlot) {
    if (!saved.name && !saved.runs && !saved.gold && !savedRun && !saved.stats.kills) return null;
    return { name: playerName(), season: 37 + saved.stats.wins, best: saved.bestFloor, gold: saved.gold, runFloor: savedRun ? savedRun.floor + 1 : 0, klass: savedRun && savedRun.class };
  }
  try {
    const d = JSON.parse(localStorage.getItem(slotKey('save', i)));
    if (!d || typeof d !== 'object') return null;
    let run = null;
    try { run = JSON.parse(localStorage.getItem(slotKey('run', i))); } catch (e) { /* no run */ }
    const num = v => Math.max(0, Math.floor(Number(v) || 0));
    return { name: cleanName(d.name) || DEFAULT_NAME, season: 37 + num(d.stats && d.stats.wins), best: num(d.bestFloor), gold: num(d.gold), runFloor: run && Number.isFinite(run.floor) ? num(run.floor) + 1 : 0, klass: run && typeof run.class === 'string' && CLASSES[run.class] ? run.class : null };
  } catch (e) { return null; }
}

function openSlots() {
  state = 'slots';
  slotsUi = { erase: -1, until: 0, note: '', noteUntil: 0 };
  sfx('uiClick');
}

function closeSlots() {
  state = 'title';
  sfx('uiClick');
}

// Switches to another save. A save with nothing in it gets a name first.
function chooseSave(i) {
  if (i < 0 || i >= SLOT_COUNT) return;
  if (i !== activeSlot) {
    saveGame();
    activeSlot = i;
    try { localStorage.setItem('pixelCrawler.slot', String(i)); } catch (e) { /* storage may be blocked */ }
    loadSaved();
    savedRun = readRun();
    world = newWorld(0);
    if (!saved.name && !saved.runs && !saved.gold && !savedRun) askName('');
  }
  state = 'title';
  sfx('uiClick');
}

function erasePending(i) { return slotsUi.erase === i && time < slotsUi.until; }

// The first click only asks; the second one, within a few seconds, does it.
function eraseSlot(i) {
  if (!erasePending(i)) {
    slotsUi.erase = i; slotsUi.until = time + 4;
    slotsUi.note = 'Click Erase again to wipe save ' + (i + 1) + ' for good. Gold, upgrades, achievements and the story go too.'; slotsUi.noteUntil = time + 4;
    sfx('deny');
    return;
  }
  slotsUi.erase = -1;
  try { localStorage.removeItem(slotKey('save', i)); localStorage.removeItem(slotKey('run', i)); } catch (e) { /* storage may be blocked */ }
  if (i === activeSlot) {
    loadSaved();
    savedRun = null;
    world = newWorld(0);
    askName('');
  }
  slotsUi.note = 'Save ' + (i + 1) + ' is empty again.'; slotsUi.noteUntil = time + 3;
  sfx('bagClose');
}

function renameSlot(i) {
  if (i !== activeSlot) chooseSave(i), state = 'slots';
  askName(saved.name);
  slotsUi.note = 'Hello, ' + playerName() + '.'; slotsUi.noteUntil = time + 3;
  sfx('uiClick');
}

// ---- the screen ----

const slotsBack = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });
const slotRow = i => ({ x: 14, y: 30 + i * 44, w: BASE_W - 28, h: 40 });
function slotButtons(i) {
  const r = slotRow(i), x = r.x + r.w - 62;
  return [
    { id: 'play', x, y: r.y + 3, w: 58, h: 11 },
    { id: 'rename', x, y: r.y + 15, w: 58, h: 11 },
    { id: 'erase', x, y: r.y + 27, w: 58, h: 11 },
  ];
}

function clickSlots() {
  if (inBox(slotsBack(), 2)) { closeSlots(); return; }
  for (let i = 0; i < SLOT_COUNT; i++) {
    for (const b of slotButtons(i)) {
      if (!inBox(b)) continue;
      if (b.id === 'play') chooseSave(i);
      else if (b.id === 'rename') renameSlot(i);
      else eraseSlot(i);
      return;
    }
    if (inBox(slotRow(i))) { chooseSave(i); return; }
  }
}

function drawSlots() {
  dim(0.92);
  drawText('Saves', 10, 8, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawButton(slotsBack(), 'Back', inBox(slotsBack()));
  for (let i = 0; i < SLOT_COUNT; i++) {
    const r = slotRow(i), info = slotInfo(i), active = i === activeSlot, hover = inBox(r);
    ctx.fillStyle = hover ? 'rgba(58,68,102,0.9)' : 'rgba(24,20,37,0.85)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    border(r.x, r.y, r.w, r.h, active ? COLOR.O : hover ? COLOR.W : COLOR.D);
    drawText('SAVE ' + (i + 1), r.x + 6, r.y + 5, active ? COLOR.O : COLOR.g);
    if (!info) {
      drawText('Empty', r.x + 6, r.y + 16, COLOR.D);
      drawText('A new crawler starts here.', r.x + 6, r.y + 27, COLOR.D);
    } else {
      drawText(info.name, r.x + 46, r.y + 5, COLOR.W);
      drawText('Season ' + info.season + '   Best floor ' + info.best + '   ' + info.gold + ' gold', r.x + 6, r.y + 16, COLOR.S);
      drawText(info.runFloor ? 'Run in progress: floor ' + info.runFloor + (info.klass ? ', ' + CLASSES[info.klass].name : '') : 'No run in progress', r.x + 6, r.y + 27, info.runFloor ? COLOR.y : COLOR.g);
    }
    for (const b of slotButtons(i)) {
      const over = inBox(b);
      let label = b.id === 'play' ? (active ? 'In use' : info ? 'Play' : 'Start') : b.id === 'rename' ? 'Rename' : (erasePending(i) ? 'Sure?' : 'Erase');
      if (b.id === 'rename' && !info && !active) label = '';
      if (!label) continue;
      const color = b.id === 'erase' ? (erasePending(i) ? COLOR.r : over ? COLOR.W : COLOR.g) : b.id === 'play' && active ? COLOR.l : over ? COLOR.W : COLOR.O;
      ctx.fillStyle = 'rgba(24,20,37,0.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
      border(b.x, b.y, b.w, b.h, color);
      drawText(label, b.x + b.w / 2, b.y + 3, color, { align: 'center' });
    }
  }
  const note = time < slotsUi.noteUntil;
  drawText(note ? slotsUi.note : 'Pick a save to play. Erasing the one in use starts the whole game over.', BASE_W / 2, 166, note ? COLOR.y : COLOR.g, { align: 'center' });
}

// ---- the button on the title screen ----

function slotButton() {
  const label = 'Save ' + (activeSlot + 1) + ': ' + playerName();
  return { x: 6, y: 6, w: textWidth(label) + 14, h: 14, label };
}
const overSlotButton = () => state === 'title' && inBox(slotButton());
function drawSlotButton() {
  const b = slotButton();
  drawButton(b, b.label, overSlotButton());
}
