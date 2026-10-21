"use strict";

// ---------- Level ----------

function tileTypeAt(lv, x, y) {
  if (x < 0 || y < 0 || x >= lv.b || y >= lv.h) return TILE_TYPES['#'];
  return TILE_TYPES[lv.chars[y][x]] || TILE_TYPES['#'];
}
const isWall = (lv, x, y) => !!tileTypeAt(lv, x, y).wall;
const isSolid = (lv, x, y) => x < 0 || y < 0 || x >= lv.b || y >= lv.h || lv.solid[y * lv.b + x] === 1;

// Does a bullet stop at this tile? Tiles that hold a target or a breakable are solid for walking, but bullets fly into
// them and are caught by the object's own hit box, so they can be hit from every side.
const blocksBullets = (lv, x, y) => {
  if (!isSolid(lv, x, y)) return false;
  const t = tileTypeAt(lv, x, y);
  return !(t.target || t.breakable);
};

// Which floor lies under a tile? Furniture and special tiles inherit the floor around them.
function floorUnder(lv, x, y) {
  const t = tileTypeAt(lv, x, y);
  if (t.floor) return t.floor;
  for (let r = 1; r <= 3; r++) {
    for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]]) {
      const n = tileTypeAt(lv, x + dx, y + dy);
      if (n.floor) return n.floor;
    }
  }
  return 'parquet';
}

// tier is the floor number counting from 0: every floor is harder than the last (see DIFFICULTY)
function buildLevel(map, tier = 0) {
  const lv = {
    name: map.name, boss: map.boss, objectives: map.objectives || [], briefing: map.briefing, dark: map.dark, breakables: [], pickups: [], b: map.rows[0].length, h: map.rows.length, gate: null, bossSpawn: null, stairs: null,
    chars: map.rows.map(row => [...row]), targets: [], enemies: [], items: [],
  };
  lv.solid = new Uint8Array(lv.b * lv.h);
  lv.start = { x: lv.b * TILE / 2, y: lv.h * TILE / 2 };
  for (let y = 0; y < lv.h; y++) {
    for (let x = 0; x < lv.b; x++) {
      const t = tileTypeAt(lv, x, y);
      if (t.wall || t.furniture || t.target || t.gate || t.breakable) lv.solid[y * lv.b + x] = 1;
      if (t.breakable) {
        const def = BREAKABLES[t.breakable];
        lv.breakables.push({ kind: t.breakable, x: x * TILE + 8, y: y * TILE + 8, life: def.life, maxLife: def.life, flash: 0, wobble: 0, timer: 2 + hash(x, y, 2) * 3 });
      }
      if (t.pickup) lv.pickups.push({ kind: t.pickup, x: x * TILE + 8, y: y * TILE + 8, time: hash(x, y, 6) * 6 });
      if (t.gate) (lv.gate || (lv.gate = { tiles: [] })).tiles.push({ x, y });
      if (t.bossSpawn) lv.bossSpawn = { x: x * TILE + 8, y: y * TILE + 10 };
      if (t.stairs) lv.stairs = { x: x * TILE + 8, y: y * TILE + 8 };
      if (t.start) lv.start = { x: x * TILE + 8, y: y * TILE + 8 };
      if (t.target) lv.targets.push({ x: x * TILE + 8, y: y * TILE + 8, b: 14, h: 16, hitFlash: 0, wobble: 0, direction: 1, hit: false, style: map.targetStyle || 'dummy' });
      if (t.enemy) lv.enemies.push(createEnemy(t.enemy, x * TILE + 8, y * TILE + 10, tier));
      if (t.item) lv.items.push(createItem(randomWeapon(), x * TILE + 8, y * TILE + 10));
      if (t.gear) lv.items.push(createItem(randomGear(), x * TILE + 8, y * TILE + 10));
    }
  }
  // a dungeon that has been beaten before has more enemies
  const share = dungeonCycle() * CYCLE.enemyShare;
  for (const f of lv.enemies.slice()) {
    for (let n = Math.floor(share) + (Math.random() < share % 1 ? 1 : 0); n > 0; n--) lv.enemies.push(createEnemy(f.type, f.x, f.y, tier));
  }
  pickElites(lv.enemies, tier);
  scatterEnemies(lv);
  lv.canvas = map.canvas || (map.canvas = drawLevel(lv));   // the map image never changes, so it is only made once
  return lv;
}

