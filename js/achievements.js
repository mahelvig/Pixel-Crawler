"use strict";

// ---------- Achievements ----------
// The dungeon keeps score, and it has opinions. An achievement is unlocked once (it is saved between runs, see progress.js),
// gives a short message and a reward in the game, and gets a longer text on the achievements page of the title screen.
// name is the title, hint says what to do, popup is the short message in the game, story is the long text (only shown once
// unlocked), reward is { gold } or { box: 'bronze' | 'silver' | 'gold' | 'platinum' } (a weapon or a piece of clothing of
// that rarity, see BOX_TIERS) or { heal: true } or { ammo: true }, and test says when it is done.
// secret ones hide their name and hint until they are unlocked. test gets { s: saved.stats, r: run, pl: player, w: world }.

const BOX_TIERS = {
  bronze:   { name: 'Bronze Box',   rarity: 'common' },
  silver:   { name: 'Silver Box',   rarity: 'rare' },
  gold:     { name: 'Gold Box',     rarity: 'epic' },
  platinum: { name: 'Platinum Box', rarity: 'legendary' },
};

const BOSS_TYPES = Object.keys(ENEMIES).filter(id => ENEMIES[id].boss);
const killsOf = (s, type) => (s.killsBy[type] || 0);
const wornCount = pl => { let n = 0; for (let i = 0; i < GEAR_SLOTS.length; i++) if (pl.slots[BAG.equipStart + i]) n++; return n; };
const wornRarity = (pl, rarity) => { for (let i = 0; i < GEAR_SLOTS.length; i++) { const g = GEAR[pl.slots[BAG.equipStart + i]]; if (g && g.rarity === rarity) return true; } return false; };

