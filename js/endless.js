"use strict";

// ---------- Off script: the endless descent ----------
// After floor 12 the season ends with the finale (see story.js). A player who refuses it goes on down, "off script": floors 13, 14 and
// so on are the twelve floors you know, picked again in a new order and turned another way, each with one or two floor rules that change
// how it plays (FLOOR_RULES). Which floor and which rules come up is decided by the run's seed, so a continued run gets the same floors.
// The boss of an endless floor is an elite boss with more life the deeper you go, and the enemies grow tougher at a slower pace than
// before the Core (ENDLESS.tierStep floors of difficulty per floor).

// tierStep: how much harder every floor below the Core is (1 = as much as a normal floor). bossLife: extra boss life per floor below the
// Core. twoRulesFrom: the first floor (counting from 1) with two rules at once.
const ENDLESS = { tierStep: 0.6, bossLife: 0.12, twoRulesFrom: 17 };

// What every rule does. stats are added to the player's stats (see stat in gear.js); the rest are read where they matter:
// enemyLife, enemySpeed, enemyDamage (multipliers), enemyShare (extra enemies, 1 = twice as many), eliteMult (chance of elites),
// viewers (how fast the viewers meter fills), ammo (ammo from pickups), gold, dark (the floor is dark), volatile (every enemy explodes
// when it dies) and bossGuards (elites that come with the boss).
const FLOOR_RULES = {
  blackout:    { name: 'Blackout', text: 'The lights are out. Bring your own.', dark: 0.86 },
  eliteWeek:   { name: 'Elite Week', text: 'Far more elites, and far more loot.', eliteMult: 2.5 },
  glassCannon: { name: 'Glass Cannon', text: 'Everybody hits twice as hard. Including you.', stats: { damage: 1 }, enemyDamage: 2 },
  sponsorNight:{ name: 'Sponsor Night', text: 'The viewers are generous tonight: boxes come twice as fast.', viewers: 2 },
  swarm:       { name: 'Swarm', text: 'Twice as many enemies, but they are flimsy.', enemyShare: 1, enemyLife: 0.55 },
  fastForward: { name: 'Fast Forward', text: 'Everything moves faster. You too.', stats: { speed: 0.25 }, enemySpeed: 1.3 },
  budgetCuts:  { name: 'Budget Cuts', text: 'Half the ammo from pickups, but gold is worth more.', ammo: 0.5, gold: 1.6 },
  explosive:   { name: 'Everything Explodes', text: 'Every enemy blows up when it dies. Keep your distance.', volatile: true },
  bloodMoon:   { name: 'Blood Moon', text: 'Kills can heal you, but you have two hearts less.', stats: { killHeal: 0.12, maxLife: -2 } },
  royalGuard:  { name: 'Royal Guard', text: 'The boss arrives with elite bodyguards.', bossGuards: 3 },
};
const RULE_IDS = Object.keys(FLOOR_RULES);

const isEndless = index => index >= LEVEL_ORDER.length;
const depthBelowCore = index => index - LEVEL_ORDER.length + 1;   // floor 13 is 1

// How hard a floor is (the tier of its enemies, see DIFFICULTY).
const floorTier = index => isEndless(index) ? LEVEL_ORDER.length - 1 + depthBelowCore(index) * ENDLESS.tierStep : index;

// A number from 0 to 1 that is always the same for this run, floor and purpose.
const runRandom = (index, salt) => hash(run.seed, index * 7 + salt, 911);

// The floor that an endless floor is made from: any of the twelve, but not the same as the one just before it.
function endlessMapId(index) {
  const pick = i => LEVEL_ORDER[Math.floor(runRandom(i, 1) * LEVEL_ORDER.length)];
  let id = pick(index);
  if (isEndless(index - 1) && pick(index - 1) === id) id = LEVEL_ORDER[(LEVEL_ORDER.indexOf(id) + 1 + Math.floor(runRandom(index, 2) * (LEVEL_ORDER.length - 1))) % LEVEL_ORDER.length];
  return id;
}

function endlessRules(index) {
  const count = index + 1 >= ENDLESS.twoRulesFrom ? 2 : 1, rules = [];
  for (let k = 0; rules.length < count && k < 20; k++) {
    const id = RULE_IDS[Math.floor(runRandom(index, 10 + k) * RULE_IDS.length)];
    if (!rules.includes(id)) rules.push(id);
  }
  return rules;
}

// The elite trait of the boss of an endless floor.
const endlessBossTrait = index => Object.keys(ELITES)[Math.floor(runRandom(index, 30) * Object.keys(ELITES).length)];

// ---------- The rules at work ----------

// While a floor is being built its rules are in BUILD_RULES; while it is played they are on world.level.rules.
let BUILD_RULES = null;
const activeRules = () => BUILD_RULES !== null ? BUILD_RULES : (world && world.level && world.level.rules) || [];

function ruleMult(key) {
  let m = 1;
  for (const id of activeRules()) if (FLOOR_RULES[id][key] !== undefined && typeof FLOOR_RULES[id][key] === 'number') m *= FLOOR_RULES[id][key];
  return m;
}
function ruleSum(key) {
  let s = 0;
  for (const id of activeRules()) if (typeof FLOOR_RULES[id][key] === 'number') s += FLOOR_RULES[id][key];
  return s;
}
const ruleOn = key => activeRules().some(id => !!FLOOR_RULES[id][key]);
function ruleStat(name) {
  let s = 0;
  for (const id of activeRules()) { const st = FLOOR_RULES[id].stats; if (st && st[name]) s += st[name]; }
  return s;
}

// An elite boss: the trait of an elite (see makeElite), but only part of the extra life, since a boss has a lot already.
function makeBossElite(f, trait) {
  const base = f.maxLife;
  makeElite(f, trait);
  f.life = f.maxLife = Math.ceil(base * (1 + (ELITES[trait].life - 1) * 0.3));
  f.eliteName = ENEMIES[f.type].name + ' (' + ELITES[trait].name + ')';
}

// The boss of an endless floor: tougher the deeper you go, with a trait, and bodyguards if the floor rule says so.
function endlessBoss(boss) {
  const index = world.levelIndex;
  boss.life = boss.maxLife = Math.ceil(boss.maxLife * (1 + ENDLESS.bossLife * depthBelowCore(index)));
  makeBossElite(boss, endlessBossTrait(index));
}

function bossGuards(boss) {
  const n = Math.round(ruleSum('bossGuards'));
  if (!n) return;
  const types = Object.keys(world.totals.killType).filter(t => !ENEMIES[t].boss);
  for (let i = 0; i < n && types.length; i++) {
    const type = types[i % types.length], spot = freeSpotNear(boss.x, boss.y, type, 16, 32);
    const f = createEnemy(type, spot.x, spot.y, floorTier(world.levelIndex));
    makeElite(f, Object.keys(ELITES)[i % Object.keys(ELITES).length]);
    f.chasing = true;
    world.enemies.push(f);
    puff(spot.x, spot.y);
  }
}

// The rules of the floor, top left, while playing below the Core.
function drawRulesHud() {
  const rules = world.level.rules || [];
  if (!rules.length || world.helpAlpha > 0) return;
  rules.forEach((id, i) => {
    const text = FLOOR_RULES[id].name, w = textWidth(text) + 10;
    ctx.fillStyle = 'rgba(24,20,37,0.85)';
    ctx.fillRect(4, 4 + i * 15, w, 13);
    border(4, 4 + i * 15, w, 13, COLOR.m);
    drawText(text, 9, 8 + i * 15, COLOR.m);
  });
}
