"use strict";

// ---------- The people of the dungeon ----------
// From floor 9 every floor has a quest with other people who are stuck in the dungeon (see NPC in settings.js and rollObjectives in
// objectives.js). Two kinds:
//   escort   a survivor hides somewhere on the floor. Walk up to them and they follow you; lead them back to the way out at the start
//            (the ring on the floor). Enemies that chase you hurt them if they get close, and so do enemy shots. If they die the quest
//            ends without a reward (the gate still opens, nobody wants to lock you in for that).
//   rescue   prisoners sit in cages, guarded by a few enemies. Shoot the cage open. They thank you, heal you and give you something.
// An arrow at the edge of the screen points at the survivor, and then at the way out.

const NPC_LINES = {
  call: ['Help! Over here!', 'Please! Do not leave!', 'Is it safe? It is not safe.', 'I have a family. They are also in the dungeon.'],
  follow: ['Lead the way!', 'I will stay right behind you. Right behind.', 'Do not die. I am short on friends.', 'Finally! A professional!'],
  hurt: ['Ow!', 'That was my good arm!', 'Rude!', 'I am not paid for this!'],
  safe: ['Thank you! I am going to lie down!', 'They will never believe this at work.', 'I would hug you, but the viewers are watching.'],
  freed: ['I am free! Is it Tuesday?', 'Nobody else came! Thank you!', 'I knew a crawler would turn up eventually.'],
};
const npcPick = list => list[Math.floor(Math.random() * list.length)];

function createNpc(spec) {
  return { x: spec.x, y: spec.y, vx: 0, vy: 0, name: spec.name, look: spec.look, state: 'waiting', life: NPC.life, maxLife: NPC.life,
    hurtTime: 0, flash: 0, talkTime: 1 + Math.random() * 2, animTime: 0, direction: 1, safeTime: 0 };
}

function npcSay(n, text) {
  world.floatingTexts.push({ x: n.x, y: n.y - 24, text, life: 1.8, color: COLOR.l });
}

function updateNpcs(dt) {
  const pl = world.player, lv = world.level;
  for (const n of [...world.npcs]) {
    if (n.state === 'safe') {
      n.safeTime += dt;
      if (n.safeTime > 2.2) world.npcs.splice(world.npcs.indexOf(n), 1);
      continue;
    }
    n.hurtTime -= dt; n.flash -= dt; n.talkTime -= dt;
    const dx = pl.x - n.x, dy = pl.y - n.y, distance = Math.hypot(dx, dy) || 1;
    if (n.state === 'waiting') {
      if (distance < NPC.wakeRange && canSee(n.x, n.y - 4, pl.x, pl.y - 4)) {
        n.state = 'following';
        npcSay(n, npcPick(NPC_LINES.follow));
        sfx('uiClick');
      } else if (distance < 160 && n.talkTime <= 0) {
        n.talkTime = 5 + Math.random() * 3;
        npcSay(n, npcPick(NPC_LINES.call));
      }
    }
    let ix = 0, iy = 0;
    if (n.state === 'following' && distance > NPC.followDistance) {
      const m = pathTo(n, { b: 8, h: 6 }), mx = m.x - n.x, my = m.y - n.y, l = Math.hypot(mx, my) || 1;
      ix = mx / l; iy = my / l;
    }
    const a = 1 - Math.exp(-10 * dt);
    n.vx += (ix * NPC.speed - n.vx) * a;
    n.vy += (iy * NPC.speed - n.vy) * a;
    const fromX = n.x, fromY = n.y;
    moveAxis(n, n.vx * dt, 'x', iy, 8, 6);
    moveAxis(n, n.vy * dt, 'y', ix, 8, 6);
    const moved = Math.hypot(n.x - fromX, n.y - fromY);
    n.animTime = moved / dt > 4 ? n.animTime + moved / 6 : 0;
    if (Math.abs(n.vx) > 2) n.direction = Math.sign(n.vx);
    // the way out
    if (n.state === 'following' && lv.exit && Math.hypot(n.x - lv.exit.x, n.y - lv.exit.y) < NPC.exitRadius) npcSafe(n);
    // enemies that chase you hurt them when they get close
    if (n.state !== 'safe' && n.hurtTime <= 0 && world.enemies.some(e => e.chasing && Math.hypot(e.x - n.x, e.y - n.y) < NPC.contactRange)) hurtNpc(n, 1);
  }
}

function hurtNpc(n, damage) {
  if (n.state === 'safe') return;
  n.life -= damage;
  n.hurtTime = NPC.hurtEvery;
  n.flash = 0.12;
  sfx('hit', n.x, n.y);
  world.floatingTexts.push({ x: n.x + randRange(-3, 3), y: n.y - 16, text: '-' + damage, life: 0.8, color: COLOR.r });
  for (let p = 0; p < 5; p++) particle(n.x, n.y - 5, randRange(-40, 40), randRange(-40, 10), COLOR.r, 0.3);
  if (n.life <= 0) { npcLost(n); return; }
  if (Math.random() < 0.5) npcSay(n, npcPick(NPC_LINES.hurt));
}

function npcLost(n) {
  world.npcs.splice(world.npcs.indexOf(n), 1);
  world.npcLost++;
  puff(n.x, n.y);
  sfx('playerDie');
  systemMessage(n.name + ' did not make it. The viewers are split on whether that was your fault.', 5);
}

