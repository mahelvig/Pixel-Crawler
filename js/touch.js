// Touch controls: a move stick on the left half of the screen, an aim-and-shoot stick on the right half.
// The sticks float: they appear where the thumb lands and follow it when it is dragged further out.
const TOUCH = {
  stickRadius: 24,   // how far the thumb can be from the stick centre before the centre follows
  deadzone: 4,       // below this distance the stick counts as untouched
  assistCone: 0.35,  // aim assist: how far off (radians) an enemy may be and still pull the aim
  assistRange: 150,  // aim assist: how far away an enemy may be
  assistPull: 0.8,   // aim assist: 0 = none, 1 = snap fully to the enemy
};

// touch is on from the start on a phone or tablet (the main pointer is a finger), so the title screen already shows the right texts
const touch = { on: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches, move: null, aim: null };

// the text for keyboard and mouse, or for touch
const T = (pc, phone) => touch.on ? phone : pc;

// the on-screen buttons while playing
const TOUCH_BUTTONS = [
  { id: 'pause', x: SCREEN_W / 2 - 21, y: 3, w: 18, h: 18, label: 'II' },
  { id: 'bag', x: SCREEN_W / 2 + 3, y: 3, w: 18, h: 18, label: 'B' },
];

// the area of hotbar slot i; bigger than the drawn slot so a thumb can hit it
function hotbarRect(i) {
  const r = 18, m = 2, n = BAG.hotbarSlots;
  const x0 = Math.round(SCREEN_W / 2 - (n * r + (n - 1) * m) / 2), y0 = SCREEN_H - r - 4;
  return { x: x0 + i * (r + m), y: y0, w: r, h: r };
}

function touchPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp((e.clientX - rect.left) * SCREEN_W / rect.width, 0, SCREEN_W - 1),
    y: clamp((e.clientY - rect.top) * SCREEN_H / rect.height, 0, SCREEN_H - 1),
  };
}

function inRect(p, r, pad = 0) {
  return p.x >= r.x - pad && p.x < r.x + r.w + pad && p.y >= r.y - pad && p.y < r.y + r.h + pad;
}

// direction and strength (0..1) of a stick
function stickVector(s) {
  if (!s) return { x: 0, y: 0, mag: 0, angle: 0 };
  const dx = s.x - s.x0, dy = s.y - s.y0, d = Math.hypot(dx, dy);
  if (d < TOUCH.deadzone) return { x: 0, y: 0, mag: 0, angle: 0 };
  return { x: dx / d, y: dy / d, mag: Math.min(1, d / TOUCH.stickRadius), angle: Math.atan2(dy, dx) };
}

// Everything that can be shot at: living enemies, then shooting targets not yet hit and breakable things (nests, coffins,
// cameras). solid is the tile the thing stands in, which does not count as a wall between it and the player.
function shootables(pl) {
  const list = [];
  for (const en of world.enemies) if (!en.dead) list.push({ x: en.x, y: en.y, enemy: true });
  for (const t of world.targets) if (!t.hit) list.push({ x: t.x, y: t.y, solid: null });
  for (const b of world.breakables) list.push({ x: b.x, y: b.y + 8 - BREAKABLES[b.kind].h / 2, solid: [Math.floor(b.x / TILE), Math.floor(b.y / TILE)] });
  return list;
}

// Auto-fire: the nearest enemy within the weapon's range that is not behind a wall; if there is none, the nearest target or
// breakable. Returns null if there is nothing.
function autoTarget(pl) {
  if (!touch.on || !OPTIONS.autoFire || !world.enemies || !pl.weapon) return null;
  const range = WEAPONS[pl.weapon].range;
  let best = null, bestDist = Infinity;
  for (const o of shootables(pl)) {
    const d = Math.hypot(o.x - pl.x, o.y - (pl.y - 4));
    const better = !best || (o.enemy && !best.enemy) || (!!o.enemy === !!best.enemy && d < bestDist);
    if (d >= range || !better) continue;
    let clear = true;
    for (let i = 1; i < 8 && clear; i++) {
      const tx = Math.floor((pl.x + (o.x - pl.x) * i / 8) / TILE), ty = Math.floor((pl.y + (o.y - pl.y) * i / 8) / TILE);
      if (o.solid && tx === o.solid[0] && ty === o.solid[1]) continue;
      if (blocksBullets(world.level, tx, ty)) clear = false;
    }
    if (clear) { best = o; bestDist = d; }
  }
  return best;
}

function touchFiring() { return touch.on && (stickVector(touch.aim).mag > 0 || !!autoTarget(world.player)); }

