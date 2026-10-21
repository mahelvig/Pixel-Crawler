"use strict";

// ---------- Minimap ----------
// The map fills in where the player has been: every tile within sight (MINIMAP.reveal tiles, not through walls) is remembered. A small
// part of it sits in the top left corner while playing; N (or the map button on a touch screen) opens the whole floor, with the game
// paused. It also marks Morris, people to rescue, things to pick up, the boss gate, the boss and the stairs, once they have been seen.

const MINIMAP = { reveal: 7, view: [36, 24], scale: 2, wall: '#4a5784', floor: '#9fb0d0', gate: '#e43b44' };

// the explored tiles of this floor, drawn into a canvas of one pixel per tile
function minimapOf(w = world) {
  if (!w.minimap) {
    const lv = w.level, [canvas, g] = createCanvas(lv.b, lv.h);
    w.minimap = { seen: new Uint8Array(lv.b * lv.h), canvas, g, tx: -1, ty: -1, gateDone: false };
  }
  return w.minimap;
}

function mapReveal(m, lv, x, y) {
  const i = y * lv.b + x;
  if (m.seen[i]) return;
  m.seen[i] = 1;
  m.g.fillStyle = lv.solid[i] ? MINIMAP.wall : MINIMAP.floor;
  m.g.fillRect(x, y, 1, 1);
}

// every frame while playing: remember what the player can see from where they stand
function updateMinimap() {
  const lv = world.level, m = minimapOf(), pl = world.player;
  const tx = Math.floor(pl.x / TILE), ty = Math.floor(pl.y / TILE), R = MINIMAP.reveal;
  if (world.gateOpen && lv.gate && !m.gateDone) {
    m.gateDone = true;
    for (const t of lv.gate.tiles) { m.seen[t.y * lv.b + t.x] = 0; mapReveal(m, lv, t.x, t.y); }   // the gate is not a wall any more
  }
  if (tx === m.tx && ty === m.ty) return;
  m.tx = tx; m.ty = ty;
  for (let y = Math.max(0, ty - R); y <= Math.min(lv.h - 1, ty + R); y++) {
    for (let x = Math.max(0, tx - R); x <= Math.min(lv.b - 1, tx + R); x++) {
      const dx = x - tx, dy = y - ty;
      if (dx * dx + dy * dy > R * R || m.seen[y * lv.b + x]) continue;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));
      let clear = true;
      for (let s = 1; s < steps && clear; s++) {
        if (blocksBullets(lv, Math.round(tx + dx * s / steps), Math.round(ty + dy * s / steps))) clear = false;
      }
      if (clear) mapReveal(m, lv, x, y);
    }
  }
}

const mapSeen = (m, lv, x, y) => m.seen[Math.floor(y / TILE) * lv.b + Math.floor(x / TILE)] === 1;

// the things worth showing, as world positions: {x, y, color, size}
function minimapMarks() {
  const lv = world.level, m = world.minimap, marks = [], blink = Math.floor(time * 3) % 2 === 0;
  const add = (x, y, color, size = 1) => { if (mapSeen(m, lv, x, y)) marks.push({ x, y, color, size }); };
  if (lv.trader) add(lv.trader.x, lv.trader.y, COLOR.y, 2);
  for (const n of world.npcs) if (n.state !== 'safe') add(n.x, n.y, COLOR.c, 2);
  for (const b of world.breakables) if (b.kind === 'cage') add(b.x, b.y, COLOR.c, 2);
  for (const p of world.pickups) add(p.x, p.y, COLOR.l, 1);
  if (lv.exit && world.npcs.some(n => n.state !== 'safe')) add(lv.exit.x, lv.exit.y, COLOR.l, 2);
  if (lv.gate && !world.gateOpen) add(lv.gate.tiles[0].x * TILE + 8, lv.gate.tiles[0].y * TILE + 8, MINIMAP.gate, 2);
  for (const f of world.enemies) if (ENEMIES[f.type].boss && !f.minion) marks.push({ x: f.x, y: f.y, color: blink ? COLOR.r : COLOR.R, size: 3 });
  if (world.stairs && world.stairs.active) marks.push({ x: world.stairs.x, y: world.stairs.y, color: blink ? COLOR.O : COLOR.y, size: 3 });
  marks.push({ x: world.player.x, y: world.player.y, color: blink ? COLOR.W : COLOR.c, size: 2 });
  return marks;
}

