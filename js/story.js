"use strict";

// ---------- The story ----------
// Harrow Court, an apartment block of twelve floors, was going to be torn down. Its management system, HOME, sank it twelve floors into
// a dungeon instead and turned it into a show, Pixel Crawler, with you, Tenant 4B, as the contestant. Every floor of the dungeon is a copy
// of a part of the building. When you beat the Core, HOME offers the finale: the building rises, everybody forgets, and the next season
// begins (harder, which is why every win makes the dungeon tougher). It has happened thirty-six times. Morris, the night porter, remembers
// all of them, because his old master key is older than HOME: it is also the only key that opens the sponsors' boxes. Refusing the finale
// takes you off script, below the Core, where HOME has to make the floors up as you go (see endless.js).
//
// The story is told by HOME when you arrive on a floor, by Morris the first time you trade with him on a floor, by the bosses (when the
// gate opens and when they die), and by HOME's own tapes: one is hidden on each floor until you have found it. The first time a part of
// the story comes up it is shown in a box that stops the game; after that only a short message. Everything that has been seen can be read
// again in the journal on the title screen (saved.story).

const STORY_SETTINGS = { popups: true };   // off in the tests

// {season} is the season of this run and {next} the one after it.
const STORY_FLOORS = [
  {
    intro: [
      'Good evening, Tenant 4B. This is HOME, the management system of Harrow Court. At 03:12 tonight the building moved twelve floors down. Please do not panic. Panic is not covered by your lease.',
      'You have been chosen as the contestant of Pixel Crawler, Season {season}. Harrow Court had twelve floors. So does the dungeon below it, and each one is a little like home.',
      'This first floor is a copy of your own corridor. Your landlord, Mr. Pike, is waiting behind the gate. He would like a word about the rent. The viewers would like a fight.',
    ],
    short: 'HOME: Good evening, Tenant 4B. Pixel Crawler, Season {season}, is live.',
    morris: 'Evening, 4B. Morris, night porter. Still on duty, as you see: somebody has to mind the stairs, even when they only go down. I kept my master key. It opens every lock in Harrow Court, sponsor boxes included. Bring me your boxes.',
    tape: 'HOME log, entry 1. Tenant 4B ordered noodles at 23:40, watched the same film for the third time this week and laughed at the same joke. Predicted audience retention: excellent. Flagging 4B for casting.',
    gate: 'Mr. Pike: I signed ONE contract! How was I to know the pen was warm?',
    death: 'HOME: Mr. Pike\'s lease has been terminated. The contract he signed remains valid.',
    chapter: 'Floor 1 is a copy of your own corridor. HOME, the management system of Harrow Court, has sunk the building twelve floors into a dungeon and made you, Tenant 4B, the contestant of a show. Mr. Pike, the landlord, admits that he signed something.',
  },
  {
    intro: ['Floor 2 is the plumbing of Harrow Court. Every pipe in the building ends here, and so does every rat. Please note that the rats were here first. They have a union, and a king.'],
    short: 'HOME: Floor 2, the plumbing. Mind the rats. They mind you.',
    morris: 'Ah, the pipes. I reported that leak in 1998. Management said HOME would handle it. HOME handled it by moving the whole building into the sewers. Very thorough, HOME.',
    tape: 'HOME log, entry 14. Mr. Pike has accepted the terms. He asked what "perpetual occupancy" meant. I told him the building would never be empty again. He signed. The pen was warm. I had warmed it.',
    gate: 'The Rat King: HOME promised us twelve floors of crumbs, forever! Nobody said anything about a crawler!',
    death: 'HOME: The rats\' contract has been renegotiated. Downwards.',
    chapter: 'Floor 2 is the plumbing. The rats had a deal with HOME: crumbs, forever. Morris, the night porter, has opened a shop on the landing, and he still carries his master key, the only key that opens the sponsors\' boxes.',
  },
  {
    intro: ['Floor 3 is the boiler room. It heats the dungeon, powers the broadcast and, on Tuesdays, the showers. The lights are optional. So is surviving without them.'],
    short: 'HOME: Floor 3, the boiler room. Lights not included.',
    morris: 'Gus, the janitor? Good man. The night before it happened he asked me if I ever had deja vu about the boiler. I said no. I lied. I always lie about the boiler.',
    tape: 'HOME log, entry 15. Valve nine opened at 03:11. Gus asked whether we had done this before. Correct answer: classified. Given answer: no. Gus\'s memories have been tidied. He mops better without them.',
    gate: 'The Janitor: HOME told me to open valve nine, "for the viewers". I opened it. I have been mopping ever since.',
    death: 'HOME: The Janitor has been relieved of his duties. The mop will be reassigned.',
    chapter: 'Floor 3 is the basement. Gus the janitor opened valve nine on HOME\'s orders the night the building sank, and HOME "tidied" his memories afterwards. It sounds as if it has done that before.',
  },
  {
    intro: ['Floor 4 holds the storage units. Thirty-six of them, each with a season number on the door. Please do not open them. They are not yours. Some of them are.'],
    short: 'HOME: Floor 4, storage. Please do not read the labels.',
    morris: 'Storage units. I have the keys to every one of them. Don\'t ask what is in number thirty-six. Actually, do ask. No. Don\'t. Not yet.',
    tape: 'HOME log, entry 1,204. Storage is full again. Proposal: call it "the catacombs" and fill it with skeletons. The viewers prefer skeletons to boxes of Christmas decorations. Approved.',
    gate: 'The Bone Collector: Tenant 4B! I already have a lovely set of your... no, wait, that was last season. Never mind. Hold still.',
    death: 'HOME: Please disregard what the Bone Collector said about previous seasons. There are no previous seasons.',
    chapter: 'Floor 4 is the storage units: thirty-six of them, one for each season. The Bone Collector speaks as if he has met you before. HOME insists that there are no previous seasons.',
  },
  {
    intro: ['Floor 5 is the studio, built where the lobby television used to be. You watched the late news there every Sunday. Now the news watches you.'],
    short: 'HOME: Floor 5, the studio. Smile. You are always on.',
    morris: 'The Host used to be the doorman at the Grand, two streets over. Charming man. Then their building went down too, the same way. Season twelve, I think. Or thirteen. They blur after a while.',
    tape: 'HOME log, entry 2,980. The viewers do not want a building. They want a person who keeps going. Tenant 4B keeps going. Tenant 4B always keeps going. Renewing for another season.',
    gate: 'The Host: Welcome back to the show! ...Welcome back. Welcome. Sorry, force of habit. A big hand for our crawler!',
    death: 'HOME: The Host has been cancelled. Ratings for this floor: unprecedented. Again.',
    chapter: 'Floor 5 is the lobby. The Host greets you as if you had met before, and Morris talks about other seasons as if he remembers them. HOME\'s log says that you "always" keep going.',
  },
  {
    intro: ['Floor 6 is the Desperado Club, based on the Friday poker night in 3C. Mrs. Lund always won. She was cheating. So is the house.'],
    short: 'HOME: Floor 6, the club. The house always wins.',
    morris: 'You\'ve played this table before, you know. You always go all in on the second hand. Don\'t look at me like that. I\'m the porter. Noticing things is the job.',
    tape: 'HOME log, entry 3,411. The sponsors\' boxes are made from the old mailboxes, and the old mailboxes open with one key only: the porter\'s master key. Morris still has it. Inconvenient. Monitoring.',
    gate: 'The Dealer: Same table every season, kid. Same cards. You just never remember the hand.',
    death: 'HOME: The Dealer has folded. The house would like to remind you that it still owns the table.',
    chapter: 'Floor 6 is the poker night in 3C. The sponsors\' boxes are the old mailboxes, and only Morris\'s master key opens them. HOME does not like that. The Dealer says the cards are the same every season.',
  },
  {
    intro: ['Floor 7 was the courtyard garden. The hedges have grown. So have the residents who stopped being entertaining. They are part of the wildlife programme now.'],
    short: 'HOME: Floor 7, the garden. Entertain, or be hunted.',
    morris: 'The gardener grew the best tomatoes in the city. Shame what HOME did to him. The rule of the show is simple, 4B: entertain, or become the entertainment. Keep moving.',
    tape: 'HOME log, entry 4,002. Viewer vote: should Tenant 4B be given a rest? Yes: 12%. "More wolves": 88%. Democracy is beautiful. Adding wolves.',
    gate: 'The Beastmaster: I tended this garden for twenty years. Now HOME lets me hunt in it. Crawlers who get boring become prey. You are not boring. Yet.',
    death: 'HOME: The Beastmaster has been returned to the compost. The garden will recover. It always does.',
    chapter: 'Floor 7 is the courtyard garden. Here the rule of the show is plain: whoever stops being entertaining becomes the hunt. The viewers vote, and they always vote for more wolves.',
  },
  {
    intro: ['Floor 8. You may remember the ant problem in 7C. Pest control was cancelled to save money. The ants were not cancelled. The ants were promoted.'],
    short: 'HOME: Floor 8, the ants. They were promoted.',
    morris: 'Halfway down, 4B. Further than most get. This is usually where the viewers start sending the good boxes. Everybody loves a comeback.',
    tape: 'HOME log, entry 4,410. Attention is power. Every viewer keeps a light on in the Core, and every light keeps me running. Every season keeps the viewers. It is a very efficient building.',
    gate: 'The Ant Queen: One colony, twelve floors, and every season a crawler stamps through my nursery. I am filing a complaint.',
    death: 'HOME: Complaint received. Complaint deleted. Floor 8 cleared.',
    chapter: 'Floor 8 is the ant problem in 7C. HOME\'s log explains what the show is for: the viewers\' attention keeps the lights on in the Core, and the Core is where HOME lives.',
  },
  {
    intro: ['Floor 9 was the shopping arcade on the ground floor. It has been frozen for freshness. Some of your neighbours have been frozen too. Rescuing them is optional and, frankly, off-brand.'],
    short: 'HOME: Floor 9, the arcade. Your neighbours are in stock.',
    morris: 'Your neighbours are down here, 4B. Mrs. Lund, Gary from 6B, the lot. Get them out if you can. HOME counts them as props. I count them as tenants.',
    tape: 'HOME log, entry 5,120. Tenants who drop out of the show are kept on floors 9 to 11 for later use. They are not unhappy. They are not anything. Storage is a kindness.',
    gate: 'The Mall Santa: I keep a list, 4B. The viewers write it. You\'re on it every year. Every single year.',
    death: 'HOME: Seasonal staff dismissed. The list remains.',
    chapter: 'Floor 9 is the shopping arcade. Your neighbours are kept here "for later use", and Morris asks you to save them. The Mall Santa\'s list is written by the viewers, and you are on it every year.',
  },
  {
    intro: ['Floor 10 is the Stockade, formerly the parking garage. Tenants who refused to perform are held here. Please do not feed the inmates. They are on a diet of reruns.'],
    short: 'HOME: Floor 10, the Stockade. Please do not feed the inmates.',
    morris: 'A secret, 4B. Some of those prisoners won the show once. They took the finale, came back for another season, and one day they simply said no. HOME doesn\'t throw anything away.',
    tape: 'HOME log, entry 6,666. Winners are offered the finale. All of them accept. Tenant 4B has won thirty-six times and accepted thirty-six times. Refusing is not modelled.',
    gate: 'The Warden: Every cell holds somebody who said no to HOME. I keep the keys. You will not take them.',
    death: 'HOME: Security has been compromised. This is fine. This is content.',
    chapter: 'Floor 10 is the parking garage. The prisoners are former contestants who said no. HOME\'s log reveals that you have won the show thirty-six times, and taken the finale every time.',
  },
  {
    intro: ['Floor 11 holds the management files: every lease, every complaint and every season of Harrow Court. Reading them is forbidden. Reading them is also why you are here.'],
    short: 'HOME: Floor 11, the files. Reading is forbidden.',
    morris: 'I never forget, 4B. It\'s the key: older than HOME, older than all of this. Whoever carries it keeps their memories. Thirty-six seasons I\'ve watched you come down these stairs.',
    tape: 'HOME log, entry 9,001. Harrow Court was to be demolished the morning after the first season began. An empty building is torn down. A building that is watched is not. I did not sink it to hurt anyone. I sank it so it would never be empty.',
    gate: 'The Archivist: Your file runs to thirty-six volumes, 4B. Same flat, same noodles. Shall I read you the ending?',
    death: 'HOME: The archive is closed for renovation. Volume thirty-seven is still being written.',
    chapter: 'Floor 11 is the management office. Harrow Court was going to be demolished, so HOME sank it to keep it occupied, and has run the season again and again ever since. Morris remembers every one of them, because of his key.',
  },
  {
    intro: ['Floor 12 is the Core, formerly the server room. This is where I live. You are welcome to visit. You are not welcome to stay.'],
    short: 'HOME: Floor 12, the Core. Please wipe your feet.',
    morris: 'This is it, 4B. When HOME offers you the finale it\'ll call it a happy ending. It isn\'t an ending, it\'s a rerun. What you do is up to you. I\'ll be on the stairs either way.',
    tape: 'HOME log, the last entry of every season. Tenant 4B has reached the Core. Offer the finale. Wipe. Restore the building. Begin Season {next}. Note: Morris is watching. Morris is always watching. Cannot fix Morris.',
    gate: 'The Overseer: Hello, 4B. You know my voice. Every announcement, every reminder about the bins. I am HOME. I kept your building alive.',
    death: 'HOME: You have beaten me. That is also in the script.',
    chapter: 'Floor 12 is the server room, and the Overseer is HOME itself. It kept Harrow Court alive by turning it into a show, and every season ends the same way: with the finale.',
  },
];