// returns true when the touch was used for playing; other states use the ordinary click handling
function touchDown(e) {
  if (state === 'map') { closeMap(); return true; }
  if (state !== 'playing') return false;
  const p = touchPoint(e);
  mouse.x = p.x; mouse.y = p.y;
  if (tradeButtonShown() && inRect(p, tradeButton(), 3)) { tryTrade(); return true; }
  if (abilityShown() && inRect(p, abilityRect(), 4)) { useAbility(); return true; }
  if (minimapRect() && inRect(p, minimapRect(), 2)) { openMap(); return true; }
  for (const b of TOUCH_BUTTONS) {
    if (inRect(p, b, 3)) {
      if (b.id === 'pause') { state = 'pause'; sfx('pause'); } else toggleBag();
      return true;
    }
  }
  for (let i = 0; i < BAG.hotbarSlots; i++) {
    if (inRect(p, hotbarRect(i), 1)) { selectSlot(world.player, i); return true; }
  }
  const which = p.x < SCREEN_W / 2 ? 'move' : 'aim';
  if (touch[which]) return true;
  touch[which] = { id: e.pointerId, x0: p.x, y0: p.y, x: p.x, y: p.y };
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not important */ }
  return true;
}

function touchMove(e) {
  for (const which of ['move', 'aim']) {
    const s = touch[which];
    if (!s || s.id !== e.pointerId) continue;
    const p = touchPoint(e);
    s.x = p.x; s.y = p.y;
    // dragging past the radius pulls the centre along
    const dx = s.x - s.x0, dy = s.y - s.y0, d = Math.hypot(dx, dy);
    if (d > TOUCH.stickRadius) {
      s.x0 = s.x - dx / d * TOUCH.stickRadius;
      s.y0 = s.y - dy / d * TOUCH.stickRadius;
    }
  }
}

function touchUp(e) {
  for (const which of ['move', 'aim']) if (touch[which] && touch[which].id === e.pointerId) touch[which] = null;
}

function touchRelease() { touch.move = null; touch.aim = null; }

// the aim angle from the aim stick, pulled towards the nearest enemy that is roughly in that direction
function aimAngle(pl) {
  const v = stickVector(touch.aim);
  if (v.mag === 0) {
    const target = autoTarget(pl);
    return target ? Math.atan2(target.y - (pl.y - 4), target.x - pl.x) : pl.aim;
  }
  if (!OPTIONS.aimAssist || !world.enemies) return v.angle;
  let best = null, bestDist = TOUCH.assistRange;
  for (const en of shootables(pl)) {
    const dx = en.x - pl.x, dy = en.y - (pl.y - 4), d = Math.hypot(dx, dy);
    if (d >= bestDist) continue;
    const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - v.angle), Math.cos(Math.atan2(dy, dx) - v.angle));
    if (Math.abs(diff) > TOUCH.assistCone) continue;
    best = diff; bestDist = d;
  }
  return best === null ? v.angle : v.angle + best * TOUCH.assistPull;
}

// drawn on top of the game while playing
function drawTouch() {
  if (!touch.on || state !== 'playing') return;
  for (const b of TOUCH_BUTTONS) {
    ctx.fillStyle = 'rgba(24,20,37,0.6)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    border(b.x, b.y, b.w, b.h, COLOR.D);
    drawText(b.label, b.x + b.w / 2, b.y + 6, COLOR.S, { align: 'center' });
  }
  const target = autoTarget(world.player);
  if (target && !touch.aim) {
    const x = Math.round(target.x - camera.x), y = Math.round(target.y - camera.y);
    ctx.fillStyle = COLOR.r;
    for (const [dx, dy] of [[-6, -6], [4, -6], [-6, 4], [4, 4]]) ctx.fillRect(x + dx, y + dy, 3, 3);
  }
  for (const [which, hintX, hint] of [['move', SCREEN_W * 0.18, 'MOVE'], ['aim', SCREEN_W * 0.82, 'AIM']]) {
    const s = touch[which];
    if (!s) {
      if (world.helpAlpha > 0) {
        ctx.globalAlpha = 0.35 * Math.min(1, world.helpAlpha);
        ring(hintX, SCREEN_H * 0.62, TOUCH.stickRadius, COLOR.S);
        drawText(hint, hintX, SCREEN_H * 0.62 - 3, COLOR.S, { align: 'center' });
        ctx.globalAlpha = 1;
      }
      continue;
    }
    ctx.globalAlpha = 0.45;
    ring(s.x0, s.y0, TOUCH.stickRadius, COLOR.S);
    ctx.fillStyle = which === 'aim' ? COLOR.W : COLOR.S;
    ctx.fillRect(Math.round(s.x) - 4, Math.round(s.y) - 4, 9, 9);
    ctx.globalAlpha = 1;
  }
}

// a square-ish pixel ring (the game is pixel art, so no smooth arcs)
function ring(cx, cy, r, color) {
  ctx.fillStyle = color;
  for (let a = 0; a < 32; a++) {
    const t = a / 32 * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1);
  }
}
