"use strict";

// ---------- Drawing ----------

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  const sk = camera.shake > 0.2 ? camera.shake : 0;
  const kx = Math.round(camera.x + randRange(-sk, sk)), ky = Math.round(camera.y + randRange(-sk, sk));
  ctx.save();
  ctx.translate(-kx, -ky);
  ctx.drawImage(world.level.canvas, 0, 0);
  for (const stain of world.stains) { ctx.fillStyle = stain.color; ctx.fillRect(stain.x, stain.y, 1, 1); }
  drawGate();
  if (world.stairs && world.stairs.active) drawStairs(world.stairs);
  drawHazards();

  const figures = world.targets.map(dummy => ({ y: dummy.y + 7, paint: () => drawTarget(dummy) }));
  for (const f of world.enemies) figures.push({ y: f.y + 1, paint: () => drawEnemy(f) });
  for (const d of world.drops) figures.push({ y: d.y, paint: () => drawDrop(d) });
  for (const g of world.items) figures.push({ y: g.y, paint: () => drawItem(g) });
  for (const b of world.breakables) figures.push({ y: b.y + 7, paint: () => drawBreakable(b) });
  for (const p of world.pickups) figures.push({ y: p.y, paint: () => drawPickup(p) });
  if (state !== 'dead') figures.push({ y: world.player.y + 3, paint: () => drawPlayer(world.player) });
  figures.sort((a, b) => a.y - b.y).forEach(f => f.paint());

  for (const k of world.bullets) {
    const b = BULLET_SPRITES[k.image];
    ctx.drawImage(b, Math.round(k.x) - (b.width >> 1), Math.round(k.y) - (b.height >> 1));
  }
  drawEnemyBullets();
  drawBlasts();
  for (const p of world.particles) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
  for (const t of world.floatingTexts) drawText(t.text, t.x, t.y, t.color || COLOR.W, { align: 'center', alpha: Math.min(1, t.life * 4) });
  ctx.restore();
  drawDarkness(kx, ky);

  if (world.hurtFlash > 0) drawHurtOverlay();
  if (state === 'shop') drawShop();
  else if (state === 'title') drawTitle();
  else {
    drawHud();
    if (state === 'pause') drawPause();
    if (state === 'dead') drawDead();
    if (state === 'won') drawWon();
    if (state === 'bag') drawBag();
    if (state === 'levelup') drawLevelUp();
  }
  drawTouch();
  if (mouse.inside && !touch.on) {
    if (state === 'bag' || state === 'shop' || state === 'levelup') ctx.drawImage(POINTER, Math.floor(mouse.x), Math.floor(mouse.y));
    else drawCrosshair();
  }
}

function shadow(x, y, b) {
  ctx.fillStyle = 'rgba(24,20,37,0.45)';
  ctx.fillRect(x - b / 2, y, b, 2);
  ctx.fillRect(x - b / 2 + 1, y + 2, b - 2, 1);
}

function drawPlayer(pl) {
  if (pl.invulnerable > 0 && Math.floor(pl.invulnerable * 16) % 2 === 0) return;   // flashes after a hit
  const c = Math.cos(pl.aim), s = Math.sin(pl.aim);
  const direction = s < -0.65 ? 'back' : s > 0.65 ? 'front' : 'side';
  const frame = PLAYER_IMAGES[direction][Math.floor(pl.animTime) % 4];
  const x = Math.round(pl.x), y = Math.round(pl.y);
  shadow(x, y + 1, 10);
  if (direction === 'back') drawWeapon(pl);
  ctx.save();
  ctx.translate(x, 0);
  if (c < 0) ctx.scale(-1, 1);
  ctx.drawImage(frame, -8, y - 12);
  ctx.restore();
  if (direction !== 'back') drawWeapon(pl);
  const hat = pl.slots[BAG.equipStart];   // the hat sits on the head
  if (hat) ctx.drawImage(GEAR_ICONS[hat], x - 6, y - 20);
}