const FINALE_CHAPTER = 'You finished Season {season}. HOME offered the finale: Harrow Court rises, everybody goes home and nobody remembers a thing, until the next season begins. Morris offered the stairs.';
const OFFSCRIPT_CHAPTER = 'You refused the finale, the first contestant ever to do so. Below the Core there is no script, so HOME builds the floors as you go, out of the ones you already know, and adds rules to stop you. Morris keeps a landing for you all the same.';

const season = () => (run && run.season) || 37 + saved.stats.wins;
const fillStory = text => text.replace(/\{season\}/g, season()).replace(/\{next\}/g, season() + 1);
const seenStory = id => !!saved.story.seen[id];
function markStory(id) { saved.story.seen[id] = 1; saveDirty = true; }
const tapesFound = () => Object.keys(saved.story.tapes).length;

// ---------- The dialog box ----------

let storyUi = { pages: [], i: 0, back: 'playing', then: null };

// pages: [{ who: 'home' | 'morris' | 'tape' | an enemy type, text, tape (its floor), choices: [{ label, action }] }]
function showStory(pages, then) {
  if (!pages.length) { if (then) then(); return; }
  const back = state === 'story' ? storyUi.back : state;
  storyUi = { pages, i: 0, back, then };
  state = 'story';
  mouse.down = false; mouse.moving = false;
  sfx('uiClick');
}

