"use strict";

// ---------- Perks: what you choose at every level ----------
// A perk lasts for the run. Most are stats that can be taken several times (PERKS in settings.js); a few are one-offs.

// What the perks of this run and the upgrades in the shop add to one stat. stat() in gear.js adds this to the clothes.
function progressStat(name) {
  let total = 0;
  const pl = world && world.player;
  if (pl) {
    for (const id in pl.perks) {
      const p = PERKS[id];
      if (p && p.stats[name]) total += p.stats[name] * pl.perks[id];
    }
    total += classStat(name);
  }
  for (const id in UPGRADES) if (UPGRADES[id].stat === name) total += UPGRADES[id].step * upgradeLevel(id);
  return total;
}

// What the one-off perks do.
const PERK_EFFECTS = {
  heal(pl) { pl.life = maxLife(); },
  ammo(pl) {
    for (const type of pl.slots) {
      if (isWeapon(type) && !WEAPONS[type].infinite) pl.ammo[type] = Math.min(WEAPONS[type].ammoMax, (pl.ammo[type] || 0) + WEAPONS[type].ammoPickup * 2);
    }
  },
  gold(pl, perk) { awardGold(perk.value, true); },
};

// Three different perks that can still be taken. Luck makes the better ones turn up more often.
function rollPerks() {
  const pl = world.player, picked = [];
  const eligible = id => PERKS[id].effect || (pl.perks[id] || 0) < PERKS[id].max;
  for (let n = 0; n < 3; n++) {
    const pool = Object.keys(PERKS).filter(id => eligible(id) && !picked.includes(id));
    if (!pool.length) break;
    const rarity = pickRarity(), same = pool.filter(id => PERKS[id].rarity === rarity), list = same.length ? same : pool;
    picked.push(list[Math.floor(Math.random() * list.length)]);
  }
  return picked;
}

function openLevelUp() {
  state = 'levelup';
  world.levelUp = { choices: rollPerks() };
  mouse.down = false;
  mouse.moving = false;
  sfx('levelup');
}

function choosePerk(i) {
  const pl = world.player, id = world.levelUp && world.levelUp.choices[i];
  if (!id) return;
  const perk = PERKS[id];
  if (perk.effect) PERK_EFFECTS[perk.effect](pl, perk);
  else pl.perks[id] = (pl.perks[id] || 0) + 1;
  sfx('perk');
  world.floatingTexts.push({ x: pl.x, y: pl.y - 18, text: perk.name, life: 1.2, color: RARITY[perk.rarity].color });
  pl.pending--;
  if (pl.pending > 0) {
    world.levelUp = { choices: rollPerks() };
  } else {
    world.levelUp = null;
    state = 'playing';
  }
}

// The three cards of the level-up screen.
const perkCard = i => ({ x: 11 + i * 102, y: 38, w: 94, h: 112 });

function perkUnderMouse() {
  if (!mouse.inside || !world.levelUp) return -1;
  return world.levelUp.choices.findIndex((id, i) => { const c = perkCard(i); return mouse.x >= c.x && mouse.x < c.x + c.w && mouse.y >= c.y && mouse.y < c.y + c.h; });
}

function clickPerk() {
  const i = perkUnderMouse();
  if (i >= 0) choosePerk(i);
}

function drawLevelUp() {
  const pl = world.player, over = perkUnderMouse();
  dim(0.72);
  drawText('LEVEL UP!', BASE_W / 2, 8, COLOR.O, { scale: 2, align: 'center', shadow: COLOR.x });
  drawText('You are level ' + pl.level + '. Pick a perk.' + (pl.pending > 1 ? '   (' + (pl.pending - 1) + ' more to come)' : ''), BASE_W / 2, 26, COLOR.S, { align: 'center' });
  world.levelUp.choices.forEach((id, i) => {
    const c = perkCard(i), perk = PERKS[id], rarityInfo = RARITY[perk.rarity], hover = i === over;
    ctx.fillStyle = hover ? 'rgba(58,68,102,0.95)' : 'rgba(24,20,37,0.95)';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    border(c.x, c.y, c.w, c.h, hover ? COLOR.W : rarityInfo.color);
    ctx.fillStyle = rarityInfo.color;
    ctx.fillRect(c.x, c.y, c.w, 2);
    drawText(String(i + 1), c.x + 6, c.y + 7, COLOR.g);
    wrapLines(perk.name, c.w - 22).forEach((l, n) => drawText(l, c.x + 16, c.y + 7 + n * 8, COLOR.W));
    drawText(rarityInfo.name, c.x + 6, c.y + 26, rarityInfo.color);
    wrapLines(perk.description, c.w - 12).forEach((l, n) => drawText(l, c.x + 6, c.y + 40 + n * 8, COLOR.a));
    const have = pl.perks[id] || 0;
    drawText(perk.effect ? 'One-off' : 'Level ' + (have + 1) + ' / ' + perk.max, c.x + 6, c.y + c.h - 12, COLOR.l);
  });
  drawText(T('Click a card or press 1, 2 or 3', 'Tap a card'), BASE_W / 2, 160, COLOR.g, { align: 'center' });
}