const ACHIEVEMENTS = [
  // ---- killing things ----
  { id: 'firstBlood', name: 'First Blood', hint: 'Kill an enemy.', reward: { gold: 10 }, test: A => A.s.kills >= 1,
    popup: 'You killed something. Somebody at home is cheering.',
    story: 'Congratulations, crawler. You have ended a life that was perfectly content a moment ago. The viewers watched it happen, and a few of them stood up. Do not get used to the feeling. Actually, do. It is good for ratings.' },
  { id: 'pestControl', name: 'Pest Control', hint: 'Kill 25 rats.', reward: { gold: 25 }, test: A => killsOf(A.s, 'rat') >= 25,
    popup: '25 rats. The building manager sends his thanks.',
    story: 'Twenty-five rats, dead. Their families have been notified by a very small, very rude letter. The building has been told there is "nothing to worry about". There is always something to worry about.' },
  { id: 'gobSmacked', name: 'Gob Smacked', hint: 'Kill 30 goblins.', reward: { gold: 30 }, test: A => killsOf(A.s, 'goblin') >= 30,
    popup: '30 goblins. They really did not see that coming.',
    story: 'Thirty goblins have learned that being green is not a defence. The survivors have formed a support group. You are not invited. You are the topic.' },
  { id: 'batOutOfHell', name: 'Bat Out of Hell', hint: 'Kill 20 bats.', reward: { gold: 30 }, test: A => killsOf(A.s, 'bat') >= 20,
    popup: '20 bats. Erratic, annoying, and now deceased.',
    story: 'Bats are difficult to hit, which is why the audience gave you a small round of applause for twenty of them. The applause was sarcastic. The bats were real.' },
  { id: 'slimeTime', name: 'Slime Time', hint: 'Kill 25 slimes.', reward: { gold: 30 }, test: A => killsOf(A.s, 'slime') >= 25,
    popup: '25 slimes. You are going to need a mop.',
    story: 'Every slime you kill becomes several smaller slimes, and you have killed twenty-five of the big ones. The mathematics of this are somebody else\'s problem. The cleaning bill is yours.' },
  { id: 'exorcist', name: 'Exorcist', hint: 'Kill 15 ghosts.', reward: { gold: 35 }, test: A => killsOf(A.s, 'ghost') >= 15,
    popup: '15 ghosts. Dead twice. Impressive.',
    story: 'You have killed fifteen things that were already dead. The paperwork is a nightmare. A department has been created just to handle your case. It has one employee and he is crying.' },
  { id: 'bombSquad', name: 'Bomb Squad', hint: 'Kill 15 bombers.', reward: { gold: 35 }, test: A => killsOf(A.s, 'bomber') >= 15,
    popup: '15 bombers. Still got all your fingers? Good.',
    story: 'Fifteen walking bombs, and you are still in one piece. Either you are very careful or very lucky. The audience has money on lucky.' },
  { id: 'tinOpener', name: 'Tin Opener', hint: 'Kill 15 knights.', reward: { gold: 40 }, test: A => killsOf(A.s, 'knight') >= 15,
    popup: '15 knights. Shields are just fancy tin lids.',
    story: 'Fifteen knights, opened like cans. They were told the shield would protect them. They were told many things. Nobody asked you to feel bad about it, and so far you have not.' },
  { id: 'giantSlayer', name: 'Giant Slayer', hint: 'Kill 8 ogres.', reward: { box: 'silver' }, test: A => killsOf(A.s, 'ogre') >= 8,
    popup: '8 ogres. They were big. You were bigger. Marginally.',
    story: 'Eight ogres, each the size of a wardrobe and with the manners of a wet sock. You took them all down. The dungeon is sending you a small box and a lot of passive-aggressive feelings.' },
  { id: 'exterminator', name: 'Exterminator', hint: 'Kill 100 enemies in total.', reward: { gold: 40 }, test: A => A.s.kills >= 100,
    popup: '100 kills. The viewers are getting attached.',
    story: 'One hundred kills. The number is on a banner somewhere. The banner is on fire, which was not planned, but the audience seems to like it.' },
  { id: 'bodyCount', name: 'Body Count', hint: 'Kill 500 enemies in total.', reward: { box: 'silver' }, test: A => A.s.kills >= 500,
    popup: '500 kills. That is a lot of paperwork.',
    story: 'Five hundred. The dungeon has run out of ways to describe you, so it has started to make some up. "Efficient" was the nicest one. Please accept this box and stop looking at the other words.' },
  { id: 'massExtinction', name: 'Mass Extinction', hint: 'Kill 2000 enemies in total.', reward: { box: 'gold' }, test: A => A.s.kills >= 2000,
    popup: '2000 kills. Several species are filing complaints.',
    story: 'Two thousand creatures have met you and then stopped existing. Scientists would like to study you. The dungeon would like to keep you. The audience would like a sequel.' },
  { id: 'rampage', name: 'Rampage', hint: 'Kill 5 enemies within 3 seconds.', reward: { gold: 30 }, test: A => A.r.bestCombo >= 5,
    popup: 'Five in three seconds. Somebody call a doctor. For them.',
    story: 'Five kills in the time it takes to say "oh no". The audience has gone quiet in that special way that means they are very, very excited. A woman in section C has fainted.' },
  { id: 'massacre', name: 'Massacre', hint: 'Kill 10 enemies within 5 seconds.', reward: { box: 'silver' }, test: A => A.r.bestCombo10 >= 10,
    popup: 'Ten in five seconds. That was not a fight. That was weather.',
    story: 'You did not fight them. You happened to them. The cleaning crew have been told to bring more buckets and a bigger van, and to stop making eye contact.' },

  { id: 'wantedDead', name: 'Wanted: Dead or Alive', hint: 'Kill 20 bandits.', reward: { gold: 40 }, test: A => killsOf(A.s, 'bandit') >= 20,
    popup: '20 bandits. The reward poster has a new price.',
    story: 'Twenty bandits, all of them wanted for something. You have collected a small bounty and an enormous grudge. The sheriff sends a thank-you note, signed in what looks like gravy.' },
  { id: 'cheatingCheaters', name: 'Cheating Cheaters', hint: 'Kill 12 card sharks.', reward: { gold: 40 }, test: A => killsOf(A.s, 'cardShark') >= 12,
    popup: '12 card sharks. They were holding aces. Of course.',
    story: 'Twelve card sharks, and every one of them had an ace up their sleeve. Some had four. The house is embarrassed. The house is, however, reshuffling.' },
  { id: 'bacon', name: 'Bring Home the Bacon', hint: 'Kill 12 boars.', reward: { gold: 40 }, test: A => killsOf(A.s, 'boar') >= 12,
    popup: '12 boars. Dinner is sorted.',
    story: 'Twelve boars, all dead, all unreasonably angry about it. Not one of them saw you coming, and several saw you going. The dungeon would like to remind you that you cannot actually eat them.' },
  { id: 'lastWolf', name: 'Wolf Whistle', hint: 'Kill 25 wolves.', reward: { box: 'silver' }, test: A => killsOf(A.s, 'wolf') >= 25,
    popup: '25 wolves. The pack has a new leader. It is you. Do not howl.',
    story: 'Twenty-five wolves. The forest has gone quiet and the moon has stopped looking at you. Somewhere, a smaller wolf is learning to howl a lot more carefully.' },
  { id: 'anteater', name: 'Anteater', hint: 'Kill 60 ants.', reward: { gold: 45 }, test: A => killsOf(A.s, 'ant') >= 60,
    popup: '60 ants. There are always more ants.',
    story: 'Sixty ants, and the colony did not even notice. There are millions. The queen has begun to refer to you as "the incident". It is the nicest thing anyone here has called you.' },

  // ---- bosses and floors ----
  { id: 'bossSlayer', name: 'Eviction Notice', hint: 'Defeat a boss.', reward: { gold: 50 }, test: A => Object.keys(A.s.bossTypes).length >= 1,
    popup: 'A boss, dead. The building has a vacancy.',
    story: 'Somebody important lived there. Now nobody does. The dungeon would like to remind you that bosses have feelings, and also that it does not care. Enjoy your staircase.' },
  { id: 'regicide', name: 'Regicide', hint: 'Defeat every boss.', reward: { box: 'gold' }, test: A => Object.keys(A.s.bossTypes).length >= BOSS_TYPES.length,
    popup: 'Every boss, dead. The dungeon is running out of staff.',
    story: 'All of them. The Landlord, the Rat King, the Janitor, the Bone Collector, the Host, the Dealer, the Beastmaster and the Ant Queen. HR has called an emergency meeting. You are not allowed in the building anymore. You are, unfortunately, already in the building.' },
  { id: 'floor2', name: 'Going Down', hint: 'Reach floor 2.', reward: { gold: 15 }, test: A => A.w.levelIndex >= 1,
    popup: 'Floor 2. Mind the stairs. And everything else.',
    story: 'Down you go. The dungeon has noted that you can use stairs, which puts you ahead of most contestants. The next floor has been made slightly worse as a reward.' },
  { id: 'floor3', name: 'Deeper', hint: 'Reach floor 3.', reward: { gold: 30 }, test: A => A.w.levelIndex >= 2,
    popup: 'Floor 3. The smell is getting worse. That is normal.',
    story: 'Three floors down, and the air has started to taste of old pennies and regret. The viewers have placed bets. The odds on your survival were not shown to you, for your own good.' },
  { id: 'floor5', name: 'Rock Bottom', hint: 'Reach floor 5.', reward: { box: 'silver' }, test: A => A.w.levelIndex >= 4,
    popup: 'Floor 5. You have found the bottom. There is more bottom.',
    story: 'Five floors down. Nothing below it, supposedly. The dungeon is saying "supposedly" with a very particular smile. Do not look for a manager. There is no manager.' },
  { id: 'floor6', name: 'High Roller', hint: 'Reach floor 6.', reward: { gold: 50 }, test: A => A.w.levelIndex >= 5,
    popup: 'Floor 6. The house always wins. Try anyway.',
    story: 'A saloon, a casino and a lot of people with revolvers, all in one room. The dungeon has dealt you in. The dungeon has also marked the cards. Please keep smiling, the cameras love a gambler.' },
  { id: 'floor7', name: 'Open Season', hint: 'Reach floor 7.', reward: { box: 'silver' }, test: A => A.w.levelIndex >= 6,
    popup: 'Floor 7. Grass, trees, and things that want you dead.',
    story: 'A forest, somehow, underground. The sky is painted on and the wolves are very much not. Somebody is hunting here. You have been told that it is you. You have also been told that the hunters are, in turn, being hunted. By something worse.' },
  { id: 'floor8', name: 'Hive Mind', hint: 'Reach floor 8.', reward: { box: 'gold' }, test: A => A.w.levelIndex >= 7,
    popup: 'Floor 8. The ground is moving. That is ants.',
    story: 'A scorched desert of tunnels and a queen who has never once heard the word no. The ants are organised, loyal and extremely hungry. You are, for them, a very large and very walkable picnic.' },
  { id: 'employee', name: 'Employee of the Month', hint: 'Finish all objectives on a floor.', reward: { gold: 25 }, test: A => A.w.gateOpen,
    popup: 'All objectives done. A gold star has been glued to your forehead.',
    story: 'You did everything you were told, which is rare and slightly suspicious. A certificate has been printed. It is blank, because the dungeon does not do praise, but the paper is nice.' },
  { id: 'untouchable', name: 'Untouchable', hint: 'Defeat a boss without being hit on that floor.', reward: { box: 'silver' }, test: A => A.r.flawlessBoss,
    popup: 'Not a scratch. Show-off.',
    story: 'An entire floor, a boss, and not one hit. The dungeon checked the records three times and then, quietly, had somebody fired. The audience is chanting your name. They have mispronounced it.' },
  { id: 'clutch', name: 'By a Hair', hint: 'Defeat a boss with only one heart left.', reward: { box: 'bronze' }, test: A => A.r.clutchBoss,
    popup: 'One heart. One boss. One very loud audience.',
    story: 'You won with a single heart left. The viewers screamed. The producers cried. The medical team looked at their watches and said "not yet".' },
  { id: 'speedrun', name: 'In a Hurry', hint: 'Defeat a boss within 2 minutes of entering the floor.', reward: { box: 'silver' }, test: A => A.r.fastBoss,
    popup: 'Under two minutes. Were you late for something?',
    story: 'You went in, you killed the boss, and you were out before the tea was ready. The dungeon is slightly offended. It had planned a whole speech.' },
  { id: 'seasonFinale', name: 'Season Finale', hint: 'Finish the game.', reward: { box: 'platinum' }, test: A => A.s.wins >= 1,
    popup: 'You cleared the dungeon. The viewers want more.',
    story: 'You walked out. A real, actual victory. The dungeon has applauded, once, with exactly one hand. A new season has been ordered. You have been informed that you are in it.' },

  { id: 'firstSponsor', name: 'Fan Favourite', hint: 'Get a box from your sponsors.', reward: { gold: 20 }, test: A => A.s.boxes >= 1,
    popup: 'Your first sponsor box. Somebody out there likes you.',
    story: 'The viewers loved something you did, and a sponsor sent a box to prove it. The sponsor is a company that sells soap made of regret. Please send them a thank-you note. Please do not open the note.' },
  { id: 'crowdPleaser', name: 'Crowd Pleaser', hint: 'Get 15 boxes from your sponsors.', reward: { box: 'silver' }, test: A => A.s.boxes >= 15,
    popup: '15 sponsor boxes. The ratings are through the roof.',
    story: 'Fifteen boxes, from fifteen separate delighted sponsors, and three who were not delighted but sent one anyway. The viewers have made T-shirts. Your face is on the T-shirts. It is the wrong face, but it is on them.' },
  { id: 'trending', name: 'Trending', hint: 'Get 3 boxes from your sponsors in one run.', reward: { box: 'gold' }, test: A => A.r.boxes >= 3,
    popup: 'Three boxes in one run. You are trending.',
    story: 'Three sponsor boxes in a single run. The dungeon has refreshed the ratings six times, because it assumed it was a mistake. It was not a mistake. You are very good at being watched.' },

  // ---- dying ----
  { id: 'firstDeath', name: 'Rookie Mistake', hint: 'Die for the first time.', reward: { gold: 15 }, test: A => A.s.deaths >= 1,
    popup: 'You died. The viewers are delighted.',
    story: 'Welcome to the club. Most crawlers do this early. Your death has been edited into a highlight reel with sad music and a laugh track. You have been given a participation prize.' },
  { id: 'frequentFlyer', name: 'Frequent Flyer', hint: 'Die 10 times.', reward: { gold: 50 }, test: A => A.s.deaths >= 10,
    popup: 'Ten deaths. You have earned miles.',
    story: 'Ten times you have died, and ten times you have come back for more. The dungeon thinks this is either admirable or a medical problem. The audience thinks it is a sitcom.' },
  { id: 'instantRegret', name: 'Instant Regret', hint: 'Die within 30 seconds of starting.', secret: true, reward: { gold: 20 }, test: A => A.r.quickDeath,
    popup: 'Thirty seconds. A new record, in the wrong direction.',
    story: 'Thirty seconds. Not even the tutorial had time to say goodbye. The dungeon has framed this moment and hung it in the lobby, between the fire exit and the sign that says "no exit".' },

  // ---- growing up ----
  { id: 'level5', name: 'Getting the Hang of It', hint: 'Reach level 5 in one run.', reward: { gold: 20 }, test: A => A.pl.level >= 5,
    popup: 'Level 5. You are practically a professional.',
    story: 'Level five. You have started to look like you know what you are doing. Do not worry, nobody has told the enemies.' },
  { id: 'level10', name: 'Veteran Meat', hint: 'Reach level 10 in one run.', reward: { box: 'silver' }, test: A => A.pl.level >= 10,
    popup: 'Level 10. Veteran meat. The best kind.',
    story: 'Level ten. Your build is coming together. The audience is starting to make merchandise. Yours has a nice, slightly confused face on it.' },
  { id: 'level15', name: 'Overqualified', hint: 'Reach level 15 in one run.', reward: { box: 'gold' }, test: A => A.pl.level >= 15,
    popup: 'Level 15. The dungeon is starting to sweat.',
    story: 'Level fifteen. The dungeon has begun to take you personally. Walls are being moved. Doors are being locked. It is almost flattering.' },

  // ---- money and shopping ----
  { id: 'consumer', name: 'Consumer', hint: 'Buy an upgrade in the shop.', reward: { gold: 20 }, test: A => A.s.bought >= 1,
    popup: 'You bought something. The economy thanks you.',
    story: 'You spent real gold on a real improvement. The dungeon takes a cut, naturally. The cut is "all of it". Please enjoy the feeling of owning something nice.' },
  { id: 'bigSpender', name: 'Big Spender', hint: 'Buy 10 upgrades in the shop.', reward: { gold: 60 }, test: A => A.s.bought >= 10,
    popup: 'Ten upgrades. You are single-handedly keeping the shop alive.',
    story: 'Ten purchases. The shopkeeper has bought a boat. The boat has a name, and the name is your name. You will never see the boat.' },
  { id: 'hoarder', name: 'Dragon Mode', hint: 'Hold 500 gold at the same time.', reward: { box: 'bronze' }, test: A => saved.gold >= 500,
    popup: '500 gold. You are sitting on it, aren\'t you.',
    story: 'Five hundred gold in one pile. You have started to like it. You have started to guard it. Please stop sleeping on it, we have seen the cameras.' },

  // ---- gear and weapons ----
  { id: 'dressedToKill', name: 'Dressed to Kill', hint: 'Wear something in all six places at once.', reward: { box: 'silver' }, test: A => wornCount(A.pl) >= 6,
    popup: 'Fully dressed. The audience is very relieved.',
    story: 'A hat, a coat, shoes, two rings and an amulet. It is not a good look, but it is a look. The dungeon has awarded you a small trophy for "coordination" and a larger one for "brave".' },
  { id: 'purpleReign', name: 'Purple Reign', hint: 'Wear an epic piece of clothing.', reward: { gold: 40 }, test: A => wornRarity(A.pl, 'epic'),
    popup: 'Epic gear. Purple suits you.',
    story: 'Something with a purple glow, and it is yours. Stand up straight. Let the audience see it. They love a good accessory almost as much as a good funeral.' },
  { id: 'goldenBoy', name: 'Golden Boy', hint: 'Wear a legendary piece of clothing.', reward: { gold: 80 }, test: A => wornRarity(A.pl, 'legendary'),
    popup: 'Legendary gear. Try not to get it dirty.',
    story: 'A legendary thing, worn by you. It has a history. The history has a body count. You have just joined the history and the body count.' },
  { id: 'tailored', name: 'Tailor-made', hint: 'Upgrade a piece of clothing to the top level by finding spares.', reward: { box: 'silver' }, test: A => Object.values(A.pl.gearLevel).some(l => l >= GEAR_UPGRADE.maxLevel),
    popup: 'Maxed out. Just look at the stitching.',
    story: 'You found the same item four more times and sewed them together, which is not how it works, but the dungeon allows it. The result is magnificent and smells of mothballs.' },
  { id: 'armedToTheTeeth', name: 'Armed to the Teeth', hint: 'Carry four weapons on the hotbar.', reward: { ammo: true }, test: A => A.pl.slots.slice(0, BAG.hotbarSlots).every(Boolean),
    popup: 'Four weapons. Overkill is underrated.',
    story: 'One in each slot, and each one loaded with bad intentions. The dungeon is refilling your ammo as a thank you. And as a threat.' },
  { id: 'pawnStar', name: 'Pawn Star', hint: 'Have 5 spare items sold automatically.', reward: { gold: 40 }, test: A => A.s.sold >= 5,
    popup: 'Five items sold. You are a natural at this.',
    story: 'Bag full, ammo full, clothes maxed. You never even slowed down to count it. Five little sales, five little handshakes, a very tidy profit. The dungeon takes a small fee, which it also keeps.' },
  { id: 'sharpshooter', name: 'Sharpshooter', hint: 'Land 25 critical hits.', reward: { gold: 35 }, test: A => A.s.crits >= 25,
    popup: '25 crits. Do you aim, or just get lucky?',
    story: 'Twenty-five crits. The audience is split. Half say it is skill. The other half say it is luck. The dungeon quietly says it is both and has a lot of money on you.' },
  { id: 'luckyStreak', name: 'Lucky Streak', hint: 'Land 100 critical hits.', reward: { box: 'silver' }, test: A => A.s.crits >= 100,
    popup: '100 crits. The dungeon is checking you for rabbit feet.',
    story: 'One hundred crits. The dungeon has had your pockets searched and found a rabbit foot, a four-leaf clover, a horseshoe and a very worried-looking leprechaun. You are free to go.' },
  { id: 'propertyDamage', name: 'Property Damage', hint: 'Destroy 10 nests, coffins or cameras.', reward: { gold: 35 }, test: A => A.s.destroyed >= 10,
    popup: '10 things smashed. You will be paying for those.',
    story: 'The dungeon has an itemised list. "One nest, slightly damp." "One coffin, formerly occupied." "One camera, in love with you." The bill will be sent to your next of kin.' },
  { id: 'marathon', name: 'Cardio Day', hint: 'Walk a long way in a single run.', reward: { gold: 25 }, test: A => A.r.walked >= 6000,
    popup: 'That is a lot of walking. Your legs have filed a complaint.',
    story: 'You walked and walked and walked. The dungeon has measured it and is surprised. The distance has been recorded in "crawler units", which are not a real unit, but sound serious.' },

  // ---- strange ones ----
  { id: 'loitering', name: 'Loitering', hint: 'Stand perfectly still for 20 seconds.', secret: true, reward: { gold: 5 }, test: A => A.r.still >= 20,
    popup: 'You have been standing there for a while. Is something wrong?',
    story: 'Twenty seconds of nothing. No running, no shooting, no screaming. The dungeon has called your name twice, and then asked if you needed a chair. It left a note on your door that says "please move".' },
  { id: 'sprayAndPray', name: 'Spray and Pray', hint: 'Run completely out of ammo.', secret: true, reward: { ammo: true }, test: A => A.r.empty,
    popup: 'Click. Click. Click. The dungeon laughs. Here, have some ammo.',
    story: 'Empty. Not a single bullet. You stood there and pulled the trigger and nothing came out, which the audience found hilarious. The dungeon has refilled your pockets, out of pity, and wants it known that it did so reluctantly.' },
];