function drawWeapon(pl) {
  if (!pl.weapon) return;
  const v = WEAPONS[pl.weapon], wi = WEAPON_IMAGES[v.image], h = hand(pl);
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(pl.aim);
  if (Math.cos(pl.aim) < 0) ctx.scale(1, -1);
  ctx.drawImage(wi.image, -wi.pivot[0] - Math.round(pl.recoil), -wi.pivot[1]);
  ctx.restore();
  if (pl.muzzleFlash > 0) {
    const m = muzzle(pl), mx = Math.round(m.x), my = Math.round(m.y);
    ctx.fillStyle = v.flash;
    ctx.fillRect(mx - 1, my, 3, 1); ctx.fillRect(mx, my - 1, 1, 3);
    ctx.fillStyle = COLOR.W;
    ctx.fillRect(mx, my, 1, 1);
  }
}

function drawTarget(dummy) {
  const x = Math.round(dummy.x + Math.sin(time * 40) * dummy.wobble * 1.5 * dummy.direction), y = Math.round(dummy.y);
  shadow(Math.round(dummy.x), y + 6, 8);
  if (dummy.style === 'gauge') {
    // the needle trembles in the red until the gauge has been hit, then it stays in the green
    const frame = Math.floor(time * 9 + dummy.x) % 2;
    const image = dummy.hit ? (dummy.hitFlash > 0 ? GAUGE_WHITE.fixed : GAUGE_FIXED) : (dummy.hitFlash > 0 ? GAUGE_WHITE.bad[frame] : GAUGE_BAD[frame]);
    ctx.drawImage(image, x - 8, y - 8);
    return;
  }
  ctx.drawImage(dummy.hitFlash > 0 ? TARGET_WHITE : TARGET_IMAGE, x - 8, y - 8);
}

function drawEnemy(f) {
  const t = ENEMIES[f.type], frames = (f.hitFlash > 0 || (f.fuse > 0 && Math.floor(time * 16) % 2 === 0)) ? ENEMY_WHITE[f.type] : ENEMY_IMAGES[f.type];
  const image = frames[Math.floor(f.animTime) % frames.length];
  const x = Math.round(f.x), y = Math.round(f.y), top = y - image.height + 4 - (t.hover || 0);
  const shake = f.windup > 0 || f.dashWindup > 0 ? Math.round(Math.sin(time * 60)) : 0;   // shakes while winding up a strike
  if (t.shadowWidth !== 0) shadow(x, y + 1, t.shadowWidth || 10);
  if (f.teleportTime > 0) ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 40);   // flickers while teleporting
  if (t.ghost) ctx.globalAlpha = 0.6 + 0.15 * Math.sin(time * 4 + f.x);   // ghosts are see-through
  ctx.save();
  ctx.translate(x + shake, 0);
  if (f.direction < 0) ctx.scale(-1, 1);
  ctx.drawImage(image, -Math.floor(image.width / 2), top);
  if (f.slowTime > 0) {
    // frozen: a layer of ice on top
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * 0.45;
    ctx.drawImage(ENEMY_ICE[f.type][Math.floor(f.animTime) % frames.length], -Math.floor(image.width / 2), top);
    ctx.globalAlpha = alpha;
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (!t.boss && f.life < f.maxLife) {
    const bb = 10;
    ctx.fillStyle = COLOR.K;
    ctx.fillRect(x - bb / 2 - 1, top - 4, bb + 2, 3);
    ctx.fillStyle = COLOR.r;
    ctx.fillRect(x - bb / 2, top - 3, Math.ceil(bb * f.life / f.maxLife), 1);
  }
  if (f.exclaim > 0) drawText('!', x, top - 11 - Math.round(Math.max(0, f.exclaim - 0.5) * 10), COLOR.y, { align: 'center' });
}

// the ring that flashes for a moment when something explodes
function drawBlasts() {
  for (const b of world.blasts) {
    const p = b.time / 0.3, radius = b.radius * (0.3 + 0.7 * p);
    ctx.fillStyle = p < 0.5 ? COLOR.y : COLOR.o;
    for (let i = 0; i < 40; i++) {
      const a = Math.PI * 2 * i / 40;
      ctx.fillRect(Math.round(b.x + Math.cos(a) * radius), Math.round(b.y + Math.sin(a) * radius), 1, 1);
    }
  }
}