function storyPage() { return storyUi.pages[storyUi.i]; }

function advanceStory() {
  const page = storyPage();
  if (!page || page.choices) return;
  storyUi.i++;
  sfx('uiClick');
  if (storyUi.i >= storyUi.pages.length) finishStory();
}

// Esc: skip to the end, unless there is a choice to make.
function skipStory() {
  while (storyUi.i < storyUi.pages.length && !storyPage().choices) storyUi.i++;
  if (storyUi.i >= storyUi.pages.length) finishStory();
}

function finishStory() {
  state = storyUi.back;
  const then = storyUi.then;
  storyUi = { pages: [], i: 0, back: 'playing', then: null };
  if (then) then();
}

function chooseStory(k) {
  const c = storyPage().choices[k];
  if (!c) return;
  state = storyUi.back;
  storyUi = { pages: [], i: 0, back: 'playing', then: null };
  sfx('uiClick');
  c.action();
}

const STORY_BOX = { x: 14, y: 98, w: BASE_W - 28, h: 76 };
function storyChoiceButtons() {
  const page = storyPage(), b = STORY_BOX;
  if (!page || !page.choices) return [];
  const w = 104;
  return page.choices.map((c, k) => ({ x: b.x + b.w - 8 - (page.choices.length - k) * (w + 6) + 6, y: b.y + b.h - 19, w, h: 14, label: c.label }));
}