const ACHIEVEMENT_BY_ID = {};

// ---------- Weapon mastery ----------
// Kill enough enemies with a weapon and you may start your runs with it, with endless ammo (but at STARTER_POWER).
const MASTERY_KILLS = { common: 100, rare: 150, epic: 200, legendary: 250 };
const MASTERY = {
  nailGun: ['Nailed It', 'Hardware store, battlefield. Same thing, really.'],
  potatoCannon: ['Hot Potato', 'You have fired a vegetable at a living creature, and it worked. The dungeon respects the audacity.'],
  shotgun: ['Boomstick', 'Close range, loud noise, brilliant results. Please do not ask the shotgun how it feels about this.'],
  lightningGun: ['Static Shock', 'You have been zapping things so long that your hair stands up by itself. The audience has noticed.'],
  slingshot: ['Little David', 'Armed with a rubber band and a rock. The dungeon has been told how this story ends and is not happy about it.'],
  crossbow: ['Bolt Action', 'One shot at a time, and every one of them meant it. The wall behind the target is full of holes.'],
  flamethrower: ['Pyromaniac', 'You are, by now, mostly smoke and happiness. The fire department sends its regards and a restraining order.'],
  minigun: ['Brrrrrt', 'Not a sound, a lifestyle. The dungeon has had to hire extra staff just to sweep up the brass.'],
  rocketLauncher: ['Rocket Man', 'Why use a key when you can use a rocket? The walls are filing a formal complaint, in triplicate.'],
  baseballBat: ['Home Run', 'The bat has a name now. The enemies have also given it a name. It is not the same one.'],
  revolver: ['Six Shooter', 'Six bullets, six problems solved. You have been told that reloading is a lot of work. You have been told it twice.'],
  sniperRifle: ['One Shot', 'Patient, precise and slightly smug. The viewers love a clean kill, and so do you.'],
  grenadeLauncher: ['Pineapple Express', 'It is not a weapon, it is a conversation starter. The conversation is mostly shouting, then a boom.'],
  freezeRay: ['Cold Shoulder', 'You have turned a lot of things into slow, angry ice sculptures. The dungeon calls it art. The sculptures disagree.'],
  ricochetPistol: ['Bank Shot', 'You never aim at the enemy, you aim at the wall behind the enemy. Geometry is on your side. Barely.'],
};
for (const id of Object.keys(WEAPONS)) {
  const w = WEAPONS[id];
  if (w.infinite) continue;
  const need = MASTERY_KILLS[w.rarity], [name, story] = MASTERY[id] || [w.name + ' Master', 'You have killed a great many things with this. The dungeon has run out of jokes.'];
  ACHIEVEMENTS.push({
    id: 'master_' + id, name, hint: 'Kill ' + need + ' enemies with the ' + w.name + '.', reward: { starter: id }, test: A => (A.s.killsByWeapon[id] || 0) >= need,
    popup: need + ' kills with the ' + w.name + '. It is yours to start with now. Endless ammo, weaker, but yours.',
    story: story + ' You can now start every run with the ' + w.name + ', with endless ammo, at ' + Math.round(STARTER_POWER * 100) + '% power. Pick it on the title screen.',
  });
}
for (const a of ACHIEVEMENTS) ACHIEVEMENT_BY_ID[a.id] = a;