function drawHurtOverlay() {
  const a = clamp(world.hurtFlash, 0, 0.35);
  ctx.fillStyle = `rgba(228,59,68,${a * 0.3})`;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = `rgba(228,59,68,${a * 1.5})`;
  ctx.fillRect(0, 0, SCREEN_W, 3); ctx.fillRect(0, SCREEN_H - 3, SCREEN_W, 3);
  ctx.fillRect(0, 3, 3, SCREEN_H - 6); ctx.fillRect(SCREEN_W - 3, 3, 3, SCREEN_H - 6);
}

function border(x, y, b, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, b, 1); ctx.fillRect(x, y + h - 1, b, 1);
  ctx.fillRect(x, y, 1, h); ctx.fillRect(x + b - 1, y, 1, h);
}

function drawHud() {
  const pl = world.player, px = 4;
  let py = SCREEN_H - 24, ph = 20;

  // the weapon, bottom left, framed in its rarity colour
  if (pl.weapon) {
    ph = 27; py = SCREEN_H - 31;
    const v = WEAPONS[pl.weapon], rarityInfo = RARITY[v.rarity], image = WEAPON_IMAGES[v.image].image;
    const ammo = 'Ammo ' + ammoText(pl, pl.weapon);
    const tx = px + 8 + image.width * 2;
    const pb = Math.max(textWidth(v.name), textWidth(rarityInfo.name), textWidth(ammo)) + tx - px + 6;
    ctx.fillStyle = 'rgba(24,20,37,0.85)';
    ctx.fillRect(px, py, pb, ph);
    border(px, py, pb, ph, rarityInfo.color);
    ctx.drawImage(image, px + 4, py + Math.round((ph - image.height * 2) / 2), image.width * 2, image.height * 2);
    drawText(v.name, tx, py + 4, COLOR.W);
    drawText(rarityInfo.name, tx, py + 11, rarityInfo.color);
    drawText(ammo, tx, py + 18, hasAmmo(pl, pl.weapon) ? COLOR.y : COLOR.r);
  } else {
    const pb = textWidth('Empty hands') + 12;
    ctx.fillStyle = 'rgba(24,20,37,0.85)';
    ctx.fillRect(px, py, pb, ph);
    border(px, py, pb, ph, COLOR.D);
    drawText('Empty hands', px + 6, py + 4, COLOR.g);
    drawText('Tab: bag', px + 6, py + 11, COLOR.s);
  }
  drawHotbar(pl);

  // the hearts, right above the weapon
  for (let i = 0; i < maxLife(); i++) ctx.drawImage(i < pl.life ? HEART_FULL : HEART_EMPTY, px + i * 8, py - 9);

  // counters at the top right
  const counter = (text, y, finished) => {
    const tb = textWidth(text) + 10;
    ctx.fillStyle = 'rgba(24,20,37,0.85)';
    ctx.fillRect(SCREEN_W - 4 - tb, y, tb, 13);
    border(SCREEN_W - 4 - tb, y, tb, 13, finished ? COLOR.O : COLOR.D);
    drawText(text, SCREEN_W - 9, y + 4, finished ? COLOR.O : COLOR.S, { align: 'right' });
  };
  const objectives = objectiveLines();
  objectives.forEach((o, i) => counter(o.text, 4 + i * 15, o.done));
  if (world.gateOpen) counter('Boss ' + (world.bossDefeated ? 1 : 0) + '/1', 4 + objectives.length * 15, world.bossDefeated);
  drawBossBar();
  drawDevPanel();
  drawProgressHud();
  drawText('Floor ' + (world.levelIndex + 1), SCREEN_W - 5, SCREEN_H - 9, COLOR.s, { align: 'right' });

  // the controls, top left, until they have been tried
  if (world.helpAlpha > 0 && !touch.on) {
    const lines = [
      [OPTIONS.rightClickMove ? 'RMB' : 'WASD', 'move', world.hasWalked], ['Mouse', 'aim', world.hasShot],
      ['Click', 'shoot', world.hasShot], ['Esc', 'pause', false],
    ];
    lines.forEach(([key, label, done], i) => {
      drawText(key, 5, 5 + i * 8, done ? COLOR.l : COLOR.O, { alpha: world.helpAlpha });
      drawText(label, 30, 5 + i * 8, done ? COLOR.l : COLOR.S, { alpha: world.helpAlpha });
    });
  }

  // system message at the top centre
  const m = world.messages[0];
  if (m) {
    const slideIn = Math.min(1, (m.duration - m.time) * 6, m.time * 3);
    const mb = textWidth(m.text) + 12, mx = Math.round(SCREEN_W / 2 - mb / 2), my = Math.round(-14 + slideIn * 36);
    ctx.fillStyle = 'rgba(24,20,37,0.9)';
    ctx.fillRect(mx, my, mb, 13);
    ctx.fillStyle = COLOR.O;
    ctx.fillRect(mx, my, 2, 13);
    border(mx, my, mb, 13, COLOR.D);
    drawText(m.text, mx + 7, my + 4, COLOR.y);
  }
}