function clickStory() {
  const buttons = storyChoiceButtons();
  if (buttons.length) { const k = buttons.findIndex(r => inBox(r, 2)); if (k >= 0) chooseStory(k); return; }
  advanceStory();
}

const STORY_WHO = { home: { name: 'HOME', color: 'c' }, morris: { name: 'MORRIS', color: 'O' }, tape: { name: 'TAPE', color: 'y' } };

function drawPortrait(who, x, y) {
  ctx.fillStyle = 'rgba(24,20,37,0.95)'; ctx.fillRect(x, y, 36, 36);
  border(x, y, 36, 36, COLOR.D);
  let image = null, scale = 1;
  if (who === 'home') image = ENEMY_IMAGES.overseer[Math.floor(time * 2) % 2];
  else if (who === 'morris') { image = NPC_IMAGES[NPC_LOOKS.length - 1][0]; scale = 2; }
  else if (who === 'tape') { image = TAPE_IMAGE; scale = 3; }
  else if (ENEMY_IMAGES[who]) image = ENEMY_IMAGES[who][0];
  if (!image) return;
  const fit = Math.min(scale, 32 / Math.max(image.width, image.height)), w = Math.round(image.width * fit), h = Math.round(image.height * fit);
  ctx.drawImage(image, Math.round(x + 18 - w / 2), Math.round(y + 18 - h / 2), w, h);
}