// the weapon the next run starts with: the one chosen on the title screen, if it has been unlocked
const starterUnlocked = id => id === PLAYER.startWeapon || (!!WEAPONS[id] && !!saved.ach['master_' + id]);
const chosenStartWeapon = () => starterUnlocked(saved.startWeapon) ? saved.startWeapon : PLAYER.startWeapon;
const unlockedStarters = () => Object.keys(WEAPONS).filter(starterUnlocked).sort((a, b) => (a === PLAYER.startWeapon ? -1 : 0) - (b === PLAYER.startWeapon ? -1 : 0));

// ---------- Counting what happens ----------
// Totals that last for ever live in saved.stats (see progress.js), what happens during one run in run.

const STAT_NAMES = ['kills', 'deaths', 'wins', 'bought', 'sold', 'crits', 'destroyed', 'shots', 'damageTaken', 'goldEarned', 'walked', 'playTime', 'levels', 'boxes'];
const emptyStats = () => ({ kills: 0, deaths: 0, wins: 0, bought: 0, sold: 0, crits: 0, destroyed: 0, shots: 0, damageTaken: 0, goldEarned: 0, walked: 0, playTime: 0, levels: 0, boxes: 0,
  killsBy: {}, bossTypes: {}, killsByWeapon: {}, deathsBy: {} });