function dim(alpha) {
  ctx.fillStyle = `rgba(24,20,37,${alpha})`;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
}

function drawTitle() {
  dim(0.7);
  drawText('Pixel Crawler', SCREEN_W / 2, 34, COLOR.O, { scale: 3, align: 'center', shadow: COLOR.x });
  drawText('The apartment block has sunk into a dungeon.', SCREEN_W / 2, 64, COLOR.S, { align: 'center' });
  drawText('Get as deep as you can.', SCREEN_W / 2, 72, COLOR.S, { align: 'center' });
  if (Math.floor(time * 2.5) % 2 === 0) drawText('Click to start', SCREEN_W / 2, 100, COLOR.W, { scale: 2, align: 'center' });
  drawText((OPTIONS.rightClickMove ? 'Right-click' : 'WASD') + ' move    Mouse aim    Click shoot    Esc pause', SCREEN_W / 2, 146, COLOR.g, { align: 'center' });
  drawText('1-4 or wheel switch weapon    Tab bag', SCREEN_W / 2, 154, COLOR.g, { align: 'center' });
  drawText('Milestone 10', SCREEN_W - 5, SCREEN_H - 9, COLOR.s, { align: 'right' });
  drawShopButton(TITLE_SHOP_Y);
  drawText('Best floor ' + saved.bestFloor + '   ' + saved.gold + ' gold', SCREEN_W / 2, 136, COLOR.g, { align: 'center' });
}

function drawDead() {
  const elapsed = time - world.deathTime;
  dim(Math.min(0.7, elapsed * 1.2));
  drawText('You died', SCREEN_W / 2, 52, COLOR.r, { scale: 3, align: 'center', shadow: COLOR.p });
  drawText(`Killed ${world.killed} of ${world.enemyTotal} enemies.`, SCREEN_W / 2, 84, COLOR.S, { align: 'center' });
  drawText('The viewers have seen better.', SCREEN_W / 2, 92, COLOR.g, { align: 'center' });
  if (elapsed > 1 && Math.floor(time * 2.5) % 2 === 0) drawText('Click to try again', SCREEN_W / 2, 118, COLOR.W, { scale: 2, align: 'center' });
  drawText('Level ' + world.player.level + '   Gold earned: ' + world.player.runGold, SCREEN_W / 2, 102, COLOR.y, { align: 'center' });
  drawShopButton(END_SHOP_Y);
}