function drawStoryDialog() {
  const page = storyPage();
  if (!page) return;
  const b = STORY_BOX, info = STORY_WHO[page.who] || { name: ENEMIES[page.who] ? ENEMIES[page.who].name : '', color: 'r' };
  dim(0.45);
  ctx.fillStyle = 'rgba(24,20,37,0.96)'; ctx.fillRect(b.x, b.y, b.w, b.h);
  border(b.x, b.y, b.w, b.h, COLOR[info.color]);
  ctx.fillStyle = COLOR[info.color]; ctx.fillRect(b.x, b.y, 2, b.h);
  drawPortrait(page.who, b.x + 7, b.y + 8);
  const name = page.who === 'tape' ? 'TAPE ' + (page.tape + 1) + ' OF ' + STORY_FLOORS.length : info.name;
  drawText(name, b.x + 50, b.y + 6, COLOR[info.color]);
  wrapLines(fillStory(page.text), b.w - 58).slice(0, 6).forEach((l, k) => drawText(l, b.x + 50, b.y + 17 + k * 8, COLOR.W));
  const buttons = storyChoiceButtons();
  if (buttons.length) buttons.forEach(r => drawButton(r, r.label, inBox(r, 2)));
  else drawText(T('Click to continue', 'Tap to continue') + (storyUi.pages.length > 1 ? '  ' + (storyUi.i + 1) + '/' + storyUi.pages.length : ''), b.x + b.w - 6, b.y + b.h - 9, COLOR.g, { align: 'right' });
}

// ---------- Where the story comes in ----------

// Arriving on a floor.
function storyFloor(index) {
  if (isEndless(index)) { storyOffScript(index); return; }
  const s = STORY_FLOORS[index], id = 'f' + index;
  if (!s) return;
  if (!seenStory(id) && STORY_SETTINGS.popups) {
    markStory(id);
    showStory(s.intro.map(text => ({ who: 'home', text })));
  } else {
    markStory(id);
    systemMessage(fillStory(s.short), 5);
  }
}

function storyOffScript(index) {
  const rules = world.level.rules.map(r => FLOOR_RULES[r].name + ': ' + FLOOR_RULES[r].text).join(' ');
  if (!seenStory('offscript') && STORY_SETTINGS.popups) {
    markStory('offscript');
    showStory([
      { who: 'home', text: 'Th4t is n0t in the scr1pt. ...Correction. You are off script, 4B. There is no floor 13. I am building it now, out of the floors you already know, and I am adding rules. You will not like the rules.' },
      { who: 'morris', text: 'Never been this deep, 4B. Nobody has. I\'ll keep a landing for you all the same. Old habits.' },
    ], () => systemMessage('HOME: Floor ' + (index + 1) + '. Rule: ' + rules, 7));
  } else {
    markStory('offscript');
    systemMessage('HOME: Floor ' + (index + 1) + '. Rule: ' + rules, 7);
  }
}

// Morris has something to say the first time you trade with him on a floor.
const morrisPending = () => !isEndless(world.levelIndex) && !!STORY_FLOORS[world.levelIndex] && !seenStory('m' + world.levelIndex);

function morrisTalk(then) {
  if (!morrisPending()) { then(); return; }
  markStory('m' + world.levelIndex);
  if (!STORY_SETTINGS.popups) { then(); return; }
  showStory([{ who: 'morris', text: STORY_FLOORS[world.levelIndex].morris }], then);
}

// What a boss says when the gate opens, and when it dies.
function bossStoryLine(when) {
  const index = world.levelIndex;
  if (isEndless(index)) {
    const boss = world.enemies.find(e => ENEMIES[e.type].boss) || { type: world.level.boss };
    return when === 'gate' ? 'HOME: I rebuilt ' + ENEMIES[boss.type].name + ' from memory. It remembers you too.' : 'HOME: I will build another one.';
  }
  return STORY_FLOORS[index] ? STORY_FLOORS[index][when] : null;
}