let run = null;

function resetRun() {
  run = { time: 0, floorTime: 0, floorHits: 0, kills: [], bestCombo: 0, bestCombo10: 0, still: 0, walked: 0, lastWalked: 0, lastWorld: null, check: 0,
    flawlessBoss: false, clutchBoss: false, fastBoss: false, empty: false, quickDeath: false, boxes: 0, viewersHint: false };
}
resetRun();

// a new floor
function floorStarted() {
  run.floorTime = 0;
  run.floorHits = 0;
}

// something happened: add it to the totals and see if that finishes an achievement
function track(event, data) {
  const s = saved.stats;
  viewerReaction(event);
  switch (event) {
    case 'kill': {
      s.kills++;
      s.killsBy[data.type] = (s.killsBy[data.type] || 0) + 1;
      break;
    }
    case 'killAny': {
      // any enemy, also the ones called by nests and bosses: for killing several in a row
      run.kills.push(time);
      run.kills = run.kills.filter(t => time - t <= 5);
      run.bestCombo = Math.max(run.bestCombo, run.kills.filter(t => time - t <= 3).length);
      run.bestCombo10 = Math.max(run.bestCombo10, run.kills.length);
      const combo = run.kills.filter(t => time - t <= 3).length;
      addViewers(VIEWERS.kill + Math.min(combo - 1, VIEWERS.comboCap) * VIEWERS.comboBonus);
      return;
    }
    case 'weaponKill': s.killsByWeapon[data.lastWeapon] = (s.killsByWeapon[data.lastWeapon] || 0) + 1; break;
    case 'shot': s.shots++; return;
    case 'boss': {
      s.bossTypes[data.type] = (s.bossTypes[data.type] || 0) + 1;
      if (run.floorHits === 0) run.flawlessBoss = true;
      if (world.player.life <= 1) run.clutchBoss = true;
      if (run.floorTime <= 120) run.fastBoss = true;
      addViewers(VIEWERS.boss + (run.floorHits === 0 ? VIEWERS.flawless : 0));
      break;
    }
    case 'hurt': run.floorHits++; run.still = 0; s.damageTaken += data; return;
    case 'crit': s.crits++; break;
    case 'bought': s.bought++; break;
    case 'sold': s.sold++; break;
    case 'box': s.boxes++; break;
    case 'objective': case 'target': return;
    case 'destroyed': s.destroyed++; break;
    case 'empty': run.empty = true; break;
    case 'dead': s.deaths++; { const by = world.lastHitBy || 'hazard'; s.deathsBy[by] = (s.deathsBy[by] || 0) + 1; } if (run.time < 30) run.quickDeath = true; break;
    case 'won': s.wins++; break;
  }
  saveDirty = true;
  checkAchievements();
}

