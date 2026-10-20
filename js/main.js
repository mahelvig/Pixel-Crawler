"use strict";

// ---------- Game state ----------

let state = 'title';   // title, playing, pause, bag, dead or won
let time = 0;
let world = null;
const camera = { x: 0, y: 0, shake: 0 };

function newWorld(index = 0) {
  const level = buildLevel(MAPS[LEVEL_ORDER[index]], index);
  return {
    levelIndex: index,
    level,
    drops: [], levelUp: null,
    darkNow: level.dark ? level.dark.level : 0, flickerTime: 0,
    enemyBullets: [], hazards: [], blasts: [], gateOpen: false, gateOpenTime: 0, bossDefeated: false, wonTime: 0,
    stairs: level.stairs ? { x: level.stairs.x, y: level.stairs.y, active: false, time: 0 } : null,
    player: createPlayer(level.start.x, level.start.y),
    targets: level.targets,
    bullets: [], particles: [], floatingTexts: [], messages: [],
    hasWalked: false, hasShot: false, walkedDistance: 0, helpAlpha: 1, goalShown: false,
    targetsHit: 0,
    enemies: level.enemies, enemyTotal: level.enemies.length, killed: 0, killedByType: {},
    breakables: level.breakables, pickups: level.pickups, destroyed: {}, collected: {},
    totals: { destroy: countBy(level.breakables, 'kind'), collect: countBy(level.pickups, 'kind'), killType: countBy(level.enemies, 'type') },
    surviveTime: 0, waveTime: 5, objectiveDone: [],
    stains: [], hurtFlash: 0, deathTime: 0, pathMap: null, pathMapTile: -1,
    items: level.items, holding: -1, hasFound: false, fullMessage: -99,
  };
}

function startGame() {
  world = newWorld();
  resetRun();
  state = 'playing';
  sfx('start');
  // the tutorial is only for the first run (floor 1 has been played once already)
  if (saved.tutorialDone) { world.hasWalked = world.hasShot = world.hasFound = world.hasFoundGear = true; world.helpAlpha = 0; }
  systemMessage('Welcome to the dungeon. Try not to die.');
  if (dungeonCycle() > 0) systemMessage('The dungeon has been beaten ' + saved.stats.wins + (saved.stats.wins === 1 ? ' time' : ' times') + '. It is angrier now, and it brought friends.', 5);
}

function systemMessage(text, duration = 4) {
  world.messages.push({ text, time: duration, duration });
}

// ---------- Input ----------

const keys = new Set();
const mouse = { x: SCREEN_W / 2, y: SCREEN_H / 2, down: false, inside: false, moving: false };

// options the player can change in the pause menu, remembered between visits
const OPTIONS = { rightClickMove: false, sfx: true, music: true, aimAssist: true, autoFire: true };
for (const key of Object.keys(OPTIONS)) {
  try {
    const saved = localStorage.getItem('pixelCrawler.' + key);
    if (saved !== null) OPTIONS[key] = saved === '1';
  } catch { /* storage may be blocked */ }
}

function setOption(key, on) {
  OPTIONS[key] = on;
  if (key === 'rightClickMove') mouse.moving = false;
  if (key === 'sfx' || key === 'music') applyVolumes();
  try { localStorage.setItem('pixelCrawler.' + key, on ? '1' : '0'); } catch { /* storage may be blocked */ }
}
const setRightClickMove = on => setOption('rightClickMove', on);

// browsers only allow sound after the player has done something
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, audioInit);

function togglePause() {
  if (state === 'playing') state = 'pause';
  else if (state === 'pause') state = 'playing';
  else return;
  sfx('pause');
}

window.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Backquote') { devCycle(); return; }
  if (e.code === 'KeyE' && state === 'bag') { equipAtMouse(); return; }
  if (devKey(e.code)) return;
  if (e.code === 'Tab' || e.code === 'KeyI') { toggleBag(); return; }
  if (e.code === 'KeyM') { setOption('music', !OPTIONS.music); return; }
  if (e.code === 'KeyA' && state === 'title') { openAchievements(); return; }
  if (e.code === 'KeyS' && state === 'title') { openStats(); return; }
  if (e.code === 'KeyW' && state === 'title') { cycleStartWeapon(); return; }
  if (state === 'stats' && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) { statsTab(e.code === 'ArrowLeft' ? -1 : 1); return; }
  if (state === 'achievements') {
    if (e.code === 'ArrowLeft') { achPage(-1); return; }
    if (e.code === 'ArrowRight') { achPage(1); return; }
    if (e.code === 'ArrowUp') { achMove(-1); return; }
    if (e.code === 'ArrowDown') { achMove(1); return; }
  }
  if (e.code === 'KeyU' && (state === 'title' || state === 'dead' || state === 'won')) { openShop(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'shop') { closeShop(); return; }
    if (state === 'achievements') { closeAchievements(); return; }
    if (state === 'stats') { closeStats(); return; }
    if (state === 'levelup') return;
    if (state === 'bag') toggleBag();
    else togglePause();
    return;
  }
  const digit = /^Digit\d$/.test(e.code) ? Number(e.code.slice(5)) : 0;
  if (state === 'levelup' && digit >= 1 && digit <= 3) { choosePerk(digit - 1); return; }
  if (digit >= 1 && digit <= BAG.hotbarSlots) {
    if (state === 'playing') selectSlot(world.player, digit - 1);
    else if (state === 'bag') moveToHotbar(digit - 1);
  }
  keys.add(e.code);
});