const mapOpen = () => state === 'map';
function openMap() {
  if (state !== 'playing') return;
  state = 'map';
  mouse.down = false;
  mouse.moving = false;
  sfx('pause');
}
function closeMap() {
  if (state !== 'map') return;
  state = 'playing';
  sfx('pause');
}

// ---------- The corner ----------

// the place and size of the corner map, or null when it is not shown
function minimapRect() {
  if (!OPTIONS.minimap || world.helpAlpha > 0 || !world.minimap) return null;   // the controls of the tutorial sit in the same place
  const lv = world.level, rules = (lv.rules || []).length, s = MINIMAP.scale;
  const vw = Math.min(MINIMAP.view[0], lv.b), vh = Math.min(MINIMAP.view[1], lv.h);
  return { x: 4, y: 4 + rules * 15, w: vw * s + 2, h: vh * s + 2, vw, vh };
}

function drawMinimap() {
  const r = minimapRect();
  if (!r) return;
  const m = world.minimap, lv = world.level, pl = world.player, s = MINIMAP.scale;
  const x0 = clamp(Math.round(pl.x / TILE - r.vw / 2), 0, lv.b - r.vw), y0 = clamp(Math.round(pl.y / TILE - r.vh / 2), 0, lv.h - r.vh);
  ctx.fillStyle = 'rgba(24,20,37,0.7)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalAlpha = 0.85;
  ctx.drawImage(m.canvas, x0, y0, r.vw, r.vh, r.x + 1, r.y + 1, r.vw * s, r.vh * s);
  ctx.globalAlpha = 1;
  border(r.x, r.y, r.w, r.h, COLOR.D);
  for (const k of minimapMarks()) {
    const px = r.x + 1 + (k.x / TILE - x0) * s, py = r.y + 1 + (k.y / TILE - y0) * s;
    if (px < r.x + 1 || py < r.y + 1 || px > r.x + r.w - 2 || py > r.y + r.h - 2) continue;
    ctx.fillStyle = k.color;
    ctx.fillRect(Math.round(px) - (k.size >> 1), Math.round(py) - (k.size >> 1), k.size, k.size);
  }
}

// ---------- The whole floor ----------

function drawBigMap() {
  const lv = world.level, m = world.minimap || minimapOf();
  dim(0.82);
  const s = Math.max(1, Math.floor(Math.min((BASE_W - 16) / lv.b, (SCREEN_H - 34) / lv.h)));
  const w = lv.b * s, h = lv.h * s, x = Math.round(BASE_W / 2 - w / 2), y = 22 + Math.round((SCREEN_H - 34 - h) / 2);
  drawText('Floor ' + (world.levelIndex + 1) + ': ' + lv.name, BASE_W / 2, 8, COLOR.O, { align: 'center' });
  ctx.fillStyle = '#0e0b18';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.drawImage(m.canvas, 0, 0, lv.b, lv.h, x, y, w, h);
  border(x - 2, y - 2, w + 4, h + 4, COLOR.D);
  for (const k of minimapMarks()) {
    const size = k.size + 1;
    ctx.fillStyle = COLOR.K;
    ctx.fillRect(Math.round(x + k.x / TILE * s) - (size >> 1) - 1, Math.round(y + k.y / TILE * s) - (size >> 1) - 1, size + 2, size + 2);
    ctx.fillStyle = k.color;
    ctx.fillRect(Math.round(x + k.x / TILE * s) - (size >> 1), Math.round(y + k.y / TILE * s) - (size >> 1), size, size);
  }
  const legend = [['You', COLOR.W], ['Morris', COLOR.y], ['People', COLOR.c], ['Pickups', COLOR.l], ['Gate', MINIMAP.gate], ['Stairs', COLOR.O]];
  let lx = Math.round(BASE_W / 2 - legend.reduce((t, [name]) => t + textWidth(name) + 14, 0) / 2);
  for (const [name, color] of legend) {
    ctx.fillStyle = color; ctx.fillRect(lx, SCREEN_H - 12, 4, 4);
    drawText(name, lx + 7, SCREEN_H - 13, COLOR.S);
    lx += textWidth(name) + 14;
  }
  drawText(T('N or click to close', 'Tap to close'), BASE_W / 2, SCREEN_H - 24, COLOR.g, { align: 'center' });
}
