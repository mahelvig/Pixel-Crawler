"use strict";

// ---------- Darkness and light ----------
// A floor can be dark (map.dark in map.js): then the whole screen is covered in a dark layer that has holes where there
// is light. The player carries a small light, and fuses, shots, explosions, steam and bosses light up their surroundings.
// Every fuse that is found brings back a part of the light; with the last one the floor is fully lit.

const [DARK_CANVAS, DARK_G] = createCanvas(SCREEN_W, SCREEN_H);
const LIGHTS = {};   // light sprites by radius, made when they are first needed

// How much of the darkness a light clears, in rings from the middle outwards.
const LIGHT_RINGS = [1, 0.85, 0.6, 0.35, 0.15];

// A light is a round sprite of stepped transparency: the rings of LIGHT_RINGS, drawn in black so they can cut a hole.
function lightSprite(radius) {
  const r = Math.max(6, Math.round(radius / 2) * 2);
  if (LIGHTS[r]) return LIGHTS[r];
  const [c, g] = createCanvas(2 * r + 1, 2 * r + 1);
  for (let y = 0; y <= 2 * r; y++) {
    let start = 0, ring = -1;
    for (let x = 0; x <= 2 * r + 1; x++) {
      let now = -1;
      if (x <= 2 * r) {
        const d = Math.hypot(x - r, y - r) / r;
        now = d >= 1 ? -1 : Math.min(LIGHT_RINGS.length - 1, Math.floor(d * LIGHT_RINGS.length));
      }
      if (now !== ring) {
        if (ring >= 0) { g.fillStyle = 'rgba(0,0,0,' + LIGHT_RINGS[ring] + ')'; g.fillRect(start, y, x - start, 1); }
        start = x;
        ring = now;
      }
    }
  }
  LIGHTS[r] = c;
  return c;
}

// How dark the floor should be right now: it falls from map.dark.level to 0 as the fuses are found.
function darknessTarget() {
  const d = world.level.dark;
  if (!d) return 0;
  const total = world.totals.collect[d.fix] || 1;
  return d.level * (1 - Math.min(1, (world.collected[d.fix] || 0) / total));
}

function updateLighting(dt) {
  world.darkNow += (darknessTarget() - world.darkNow) * Math.min(1, dt * 4);
  if (world.flickerTime > 0) world.flickerTime -= dt;
}

// Everything that gives light, with its position in the world and its radius.
function lightSources() {
  const pl = world.player, lights = [{ x: pl.x, y: pl.y - 4, r: LIGHT.player + stat('lightRadius') }];
  if (pl.muzzleFlash > 0) lights.push({ x: pl.x, y: pl.y - 4, r: LIGHT.shot * 2.5 });
  for (const p of world.pickups) lights.push({ x: p.x, y: p.y - 4, r: LIGHT.pickup });
  for (const g of world.items) lights.push({ x: g.x, y: g.y - 6, r: LIGHT.item });
  for (const d of world.drops) lights.push({ x: d.x, y: d.y, r: 10 });
  for (const k of world.bullets) lights.push({ x: k.x, y: k.y, r: LIGHT.shot });
  for (const k of world.enemyBullets) lights.push({ x: k.x, y: k.y, r: LIGHT.shot });
  for (const b of world.blasts) lights.push({ x: b.x, y: b.y, r: b.radius * 2.5 * (1 - b.time / 0.3) });
  for (const z of world.hazards) if (z.age >= z.warn) lights.push({ x: z.x, y: z.y, r: z.radius + 10 });
  for (const f of world.enemies) {
    const e = ENEMIES[f.type];
    if (e.boss && f.chasing) lights.push({ x: f.x, y: f.y - 8, r: LIGHT.boss });
    if (e.ghost) lights.push({ x: f.x, y: f.y - 8, r: 14 });          // ghosts glow a little
    if (f.fuse > 0) lights.push({ x: f.x, y: f.y - 4, r: 24 });       // and so does a lit fuse
  }
  if (world.stairs && world.stairs.active) lights.push({ x: world.stairs.x, y: world.stairs.y, r: LIGHT.pickup + 6 });
  return lights;
}

// Draws the dark layer over the world. kx and ky are where the camera is.
function drawDarkness(kx, ky) {
  let alpha = world.darkNow;
  if (alpha < 0.01) return;
  if (world.flickerTime > 0 && Math.sin(time * 60) > 0.2) alpha *= 0.25;   // the lights flicker when a fuse goes in
  const g = DARK_G;
  g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, SCREEN_W, SCREEN_H);
  g.fillStyle = 'rgba(6,4,18,' + alpha + ')';
  g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  g.globalCompositeOperation = 'destination-out';
  for (const l of lightSources()) {
    const sx = Math.round(l.x - kx), sy = Math.round(l.y - ky), r = Math.round(l.r / 2) * 2;
    if (sx + r < 0 || sy + r < 0 || sx - r > SCREEN_W || sy - r > SCREEN_H) continue;
    g.drawImage(lightSprite(l.r), sx - Math.max(6, r), sy - Math.max(6, r));
  }
  g.globalCompositeOperation = 'source-over';
  ctx.drawImage(DARK_CANVAS, 0, 0);
}