// the mouse wheel cycles through the hotbar slots
let lastWheel = 0;
canvas.addEventListener('wheel', e => {
  if (state !== 'playing') return;
  e.preventDefault();
  if (time - lastWheel < 0.12 || e.deltaY === 0) return;
  lastWheel = time;
  const pl = world.player, n = BAG.hotbarSlots;
  selectSlot(pl, (pl.active + Math.sign(e.deltaY) + n) % n);
}, { passive: false });
window.addEventListener('keyup', e => keys.delete(e.code));

function updateMouse(e) {
  const rect = canvas.getBoundingClientRect();
  // menus are drawn shifted by UI_X, so their hit areas are too
  const shift = state === 'playing' ? 0 : UI_X;
  mouse.x = clamp((e.clientX - rect.left) * SCREEN_W / rect.width - shift, -shift, SCREEN_W - 1 - shift);
  mouse.y = clamp((e.clientY - rect.top) * SCREEN_H / rect.height, 0, SCREEN_H - 1);
  mouse.inside = true;
}
canvas.addEventListener('pointermove', e => { if (e.pointerType === 'touch') { touchMove(e); return; } touch.on = false; updateMouse(e); });
canvas.addEventListener('pointerenter', updateMouse);
canvas.addEventListener('pointerleave', () => { if (!mouse.down) mouse.inside = false; });
canvas.addEventListener('pointerdown', e => {
  touch.on = e.pointerType === 'touch';
  updateMouse(e);
  canvas.focus();
  if (touch.on && touchDown(e)) return;
  if (state === 'levelup') { if (e.button === 0) clickPerk(); return; }
  if (state === 'shop') { if (e.button === 0) clickShop(); return; }
  if (state === 'achievements') { if (e.button === 0) clickAchievements(); return; }
  if (state === 'stats') { if (e.button === 0) clickStats(); return; }
  if (state === 'bag') { clickInBag(e.button); return; }
  if (e.button === 2 && state === 'playing' && OPTIONS.rightClickMove) {
    mouse.moving = true;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* not important */ }
    return;
  }
  if (e.button !== 0) return;
  if (state === 'title') { if (overShopButton(TITLE_SHOP_Y)) openShop(); else if (overAchButton(TITLE_SHOP_Y)) openAchievements(); else if (overStatsButton(TITLE_SHOP_Y)) openStats(); else if (overWeaponButton()) cycleStartWeapon(); else startGame(); return; }
  if (state === 'pause') {
    const option = overPauseOption();
    if (option >= 0) { setOption(pauseOptions()[option].key, !OPTIONS[pauseOptions()[option].key]); sfx('uiClick'); }
    else { state = 'playing'; sfx('pause'); }
    return;
  }
  if (state === 'dead') { if (overShopButton(END_SHOP_Y)) openShop(); else if (time - world.deathTime > 1) startGame(); return; }
  if (state === 'won') { if (overShopButton(END_SHOP_Y)) openShop(); else if (time - world.wonTime > 1) startGame(); return; }
  mouse.down = true;
  try { canvas.setPointerCapture(e.pointerId); } catch { /* not important */ }
});
window.addEventListener('pointerup', e => {
  touchUp(e);
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.moving = false;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
  keys.clear();
  mouse.down = false;
  mouse.moving = false;
  if (state === 'playing') state = 'pause';
});
window.addEventListener('resize', () => { if (touch.on && innerHeight > innerWidth && state === 'playing') state = 'pause'; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state === 'playing') state = 'pause';
  audioSuspend(document.hidden);
  if (document.hidden) saveGame();
});

// ---------- Update ----------