// every frame while playing
function updateAchievements(dt) {
  const pl = world.player;
  run.time += dt;
  run.floorTime += dt;
  if (run.lastWorld !== world) { run.lastWorld = world; run.lastWalked = 0; }
  const stepped = Math.max(0, world.walkedDistance - run.lastWalked);
  run.walked += stepped;
  saved.stats.walked += stepped;
  saved.stats.playTime += dt;
  run.lastWalked = world.walkedDistance;
  run.still = Math.hypot(pl.vx, pl.vy) < 1 && !(mouse.down || touchFiring()) ? run.still + dt : 0;
  if ((run.check -= dt) <= 0) { run.check = 0.25; checkAchievements(); }
}

// ---------- Unlocking ----------

function achievementArgs() { return { s: saved.stats, r: run, pl: world.player, w: world }; }

function checkAchievements() {
  if (dev.on || !world || (state !== 'playing' && state !== 'dead' && state !== 'won')) return;
  const args = achievementArgs();
  for (const a of ACHIEVEMENTS) {
    if (!saved.ach[a.id] && a.test(args)) unlockAchievement(a);
  }
}

function rewardText(r) {
  if (r.gold) return r.gold + ' gold';
  if (r.box) return 'a ' + BOX_TIERS[r.box].name;
  if (r.starter) return 'start with the ' + WEAPONS[r.starter].name;
  if (r.heal) return 'a full heal';
  return 'a lot of ammo';
}