function drawWon() {
  const since = time - world.wonTime;
  dim(Math.min(0.8, since * 1.2));
  drawText('To be continued', SCREEN_W / 2, 52, COLOR.O, { scale: 3, align: 'center', shadow: COLOR.x });
  drawText('You cleared ' + LEVEL_ORDER.length + ' floors.', SCREEN_W / 2, 84, COLOR.S, { align: 'center' });
  drawText('The viewers want more.', SCREEN_W / 2, 92, COLOR.g, { align: 'center' });
  if (since > 1 && Math.floor(time * 2.5) % 2 === 0) drawText('Click to play again', SCREEN_W / 2, 118, COLOR.W, { scale: 2, align: 'center' });
  drawText('Level ' + world.player.level + '   Gold earned: ' + world.player.runGold, SCREEN_W / 2, 102, COLOR.y, { align: 'center' });
  drawShopButton(END_SHOP_Y);
}

function drawPause() {
  dim(0.65);
  drawText('Pause', SCREEN_W / 2, 44, COLOR.W, { scale: 3, align: 'center' });
  drawText(touch.on ? 'Tap outside the options to resume' : 'Esc or click to resume', SCREEN_W / 2, 72, COLOR.S, { align: 'center' });

  // the options: each is a box that can be ticked
  PAUSE_OPTIONS.forEach((option, i) => {
    const r = pauseOptionRect(i), on = OPTIONS[option.key], hover = overPauseOption() === i;
    ctx.fillStyle = 'rgba(24,20,37,0.85)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    border(r.x, r.y, r.w, r.h, hover ? COLOR.W : COLOR.D);
    border(r.x + 5, r.y + 4, 9, 9, on ? COLOR.l : COLOR.g);
    if (on) { ctx.fillStyle = COLOR.l; ctx.fillRect(r.x + 7, r.y + 6, 5, 5); }
    drawText(option.label, r.x + 19, r.y + 6, hover ? COLOR.W : COLOR.S);
  });
  const hovered = overPauseOption();
  if (hovered >= 0) {
    const option = PAUSE_OPTIONS[hovered];
    drawText(OPTIONS[option.key] ? option.on : option.off, SCREEN_W / 2, SCREEN_H - 12, COLOR.g, { align: 'center' });
  }
}

// The options in the pause menu. on and off explain what the option does in each state.
const PAUSE_OPTIONS = [
  { key: 'rightClickMove', label: 'Move with right-click', on: 'Hold the right button to walk towards the cursor. WASD is off.', off: 'Turns off WASD and walks towards the cursor instead.' },
  { key: 'sfx', label: 'Sound effects', on: 'Sound effects are on.', off: 'Sound effects are off.' },
  { key: 'aimAssist', label: 'Aim assist (touch)', on: 'On touch screens the aim stick nudges your shots towards nearby enemies.', off: 'Aim assist is off: you aim exactly where the stick points.' },
  { key: 'music', label: 'Music (M)', on: 'Music is on. Press M to switch it on or off at any time.', off: 'Music is off. Press M to switch it on or off at any time.' },
];

// the clickable area of an option in the pause menu
function pauseOptionRect(i) {
  const w = Math.max(...PAUSE_OPTIONS.map(o => textWidth(o.label))) + 28, h = 16;
  return { x: Math.round(SCREEN_W / 2 - w / 2), y: 86 + i * 18, w, h };
}

// the index of the option under the mouse, or -1
function overPauseOption() {
  if (!mouse.inside) return -1;
  return PAUSE_OPTIONS.findIndex((o, i) => {
    const r = pauseOptionRect(i);
    return mouse.x >= r.x && mouse.x < r.x + r.w && mouse.y >= r.y && mouse.y < r.y + r.h;
  });
}

function drawCrosshair() {
  const x = Math.floor(mouse.x), y = Math.floor(mouse.y);
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(x - 5, y - 1, 4, 3); ctx.fillRect(x + 2, y - 1, 4, 3);
  ctx.fillRect(x - 1, y - 5, 3, 4); ctx.fillRect(x - 1, y + 2, 3, 4);
  ctx.fillRect(x - 1, y - 1, 3, 3);
  ctx.fillStyle = COLOR.W;
  ctx.fillRect(x - 4, y, 2, 1); ctx.fillRect(x + 3, y, 2, 1);
  ctx.fillRect(x, y - 4, 1, 2); ctx.fillRect(x, y + 3, 1, 2);
  ctx.fillRect(x, y, 1, 1);
}
