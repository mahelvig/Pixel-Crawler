"use strict";

// ---------- Helpers ----------

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const randRange = (a, b) => a + Math.random() * (b - a);

// Fixed "random" number between 0 and 1 for a position, so the map looks the same every time.
function hash(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function createCanvas(b, h) {
  const c = document.createElement('canvas');
  c.width = b; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function createSprite(rows) {
  const [c, g] = createCanvas(rows[0].length, rows.length);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const f = COLOR[row[x]];
      if (f) { g.fillStyle = f; g.fillRect(x, y, 1, 1); }
    }
  });
  return c;
}

function createSilhouette(source, color) {
  const [c, g] = createCanvas(source.width, source.height);
  g.drawImage(source, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---------- Screen ----------

const canvas = document.getElementById('screen');
canvas.width = SCREEN_W;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fitScreen() {
  // the real visible size: on phones the body can be taller than what is on screen (address bar)
  const vv = window.visualViewport, w = vv ? vv.width : (window.innerWidth || document.body.clientWidth), h = vv ? vv.height : (window.innerHeight || document.body.clientHeight);
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  let scale = Math.min(w / SCREEN_W, h / SCREEN_H);
  if (scale >= 2 && !coarse) scale = Math.floor(scale * 2) / 2; // phones use every pixel they have
  if (document.body.style) document.body.style.height = h + 'px';
  canvas.style.width = Math.floor(SCREEN_W * scale) + 'px';
  canvas.style.height = Math.floor(SCREEN_H * scale) + 'px';
}
window.addEventListener('resize', fitScreen);
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitScreen);
window.addEventListener('orientationchange', fitScreen);
fitScreen();

function textWidth(text, scale = 1) {
  let b = 0;
  for (const t of text.toUpperCase()) b += (FONT_PIXELS[t] || FONT_PIXELS['?']).b + 1;
  return Math.max(0, b - 1) * scale;
}

function drawText(text, x, y, color, options = {}) {
  const { scale = 1, shadow = COLOR.K, align = 'left', alpha = 1 } = options;
  const width = textWidth(text, scale);
  const x0 = Math.round(align === 'center' ? x - width / 2 : align === 'right' ? x - width : x);
  const y0 = Math.round(y);
  ctx.globalAlpha = alpha;
  const paint = (dx, dy, f) => {
    ctx.fillStyle = f;
    let cx = x0;
    for (const t of text.toUpperCase()) {
      const gl = FONT_PIXELS[t] || FONT_PIXELS['?'];
      for (let i = 0; i < gl.px.length; i += 2) ctx.fillRect(cx + gl.px[i] * scale + dx, y0 + gl.px[i + 1] * scale + dy, scale, scale);
      cx += (gl.b + 1) * scale;
    }
  };
  if (shadow) paint(0, scale, shadow);
  paint(0, 0, color);
  ctx.globalAlpha = 1;
}

// Splits a text into lines no wider than maxWidth.
function wrapLines(text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? line + ' ' + word : word;
    if (line && textWidth(candidate) > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------- Map graphics ----------

// Draws the whole map once onto its own canvas.
function drawLevel(lv) {
  const [c, g] = createCanvas(lv.b * TILE, lv.h * TILE);
  const F = COLOR;
  const r = (x, y, b, h, f) => { g.fillStyle = f; g.fillRect(x, y, b, h); };
  const tileChar = (x, y) => (lv.chars[y] && lv.chars[y][x]) || '#';
  const v = (x, y) => isWall(lv, x, y);

  // --- floors ---
  const FLOORS = {
    parquet(tx, ty, x0, y0) {
      for (let row = 0; row < 4; row++) {
        const wy = y0 + row * 4, plank = wy >> 2, offset = (plank * 11) % 24;
        for (let px = 0; px < 16; px++) {
          const wx = x0 + px, n = hash(Math.floor((wx + offset) / 24), plank, 7);
          r(wx, wy, 1, 3, n < 0.5 ? F.u : n < 0.85 ? F.H : F.q);
          if ((wx + offset) % 24 === 0) r(wx, wy, 1, 3, F.U);
          else if (hash(wx, wy, 3) < 0.04) r(wx, wy + 1, 1, 1, F.U);
        }
        r(x0, wy + 3, 16, 1, F.U);
      }
    },
    kitchenTile(tx, ty, x0, y0) {
      for (let by = 0; by < 2; by++) {
        for (let bx = 0; bx < 2; bx++) {
          const wx = x0 + bx * 8, wy = y0 + by * 8, light = (((wx >> 3) + (wy >> 3)) & 1) === 0;
          r(wx, wy, 8, 8, light ? F.S : F.g);
          r(wx + 1, wy + 1, 1, 1, light ? F.W : F.S);
        }
      }
    },
    carpet(tx, ty, x0, y0) {
      const isCarpet = (x, y) => !v(x, y) && floorUnder(lv, x, y) === 'carpet';
      const left = !isCarpet(tx - 1, ty), right = !isCarpet(tx + 1, ty), top = !isCarpet(tx, ty - 1), bottom = !isCarpet(tx, ty + 1);
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const mx = (x0 + px) % 8, my = (y0 + py) % 8;
          let f = Math.abs(mx - 3.5) + Math.abs(my - 3.5) === 3 ? F.r : F.R;
          const edge = Math.min(left ? px : 99, right ? 15 - px : 99, top ? py : 99, bottom ? 15 - py : 99);
          if (edge === 0) f = F.p; else if (edge === 1) f = F.O;
          r(x0 + px, y0 + py, 1, 1, f);
        }
      }
    },
    concrete(tx, ty, x0, y0) {
      r(x0, y0, 16, 16, F.D);
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const n = hash(x0 + px, y0 + py, 11);
          if (n < 0.06) r(x0 + px, y0 + py, 1, 1, F.s);
          else if (n < 0.09) r(x0 + px, y0 + py, 1, 1, F.k);
        }
      }
      if (hash(tx, ty, 5) < 0.15) {
        let x = 2 + Math.floor(hash(tx, ty, 6) * 12), y = 2;
        for (let i = 0; i < 10 && y < 15; i++) {
          r(x0 + x, y0 + y, 1, 1, F.k);
          y += 1; x = clamp(x + Math.floor(hash(tx + i, ty, 8) * 3) - 1, 0, 15);
        }
      }
    },
    metal(tx, ty, x0, y0) {
      // dark steel grating with rivets, and now and then a glowing vent
      r(x0, y0, 16, 16, F.k);
      for (let i = 0; i < 16; i += 4) { r(x0, y0 + i, 16, 1, F.D); r(x0 + i, y0, 1, 16, F.D); }
      for (let i = 0; i < 16; i += 8) for (let j = 0; j < 16; j += 8) r(x0 + i + 1, y0 + j + 1, 1, 1, F.s);
      if (hash(tx, ty, 13) < 0.12) { r(x0 + 4, y0 + 6, 8, 4, F.K); r(x0 + 5, y0 + 7, 6, 2, F.o); r(x0 + 6, y0 + 7, 4, 1, F.O); }
    },
    stone(tx, ty, x0, y0) {
      // mossy flagstones
      r(x0, y0, 16, 16, F.e);
      for (let by = 0; by < 2; by++) {
        for (let bx = 0; bx < 2; bx++) {
          const wx = x0 + bx * 8, wy = y0 + by * 8;
          r(wx, wy, 8, 1, F.K); r(wx, wy, 1, 8, F.K);
          r(wx + 1, wy + 1, 6, 1, F.f);
          if (hash(tx * 2 + bx, ty * 2 + by, 17) < 0.3) r(wx + 2, wy + 3, 3, 2, F.f);
        }
      }
      if (hash(tx, ty, 19) < 0.12) { r(x0 + 3, y0 + 9, 1, 1, F.W); r(x0 + 4, y0 + 10, 2, 1, F.S); r(x0 + 6, y0 + 9, 1, 1, F.W); }
    },
    planks(tx, ty, x0, y0) {
      // dark saloon boards
      r(x0, y0, 16, 16, F.u);
      for (let row = 0; row < 4; row++) {
        const wy = y0 + row * 4, offset = ((ty * 4 + row) * 7) % 16;
        if (hash(tx, ty * 4 + row, 31) < 0.4) r(x0, wy, 16, 3, F.U);
        r(x0, wy + 3, 16, 1, F.p);
        for (let px = 0; px < 16; px++) {
          if ((x0 + px + offset) % 16 === 0) r(x0 + px, wy, 1, 3, F.p);
          else if (hash(x0 + px, wy, 5) < 0.05) r(x0 + px, wy + 1, 1, 1, F.H);
        }
      }
    },
    felt(tx, ty, x0, y0) {
      // green card-table felt
      r(x0, y0, 16, 16, F.G);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 41);
        if (n < 0.1) r(x0 + px, y0 + py, 1, 1, F.f);
        else if (n < 0.14) r(x0 + px, y0 + py, 1, 1, F.l);
      }
      if ((tx + ty) % 4 === 0) { r(x0 + 7, y0 + 7, 2, 2, F.f); r(x0 + 7, y0 + 7, 1, 1, F.O); }
    },
    grass(tx, ty, x0, y0) {
      r(x0, y0, 16, 16, F.G);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 43);
        if (n < 0.1) r(x0 + px, y0 + py, 1, 2, F.l);
        else if (n < 0.2) r(x0 + px, y0 + py, 1, 1, F.f);
        else if (n < 0.205) r(x0 + px, y0 + py, 1, 1, hash(px, py, tx) < 0.5 ? F.y : F.W);
      }
    },
    dirt(tx, ty, x0, y0) {
      r(x0, y0, 16, 16, F.H);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 47);
        if (n < 0.1) r(x0 + px, y0 + py, 1, 1, F.u);
        else if (n < 0.16) r(x0 + px, y0 + py, 1, 1, F.t);
        else if (n < 0.18) r(x0 + px, y0 + py, 2, 1, F.U);
        else if (n < 0.185) r(x0 + px, y0 + py, 1, 1, F.s);
      }
    },
    sand(tx, ty, x0, y0) {
      r(x0, y0, 16, 16, F.a);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 53);
        if (n < 0.08) r(x0 + px, y0 + py, 1, 1, F.t);
        else if (n < 0.1) r(x0 + px, y0 + py, 1, 1, F.W);
      }
      // wind ripples
      for (let i = 0; i < 2; i++) {
        const ry = 3 + i * 7 + Math.floor(hash(tx, ty, 55 + i) * 3), rx = Math.floor(hash(ty, tx, 57 + i) * 6);
        r(x0 + rx, y0 + ry, 8, 1, F.t);
        r(x0 + rx + 2, y0 + ry + 1, 5, 1, F.q);
      }
    },
    ice(tx, ty, x0, y0) {
      // frozen floor with cracks and glints
      r(x0, y0, 16, 16, F.S);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 61);
        if (n < 0.025) r(x0 + px, y0 + py, 1, 1, F.c);
        else if (n < 0.06) r(x0 + px, y0 + py, 1, 1, F.W);
        else if (n < 0.09) r(x0 + px, y0 + py, 1, 1, F.g);
      }
      r(x0, y0, 16, 1, F.g); r(x0, y0, 1, 16, F.g);
      if (hash(tx, ty, 63) < 0.22) {
        let x = 2 + Math.floor(hash(tx, ty, 64) * 10), y = 1;
        for (let i = 0; i < 12 && y < 15; i++) { r(x0 + x, y0 + y, 1, 1, F.b); y++; x = clamp(x + Math.floor(hash(tx + i, ty, 65) * 3) - 1, 0, 15); }
      }
    },
    slab(tx, ty, x0, y0) {
      // dull prison flagstones with a faded paint line here and there
      r(x0, y0, 16, 16, F.s);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 67);
        if (n < 0.07) r(x0 + px, y0 + py, 1, 1, F.g);
        else if (n < 0.12) r(x0 + px, y0 + py, 1, 1, F.D);
      }
      r(x0, y0, 16, 1, F.D); r(x0, y0, 1, 16, F.D);
      r(x0 + 8, y0 + 8, 8, 1, F.D); r(x0 + 8, y0, 1, 8, F.D);
      if (ty % 7 === 3) { r(x0, y0 + 6, 16, 2, F.q); r(x0, y0 + 8, 16, 1, F.t); }
    },
    ink(tx, ty, x0, y0) {
      // dark purple carpet with a diamond pattern and the odd ink blot
      r(x0, y0, 16, 16, F.p);
      for (let py = 0; py < 16; py++) for (let px = 0; px < 16; px++) {
        const mx = (x0 + px) % 8, my = (y0 + py) % 8;
        if (Math.abs(mx - 3.5) + Math.abs(my - 3.5) === 3) r(x0 + px, y0 + py, 1, 1, F.P);
        else if (hash(x0 + px, y0 + py, 69) < 0.04) r(x0 + px, y0 + py, 1, 1, F.K);
      }
      if (hash(tx, ty, 71) < 0.12) { const bx = 3 + Math.floor(hash(tx, ty, 72) * 8), by = 3 + Math.floor(hash(tx, ty, 73) * 8); r(x0 + bx, y0 + by, 3, 2, F.K); r(x0 + bx + 1, y0 + by + 2, 2, 1, F.K); r(x0 + bx + 3, y0 + by, 1, 1, F.K); }
    },
    circuit(tx, ty, x0, y0) {
      // a dark machine floor with glowing traces
      r(x0, y0, 16, 16, F.k);
      r(x0, y0, 16, 1, F.D); r(x0, y0, 1, 16, F.D);
      const kind = hash(tx, ty, 75);
      if (kind < 0.35) { r(x0, y0 + 8, 16, 1, F.b); r(x0 + 5, y0 + 8, 1, 4, F.b); r(x0 + 5, y0 + 12, 1, 1, F.c); }
      else if (kind < 0.6) { r(x0 + 8, y0, 1, 16, F.b); r(x0 + 8, y0 + 4, 4, 1, F.b); r(x0 + 12, y0 + 4, 1, 1, F.c); }
      else if (kind < 0.7) { r(x0 + 4, y0 + 4, 8, 8, F.K); r(x0 + 5, y0 + 5, 6, 6, F.D); r(x0 + 7, y0 + 7, 2, 2, F.c); }
      for (let i = 0; i < 4; i++) r(x0 + Math.floor(hash(tx, ty, 80 + i) * 16), y0 + Math.floor(hash(ty, tx, 90 + i) * 16), 1, 1, F.D);
    },
    marble(tx, ty, x0, y0) {
      // a glossy checkerboard
      for (let by = 0; by < 2; by++) {
        for (let bx = 0; bx < 2; bx++) {
          const light = ((tx + ty + bx + by) & 1) === 0;
          r(x0 + bx * 8, y0 + by * 8, 8, 8, light ? F.S : F.g);
          r(x0 + bx * 8 + 1, y0 + by * 8 + 1, 3, 1, light ? F.W : F.S);
        }
      }
    },
  };

  // --- walls ---
  function wallTop(tx, ty, x0, y0) {
    // seen from above, a wall takes its colour from the floor next to it: hedges, adobe and so on
    const around = [[0, 1], [1, 0], [-1, 0], [0, -1]].map(([dx, dy]) => (v(tx + dx, ty + dy) ? null : floorUnder(lv, tx + dx, ty + dy))).find(Boolean);
    const top = around === 'grass' || around === 'dirt' ? F.f : around === 'sand' ? F.q : around === 'planks' || around === 'felt' ? F.p : around === 'ice' ? F.g : around === 'ink' ? F.K : F.k;
    r(x0, y0, 16, 16, top);
    for (let i = 0; i < 6; i++) r(x0 + Math.floor(hash(tx, ty, i) * 16), y0 + Math.floor(hash(ty, tx, i) * 16), 1, 1, top === F.f ? F.G : F.K);
    if (!v(tx - 1, ty)) r(x0, y0, 1, 16, F.D);
    if (!v(tx + 1, ty)) r(x0 + 15, y0, 1, 16, F.D);
    if (!v(tx, ty - 1)) r(x0, y0, 16, 1, F.D);
  }

  function wallFront(tx, ty, x0, y0, hasWindow) {
    const room = floorUnder(lv, tx, ty + 1);
    r(x0, y0, 16, 4, F.k);
    if (!v(tx - 1, ty)) r(x0, y0, 1, 4, F.D);
    if (!v(tx + 1, ty)) r(x0 + 15, y0, 1, 4, F.D);
    if (!v(tx, ty - 1)) r(x0, y0, 16, 1, F.D);
    r(x0, y0 + 3, 16, 1, F.K);
    if (room === 'kitchenTile') {
      // white kitchen tiles
      r(x0, y0 + 4, 16, 10, F.S);
      for (let px = 0; px < 16; px++) if ((x0 + px) % 4 === 0) r(x0 + px, y0 + 4, 1, 10, F.g);
      r(x0, y0 + 8, 16, 1, F.g); r(x0, y0 + 12, 16, 1, F.g);
      r(x0, y0 + 14, 16, 2, F.g); r(x0, y0 + 15, 16, 1, F.s);
    } else if (room === 'planks' || room === 'felt' || room === 'ink') {
      // dark wood panelling with a gold rail
      r(x0, y0 + 4, 16, 12, F.U);
      for (let px = 0; px < 16; px++) if ((x0 + px) % 4 === 0) r(x0 + px, y0 + 4, 1, 12, F.p);
      r(x0, y0 + 9, 16, 1, F.O); r(x0, y0 + 10, 16, 1, F.p);
      r(x0, y0 + 14, 16, 1, F.u); r(x0, y0 + 15, 16, 1, F.p);
      for (let px = 1; px < 16; px += 4) r(x0 + px, y0 + 5, 1, 3, F.u);
    } else if (room === 'grass' || room === 'dirt') {
      // a thick hedge
      r(x0, y0 + 4, 16, 12, F.f);
      for (let py = 4; py < 16; py++) for (let px = 0; px < 16; px++) {
        const n = hash(x0 + px, y0 + py, 61);
        if (n < 0.3) r(x0 + px, y0 + py, 1, 1, F.G);
        else if (n < 0.42) r(x0 + px, y0 + py, 1, 1, F.l);
        else if (n < 0.5) r(x0 + px, y0 + py, 1, 1, F.e);
      }
      r(x0, y0 + 14, 16, 2, F.e);
    } else if (room === 'sand') {
      // adobe bricks
      r(x0, y0 + 4, 16, 12, F.q);
      for (let row = 0; row < 3; row++) {
        const yy = y0 + 4 + row * 4;
        r(x0, yy + 3, 16, 1, F.x);
        for (let px = 0; px < 16; px++) if ((x0 + px + row * 5) % 10 === 0) r(x0 + px, yy, 1, 3, F.x);
        r(x0, yy, 16, 1, F.t);
      }
    } else if (room === 'ice') {
      // frosted blue bricks
      r(x0, y0 + 4, 16, 12, F.b);
      for (let row = 0; row < 3; row++) {
        const yy = y0 + 4 + row * 4;
        r(x0, yy + 3, 16, 1, F.S);
        for (let px = 0; px < 16; px++) if ((x0 + px + row * 4) % 8 === 0) r(x0 + px, yy, 1, 3, F.S);
        r(x0, yy, 16, 1, F.c);
      }
      r(x0, y0 + 4, 16, 1, F.W);
    } else if (room === 'circuit') {
      // dark panels with a glowing seam
      r(x0, y0 + 4, 16, 12, F.D);
      for (let px = 0; px < 16; px++) if ((x0 + px) % 8 === 0) r(x0 + px, y0 + 4, 1, 12, F.k);
      r(x0, y0 + 9, 16, 1, F.b); r(x0, y0 + 10, 16, 1, F.c);
      r(x0, y0 + 15, 16, 1, F.K);
    } else if (room === 'concrete' || room === 'metal' || room === 'stone' || room === 'slab') {
      // brick blocks
      r(x0, y0 + 4, 16, 12, F.s);
      for (let row = 0; row < 3; row++) {
        const yy = y0 + 4 + row * 4;
        r(x0, yy + 3, 16, 1, F.D);
        for (let px = 0; px < 16; px++) if ((x0 + px + row * 4) % 8 === 0) r(x0 + px, yy, 1, 3, F.D);
      }
    } else {
      // striped wallpaper with a skirting board
      r(x0, y0 + 4, 16, 10, F.P);
      for (let px = 0; px < 16; px++) {
        if ((x0 + px) % 4 === 0) r(x0 + px, y0 + 4, 1, 10, F.p);
        if ((x0 + px) % 4 === 2) for (let py = 5; py < 14; py += 3) r(x0 + px, y0 + py, 1, 1, F.i);
      }
      r(x0, y0 + 14, 16, 1, F.a); r(x0, y0 + 15, 16, 1, F.t);
    }
    if (hasWindow) {
      // the window shows only soil: the building has sunk
      r(x0 + 2, y0 + 5, 12, 8, F.S);
      r(x0 + 3, y0 + 6, 10, 6, F.p);
      for (let i = 0; i < 7; i++) {
        r(x0 + 3 + Math.floor(hash(tx, ty, i) * 10), y0 + 6 + Math.floor(hash(tx, ty, i + 20) * 6), 1, 1, hash(tx, i, 4) < 0.5 ? F.U : F.s);
      }
      r(x0 + 7, y0 + 6, 2, 6, F.S);
      r(x0 + 2, y0 + 12, 12, 1, F.W);
    }
    if (!v(tx - 1, ty)) r(x0, y0 + 3, 1, 13, F.K);
    if (!v(tx + 1, ty)) r(x0 + 15, y0 + 3, 1, 13, F.K);
  }

  // --- furniture ---
  function counter(tx, ty, x0, y0) {
    const isCounter = x => 'KOV'.includes(tileChar(x, ty));
    r(x0, y0, 16, 7, F.S); r(x0, y0, 16, 1, F.W); r(x0, y0 + 6, 16, 1, F.g);
    r(x0, y0 + 7, 16, 8, F.u); r(x0, y0 + 15, 16, 1, F.K);
    r(x0 + 8, y0 + 8, 1, 7, F.U);
    r(x0 + 6, y0 + 9, 1, 2, F.a); r(x0 + 10, y0 + 9, 1, 2, F.a);
    if (!isCounter(tx - 1)) r(x0, y0, 1, 16, F.K);
    if (!isCounter(tx + 1)) r(x0 + 15, y0, 1, 16, F.K);
  }

  const FURNITURE = {
    bookshelf(tx, ty, x0, y0) {
      r(x0 + 1, y0, 14, 16, F.U);
      r(x0 + 2, y0 + 1, 12, 14, F.p);
      r(x0 + 2, y0 + 5, 12, 1, F.U); r(x0 + 2, y0 + 10, 12, 1, F.U);
      const bookColors = [F.r, F.b, F.l, F.O, F.P, F.c, F.m, F.a, F.n, F.G];
      for (let shelf = 0; shelf < 3; shelf++) {
        const bottom = y0 + 4 + shelf * 5;
        for (let x = x0 + 2, i = 0; x < x0 + 14; i++) {
          const n = hash(tx * 7 + i, ty * 13 + shelf, 21), width = n < 0.7 ? 1 : 2;
          if (x + width > x0 + 14) break;
          if (n < 0.92) {
            const stackHeight = 2 + Math.floor(hash(tx, i, shelf) * 3);
            r(x, bottom - stackHeight + 1, width, stackHeight, bookColors[Math.floor(hash(i, tx, ty + shelf) * bookColors.length)]);
          }
          x += width;
        }
      }
      r(x0 + 1, y0, 14, 1, F.u);
      r(x0 + 1, y0 + 15, 14, 1, F.K);
    },
    plant(tx, ty, x0, y0) {
      const leaves = new Uint8Array(16 * 12);
      for (let py = 0; py < 12; py++) {
        for (let px = 0; px < 16; px++) {
          leaves[py * 16 + px] = Math.hypot(px - 7.5, (py - 6) * 1.15) < 5.2 + hash(px, py, tx * 31 + ty) * 1.6 ? 1 : 0;
        }
      }
      const er = (px, py) => px >= 0 && px < 16 && py >= 0 && py < 12 && leaves[py * 16 + px] === 1;
      for (let py = 0; py < 12; py++) {
        for (let px = 0; px < 16; px++) {
          if (!er(px, py)) continue;
          const edge = !er(px - 1, py) || !er(px + 1, py) || !er(px, py - 1) || !er(px, py + 1);
          const light = (px - 7.5) + (py - 6) < -3 && hash(px, py, 77 + tx) > 0.35;
          r(x0 + px, y0 + py, 1, 1, edge ? F.f : light ? F.l : hash(px, py, ty) < 0.2 ? F.f : F.G);
        }
      }
      r(x0 + 4, y0 + 10, 8, 2, F.q); r(x0 + 4, y0 + 10, 8, 1, F.t);
      r(x0 + 5, y0 + 12, 6, 3, F.x); r(x0 + 9, y0 + 12, 2, 3, F.U);
      r(x0 + 5, y0 + 15, 6, 1, F.p);
    },
    table(tx, ty, x0, y0) {
      const er = (x, y) => tileChar(x, y) === 'T';
      const left = !er(tx - 1, ty), right = !er(tx + 1, ty), top = !er(tx, ty - 1), bottom = !er(tx, ty + 1);
      const xa = x0 + (left ? 1 : 0), xb = x0 + (right ? 15 : 16), ya = y0 + (top ? 2 : 0), yb = y0 + (bottom ? 12 : 16);
      r(xa, ya, xb - xa, yb - ya, F.t);
      for (let y = ya + 2; y < yb - 1; y += 3) if (hash(tx, y, 4) < 0.6) r(xa + 1 + Math.floor(hash(y, tx, 2) * 8), y, 4, 1, F.H);
      if (top) r(xa, ya, xb - xa, 1, F.a);
      if (left) r(xa, ya, 1, yb - ya, F.H);
      if (right) r(xb - 1, ya, 1, yb - ya, F.H);
      if (bottom) {
        r(xa, y0 + 12, xb - xa, 2, F.u); r(xa, y0 + 14, xb - xa, 1, F.U);
        if (left) r(x0 + 2, y0 + 14, 2, 2, F.U);
        if (right) r(x0 + 12, y0 + 14, 2, 2, F.U);
      }
      const clutter = hash(tx, ty, 9);
      if (clutter < 0.35) { r(x0 + 6, y0 + 5, 4, 4, F.K); r(x0 + 6, y0 + 5, 3, 3, F.W); r(x0 + 7, y0 + 6, 1, 1, F.U); }
      else if (clutter < 0.6) { r(x0 + 4, y0 + 5, 7, 5, F.S); r(x0 + 5, y0 + 6, 5, 3, F.W); }
    },
    sofa(tx, ty, x0, y0) {
      const er = x => tileChar(x, ty) === 'S';
      const left = !er(tx - 1), right = !er(tx + 1);
      const xa = x0 + (left ? 1 : 0), xb = x0 + (right ? 15 : 16), w = xb - xa;
      r(xa, y0 + 1, w, 1, F.K);
      r(xa, y0 + 2, w, 13, F.n);
      r(xa, y0 + 2, w, 1, F.b);
      r(xa, y0 + 7, w, 6, F.b);
      r(xa, y0 + 7, w, 1, F.c);
      if (!left) r(x0, y0 + 7, 1, 6, F.n);
      if (left) { r(x0 + 1, y0 + 4, 3, 11, F.n); r(x0 + 1, y0 + 4, 3, 1, F.b); r(x0, y0 + 2, 1, 14, F.K); }
      if (right) { r(x0 + 12, y0 + 4, 3, 11, F.n); r(x0 + 12, y0 + 4, 3, 1, F.b); r(x0 + 15, y0 + 2, 1, 14, F.K); }
      r(xa, y0 + 15, w, 1, F.K);
    },
    bed(tx, ty, x0, y0) {
      const er = (x, y) => tileChar(x, y) === 'b';
      const left = !er(tx - 1, ty), right = !er(tx + 1, ty), top = !er(tx, ty - 1), bottom = !er(tx, ty + 1);
      const xa = x0 + (left ? 1 : 0), xb = x0 + (right ? 15 : 16), w = xb - xa;
      const ia = xa + (left ? 1 : 0), ib = xb - (right ? 1 : 0), iw = ib - ia;
      r(xa, y0, w, 16, F.U);
      for (let y = y0; y < y0 + 16; y++) for (let x = ia; x < ib; x++) r(x, y, 1, 1, ((x >> 2) + (y >> 2)) & 1 ? F.i : F.m);
      if (top) {
        r(xa, y0, w, 3, F.U); r(xa, y0, w, 1, F.u);
        r(ia, y0 + 3, iw, 9, F.W);
        r(ia + 1, y0 + 4, iw - 2, 5, F.S); r(ia + 1, y0 + 4, iw - 2, 4, F.W);
        r(ia, y0 + 11, iw, 1, F.S);
      }
      if (bottom) { r(xa, y0 + 13, w, 2, F.U); r(xa, y0 + 13, w, 1, F.u); r(xa, y0 + 15, w, 1, F.K); }
    },
    counter,
    stove(tx, ty, x0, y0) {
      counter(tx, ty, x0, y0);
      r(x0 + 1, y0 + 1, 14, 5, F.k);
      for (const bx of [2, 10]) { r(x0 + bx, y0 + 2, 4, 3, F.D); r(x0 + bx + 1, y0 + 3, 2, 1, F.K); }
      r(x0 + 1, y0 + 7, 14, 8, F.S);
      r(x0 + 3, y0 + 8, 10, 1, F.g);
      r(x0 + 3, y0 + 10, 10, 4, F.k);
      r(x0 + 4, y0 + 11, 3, 1, F.D);
    },
    sink(tx, ty, x0, y0) {
      counter(tx, ty, x0, y0);
      r(x0 + 2, y0 + 1, 12, 5, F.g);
      r(x0 + 3, y0 + 2, 10, 3, F.s);
      r(x0 + 3, y0 + 2, 10, 1, F.D);
      r(x0 + 7, y0, 2, 3, F.W);
    },
    fridge(tx, ty, x0, y0) {
      r(x0 + 1, y0, 14, 16, F.g);
      r(x0 + 2, y0, 12, 15, F.W);
      r(x0 + 2, y0 + 5, 12, 1, F.S);
      r(x0 + 11, y0 + 2, 1, 2, F.D); r(x0 + 11, y0 + 7, 1, 5, F.D);
      r(x0 + 4, y0 + 8, 2, 2, F.r); r(x0 + 6, y0 + 9, 3, 2, F.y);
      r(x0 + 2, y0 + 14, 12, 1, F.S);
      r(x0 + 1, y0 + 15, 14, 1, F.K);
    },
    barrel(tx, ty, x0, y0) {
      r(x0 + 3, y0 + 1, 10, 14, F.K);
      r(x0 + 4, y0 + 2, 8, 12, F.u);
      r(x0 + 4, y0 + 1, 8, 2, F.t);
      r(x0 + 4, y0 + 5, 8, 1, F.D); r(x0 + 4, y0 + 10, 8, 1, F.D);
      for (let px = 6; px < 12; px += 3) r(x0 + px, y0 + 3, 1, 11, F.U);
      r(x0 + 5, y0 + 3, 1, 10, F.q);
      r(x0 + 3, y0 + 15, 10, 1, F.K);
    },
    tree(tx, ty, x0, y0) {
      r(x0 + 6, y0 + 9, 4, 7, F.K);
      r(x0 + 7, y0 + 9, 2, 6, F.U);
      fillEllipse(g, x0 + 8, y0 + 6, 7, 6, F.K);
      fillEllipse(g, x0 + 8, y0 + 6, 6, 5, F.f);
      fillEllipse(g, x0 + 8, y0 + 5, 5, 4, F.G);
      fillEllipse(g, x0 + 6, y0 + 3, 3, 2, F.l);
      for (let i = 0; i < 5; i++) r(x0 + 3 + Math.floor(hash(tx, ty, 70 + i) * 10), y0 + 2 + Math.floor(hash(ty, tx, 80 + i) * 8), 1, 1, F.f);
    },
    cactus(tx, ty, x0, y0) {
      r(x0 + 5, y0 + 2, 6, 14, F.K);
      r(x0 + 6, y0 + 3, 4, 12, F.G);
      r(x0 + 7, y0 + 3, 1, 12, F.l);
      r(x0 + 2, y0 + 5, 4, 5, F.K); r(x0 + 3, y0 + 6, 2, 3, F.G); r(x0 + 3, y0 + 3, 3, 4, F.K); r(x0 + 3, y0 + 3, 2, 4, F.G);
      r(x0 + 10, y0 + 7, 4, 5, F.K); r(x0 + 11, y0 + 8, 2, 3, F.G); r(x0 + 11, y0 + 5, 3, 5, F.K); r(x0 + 12, y0 + 5, 2, 5, F.G);
      for (const [px, py] of [[6, 5], [9, 8], [7, 11], [3, 5], [12, 6]]) r(x0 + px, y0 + py, 1, 1, F.W);
      r(x0 + 5, y0 + 15, 6, 1, F.K);
    },
    rock(tx, ty, x0, y0) {
      fillEllipse(g, x0 + 8, y0 + 10, 7, 5, F.K);
      fillEllipse(g, x0 + 8, y0 + 10, 6, 4, F.s);
      fillEllipse(g, x0 + 7, y0 + 9, 4, 2, F.g);
      r(x0 + 9, y0 + 12, 4, 1, F.D);
      r(x0 + 3, y0 + 12, 8, 1, F.D);
    },
    pokertable(tx, ty, x0, y0) {
      const er = (x, y) => tileChar(x, y) === 'W';
      const left = !er(tx - 1, ty), right = !er(tx + 1, ty), top = !er(tx, ty - 1), bottom = !er(tx, ty + 1);
      const xa = x0 + (left ? 1 : 0), xb = x0 + (right ? 15 : 16), ya = y0 + (top ? 1 : 0), yb = y0 + (bottom ? 12 : 16);
      r(xa, ya, xb - xa, yb - ya, F.U);
      r(xa + (left ? 1 : 0), ya + (top ? 1 : 0), xb - xa - (left ? 1 : 0) - (right ? 1 : 0), yb - ya - (top ? 1 : 0) - (bottom ? 1 : 0), F.G);
      if (bottom) { r(xa, y0 + 12, xb - xa, 3, F.p); r(xa, y0 + 15, xb - xa, 1, F.K); if (left) r(x0 + 2, y0 + 14, 2, 2, F.p); if (right) r(x0 + 12, y0 + 14, 2, 2, F.p); }
      const clutter = hash(tx, ty, 91);
      if (clutter < 0.3) { r(x0 + 4, y0 + 5, 3, 3, F.r); r(x0 + 4, y0 + 5, 3, 1, F.m); r(x0 + 9, y0 + 6, 3, 3, F.W); }
      else if (clutter < 0.55) { r(x0 + 6, y0 + 4, 4, 5, F.W); r(x0 + 7, y0 + 5, 2, 3, F.r); }
      else if (clutter < 0.7) { r(x0 + 3, y0 + 6, 2, 2, F.b); r(x0 + 5, y0 + 5, 2, 2, F.O); r(x0 + 11, y0 + 7, 2, 2, F.r); }
    },
    drift(tx, ty, x0, y0) {
      fillEllipse(g, x0 + 8, y0 + 10, 7, 5, F.K);
      fillEllipse(g, x0 + 8, y0 + 10, 6, 4, F.W);
      fillEllipse(g, x0 + 7, y0 + 9, 4, 2, F.S);
      r(x0 + 4, y0 + 12, 8, 1, F.g);
      r(x0 + 9, y0 + 8, 2, 1, F.c);
    },
    bars(tx, ty, x0, y0) {
      r(x0, y0 + 1, 16, 2, F.K); r(x0, y0 + 13, 16, 2, F.K);
      r(x0, y0 + 1, 16, 1, F.s); r(x0, y0 + 13, 16, 1, F.s);
      for (const px of [1, 5, 9, 13]) { r(x0 + px, y0 + 2, 2, 12, F.K); r(x0 + px, y0 + 2, 1, 12, F.g); }
    },
    pylon(tx, ty, x0, y0) {
      r(x0 + 3, y0 + 1, 10, 14, F.K);
      r(x0 + 4, y0 + 2, 8, 12, F.D);
      r(x0 + 4, y0 + 2, 2, 12, F.k);
      r(x0 + 7, y0 + 3, 2, 9, F.b);
      r(x0 + 7, y0 + 5, 2, 2, F.c); r(x0 + 7, y0 + 9, 2, 2, F.W);
      r(x0 + 2, y0 + 14, 12, 1, F.K);
    },
    crate(tx, ty, x0, y0) {
      r(x0 + 1, y0 + 1, 14, 14, F.U);
      r(x0 + 2, y0 + 2, 12, 12, F.t);
      for (let i = 0; i < 12; i++) { r(x0 + 2 + i, y0 + 2 + i, 1, 1, F.u); r(x0 + 13 - i, y0 + 2 + i, 1, 1, F.u); }
      r(x0 + 2, y0 + 2, 12, 1, F.a);
      r(x0 + 1, y0 + 15, 14, 1, F.K);
    },
  };

  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.b; tx++) {
      if (!v(tx, ty)) FLOORS[floorUnder(lv, tx, ty)](tx, ty, tx * TILE, ty * TILE);
    }
  }
  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.b; tx++) {
      const t = tileTypeAt(lv, tx, ty), x0 = tx * TILE, y0 = ty * TILE;
      if (t.wall) {
        if (v(tx, ty + 1)) wallTop(tx, ty, x0, y0);
        else wallFront(tx, ty, x0, y0, t.hasWindow);
      } else if (t.furniture) {
        FURNITURE[t.furniture](tx, ty, x0, y0);
      }
    }
  }
  // shadow on the floor below walls and furniture
  for (let ty = 1; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.b; tx++) {
      const t = tileTypeAt(lv, tx, ty), over = tileTypeAt(lv, tx, ty - 1);
      if (t.wall || t.furniture || !(over.wall || over.furniture)) continue;
      const x0 = tx * TILE, y0 = ty * TILE;
      r(x0, y0, 16, 1, 'rgba(24,20,37,0.45)');
      r(x0, y0 + 1, 16, 1, 'rgba(24,20,37,0.28)');
      r(x0, y0 + 2, 16, 1, 'rgba(24,20,37,0.12)');
    }
  }
  return c;
}