function weaponOfRarity(rarity) {
  const list = Object.keys(WEAPONS).filter(id => !WEAPONS[id].infinite && WEAPONS[id].rarity === rarity);
  return list.length ? list[Math.floor(Math.random() * list.length)] : randomWeapon();
}

// A box is a weapon or a piece of clothing of the right rarity; it lands at the player's feet.
function dropBox(tier) {
  const pl = world.player, rarity = BOX_TIERS[tier].rarity, type = Math.random() < 0.5 ? randomGear(rarity) : weaponOfRarity(rarity);
  world.items.push(createItem(type, pl.x, pl.y + 6, true));
}

function unlockAchievement(a) {
  const pl = world.player, r = a.reward;
  saved.ach[a.id] = 1;
  saveGame();
  if (r.gold) awardGold(r.gold, true);
  else if (r.box) {
    if (state === 'playing') {
      dropBox(r.box);
    } else {
      awardGold(60, true);   // the run is over, so a box would be lost
    }
  } else if (r.heal) PERK_EFFECTS.heal(pl);
  else if (r.starter) { /* nothing to hand over: the weapon can now be picked on the title screen */ }
  else if (r.ammo) PERK_EFFECTS.ammo(pl);
  sfx('levelup');
  systemMessage('Achievement: ' + a.name + '! ' + a.popup + ' Reward: ' + rewardText(r) + '.', 6);
}

// ---------- The achievements page ----------

const ACH_PAGE = 10;
const ach = { page: 0, selected: 0 };

const achievementCount = () => ACHIEVEMENTS.filter(a => saved.ach[a.id]).length;
const achRow = i => ({ x: 10, y: 30 + i * 12, w: 120, h: 11 });
const achBackButton = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });
const achPrevButton = () => ({ x: 10, y: 154, w: 36, h: 15 });
const achNextButton = () => ({ x: 94, y: 154, w: 36, h: 15 });
const achPages = () => Math.ceil(ACHIEVEMENTS.length / ACH_PAGE);

function openAchievements() {
  state = 'achievements';
  ach.page = 0;
  ach.selected = 0;
  sfx('uiClick');
}

