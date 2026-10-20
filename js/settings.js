"use strict";

// =====================================================================
//  PIXEL CRAWLER
//  Top-down pixel art shooter. The code is split across several files in the js folder,
//  and index.html loads them in the right order.
//  The numbers that control the game are collected here, so they are easy to tweak.
// =====================================================================

// ---------- Settings ----------

// internal width in pixels: 320 (16:9), but a wider phone screen gets up to 400 so no space is left unused
const BASE_W = 320;
const SCREEN_W = (() => {
  if (typeof window === 'undefined' || !window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return BASE_W;
  const a = Math.max(window.innerWidth, window.innerHeight) / Math.max(1, Math.min(window.innerWidth, window.innerHeight));
  return Math.max(BASE_W, Math.min(400, Math.round(180 * a / 2) * 2));
})();
const UI_X = (SCREEN_W - BASE_W) / 2;   // the menus are laid out for 320 px and sit in the middle
const SCREEN_H = 180;   // internal height in pixels
const TILE = 16;        // size of one map tile
const TIMESTEP = 1 / 60;  // fixed time step for the game logic

const PLAYER = {
  speed: 78,             // pixels per second
  acceleration: 16,      // how fast the player reaches top speed and stops
  hitbox: { b: 8, h: 6 },
  startWeapon: 'rubberBandGun',
  life: 6,               // number of hearts
  invulnerableTime: 0.9, // seconds you cannot be hit again after a hit
  knockback: 160,        // how hard you are pushed back when hit
  shotHeight: 4,         // how many pixels above the feet shots fly; walls stop them at floor level
};

const CAMERA = {
  followSpeed: 7, // how quickly the camera catches up with the player
  aimLean: 0.25,  // how much the camera leans toward the cursor (0 = none)
  maxLean: 36,    // longest distance the camera leans, in pixels
};

const RARITY = {
  common:    { name: 'Common',    color: '#c0cbdc', weight: 70 },
  rare:      { name: 'Rare',      color: '#0099db', weight: 25 },
  legendary: { name: 'Legendary', color: '#feae34', weight: 5 },
};

// damage is damage per bullet, shotsPerSec is shots per second, bulletSpeed and range are in pixels,
// spread is spread in degrees, recoil is how many pixels the weapon kicks back, shake is screen shake,
// knockbackMult is multiplied with the enemy knockback, pierce means bullets pierce enemies.
// ammoPickup is the ammo one pickup gives, ammoMax is the most you can carry (one unit is one shot),
// infinite means it never runs out.
// bounce is how many times the bullet bounces off walls, slow is how many seconds a hit slows an enemy to a crawl,
// armorPierce means the damage is not cut down by armour (see armor below).
const WEAPONS = {
  rubberBandGun: {
    name: 'Rubber Band Gun', rarity: 'common',
    damage: 1, shotsPerSec: 2.5, bulletSpeed: 170, range: 140, spread: 8, bulletsPerShot: 1,
    recoil: 2, shake: 0, knockbackMult: 1, image: 'rubberBandGun', bullet: 'rubberBand', flash: '#f6757a',
    infinite: true,
    description: 'A pencil and a rubber band. Better than nothing.',
  },
  nailGun: {
    name: 'Nail Gun', rarity: 'common',
    damage: 1, shotsPerSec: 6, bulletSpeed: 210, range: 120, spread: 14, bulletsPerShot: 1,
    recoil: 1, shake: 0, knockbackMult: 0.5, image: 'nailGun', bullet: 'nail', flash: '#c0cbdc',
    ammoPickup: 40, ammoMax: 160,
    description: 'From the hardware store. Fast, but sprays everywhere.',
  },
  potatoCannon: {
    name: 'Potato Cannon', rarity: 'rare',
    damage: 4, shotsPerSec: 0.9, bulletSpeed: 130, range: 150, spread: 2, bulletsPerShot: 1,
    recoil: 4, shake: 2, knockbackMult: 3, image: 'potatoCannon', bullet: 'potato', flash: '#e4a672',
    ammoPickup: 6, ammoMax: 24,
    description: 'Slow to reload. Hits like a sack of potatoes.',
  },
  shotgun: {
    name: 'Shotgun', rarity: 'rare',
    damage: 1, shotsPerSec: 1.3, bulletSpeed: 200, range: 85, spread: 30, bulletsPerShot: 6,
    recoil: 4, shake: 2.5, knockbackMult: 1, image: 'shotgun', bullet: 'pellet', flash: '#fee761',
    ammoPickup: 8, ammoMax: 32,
    description: 'Six pellets per shot. Best up close.',
  },
  lightningGun: {
    name: 'Lightning Gun', rarity: 'legendary',
    damage: 2, shotsPerSec: 5, bulletSpeed: 280, range: 200, spread: 3, bulletsPerShot: 1,
    recoil: 1, shake: 0.5, knockbackMult: 0.6, pierce: true, image: 'lightningGun', bullet: 'lightning', flash: '#2ce8f5',
    ammoPickup: 20, ammoMax: 80,
    description: 'The shots go straight through enemies.',
  },
  slingshot: {
    name: 'Slingshot', rarity: 'common',
    damage: 2, shotsPerSec: 1.8, bulletSpeed: 190, range: 130, spread: 3, bulletsPerShot: 1,
    recoil: 1, shake: 0, knockbackMult: 1.2, image: 'slingshot', bullet: 'stone', flash: '#8b9bb4',
    ammoPickup: 30, ammoMax: 120,
    description: 'Accurate and cheap. A bit of a letdown.',
  },
  crossbow: {
    name: 'Crossbow', rarity: 'rare',
    damage: 6, shotsPerSec: 1.1, bulletSpeed: 260, range: 190, spread: 1, bulletsPerShot: 1,
    recoil: 3, shake: 1.5, knockbackMult: 2, pierce: true, image: 'crossbow', bullet: 'bolt', flash: '#b86f50',
    ammoPickup: 8, ammoMax: 32,
    description: 'Heavy bolts that pierce through enemies.',
  },
  flamethrower: {
    name: 'Flamethrower', rarity: 'rare',
    damage: 1, shotsPerSec: 14, bulletSpeed: 110, range: 55, spread: 22, bulletsPerShot: 1,
    recoil: 0, shake: 0, knockbackMult: 0.1, pierce: true, image: 'flamethrower', bullet: 'flame', flash: '#f77622',
    ammoPickup: 70, ammoMax: 280,
    description: 'Short range, but burns everything in a line.',
  },
  minigun: {
    name: 'Minigun', rarity: 'legendary',
    damage: 1, shotsPerSec: 16, bulletSpeed: 230, range: 150, spread: 9, bulletsPerShot: 1,
    recoil: 1, shake: 0.6, knockbackMult: 0.4, image: 'minigun', bullet: 'tracer', flash: '#fee761',
    ammoPickup: 120, ammoMax: 480,
    description: 'A wall of lead. Burns through ammo.',
  },
  rocketLauncher: {
    name: 'Rocket Launcher', rarity: 'legendary',
    damage: 3, shotsPerSec: 0.8, bulletSpeed: 120, range: 170, spread: 2, bulletsPerShot: 1,
    recoil: 5, shake: 3.5, knockbackMult: 3, explode: { radius: 30, damage: 6 }, image: 'rocketLauncher', bullet: 'rocket', flash: '#e43b44',
    ammoPickup: 4, ammoMax: 16,
    description: 'Explodes on impact and hurts everything nearby.',
  },
  baseballBat: {
    name: 'Baseball Bat', rarity: 'common',
    damage: 3, shotsPerSec: 2.2, bulletSpeed: 180, range: 22, spread: 80, bulletsPerShot: 5,
    recoil: 0, shake: 0.5, knockbackMult: 3, pierce: true, image: 'baseballBat', bullet: 'swing', flash: '#ffffff',
    ammoPickup: 40, ammoMax: 120,
    description: 'Swing for the fences. Hits everything in front.',
  },
  revolver: {
    name: 'Revolver', rarity: 'common',
    damage: 3, shotsPerSec: 2, bulletSpeed: 300, range: 170, spread: 1, bulletsPerShot: 1,
    recoil: 3, shake: 1, knockbackMult: 1.5, image: 'revolver', bullet: 'slug', flash: '#feae34',
    ammoPickup: 18, ammoMax: 72,
    description: 'Six bullets, six chances. Reliable.',
  },
  sniperRifle: {
    name: 'Sniper Rifle', rarity: 'rare',
    damage: 8, shotsPerSec: 0.7, bulletSpeed: 450, range: 280, spread: 0, bulletsPerShot: 1,
    recoil: 4, shake: 2.5, knockbackMult: 3, pierce: true, armorPierce: true, image: 'sniperRifle', bullet: 'beam', flash: '#ffffff',
    ammoPickup: 6, ammoMax: 24,
    description: 'One shot, one kill. Pierces armour.',
  },
  grenadeLauncher: {
    name: 'Grenade Launcher', rarity: 'rare',
    damage: 1, shotsPerSec: 0.9, bulletSpeed: 120, range: 150, spread: 2, bulletsPerShot: 1,
    recoil: 4, shake: 2, knockbackMult: 2, bounce: 3, explode: { radius: 34, damage: 5 }, image: 'grenadeLauncher', bullet: 'grenade', flash: '#63c74d',
    ammoPickup: 6, ammoMax: 24,
    description: 'Bounces off walls and explodes. Mind your toes.',
  },
  freezeRay: {
    name: 'Freeze Ray', rarity: 'rare',
    damage: 1, shotsPerSec: 7, bulletSpeed: 200, range: 130, spread: 4, bulletsPerShot: 1,
    recoil: 0, shake: 0, knockbackMult: 0.2, slow: 2.5, image: 'freezeRay', bullet: 'ice', flash: '#2ce8f5',
    ammoPickup: 40, ammoMax: 160,
    description: 'Slows everything it touches to a crawl.',
  },
  ricochetPistol: {
    name: 'Ricochet Pistol', rarity: 'legendary',
    damage: 3, shotsPerSec: 3, bulletSpeed: 260, range: 420, spread: 2, bulletsPerShot: 1,
    recoil: 1, shake: 0.5, knockbackMult: 1, pierce: true, bounce: 5, image: 'ricochetPistol', bullet: 'spark', flash: '#fee761',
    ammoPickup: 30, ammoMax: 120,
    description: 'Bounces off walls, pierces enemies.',
  },
};

// the hotbar slots are chosen with 1-4, the rest sit in the bag. pickupDistance is how close you must get to pick something up,
// switchTime is the pause before you can shoot after switching weapon
const BAG = {
  hotbarSlots: 4,
  bagSlots: 12,
  equipStart: 16,   // hotbarSlots + bagSlots: the places for clothes come after them
  pickupDistance: 10,
  switchTime: 0.15,
};

// life is how many hits they take, sight is how far away they notice you, and forget is how far away they give up.
// range is how close they must be to strike, windup is the time from starting a strike until it lands
// (so you can step away), knockback is how far bullets push them.
// hitbox is used against walls, body is where bullets hit (dy is how high above the feet the centre is).
// dropChance is the chance that they drop a weapon when they die.
// Bosses: boss marks a boss, scale is how much bigger the sprite is, shadowWidth is the width of its shadow,
// reward is the weapon it drops. Every moveInterval seconds it uses a move from moves (in order, or at random
// with randomMoves). Each move has its own settings, and say is what the boss shouts when it uses it:
//   fan      a fan of shots bullets (speed, damage)
//   ring     a ring of shots bullets all the way around
//   summon   calls count enemies of this type (no more than max alive at a time)
//   dash     stands still for windup seconds, then charges for time seconds (hit is the reach)
//   teleport vanishes, then reappears near the player and fires its fan
//   hazards  count danger zones near the player: they only warn for warn seconds, then hurt for active seconds
// A boss that drops below half its life gets enraged: faster, moves more often, and fans/rings get more shots.
// Ranged enemies: keepAway is the distance they try to keep from the player (they back off when closer), and they
// shoot (shootInterval, shots, shotSpeed, shotDamage).
// Flying enemies: hover is how many pixels the sprite floats above its shadow, flutter is how much they swerve.
// ghost: floats through walls. armor: a shield that cuts the damage of shots from the side it faces to this fraction
// (not for armorPierce weapons and explosions). bomber: runs at the player and blows up after fuse seconds, or when it
// dies, hurting the player within radius. splits: leaves this many of another enemy behind when it dies.
const ENEMIES = {
  rat: {
    name: 'Rat', life: 2, speed: 58, damage: 1, sight: 96, forget: 220, dropChance: 0.1,
    range: 11, windup: 0.25, cooldown: 0.9, knockback: 90,
    hitbox: { b: 8, h: 5 }, body: { b: 12, h: 7, dy: -1 }, colors: ['g', 's', 'm'], shadowWidth: 12,
  },
  goblin: {
    name: 'Goblin', life: 5, speed: 40, damage: 2, sight: 110, forget: 240, dropChance: 0.4,
    range: 13, windup: 0.4, cooldown: 1.3, knockback: 50,
    hitbox: { b: 8, h: 6 }, body: { b: 10, h: 15, dy: -4 }, colors: ['l', 'G', 'U'],
  },
  landlord: {
    name: 'The Landlord', boss: true, life: 40, speed: 36, damage: 2, sight: 170, forget: 99999, dropChance: 0,
    range: 20, windup: 0.55, cooldown: 1.6, knockback: 8,
    hitbox: { b: 14, h: 8 }, body: { b: 20, h: 28, dy: -12 }, colors: ['h', 'k', 'r'], shadowWidth: 22, scale: 2,
    reward: 'lightningGun', moveInterval: 2.4, moves: ['fan', 'fan', 'summon'],
    fan: { shots: 5, speed: 70, damage: 1, say: 'EVICTION NOTICE!' },
    summon: { type: 'goblin', count: 2, max: 4, say: 'THE BAILIFFS ARE HERE!' },
  },
  ratKing: {
    name: 'The Rat King', boss: true, life: 60, speed: 50, damage: 2, sight: 170, forget: 99999, dropChance: 0,
    range: 22, windup: 0.45, cooldown: 1.2, knockback: 10,
    hitbox: { b: 16, h: 8 }, body: { b: 26, h: 14, dy: -4 }, colors: ['g', 's', 'm'], shadowWidth: 26, scale: 2,
    reward: 'shotgun', moveInterval: 2, moves: ['dash', 'summon', 'dash', 'dash'],
    dash: { windup: 0.6, time: 0.45, speed: 240, damage: 2, hit: 16, say: 'SQUEEEAK!' },
    summon: { type: 'rat', count: 3, max: 8, say: 'FEAST, MY CHILDREN!' },
  },
  bat: {
    name: 'Bat', life: 1, speed: 85, damage: 1, sight: 110, forget: 240, dropChance: 0.05,
    range: 9, windup: 0.12, cooldown: 0.8, knockback: 120,
    hitbox: { b: 6, h: 4 }, body: { b: 10, h: 7, dy: -5 }, colors: ['P', 'i', 'p'], shadowWidth: 8, hover: 6, flutter: 1.1,
  },
  spitter: {
    name: 'Spitter', life: 4, speed: 30, damage: 1, sight: 130, forget: 260, dropChance: 0.3,
    range: 0, windup: 0, cooldown: 1, knockback: 60, keepAway: 90,
    hitbox: { b: 8, h: 6 }, body: { b: 10, h: 15, dy: -4 }, colors: ['i', 'P', 'y'],
    shootInterval: 1.9, shots: 1, shotSpeed: 80, shotDamage: 1,
  },
  ogre: {
    name: 'Ogre', life: 16, speed: 26, damage: 3, sight: 100, forget: 240, dropChance: 0.7,
    range: 16, windup: 0.7, cooldown: 1.8, knockback: 15,
    hitbox: { b: 12, h: 8 }, body: { b: 18, h: 26, dy: -10 }, colors: ['q', 'x', 'U'], shadowWidth: 18, scale: 2,
  },
  janitor: {
    name: 'The Janitor', boss: true, life: 80, speed: 40, damage: 2, sight: 170, forget: 99999, dropChance: 0,
    range: 22, windup: 0.5, cooldown: 1.4, knockback: 8,
    hitbox: { b: 14, h: 8 }, body: { b: 20, h: 28, dy: -12 }, colors: ['h', 'n', 'y'], shadowWidth: 22, scale: 2,
    reward: 'flamethrower', moveInterval: 2.6, moves: ['hazards', 'ring', 'hazards'],
    hazards: { count: 3, radius: 20, warn: 0.9, active: 2.5, damage: 1, color: 'W', say: 'WET FLOOR!' },
    ring: { shots: 10, speed: 55, damage: 1, say: 'CLEANING TIME!' },
  },
  boneCollector: {
    name: 'The Bone Collector', boss: true, life: 110, speed: 44, damage: 3, sight: 170, forget: 99999, dropChance: 0,
    range: 22, windup: 0.5, cooldown: 1.3, knockback: 6,
    hitbox: { b: 14, h: 8 }, body: { b: 20, h: 28, dy: -12 }, colors: ['S', 'D', 'r'], shadowWidth: 22, scale: 2,
    reward: 'rocketLauncher', moveInterval: 2.8, moves: ['teleport', 'summon', 'teleport'],
    teleport: { say: 'JOIN MY COLLECTION!' },
    fan: { shots: 5, speed: 85, damage: 1 },
    summon: { type: 'bat', count: 3, max: 6, say: 'BONE SWARM!' },
  },
  host: {
    name: 'The Host', boss: true, life: 160, speed: 46, damage: 3, sight: 170, forget: 99999, dropChance: 0,
    range: 24, windup: 0.45, cooldown: 1.1, knockback: 5,
    hitbox: { b: 14, h: 8 }, body: { b: 20, h: 28, dy: -12 }, colors: ['t', 'P', 'O'], shadowWidth: 22, scale: 2,
    reward: 'minigun', moveInterval: 2.2, randomMoves: true, moves: ['fan', 'ring', 'hazards', 'summon', 'dash'],
    fan: { shots: 7, speed: 80, damage: 1, say: 'SMILE FOR THE CAMERAS!' },
    ring: { shots: 12, speed: 70, damage: 1, say: 'AUDIENCE PARTICIPATION!' },
    hazards: { count: 4, radius: 18, warn: 0.8, active: 2.5, damage: 1, color: 'y', say: 'SPOTLIGHT ON YOU!' },
    summon: { type: 'ogre', count: 1, max: 2, say: 'MEET YOUR COMPETITION!' },
    dash: { windup: 0.5, time: 0.4, speed: 250, damage: 3, hit: 16, say: 'SPRINT ROUND!' },
  },
  slime: {
    name: 'Slime', life: 6, speed: 26, damage: 1, sight: 90, forget: 200, dropChance: 0.2,
    range: 11, windup: 0.3, cooldown: 1.1, knockback: 80,
    hitbox: { b: 9, h: 6 }, body: { b: 12, h: 9, dy: -1 }, colors: ['l', 'G', 'f'], shadowWidth: 12,
    splits: { type: 'slimeling', count: 2 },
  },
  slimeling: {
    name: 'Slimeling', life: 2, speed: 48, damage: 1, sight: 120, forget: 220, dropChance: 0,
    range: 9, windup: 0.2, cooldown: 0.9, knockback: 120,
    hitbox: { b: 6, h: 4 }, body: { b: 8, h: 6, dy: -1 }, colors: ['l', 'G'], shadowWidth: 8,
  },
  ghost: {
    name: 'Ghost', life: 5, speed: 36, damage: 2, sight: 140, forget: 260, dropChance: 0.3,
    range: 12, windup: 0.5, cooldown: 1.5, knockback: 30,
    hitbox: { b: 6, h: 6 }, body: { b: 10, h: 14, dy: -9 }, colors: ['S', 'b', 'c'], shadowWidth: 0, hover: 4, flutter: 0.4, ghost: true,
  },
  bomber: {
    name: 'Bomber', life: 3, speed: 62, damage: 0, sight: 130, forget: 240, dropChance: 0.15,
    range: 0, windup: 0, cooldown: 99, knockback: 100,
    hitbox: { b: 7, h: 6 }, body: { b: 10, h: 10, dy: -4 }, colors: ['r', 'o', 'y'], shadowWidth: 9,
    bomber: { radius: 30, damage: 3, fuse: 0.7 },
  },
  knight: {
    name: 'Knight', life: 12, speed: 30, damage: 2, sight: 110, forget: 240, dropChance: 0.5,
    range: 14, windup: 0.55, cooldown: 1.6, knockback: 20,
    hitbox: { b: 8, h: 6 }, body: { b: 12, h: 16, dy: -5 }, colors: ['g', 'S', 'D'], shadowWidth: 11, armor: 0.2,
  },
};

// Clothes, hats, shoes, rings and amulets. slot is where it is worn (see GEAR_SLOTS), rarity says how strong it is:
// common things have one stat, rare ones two and legendary ones three. stats are listed in STAT_INFO. look is the shape
// of the icon (see GEAR_SHAPES in gear.js) and the colours it is drawn in: a is the main colour, b the trim, g the gem.
const GEAR_SLOTS = ['head', 'body', 'feet', 'ring', 'ring', 'neck'];   // the six places on the character, in the order of the bag screen
const GEAR_DROP = 0.35;   // the share of drops (from enemies) that is clothes instead of a weapon

const STAT_INFO = {
  maxLife:     { label: 'Max life',     format: 'int' },                // more hearts
  speed:       { label: 'Move speed',   format: 'pct', cap: 0.6 },
  damage:      { label: 'Damage',       format: 'pct' },                // all weapons
  fireRate:    { label: 'Fire rate',    format: 'pct', cap: 0.8 },
  ammoSave:    { label: 'Ammo saved',   format: 'pct', cap: 0.7 },      // chance that a shot is free
  armor:       { label: 'Armor',        format: 'int' },                // less damage from every hit (never below 1)
  dodge:       { label: 'Dodge',        format: 'pct', cap: 0.5 },      // chance to avoid a hit completely
  crit:        { label: 'Crit chance',  format: 'pct', cap: 0.8 },      // a critical shot does double damage
  luck:        { label: 'Luck',         format: 'pct' },                // more drops, and better ones
  lightRadius: { label: 'Light',        format: 'px' },                 // a bigger light in the dark
  pickupRange: { label: 'Pickup range', format: 'px' },
  invuln:      { label: 'Hit recovery', format: 'sec' },                // longer before you can be hit again
  killHeal:    { label: 'Heal on kill', format: 'pct', cap: 0.5 },      // chance to heal a heart when an enemy dies
  xpGain:      { label: 'Exp gain',     format: 'pct' },                // more exp from everything (perks and upgrades)
  goldGain:    { label: 'Gold gain',    format: 'pct' },                // more gold from everything (perks and upgrades)
  bounce:      { label: 'Bounces',      format: 'int', cap: 4 },        // every bullet bounces this many more times (perks)
  multishot:   { label: 'Extra bullets', format: 'int', cap: 2 },       // more bullets with every shot (perks)
  volatile:    { label: 'Explosive kills', format: 'pct', cap: 0.5 },   // chance that an enemy explodes when it dies (perks)
  pierce:      { label: 'Piercing',     format: 'int', cap: 1 },        // bullets go through enemies (perks)
};

const GEAR = {
  // ---- hats ----
  bikeHelmet: { name: 'Bike Helmet', slot: 'head', rarity: 'common', stats: { maxLife: 1 }, look: { shape: 'helmet', a: 'b', b: 'W', g: 'r' }, description: 'Safety first. Mostly.' },
  baseballCap: { name: 'Baseball Cap', slot: 'head', rarity: 'common', stats: { crit: 0.05 }, look: { shape: 'cap', a: 'r', b: 'W' }, description: 'Worn backwards, for luck.' },
  beanie: { name: 'Woolly Beanie', slot: 'head', rarity: 'common', stats: { dodge: 0.04 }, look: { shape: 'beanie', a: 'l', b: 'G', g: 'W' }, description: 'Warm, and hard to hit.' },
  minersHelmet: { name: "Miner's Helmet", slot: 'head', rarity: 'rare', stats: { lightRadius: 30, maxLife: 1 }, look: { shape: 'helmet', a: 'O', b: 'o', g: 'y' }, description: 'With a lamp. Great in the dark.' },
  tinfoilHat: { name: 'Tinfoil Hat', slot: 'head', rarity: 'rare', stats: { dodge: 0.1, crit: 0.05 }, look: { shape: 'foil', a: 'S', b: 'g' }, description: 'They cannot read your mind now.' },
  topHat: { name: 'Top Hat', slot: 'head', rarity: 'rare', stats: { luck: 0.25, crit: 0.05 }, look: { shape: 'tophat', a: 'k', b: 'K', g: 'r' }, description: 'Very fancy. Very lucky.' },
  crownOfTheCrawler: { name: 'Crown of the Crawler', slot: 'head', rarity: 'legendary', stats: { maxLife: 2, luck: 0.3, damage: 0.1 }, look: { shape: 'crown', a: 'O', g: 'r' }, description: 'Fit for a champion of the dungeon.' },
  wizardHat: { name: 'Wizard Hat', slot: 'head', rarity: 'legendary', stats: { fireRate: 0.15, ammoSave: 0.15, crit: 0.08 }, look: { shape: 'wizard', a: 'P', b: 'i', g: 'y' }, description: 'You are a wizard, Harry.' },
  // ---- clothes ----
  hoodie: { name: 'Grey Hoodie', slot: 'body', rarity: 'common', stats: { maxLife: 1 }, look: { shape: 'shirt', a: 's', b: 'g', g: 'D' }, description: 'Comfortable. Not heroic.' },
  bathrobe: { name: 'Bathrobe', slot: 'body', rarity: 'common', stats: { speed: 0.06 }, look: { shape: 'coat', a: 'm', b: 'W', g: 'i' }, description: 'Light on its feet.' },
  leatherJacket: { name: 'Leather Jacket', slot: 'body', rarity: 'common', stats: { armor: 1 }, look: { shape: 'coat', a: 'U', b: 'u', g: 'O' }, description: 'Toughens you up.' },
  bulletproofVest: { name: 'Bulletproof Vest', slot: 'body', rarity: 'rare', stats: { armor: 1, maxLife: 1 }, look: { shape: 'vest', a: 'D', b: 'k', g: 'O' }, description: 'Stops most of what hurts.' },
  hawaiianShirt: { name: 'Hawaiian Shirt', slot: 'body', rarity: 'rare', stats: { luck: 0.25, speed: 0.06 }, look: { shape: 'shirt', a: 'b', b: 'W', g: 'o' }, description: 'Loud, and the viewers love it.' },
  tuxedo: { name: 'Tuxedo', slot: 'body', rarity: 'rare', stats: { dodge: 0.07, crit: 0.07 }, look: { shape: 'coat', a: 'k', b: 'W', g: 'r' }, description: 'Dressed to kill.' },
  dragonhideCoat: { name: 'Dragonhide Coat', slot: 'body', rarity: 'legendary', stats: { armor: 1, maxLife: 2, dodge: 0.08 }, look: { shape: 'coat', a: 'G', b: 'O', g: 'y' }, description: 'Scales that turn blades away.' },
  // ---- shoes ----
  sneakers: { name: 'Sneakers', slot: 'feet', rarity: 'common', stats: { speed: 0.08 }, look: { shape: 'shoe', a: 'W', b: 'g', g: 'r' }, description: 'Good for running away.' },
  rubberBoots: { name: 'Rubber Boots', slot: 'feet', rarity: 'common', stats: { invuln: 0.15 }, look: { shape: 'boot', a: 'y', b: 'o', g: 'O' }, description: 'Shrug off a hit faster.' },
  flipFlops: { name: 'Flip-flops', slot: 'feet', rarity: 'common', stats: { speed: 0.05 }, look: { shape: 'shoe', a: 'o', b: 'q', g: 'y' }, description: 'Why are you wearing these here?' },
  runningShoes: { name: 'Running Shoes', slot: 'feet', rarity: 'rare', stats: { speed: 0.15, dodge: 0.04 }, look: { shape: 'shoe', a: 'c', b: 'b', g: 'W' }, description: 'Built for speed.' },
  steelToeBoots: { name: 'Steel-toe Boots', slot: 'feet', rarity: 'rare', stats: { armor: 1, invuln: 0.2 }, look: { shape: 'boot', a: 's', b: 'D', g: 'g' }, description: 'Heavy, but worth it.' },
  rocketBoots: { name: 'Rocket Boots', slot: 'feet', rarity: 'legendary', stats: { speed: 0.25, invuln: 0.3, dodge: 0.06 }, look: { shape: 'rocket', a: 'r', b: 'g', g: 'y' }, description: 'Do not look down.' },
  // ---- rings ----
  copperRing: { name: 'Copper Ring', slot: 'ring', rarity: 'common', stats: { damage: 0.06 }, look: { shape: 'band', a: 'q', g: 'o' }, description: 'Turns your finger green.' },
  rubberBandRing: { name: 'Rubber Band Ring', slot: 'ring', rarity: 'common', stats: { fireRate: 0.07 }, look: { shape: 'band', a: 'r', g: 'm' }, description: 'Snappy.' },
  luckyPennyRing: { name: 'Lucky Penny Ring', slot: 'ring', rarity: 'common', stats: { luck: 0.15 }, look: { shape: 'band', a: 'u', g: 'y' }, description: 'Found on the floor.' },
  moodRing: { name: 'Mood Ring', slot: 'ring', rarity: 'common', stats: { crit: 0.05 }, look: { shape: 'band', a: 'S', g: 'P' }, description: 'It is purple. That is bad.' },
  silverRing: { name: 'Silver Ring', slot: 'ring', rarity: 'rare', stats: { damage: 0.12, crit: 0.05 }, look: { shape: 'band', a: 'S', g: 'W' }, description: 'Hits harder.' },
  frugalityRing: { name: 'Ring of Frugality', slot: 'ring', rarity: 'rare', stats: { ammoSave: 0.12, fireRate: 0.06 }, look: { shape: 'band', a: 'g', g: 'l' }, description: 'Waste not, want not.' },
  vampireRing: { name: 'Vampire Ring', slot: 'ring', rarity: 'rare', stats: { killHeal: 0.1, damage: 0.05 }, look: { shape: 'band', a: 's', g: 'r' }, description: 'Drink to your victories.' },
  ringOfPower: { name: 'Ring of Power', slot: 'ring', rarity: 'legendary', stats: { damage: 0.2, fireRate: 0.1, crit: 0.08 }, look: { shape: 'band', a: 'O', g: 'c' }, description: 'One ring to shoot them all.' },
  // ---- amulets ----
  luckyCharm: { name: 'Lucky Charm', slot: 'neck', rarity: 'common', stats: { luck: 0.15 }, look: { shape: 'clover', a: 'l', b: 'O', g: 'G' }, description: 'Four leaves are better than three.' },
  whistle: { name: 'Whistle', slot: 'neck', rarity: 'common', stats: { pickupRange: 12 }, look: { shape: 'whistle', a: 'S', b: 'g' }, description: 'Things come to you.' },
  heartLocket: { name: 'Heart Locket', slot: 'neck', rarity: 'rare', stats: { maxLife: 1, killHeal: 0.08 }, look: { shape: 'heart', a: 'r', b: 'O' }, description: 'Someone loves you.' },
  magnetPendant: { name: 'Magnet Pendant', slot: 'neck', rarity: 'rare', stats: { pickupRange: 28, luck: 0.15 }, look: { shape: 'magnet', a: 'r', b: 'S' }, description: 'Attracts loot.' },
  emberAmulet: { name: 'Ember Amulet', slot: 'neck', rarity: 'rare', stats: { damage: 0.1, lightRadius: 20 }, look: { shape: 'pendant', a: 'O', b: 'o', g: 'r' }, description: 'Warm to the touch, and it glows.' },
  endlessPockets: { name: 'Endless Pockets', slot: 'neck', rarity: 'legendary', stats: { ammoSave: 0.25, pickupRange: 30, luck: 0.25 }, look: { shape: 'pendant', a: 'O', b: 'y', g: 'c' }, description: 'Bigger on the inside.' },
};

// Exp: the exp for the next level is round(first x growth ^ (level - 1)). An enemy gives perLife exp for every point of life it
// has; a boss gives boss x (floor number) and finishing an objective gives objective. goldPerExp is how much gold a kill gives
// for every exp. Gems and coins come in the sizes gemValues and coinValues (biggest first), the player's magnet pulls them in
// from magnet pixels, and no more than maxDrops can lie on the floor.
const EXP = {
  first: 8, growth: 1.32, perLife: 0.5, boss: 40, objective: 12,
  goldPerExp: 0.6, bossGold: 50, objectiveGold: 10,
  gemValues: [25, 5, 1], coinValues: [25, 5, 1], magnet: 26, maxDrops: 150,
};

// Perks, chosen at every level: three at random, and a perk with max can be taken that many times. stats are added
// to the stat() of the player for every time it was taken. A perk with an effect is a one-off (see PERK_EFFECTS in perks.js).
const PERKS = {
  swift: { name: 'Swift', rarity: 'common', max: 5, stats: { speed: 0.06 }, description: 'Run 6% faster.' },
  heavy: { name: 'Heavy Hitter', rarity: 'common', max: 6, stats: { damage: 0.08 }, description: '+8% damage with every weapon.' },
  trigger: { name: 'Trigger Finger', rarity: 'common', max: 5, stats: { fireRate: 0.07 }, description: 'Shoot 7% faster.' },
  eagle: { name: 'Eagle Eye', rarity: 'common', max: 5, stats: { crit: 0.04 }, description: '+4% chance for a critical hit.' },
  thrifty: { name: 'Thrifty', rarity: 'common', max: 5, stats: { ammoSave: 0.06 }, description: '6% of your shots are free.' },
  lucky: { name: 'Lucky', rarity: 'common', max: 5, stats: { luck: 0.1 }, description: '+10% luck: more and better drops.' },
  magnet: { name: 'Magnet', rarity: 'common', max: 4, stats: { pickupRange: 14 }, description: 'Pick things up from farther away.' },
  nightVision: { name: 'Night Vision', rarity: 'common', max: 3, stats: { lightRadius: 14 }, description: 'A bigger light in the dark.' },
  scholar: { name: 'Scholar', rarity: 'common', max: 5, stats: { xpGain: 0.1 }, description: '+10% exp from everything.' },
  greedy: { name: 'Greedy', rarity: 'common', max: 5, stats: { goldGain: 0.1 }, description: '+10% gold from everything.' },
  tough: { name: 'Tough', rarity: 'rare', max: 5, stats: { maxLife: 1 }, description: '+1 heart.' },
  thick: { name: 'Thick Skin', rarity: 'rare', max: 3, stats: { armor: 1 }, description: 'Take 1 less damage from every hit.' },
  evasive: { name: 'Evasive', rarity: 'rare', max: 5, stats: { dodge: 0.03 }, description: '+3% chance to dodge a hit.' },
  recovery: { name: 'Quick Recovery', rarity: 'rare', max: 4, stats: { invuln: 0.1 }, description: '0.1 s longer before you can be hit again.' },
  bloodthirst: { name: 'Bloodthirst', rarity: 'rare', max: 4, stats: { killHeal: 0.03 }, description: '+3% chance to heal a heart on a kill.' },
  ricochet: { name: 'Ricochet', rarity: 'rare', max: 3, stats: { bounce: 1 }, description: 'Every bullet bounces off one more wall.' },
  piercing: { name: 'Piercing Rounds', rarity: 'rare', max: 1, stats: { pierce: 1 }, description: 'Your bullets go through enemies.' },
  volatile: { name: 'Volatile', rarity: 'rare', max: 4, stats: { volatile: 0.08 }, description: '8% of enemies explode when they die.' },
  doubleBarrel: { name: 'Double Barrel', rarity: 'legendary', max: 2, stats: { multishot: 1 }, description: 'One more bullet with every shot.' },
  berserker: { name: 'Berserker', rarity: 'legendary', max: 2, stats: { damage: 0.2, fireRate: 0.1 }, description: '+20% damage and +10% fire rate.' },
  feast: { name: 'Feast', rarity: 'common', effect: 'heal', stats: {}, description: 'Restore all your hearts.' },
  cache: { name: 'Ammo Cache', rarity: 'common', effect: 'ammo', stats: {}, description: 'Refill some ammo for every weapon.' },
  treasure: { name: 'Treasure', rarity: 'common', effect: 'gold', value: 40, stats: {}, description: 'A bag of 40 gold.' },
};

// Upgrades in the shop: permanent, kept between runs. Every level adds step to a stat, up to max levels, and the price of
// level n is base x growth ^ n (rounded to a multiple of 5), so each one costs more than the one before.
const UPGRADES = {
  vitality: { name: 'Vitality', stat: 'maxLife', step: 1, max: 6, base: 60, growth: 1.6 },
  power: { name: 'Power', stat: 'damage', step: 0.04, max: 10, base: 50, growth: 1.5 },
  swiftness: { name: 'Swiftness', stat: 'speed', step: 0.03, max: 8, base: 40, growth: 1.5 },
  rapidFire: { name: 'Rapid Fire', stat: 'fireRate', step: 0.04, max: 8, base: 55, growth: 1.5 },
  eagleEye: { name: 'Eagle Eye', stat: 'crit', step: 0.02, max: 10, base: 45, growth: 1.45 },
  frugal: { name: 'Frugal', stat: 'ammoSave', step: 0.03, max: 8, base: 40, growth: 1.5 },
  plating: { name: 'Plating', stat: 'armor', step: 1, max: 3, base: 200, growth: 2.2 },
  evasion: { name: 'Evasion', stat: 'dodge', step: 0.02, max: 8, base: 80, growth: 1.55 },
  fortune: { name: 'Fortune', stat: 'luck', step: 0.05, max: 10, base: 50, growth: 1.4 },
  magnetism: { name: 'Magnetism', stat: 'pickupRange', step: 8, max: 6, base: 30, growth: 1.45 },
  scholar: { name: 'Scholar', stat: 'xpGain', step: 0.05, max: 10, base: 40, growth: 1.4 },
  treasureHunter: { name: 'Treasure Hunter', stat: 'goldGain', step: 0.05, max: 10, base: 40, growth: 1.4 },
};

// Light on a dark floor: the radius in pixels of the light each thing gives off. The player's is the "flashlight".
const LIGHT = { player: 54, pickup: 22, item: 14, shot: 14, boss: 30 };

// Sound: master is the overall volume, sfx and music are the volumes of the effects and the music, hearing is how far away
// (in pixels) an effect can be heard, and maxVoices is how many effect sounds can play at the same time.
const AUDIO = { master: 0.8, sfx: 0.9, music: 0.5, hearing: 260, maxVoices: 28 };

// Things that can be shot to pieces. life is the number of hits they take, w and h the size of the hit box, and colors
// the pieces that fly off. A nest sends out a new spawn.type every spawn.every seconds while the player is within spawn.range
// (never more than spawn.max of its own alive). A coffin lets out release.count of release.type when it breaks.
const BREAKABLES = {
  nest: { name: 'Rat nest', life: 10, w: 14, h: 12, colors: ['u', 'U', 't'], spawn: { type: 'rat', every: 5, max: 3, range: 150 } },
  coffin: { name: 'Coffin', life: 8, w: 12, h: 18, colors: ['u', 'U', 'S'], release: { type: 'bat', count: 2 } },
  camera: { name: 'TV camera', life: 7, w: 12, h: 14, colors: ['k', 'D', 'r'] },
};

const PICKUPS = { fuse: { name: 'Fuse' } };

// Every floor is harder than the last. Normal enemies on floor n (counting from 0) get tier = n:
// life x (1 + lifeStep * tier), speed x (1 + speedStep * tier), sight x (1 + sightStep * tier),
// attack cooldowns and shot intervals shorter by cooldownStep * tier, +1 damage every damageEvery floors,
// and a better chance to drop a weapon. Bosses have their own numbers and are not scaled.
const DIFFICULTY = { lifeStep: 0.22, speedStep: 0.05, sightStep: 0.08, cooldownStep: 0.06, damageEvery: 3, dropStep: 0.15 };

// The ENDESGA 32 palette. The letters are used in the sprites below.
const COLOR = {
  K: '#181425', k: '#262b44', D: '#3a4466', s: '#5a6988', g: '#8b9bb4', S: '#c0cbdc', W: '#ffffff',
  r: '#e43b44', R: '#a22633', z: '#ff0044', m: '#f6757a', i: '#b55088', P: '#68386c', p: '#3e2731',
  o: '#f77622', O: '#feae34', y: '#fee761', l: '#63c74d', G: '#3e8948', f: '#265c42', e: '#193c3e',
  n: '#124e89', b: '#0099db', c: '#2ce8f5',
  h: '#e8b796', H: '#c28569', u: '#b86f50', U: '#733e39', t: '#e4a672', a: '#ead4aa', x: '#be4a2f', q: '#d77643',
};