// The reward for saving somebody. extra is what a rescue gives on top: hearts and a good item.
function npcReward(n, kind) {
  const pl = world.player, floor = world.levelIndex;
  awardGold(Math.round(NPC.gold * (1 + floor * 0.08)), true);
  gainExp(EXP.objective);
  track('npc', kind);
  world.floatingTexts.push({ x: pl.x, y: pl.y - 26, text: 'SAVED!', life: 1.4, color: COLOR.l });
  sfx('objective');
  if (kind === 'escort') {
    const tier = pickBoxTier();
    giveBox(tier === 'bronze' ? 'silver' : tier);
  } else {
    pl.life = Math.min(maxLife(), pl.life + 2);
    world.items.push(createItem(randomDrop(3), n.x, n.y + 6, true));
  }
}

function npcSafe(n) {
  n.state = 'safe';
  world.npcSafe++;
  npcSay(n, npcPick(NPC_LINES.safe));
  for (let p = 0; p < 14; p++) particle(n.x, n.y - 6, randRange(-45, 45), randRange(-60, 0), p % 2 ? COLOR.l : COLOR.W, 0.6);
  npcReward(n, 'escort');
}

// A cage was shot open (called from destroyBreakable).
function freePrisoner(b) {
  const prisoner = { x: b.x, y: b.y, name: b.name };
  world.floatingTexts.push({ x: b.x, y: b.y - 22, text: npcPick(NPC_LINES.freed), life: 2, color: COLOR.l });
  for (let p = 0; p < 14; p++) particle(b.x, b.y - 6, randRange(-45, 45), randRange(-60, 0), p % 2 ? COLOR.l : COLOR.W, 0.6);
  world.npcSafe++;
  npcReward(prisoner, 'rescue');
}

// ---------- Drawing ----------

function drawNpc(n) {
  const frames = NPC_IMAGES[n.look % NPC_IMAGES.length], image = frames[Math.floor(n.animTime) % frames.length];
  const x = Math.round(n.x), y = Math.round(n.y), top = y - image.height + 4;
  if (n.state === 'safe') ctx.globalAlpha = Math.max(0, 1 - n.safeTime / 2.2);
  shadow(x, y + 1, 10);
  ctx.save();
  ctx.translate(x, 0);
  if (n.direction < 0) ctx.scale(-1, 1);
  ctx.drawImage(n.flash > 0 ? ENEMY_WHITE_NPC[n.look % NPC_IMAGES.length][Math.floor(n.animTime) % frames.length] : image, -8, top);
  ctx.restore();
  ctx.globalAlpha = 1;
  if (n.state === 'safe') return;
  drawText(n.name, x, top - 9, COLOR.l, { align: 'center' });
  if (n.life < n.maxLife) {
    for (let i = 0; i < n.maxLife; i++) { ctx.fillStyle = i < n.life ? COLOR.r : COLOR.D; ctx.fillRect(x - n.maxLife * 2 + i * 4, top - 3, 3, 2); }
  }
  if (n.state === 'waiting') drawText('!', x, top - 18, COLOR.c, { align: 'center' });
}
const ENEMY_WHITE_NPC = NPC_IMAGES.map(frames => frames.map(f => createSilhouette(f, COLOR.W)));

// The ring on the floor at the start, where survivors have to be led.
function drawExitMarker() {
  const lv = world.level;
  if (!lv.exit || !world.npcs.some(n => n.state !== 'safe')) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.globalAlpha = 0.35 + 0.25 * pulse;
  ctx.fillStyle = COLOR.l;
  for (let i = 0; i < 28; i++) {
    const a = Math.PI * 2 * i / 28;
    ctx.fillRect(Math.round(lv.exit.x + Math.cos(a) * NPC.exitRadius), Math.round(lv.exit.y + Math.sin(a) * NPC.exitRadius * 0.7), 1, 1);
  }
  ctx.globalAlpha = 1;
  drawText('EXIT', lv.exit.x, lv.exit.y - 4, COLOR.l, { align: 'center' });
}

// An arrow at the edge of the screen: towards the survivor, and once they follow you towards the exit.
function drawNpcPointer() {
  const lv = world.level, n = world.npcs.find(m => m.state !== 'safe');
  if (!n || state !== 'playing') return;
  const target = n.state === 'waiting' ? n : lv.exit;
  if (!target) return;
  const sx = target.x - Math.round(camera.x), sy = target.y - Math.round(camera.y);
  if (sx > 8 && sx < SCREEN_W - 8 && sy > 8 && sy < SCREEN_H - 8) return;   // already on the screen
  const cx = SCREEN_W / 2, cy = SCREEN_H / 2, angle = Math.atan2(sy - cy, sx - cx);
  const t = Math.min((SCREEN_W / 2 - 14) / Math.max(0.01, Math.abs(Math.cos(angle))), (SCREEN_H / 2 - 14) / Math.max(0.01, Math.abs(Math.sin(angle))));
  const px = cx + Math.cos(angle) * t, py = cy + Math.sin(angle) * t;
  ctx.save();
  ctx.translate(Math.round(px), Math.round(py));
  ctx.rotate(angle);
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(-5, -4, 10, 8);
  ctx.fillStyle = COLOR.l;
  for (let i = 0; i < 4; i++) ctx.fillRect(-3 + i, -3 + i, 1, 6 - 2 * i);
  ctx.fillRect(-4, -1, 8, 2);
  ctx.restore();
}