function closeAchievements() {
  state = 'title';
  sfx('uiClick');
}

function achPage(delta) {
  ach.page = (ach.page + delta + achPages()) % achPages();
  ach.selected = ach.page * ACH_PAGE;
  sfx('uiClick');
}

function achMove(delta) {
  ach.selected = Math.max(0, Math.min(ACHIEVEMENTS.length - 1, ach.selected + delta));
  ach.page = Math.floor(ach.selected / ACH_PAGE);
}

const inBox = (b, pad = 0) => mouse.inside && mouse.x >= b.x - pad && mouse.x < b.x + b.w + pad && mouse.y >= b.y - pad && mouse.y < b.y + b.h + pad;

function achRowUnderMouse() {
  for (let i = 0; i < ACH_PAGE; i++) {
    if (ach.page * ACH_PAGE + i < ACHIEVEMENTS.length && inBox(achRow(i), 1)) return ach.page * ACH_PAGE + i;
  }
  return -1;
}

function clickAchievements() {
  if (inBox(achBackButton(), 2)) { closeAchievements(); return; }
  if (inBox(achPrevButton(), 2)) { achPage(-1); return; }
  if (inBox(achNextButton(), 2)) { achPage(1); return; }
  const i = achRowUnderMouse();
  if (i >= 0) { ach.selected = i; sfx('uiClick'); }
}

// The button on the title screen that opens the page.
function achButton(y) { return titleButtons(y)[1]; }

function overAchButton(y) { return state === 'title' && inBox(achButton(y)); }

function drawAchButton(y) {
  const b = achButton(y), hover = overAchButton(y);
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  border(b.x, b.y, b.w, b.h, hover ? COLOR.W : COLOR.O);
  drawText(T('Achievements (A)', 'Achievements'), b.x + b.w / 2, b.y + 4, hover ? COLOR.W : COLOR.O, { align: 'center' });
}

function drawButton(b, label, hover) {
  ctx.fillStyle = 'rgba(24,20,37,0.85)';
  ctx.fillRect(b.x, b.y, b.w, b.h);
  border(b.x, b.y, b.w, b.h, hover ? COLOR.W : COLOR.O);
  drawText(label, b.x + b.w / 2, b.y + b.h / 2 - 3, hover ? COLOR.W : COLOR.O, { align: 'center' });
}

function drawAchievements() {
  dim(0.92);
  drawText('Achievements', 10, 8, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawText(achievementCount() + ' / ' + ACHIEVEMENTS.length, 164, 12, COLOR.S);
  drawButton(achBackButton(), 'Back', inBox(achBackButton()));
  const over = achRowUnderMouse();
  for (let i = 0; i < ACH_PAGE; i++) {
    const n = ach.page * ACH_PAGE + i;
    if (n >= ACHIEVEMENTS.length) break;
    const a = ACHIEVEMENTS[n], r = achRow(i), done = !!saved.ach[a.id];
    if (n === ach.selected) { ctx.fillStyle = 'rgba(58,68,102,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    else if (n === over) { ctx.fillStyle = 'rgba(38,43,68,0.9)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    border(r.x + 2, r.y + 2, 7, 7, done ? COLOR.l : COLOR.D);
    if (done) { ctx.fillStyle = COLOR.l; ctx.fillRect(r.x + 4, r.y + 4, 3, 3); }
    drawText(done || !a.secret ? a.name : '???', r.x + 14, r.y + 2, done ? COLOR.W : COLOR.g);
  }
  drawButton(achPrevButton(), '<', inBox(achPrevButton()));
  drawButton(achNextButton(), '>', inBox(achNextButton()));
  drawText((ach.page + 1) + ' / ' + achPages(), 70, 158, COLOR.S, { align: 'center' });

  // the selected achievement: what it is, how it ends, and what it gives
  const a = ACHIEVEMENTS[ach.selected], done = !!saved.ach[a.id], x = 144, w = BASE_W - x - 8;
  ctx.fillStyle = 'rgba(38,43,68,0.6)';
  ctx.fillRect(x - 4, 28, w + 8, 140);
  border(x - 4, 28, w + 8, 140, done ? COLOR.l : COLOR.D);
  let y = 34;
  const secret = a.secret && !done;
  wrapLines(secret ? '???' : a.name, w).forEach(l => { drawText(l, x + 2, y, COLOR.W, { scale: 1 }); y += 9; });
  drawText(done ? 'Unlocked' : 'Locked', x + 2, y, done ? COLOR.l : COLOR.r);
  y += 11;
  wrapLines(secret ? 'A secret. Keep crawling.' : a.hint, w).forEach(l => { drawText(l, x + 2, y, COLOR.S); y += 8; });
  y += 4;
  if (done) wrapLines(a.story, w).forEach(l => { drawText(l, x + 2, y, COLOR.a); y += 8; });
  else drawText('The dungeon is not telling.', x + 2, y, COLOR.D);
  drawText('Reward: ' + (secret ? '???' : rewardText(a.reward)), x + 2, 158, done ? COLOR.g : COLOR.y);
}