// Gives the enemies new places to start (see SPAWN). Only the part of the floor that the player can walk to from the start is used,
// so nobody ends up behind the boss gate or inside a wall. An enemy that cannot find a place stays where the map put it.
function scatterEnemies(lv) {
  const sx = Math.floor(lv.start.x / TILE), sy = Math.floor(lv.start.y / TILE);
  const reach = new Uint8Array(lv.b * lv.h), open = [[sx, sy]];
  reach[sy * lv.b + sx] = 1;
  while (open.length) {
    const [x, y] = open.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (isSolid(lv, nx, ny) || reach[ny * lv.b + nx]) continue;
      reach[ny * lv.b + nx] = 1;
      open.push([nx, ny]);
    }
  }
  // a tile with room around it, so that even an ogre does not start stuck in a wall
  const roomy = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isSolid(lv, x + dx, y + dy)) return false;
    return reach[y * lv.b + x] === 1;
  };
  const placed = [];
  for (const f of lv.enemies) {
    const ox = Math.floor(f.x / TILE), oy = Math.floor(f.y / TILE);
    if (!reach[oy * lv.b + ox]) { placed.push({ x: ox, y: oy }); continue; }   // behind a gate or something else special: leave it
    let near = Math.random() < SPAWN.nearChance;
    let spot = null;
    for (let tries = 0; tries < 90 && !spot; tries++) {
      if (tries === 30) near = false;   // nothing suitable close by: look anywhere
      const x = near ? ox + Math.round(randRange(-SPAWN.nearRadius, SPAWN.nearRadius)) : Math.floor(Math.random() * lv.b);
      const y = near ? oy + Math.round(randRange(-SPAWN.nearRadius, SPAWN.nearRadius)) : Math.floor(Math.random() * lv.h);
      if (x < 1 || y < 1 || x >= lv.b - 1 || y >= lv.h - 1 || !roomy(x, y)) continue;
      if (Math.hypot(x - sx, y - sy) < SPAWN.minStartDistance) continue;
      if (placed.some(p => Math.hypot(p.x - x, p.y - y) < SPAWN.minSpacing)) continue;
      spot = { x, y };
    }
    if (spot) { f.x = spot.x * TILE + 8; f.y = spot.y * TILE + 10; placed.push(spot); }
    else placed.push({ x: ox, y: oy });
  }
}

// ---------- Movement and collision ----------

function collides(x, y, b, h) {
  const lv = world.level;
  const x0 = Math.floor((x - b / 2) / TILE), x1 = Math.floor((x + b / 2 - 0.01) / TILE);
  const y0 = Math.floor((y - h / 2) / TILE), y1 = Math.floor((y + h / 2 - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolid(lv, tx, ty)) return true;
  return false;
}

// Moves along one axis. If stuck on a corner, the mover is nudged sideways so it slides into doorways.
function moveAxis(e, d, axis, otherInput, b, h) {
  if (d === 0) return;
  if (dev.on && dev.noclip && e === world.player) { e[axis] += d; return; }   // developer mode: walk through walls
  if (e.ghost) {   // ghosts float through walls, but stay inside the floor
    e[axis] = clamp(e[axis] + d, 12, (axis === 'x' ? world.level.b : world.level.h) * TILE - 12);
    return;
  }
  const fx = axis === 'x' ? d : 0, fy = axis === 'y' ? d : 0;
  if (!collides(e.x + fx, e.y + fy, b, h)) { e[axis] += d; return; }
  const step = Math.sign(d) * 0.25;
  for (let i = 0; i < 16; i++) {
    const sx = axis === 'x' ? step : 0, sy = axis === 'y' ? step : 0;
    if (collides(e.x + sx, e.y + sy, b, h)) break;
    e.x += sx; e.y += sy;
  }
  e[axis === 'x' ? 'vx' : 'vy'] = 0;
  if (otherInput !== 0) return;
  const other = axis === 'x' ? 'y' : 'x';
  for (let attempt = 1; attempt <= 6; attempt++) {
    for (const dir of [1, -1]) {
      const ox = other === 'x' ? attempt * dir : 0, oy = other === 'y' ? attempt * dir : 0;
      if (!collides(e.x + ox + Math.sign(fx), e.y + oy + Math.sign(fy), b, h)) {
        const knockbackMult = dir * Math.min(Math.abs(d), attempt);
        if (!collides(e.x + (other === 'x' ? knockbackMult : 0), e.y + (other === 'y' ? knockbackMult : 0), b, h)) e[other] += knockbackMult;
        return;
      }
    }
  }
}