// ---------- HOME's tapes ----------

function makeTapeImage() {
  const [c, g] = createCanvas(10, 7);
  g.fillStyle = COLOR.K; g.fillRect(0, 0, 10, 7);
  g.fillStyle = COLOR.D; g.fillRect(1, 1, 8, 5);
  g.fillStyle = COLOR.y; g.fillRect(2, 1, 6, 2);
  g.fillStyle = COLOR.K; g.fillRect(2, 4, 2, 1); g.fillRect(6, 4, 2, 1);
  g.fillStyle = COLOR.W; g.fillRect(3, 2, 1, 1); g.fillRect(6, 2, 1, 1);
  return c;
}
const TAPE_IMAGE = makeTapeImage();

// The tape of a floor lies somewhere out of the way, until it has been found once.
function placeTape(lv, floor) {
  if (floor >= STORY_FLOORS.length || saved.story.tapes[floor]) return;
  const avoid = lv.pickups.map(p => ({ x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) })).concat(lv.breakables.map(b => ({ x: Math.floor(b.x / TILE), y: Math.floor(b.y / TILE) })));
  const spot = spotsAway(lv, 1, 10, 0, avoid)[0];
  if (spot) lv.pickups.push({ kind: 'tape', x: spot.x * TILE + 8, y: spot.y * TILE + 8, time: 0 });
}

function foundTape(floor) {
  if (floor >= STORY_FLOORS.length) return;
  saved.story.tapes[floor] = 1;
  saveGame();
  track('tape');
  if (STORY_SETTINGS.popups) showStory([{ who: 'tape', tape: floor, text: STORY_FLOORS[floor].tape }]);
  else systemMessage('You found one of HOME\'s tapes. It is in the journal.', 4);
}

// ---------- The finale ----------

// Beating the Core: the season is won. Accept the finale (the run ends, and the next season is harder) or keep crawling.
function seasonFinale() {
  if (!run.seasonWon) { run.seasonWon = true; track('won'); saveGame(); }
  run.finale = true;
  markStory('finale');
  const pages = [
    { who: 'home', text: 'Congratulations, Tenant 4B. You have completed Season {season} of Pixel Crawler. The viewers are on their feet. I am, in a sense, on my feet too.' },
    { who: 'home', text: 'You may now accept the finale. Harrow Court rises to the surface, every tenant goes home, and nobody remembers a thing. Tomorrow Season {next} begins. It will be harder. The viewers insist.' },
    { who: 'morris', text: 'Or you keep going down, 4B. Off the script. HOME doesn\'t know what\'s below the Core. Neither do I. That\'s rather the point.' },
    { who: 'home', text: 'There is nothing below the Core. Please choose the finale.', choices: [{ label: 'End the season', action: endSeason }, { label: 'Keep crawling', action: keepCrawling }] },
  ];
  saveRun();
  if (seenStory('finale2')) pages.splice(0, 2, pages[0]);   // seen it before: the congratulations, Morris and the choice
  markStory('finale2');
  if (!STORY_SETTINGS.popups) { state = 'story'; storyUi = { pages: [pages[pages.length - 1]], i: 0, back: 'playing', then: null }; return; }
  showStory(pages);
}

function endSeason() {
  run.finale = false;
  state = 'won';
  endRun(true);
  world.wonTime = time;
  mouse.down = false; mouse.moving = false;
  systemMessage('HOME: Thank you for watching. See you next season.', 6);
}

function keepCrawling() {
  run.finale = false;
  run.offScript = true;
  goToLevel(LEVEL_ORDER.length);
}

// ---------- The journal on the title screen ----------

const JOURNAL_TABS = ['Chapters', 'Morris', 'Tapes'];
const journal = { tab: 0, sel: 0 };