function update(dt) {
  time += dt;
  if (state !== 'playing') touchRelease();
  if (state === 'playing') {
    updatePlayer(dt);
    updateEnemies(dt);
    updateEnemyBullets(dt);
    updateHazards(dt);
    updateBullets(dt);
    updateItems(dt);
    updatePickups(dt);
    updateDrops(dt);
    updateLighting(dt);
    updateBreakables(dt);
    updateObjectives(dt);
    updateStairs(dt);
    updateEffects(dt);
    updateTutorial(dt);
    updateAchievements(dt);
    updateViewers(dt);
    if (world.player.pending > 0 && !world.levelUp) openLevelUp();
  } else if (state === 'dead' || state === 'won') {
    updateBullets(dt);
    updateEffects(dt);
  }
  updateCamera(dt);
}

// ---------- Effects, tutorial and camera ----------

function splash(x, y, color, direction) {
  for (let p = 0; p < 5; p++) {
    const v = direction + Math.PI + randRange(-1.2, 1.2), f = randRange(30, 70);
    particle(x, y, Math.cos(v) * f, Math.sin(v) * f, p < 2 ? color : p < 4 ? COLOR.g : COLOR.S, randRange(0.15, 0.3));
  }
}

function particle(x, y, vx, vy, color, life) {
  world.particles.push({ x, y, vx, vy, color, life });
}

function updateEffects(dt) {
  for (const dummy of world.targets) {
    dummy.hitFlash -= dt;
    dummy.wobble *= Math.exp(-dt * 6);
  }
  for (const f of world.enemies) {
    f.hitFlash -= dt;
    f.exclaim -= dt;
  }
  world.hurtFlash -= dt;
  for (let i = world.blasts.length - 1; i >= 0; i--) {
    world.blasts[i].time += dt;
    if (world.blasts[i].time > 0.3) world.blasts.splice(i, 1);
  }
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.exp(-dt * 6); p.vy *= Math.exp(-dt * 6);
    if (p.life <= 0) world.particles.splice(i, 1);
  }
  for (let i = world.floatingTexts.length - 1; i >= 0; i--) {
    const t = world.floatingTexts[i];
    t.life -= dt;
    t.y -= 22 * dt;
    if (t.life <= 0) world.floatingTexts.splice(i, 1);
  }
  const m = world.messages[0];
  if (m && (m.time -= dt) <= 0) world.messages.shift();
}

// Short tutorial: fades once the player has walked and shot, then sets a goal.
function updateTutorial(dt) {
  if (world.walkedDistance > 24) world.hasWalked = true;
  if (world.hasWalked && world.hasShot) {
    world.helpAlpha = Math.max(0, world.helpAlpha - dt * 0.5);
    if (!world.goalShown) {
      world.goalShown = true;
      systemMessage('The block is crawling with vermin. Five targets wait in the basement.');
    }
  }
}

function updateCamera(dt) {
  const lv = world.level, pl = world.player;
  let mx, my;
  if (state === 'title') {
    mx = lv.b * TILE / 2 + Math.cos(time * 0.12) * lv.b * 4;
    my = lv.h * TILE / 2 + Math.sin(time * 0.17) * lv.h * 4;
  } else {
    let fx = 0, fy = 0;
    if (touch.on) {
      const v = stickVector(touch.aim);
      fx = v.x * v.mag * CAMERA.maxLean; fy = v.y * v.mag * CAMERA.maxLean;
    } else if (mouse.inside) {
      fx = (Math.round(camera.x) + mouse.x - pl.x) * CAMERA.aimLean;
      fy = (Math.round(camera.y) + mouse.y - (pl.y - 4)) * CAMERA.aimLean;
      const l = Math.hypot(fx, fy);
      if (l > CAMERA.maxLean) { fx *= CAMERA.maxLean / l; fy *= CAMERA.maxLean / l; }
    }
    mx = pl.x + fx;
    my = pl.y - 4 + fy;
  }
  const t = 1 - Math.exp(-CAMERA.followSpeed * dt);
  camera.x += (mx - SCREEN_W / 2 - camera.x) * t;
  camera.y += (my - SCREEN_H / 2 - camera.y) * t;
  camera.x = clamp(camera.x, 0, Math.max(0, lv.b * TILE - SCREEN_W));
  camera.y = clamp(camera.y, 0, Math.max(0, lv.h * TILE - SCREEN_H));
  camera.shake *= Math.exp(-dt * 12);
}

// ---------- Game loop ----------

world = newWorld();
let previous = performance.now(), accumulated = 0;
function loop(now) {
  accumulated += Math.min(0.25, Math.max(0, now - previous) / 1000);
  previous = now;
  while (accumulated >= TIMESTEP) {
    update(TIMESTEP);
    accumulated -= TIMESTEP;
  }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