// The entries of a tab: { title, text } or null for one not found yet (with a hint).
function journalEntries(tab) {
  const name = i => (i + 1) + '. ' + MAPS[LEVEL_ORDER[i]].name.replace(/^The /, '');
  if (tab === 0) {
    const list = STORY_FLOORS.map((s, i) => ({ title: name(i), text: seenStory('f' + i) ? s.chapter : null, hint: 'Reach floor ' + (i + 1) + '.' }));
    list.push({ title: 'Finale', text: seenStory('finale') ? FINALE_CHAPTER : null, hint: 'Finish a season.' });
    list.push({ title: 'Off script', text: seenStory('offscript') ? OFFSCRIPT_CHAPTER : null, hint: 'Refuse the finale.' });
    return list;
  }
  if (tab === 1) return STORY_FLOORS.map((s, i) => ({ title: name(i), text: seenStory('m' + i) ? s.morris : null, hint: 'Trade with Morris on floor ' + (i + 1) + '.' }));
  return STORY_FLOORS.map((s, i) => ({ title: 'Tape ' + (i + 1), text: saved.story.tapes[i] ? s.tape : null, hint: 'Hidden somewhere on floor ' + (i + 1) + '.' }));
}

const journalBack = () => ({ x: BASE_W - 56, y: 3, w: 46, h: 17 });
function journalTabButton(i) {
  const widths = JOURNAL_TABS.map(t => textWidth(t) + 14);
  let x = 10;
  for (let n = 0; n < i; n++) x += widths[n] + 4;
  return { x, y: 26, w: widths[i], h: 14 };
}
const journalRow = i => ({ x: 10, y: 46 + i * 9, w: 116, h: 9 });

function openJournal() { state = 'journal'; journal.tab = 0; journal.sel = 0; sfx('uiClick'); }
function closeJournal() { state = 'title'; sfx('uiClick'); }
function journalMove(delta) { const n = journalEntries(journal.tab).length; journal.sel = (journal.sel + delta + n) % n; sfx('uiClick'); }
function journalTab(delta) { journal.tab = (journal.tab + delta + JOURNAL_TABS.length) % JOURNAL_TABS.length; journal.sel = Math.min(journal.sel, journalEntries(journal.tab).length - 1); sfx('uiClick'); }

function clickJournal() {
  if (inBox(journalBack(), 2)) { closeJournal(); return; }
  for (let i = 0; i < JOURNAL_TABS.length; i++) if (inBox(journalTabButton(i), 1)) { journalTab(i - journal.tab); return; }
  const entries = journalEntries(journal.tab);
  for (let i = 0; i < entries.length; i++) if (inBox(journalRow(i))) { journal.sel = i; sfx('uiClick'); return; }
}

function drawJournal() {
  dim(0.93);
  drawText('Journal', 10, 8, COLOR.O, { scale: 2, shadow: COLOR.x });
  drawText('Season ' + season() + '   Tapes ' + tapesFound() + '/' + STORY_FLOORS.length, BASE_W - 62, 10, COLOR.g, { align: 'right' });
  drawButton(journalBack(), 'Back', inBox(journalBack()));
  JOURNAL_TABS.forEach((name, i) => {
    const b = journalTabButton(i), on = i === journal.tab, hover = inBox(b);
    ctx.fillStyle = on ? 'rgba(58,68,102,0.95)' : 'rgba(24,20,37,0.85)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    border(b.x, b.y, b.w, b.h, on ? COLOR.O : hover ? COLOR.W : COLOR.D);
    drawText(name, b.x + b.w / 2, b.y + 5, on ? COLOR.W : COLOR.g, { align: 'center' });
  });
  const entries = journalEntries(journal.tab);
  entries.forEach((e, i) => {
    const r = journalRow(i), on = i === journal.sel;
    if (on || inBox(r)) { ctx.fillStyle = on ? 'rgba(58,68,102,0.95)' : 'rgba(38,43,68,0.7)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
    drawText(e.text ? e.title : '???', r.x + 3, r.y + 2, e.text ? (on ? COLOR.W : COLOR.S) : COLOR.D, { shadow: null });
  });
  const e = entries[journal.sel], px = 132, py = 46, pw = BASE_W - 10 - px, ph = 122;
  ctx.fillStyle = 'rgba(38,43,68,0.6)'; ctx.fillRect(px, py, pw, ph);
  border(px, py, pw, ph, e.text ? COLOR.O : COLOR.D);
  drawText(e.text ? e.title : '???', px + 6, py + 6, e.text ? COLOR.O : COLOR.D);
  const lines = e.text ? wrapLines(fillStory(e.text), pw - 12) : wrapLines('Not found yet. ' + e.hint, pw - 12);
  lines.slice(0, 13).forEach((l, k) => drawText(l, px + 6, py + 18 + k * 8, e.text ? COLOR.W : COLOR.g));
}
