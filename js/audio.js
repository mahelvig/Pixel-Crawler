"use strict";

// ---------- Sound and music ----------
// All sound is made with the Web Audio API, so the game needs no sound files. A browser only allows sound after the
// player has clicked or pressed a key, so audioInit() runs on the first of those. Without Web Audio the game stays silent.

const audio = { ctx: null, failed: false, voices: [], last: {}, music: null, wanted: null, combat: false, combatUntil: 0, timer: null };
let sfxScratch = { vol: 1, pan: 0, delay: 0 };   // set by sfx() for the tone() and noise() calls the effect makes

function audioInit() {
  if (audio.failed) return;
  if (audio.ctx) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { audio.failed = true; return; }
    const c = new AC();
    audio.ctx = c;
    // effects and music go through their own volume controls into a compressor that keeps loud moments from clipping
    audio.master = c.createGain();
    audio.master.gain.value = AUDIO.master;
    audio.sfxBus = c.createGain();
    audio.musicBus = c.createGain();
    audio.musicFilter = c.createBiquadFilter();
    audio.musicFilter.type = 'lowpass';
    audio.musicFilter.frequency.value = 18000;
    const compressor = c.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 6;
    audio.sfxBus.connect(audio.master);
    audio.musicFilter.connect(audio.musicBus);
    audio.musicBus.connect(audio.master);
    audio.master.connect(compressor);
    compressor.connect(c.destination);
    // one second of white noise, reused by every noise sound
    audio.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = audio.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applyVolumes();
    audio.timer = setInterval(updateMusic, 60);
    if (audio.timer.unref) audio.timer.unref();
    if (c.state === 'suspended') c.resume();
  } catch (e) {
    audio.failed = true;
    audio.ctx = null;
  }
}

// Called when the sound options change.
function applyVolumes() {
  if (!audio.ctx) return;
  const t = audio.ctx.currentTime;
  audio.sfxBus.gain.setTargetAtTime(OPTIONS.sfx ? AUDIO.sfx : 0, t, 0.02);
}

// Stops everything while the page is hidden.
function audioSuspend(hidden) {
  if (!audio.ctx) return;
  if (hidden) audio.ctx.suspend(); else audio.ctx.resume();
}

// ---------- Building blocks for the effects ----------

// Effects that are too many at once are dropped, quietest-first by simply refusing new ones.
function voiceFree(end) {
  const t = audio.ctx.currentTime;
  audio.voices = audio.voices.filter(e => e > t);
  if (audio.voices.length >= AUDIO.maxVoices) return false;
  audio.voices.push(end);
  return true;
}

function sfxOut(node) {
  const c = audio.ctx;
  if (sfxScratch.pan && c.createStereoPanner) {
    const panner = c.createStereoPanner();
    panner.pan.value = sfxScratch.pan;
    node.connect(panner);
    panner.connect(audio.sfxBus);
  } else {
    node.connect(audio.sfxBus);
  }
}

// A note: freq slides to `to` over the duration. vol is the peak volume.
function tone(o) {
  const c = audio.ctx, t0 = c.currentTime + (o.delay || 0) + sfxScratch.delay;
  if (!voiceFree(t0 + o.dur)) return;
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime((o.vol || 0.2) * sfxScratch.vol, t0 + Math.min(o.attack || 0.004, o.dur / 2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  sfxOut(g);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

// A burst of filtered noise: the filter sweeps from `from` to `to`.
function noise(o) {
  const c = audio.ctx, t0 = c.currentTime + (o.delay || 0) + sfxScratch.delay;
  if (!voiceFree(t0 + o.dur)) return;
  const src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
  src.buffer = audio.noise;
  src.loop = true;
  filter.type = o.filter || 'lowpass';
  filter.Q.value = o.q || 0.7;
  filter.frequency.setValueAtTime(o.from || 2000, t0);
  if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + o.dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime((o.vol || 0.2) * sfxScratch.vol, t0 + Math.min(o.attack || 0.004, o.dur / 2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(filter);
  filter.connect(g);
  sfxOut(g);
  src.start(t0, Math.random() * 0.5);
  src.stop(t0 + o.dur + 0.03);
}

// ---------- The effects ----------

const SFX = {
  // weapons
  'fire:rubberBandGun'() { tone({ freq: 700, to: 220, dur: 0.09, type: 'triangle', vol: 0.22 }); noise({ dur: 0.02, vol: 0.06, filter: 'highpass', from: 3000 }); },
  'fire:nailGun'() { noise({ dur: 0.03, vol: 0.14, filter: 'bandpass', from: 2500, q: 2 }); tone({ freq: 1500, to: 500, dur: 0.04, vol: 0.08 }); },
  'fire:slingshot'() { tone({ freq: 420, to: 160, dur: 0.07, type: 'sine', vol: 0.2 }); noise({ dur: 0.05, vol: 0.05, filter: 'highpass', from: 2500 }); },
  'fire:potatoCannon'() { tone({ freq: 180, to: 45, dur: 0.22, type: 'sine', vol: 0.45 }); noise({ dur: 0.14, vol: 0.2, from: 1200, to: 200 }); },
  'fire:shotgun'() { noise({ dur: 0.28, vol: 0.4, from: 3500, to: 300 }); tone({ freq: 110, to: 40, dur: 0.25, type: 'sawtooth', vol: 0.25 }); },
  'fire:crossbow'() { tone({ freq: 260, to: 110, dur: 0.18, type: 'triangle', vol: 0.28 }); noise({ dur: 0.04, vol: 0.1, filter: 'bandpass', from: 1800 }); tone({ freq: 90, to: 60, dur: 0.1, type: 'sine', vol: 0.2 }); },
  'fire:flamethrower'() { noise({ dur: 0.12, vol: 0.16, filter: 'bandpass', from: 900, to: 500, q: 0.6 }); },
  'fire:minigun'() { noise({ dur: 0.04, vol: 0.18, filter: 'bandpass', from: 1800, q: 1 }); tone({ freq: 160, to: 70, dur: 0.05, vol: 0.1 }); },
  'fire:lightningGun'() { tone({ freq: 1800, to: 200, dur: 0.18, type: 'sawtooth', vol: 0.18 }); tone({ freq: 900, to: 90, dur: 0.2, vol: 0.1 }); noise({ dur: 0.1, vol: 0.08, filter: 'highpass', from: 4000 }); },
  'fire:rocketLauncher'() { noise({ dur: 0.5, vol: 0.25, from: 2200, to: 200 }); tone({ freq: 140, to: 60, dur: 0.3, type: 'sawtooth', vol: 0.25 }); },
  'fire:default'() { tone({ freq: 500, to: 200, dur: 0.08, vol: 0.2 }); },
  'fire:baseballBat'() { noise({ dur: 0.18, vol: 0.22, filter: 'bandpass', from: 500, to: 1600, q: 0.8 }); tone({ freq: 120, to: 60, dur: 0.12, type: 'sine', vol: 0.3 }); },
  'fire:revolver'() { noise({ dur: 0.18, vol: 0.35, from: 4000, to: 400 }); tone({ freq: 200, to: 70, dur: 0.15, type: 'sawtooth', vol: 0.2 }); },
  'fire:sniperRifle'() { noise({ dur: 0.4, vol: 0.45, from: 5000, to: 200 }); tone({ freq: 140, to: 40, dur: 0.35, type: 'sawtooth', vol: 0.3 }); tone({ freq: 2200, to: 800, dur: 0.1, vol: 0.08 }); },
  'fire:grenadeLauncher'() { tone({ freq: 170, to: 70, dur: 0.15, type: 'triangle', vol: 0.35 }); noise({ dur: 0.1, vol: 0.2, from: 1500, to: 300 }); },
  'fire:freezeRay'() { tone({ freq: 1600, to: 900, dur: 0.1, type: 'sine', vol: 0.15 }); noise({ dur: 0.08, vol: 0.05, filter: 'highpass', from: 5000 }); },
  'fire:ricochetPistol'() { tone({ freq: 1200, to: 500, dur: 0.09, type: 'triangle', vol: 0.2 }); tone({ freq: 600, to: 300, dur: 0.08, vol: 0.1 }); },
  bounce() { tone({ freq: 1800, to: 1300, dur: 0.05, type: 'triangle', vol: 0.12 }); },
  clang() { tone({ freq: 1500, dur: 0.12, type: 'triangle', vol: 0.2 }); tone({ freq: 2300, dur: 0.08, type: 'sine', vol: 0.1 }); noise({ dur: 0.05, vol: 0.1, filter: 'highpass', from: 4000 }); },
  iceHit() { tone({ freq: 2400, to: 1800, dur: 0.06, type: 'sine', vol: 0.08 }); },
  slimeSplit() { tone({ freq: 160, to: 380, dur: 0.18, type: 'sine', vol: 0.25 }); noise({ dur: 0.15, vol: 0.1, filter: 'bandpass', from: 500, to: 1200, q: 2 }); },
  bombFuse() { noise({ dur: 0.7, vol: 0.12, filter: 'highpass', from: 3000, to: 6000 }); tone({ freq: 800, to: 1600, dur: 0.7, vol: 0.08 }); },
  'die:slime'() { tone({ freq: 220, to: 90, dur: 0.2, type: 'sine', vol: 0.22 }); },
  'die:slimeling'() { tone({ freq: 400, to: 160, dur: 0.1, type: 'sine', vol: 0.15 }); },
  'die:ghost'() { tone({ freq: 700, to: 200, dur: 0.5, type: 'sine', vol: 0.2 }); tone({ freq: 710, to: 205, dur: 0.5, type: 'triangle', vol: 0.1 }); },
  'die:bomber'() { tone({ freq: 900, to: 300, dur: 0.1, vol: 0.15 }); },
  'die:knight'() { tone({ freq: 160, to: 60, dur: 0.3, type: 'sawtooth', vol: 0.25 }); tone({ freq: 1200, dur: 0.1, type: 'triangle', vol: 0.12 }); noise({ dur: 0.25, vol: 0.15, from: 3000, to: 500 }); },
  equip() { tone({ freq: 500, to: 700, dur: 0.06, type: 'triangle', vol: 0.12 }); noise({ dur: 0.06, vol: 0.08, filter: 'bandpass', from: 2500, q: 1 }); },
  crit() { tone({ freq: 1800, to: 2600, dur: 0.1, type: 'square', vol: 0.12 }); tone({ freq: 900, dur: 0.06, type: 'triangle', vol: 0.12 }); },
  dodge() { noise({ dur: 0.15, vol: 0.15, filter: 'bandpass', from: 1500, to: 600, q: 0.8 }); tone({ freq: 700, to: 1100, dur: 0.1, type: 'sine', vol: 0.1 }); },
  heal() { [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.08, type: 'triangle', vol: 0.14, delay: i * 0.06 })); },
  gem() { tone({ freq: 1500 + Math.random() * 300, dur: 0.05, type: 'triangle', vol: 0.09 }); },
  coin() { tone({ freq: 1300, dur: 0.05, vol: 0.09 }); tone({ freq: 1950, dur: 0.1, type: 'triangle', vol: 0.09, delay: 0.04 }); },
  levelup() { [392, 523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14, vol: 0.14, delay: i * 0.08 })); tone({ freq: 1568, dur: 0.5, type: 'triangle', vol: 0.14, delay: 0.42 }); },
  perk() { [659, 988].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.16, delay: i * 0.07 })); },
  buy() { tone({ freq: 1200, dur: 0.07, vol: 0.12 }); tone({ freq: 1800, dur: 0.18, type: 'triangle', vol: 0.14, delay: 0.07 }); noise({ dur: 0.05, vol: 0.06, filter: 'highpass', from: 4000, delay: 0.07 }); },
  deny() { tone({ freq: 160, to: 110, dur: 0.18, vol: 0.14 }); },
  empty() { tone({ freq: 200, dur: 0.03, vol: 0.12 }); noise({ dur: 0.02, vol: 0.05, filter: 'highpass', from: 3000 }); },
  outOfAmmo() { tone({ freq: 300, to: 120, dur: 0.12, vol: 0.18 }); },
  switch() { tone({ freq: 900, to: 1300, dur: 0.04, vol: 0.1 }); },
  explosion() { noise({ dur: 0.7, vol: 0.55, from: 3500, to: 150 }); tone({ freq: 90, to: 30, dur: 0.6, type: 'sine', vol: 0.5 }); },

  // hits and deaths
  hit() { noise({ dur: 0.05, vol: 0.14, filter: 'bandpass', from: 1400, q: 1 }); tone({ freq: 260, to: 140, dur: 0.05, vol: 0.1 }); },
  bossHit() { tone({ freq: 140, to: 80, dur: 0.07, vol: 0.18 }); noise({ dur: 0.05, vol: 0.12, from: 900 }); },
  targetHit() { tone({ freq: 880, to: 660, dur: 0.12, type: 'triangle', vol: 0.2 }); tone({ freq: 1760, dur: 0.06, type: 'sine', vol: 0.1 }); },
  gaugeHit() { tone({ freq: 1200, to: 800, dur: 0.1, type: 'triangle', vol: 0.2 }); tone({ freq: 2400, dur: 0.05, type: 'sine', vol: 0.08 }); noise({ dur: 0.3, vol: 0.12, filter: 'highpass', from: 3000 }); },
  woodHit() { noise({ dur: 0.06, vol: 0.16, from: 900 }); tone({ freq: 180, to: 100, dur: 0.06, type: 'triangle', vol: 0.2 }); },
  smash() { noise({ dur: 0.3, vol: 0.35, from: 3000, to: 300 }); tone({ freq: 120, to: 50, dur: 0.25, type: 'sawtooth', vol: 0.2 }); },
  'die:rat'() { tone({ freq: 1400, to: 500, dur: 0.12, vol: 0.15 }); },
  'die:goblin'() { tone({ freq: 240, to: 90, dur: 0.2, type: 'sawtooth', vol: 0.2 }); noise({ dur: 0.1, vol: 0.1, from: 1500 }); },
  'die:bat'() { tone({ freq: 2000, to: 700, dur: 0.14, type: 'triangle', vol: 0.14 }); },
  'die:spitter'() { tone({ freq: 300, to: 80, dur: 0.25, type: 'sine', vol: 0.28 }); noise({ dur: 0.15, vol: 0.1, filter: 'bandpass', from: 600, to: 300 }); },
  'die:ogre'() { tone({ freq: 100, to: 40, dur: 0.45, type: 'sawtooth', vol: 0.35 }); noise({ dur: 0.3, vol: 0.2, from: 1200, to: 200 }); },
  'die:default'() { tone({ freq: 200, to: 60, dur: 0.3, type: 'sawtooth', vol: 0.25 }); },
  bossDie() {
    noise({ dur: 1.2, vol: 0.4, from: 3000, to: 100 });
    tone({ freq: 200, to: 30, dur: 1.2, type: 'sawtooth', vol: 0.35 });
    tone({ freq: 90, to: 30, dur: 0.5, type: 'sine', vol: 0.4, delay: 0.35 });
    tone({ freq: 80, to: 30, dur: 0.5, type: 'sine', vol: 0.4, delay: 0.7 });
  },
  bossRoar() { tone({ freq: 130, to: 60, dur: 0.7, type: 'sawtooth', vol: 0.35 }); tone({ freq: 135, to: 65, dur: 0.7, vol: 0.2 }); noise({ dur: 0.5, vol: 0.2, from: 1500, to: 300 }); },

  // enemies
  alert() { tone({ freq: 700, to: 1000, dur: 0.07, vol: 0.1 }); },
  swipe() { noise({ dur: 0.1, vol: 0.12, filter: 'bandpass', from: 600, to: 1800, q: 0.8 }); },
  spit() { noise({ dur: 0.1, vol: 0.12, filter: 'bandpass', from: 1500, to: 500, q: 1.5 }); tone({ freq: 500, to: 200, dur: 0.1, type: 'sine', vol: 0.15 }); },
  summon() { tone({ freq: 300, to: 900, dur: 0.3, type: 'sine', vol: 0.2 }); tone({ freq: 150, to: 450, dur: 0.3, vol: 0.08 }); noise({ dur: 0.25, vol: 0.08, filter: 'bandpass', from: 500, to: 2500 }); },
  dashWind() { tone({ freq: 200, to: 700, dur: 0.5, type: 'sawtooth', vol: 0.12 }); },
  dash() { noise({ dur: 0.4, vol: 0.25, filter: 'bandpass', from: 400, to: 1800, q: 0.7 }); tone({ freq: 150, to: 90, dur: 0.3, type: 'sawtooth', vol: 0.15 }); },
  teleport() { tone({ freq: 1200, to: 200, dur: 0.25, type: 'sine', vol: 0.2 }); tone({ freq: 1800, to: 300, dur: 0.2, vol: 0.06 }); },
  hazardWarn() { tone({ freq: 600, dur: 0.08, vol: 0.12 }); tone({ freq: 600, dur: 0.08, vol: 0.12, delay: 0.14 }); },
  hazardGo() { noise({ dur: 0.5, vol: 0.2, filter: 'highpass', from: 2000 }); },
  bossFan() { tone({ freq: 400, to: 200, dur: 0.12, vol: 0.18 }); noise({ dur: 0.1, vol: 0.1, filter: 'bandpass', from: 1200 }); },
  bossRing() { tone({ freq: 300, to: 600, dur: 0.25, type: 'triangle', vol: 0.2 }); noise({ dur: 0.2, vol: 0.1, filter: 'bandpass', from: 800, to: 2000 }); },
  horn() { tone({ freq: 220, dur: 0.5, type: 'sawtooth', vol: 0.18 }); tone({ freq: 330, dur: 0.5, type: 'sawtooth', vol: 0.12 }); },

  // the player
  step() { noise({ dur: 0.04, vol: 0.045, from: 800, to: 400 }); },
  hurt() { tone({ freq: 380, to: 120, dur: 0.22, type: 'sawtooth', vol: 0.3 }); noise({ dur: 0.12, vol: 0.14, from: 1500, to: 300 }); },
  playerDie() { tone({ freq: 440, to: 55, dur: 1, type: 'sawtooth', vol: 0.3 }); tone({ freq: 330, to: 40, dur: 1, vol: 0.18 }); },
  pickupWeapon() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.1, vol: 0.13, delay: i * 0.07 })); },
  pickupAmmo() { tone({ freq: 880, dur: 0.07, vol: 0.13 }); tone({ freq: 1175, dur: 0.1, vol: 0.13, delay: 0.07 }); },
  lights() { tone({ freq: 110, dur: 0.35, type: 'sawtooth', vol: 0.12 }); noise({ dur: 0.3, vol: 0.12, filter: 'bandpass', from: 3000, q: 3 }); tone({ freq: 1500, dur: 0.05, vol: 0.08, delay: 0.3 }); },
  fuse() { [600, 900, 1400].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'triangle', vol: 0.18, delay: i * 0.06 })); },

  // the world
  objective() {
    [523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.12, vol: 0.14, delay: i * 0.1 }));
    tone({ freq: 1047, dur: 0.4, type: 'triangle', vol: 0.18, delay: 0.3 });
  },
  gate() {
    noise({ dur: 1.3, vol: 0.35, from: 400, to: 120 });
    tone({ freq: 60, to: 45, dur: 1.3, type: 'sawtooth', vol: 0.3 });
    tone({ freq: 90, to: 70, dur: 1.1, vol: 0.1 });
  },
  stairs() { [784, 1047, 1319, 1568].forEach((f, i) => tone({ freq: f, dur: 0.25, type: 'triangle', vol: 0.14, delay: i * 0.1 })); },
  descend() { noise({ dur: 0.8, vol: 0.2, from: 2500, to: 150 }); tone({ freq: 400, to: 80, dur: 0.8, type: 'triangle', vol: 0.2 }); },
  start() { [392, 523, 659].forEach((f, i) => tone({ freq: f, dur: 0.12, vol: 0.15, delay: i * 0.08 })); },

  // menus
  bagOpen() { tone({ freq: 300, to: 520, dur: 0.08, type: 'triangle', vol: 0.14 }); },
  bagClose() { tone({ freq: 520, to: 300, dur: 0.08, type: 'triangle', vol: 0.14 }); },
  uiClick() { tone({ freq: 700, dur: 0.03, vol: 0.1 }); },
  drop() { tone({ freq: 260, to: 140, dur: 0.08, type: 'triangle', vol: 0.15 }); },
  pause() { tone({ freq: 600, to: 300, dur: 0.1, type: 'triangle', vol: 0.14 }); },
};

// The shortest time between two plays of the same effect, so fast weapons do not turn into a buzz.
const SFX_GAP = { step: 0.11, hit: 0.035, 'fire:flamethrower': 0.06, 'fire:minigun': 0.045, woodHit: 0.05, hazardWarn: 0.2, 'fire:nailGun': 0.04 };

// Plays an effect. With a position it gets quieter and moves to the left or right of the screen depending on where it is.
function sfx(name, x, y, delay) {
  const c = audio.ctx;
  if (!c || !OPTIONS.sfx || c.state !== 'running') return;
  const fn = SFX[name] || SFX[name.split(':')[0] + ':default'];
  if (!fn) return;
  const t = c.currentTime;
  if (audio.last[name] !== undefined && t - audio.last[name] < (SFX_GAP[name] ?? 0.02)) return;
  let vol = 1, pan = 0;
  if (x !== undefined && world) {
    const pl = world.player, dx = x - pl.x, dy = y - pl.y;
    vol = Math.pow(clamp(1 - Math.hypot(dx, dy) / AUDIO.hearing, 0, 1), 1.5);
    if (vol < 0.03) return;
    pan = clamp(dx / 180, -0.8, 0.8);
  }
  audio.last[name] = t;
  sfxScratch = { vol, pan, delay: delay || 0 };
  fn();
}

// ---------- Music ----------
// A tune is built from a few short patterns that repeat over a chord progression. The patterns have 16 steps (one bar)
// or 32 steps (two bars): a number is a scale degree counted from the chord's root, null is a rest. When enemies are
// chasing the player the music gets drums and a lead melody; when it is calm it is just pad, bass and arpeggio.

const _ = null;
const MINOR = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10], PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10];

const MUSIC = {
  title: {
    bpm: 76, root: 52, scale: MINOR, chords: [0, 5, 3, 4], alwaysCombat: true,
    bass: [0, _, _, _, _, _, _, _, 4, _, _, _, _, _, _, _],
    arp: [0, _, 4, _, 7, _, 4, _, 2, _, 4, _, 7, _, 4, _],
    lead: [7, _, _, _, 6, _, 4, _, 2, _, _, _, _, _, _, _, 4, _, _, _, 5, _, 6, _, 7, _, _, _, _, _, _, _],
    drums: { kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.' },
    waves: { bass: 'triangle', arp: 'triangle', lead: 'square', pad: 'sine' },
  },
  apartment: {
    bpm: 112, root: 55, scale: MINOR, chords: [0, 5, 3, 4],
    bass: [0, _, 0, _, 0, _, 4, _, 0, _, 0, _, 5, _, 4, _],
    arp: [0, 2, 4, 2, 0, 2, 4, 7, 4, 2, 0, 2, 4, 2, 7, 4],
    lead: [4, _, 5, _, 7, _, _, _, 6, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, 9, _, 7, _, _, _, _, _, _, _],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    waves: { bass: 'triangle', arp: 'square', lead: 'square', pad: 'triangle' },
  },
  sewers: {
    bpm: 90, root: 50, scale: PHRYGIAN, chords: [0, 1, 0, 4],
    bass: [0, _, _, _, _, _, 0, _, _, _, _, _, 4, _, _, _],
    arp: [7, _, _, _, _, _, 4, _, _, 7, _, _, _, _, _, 2],
    lead: [7, _, _, _, _, _, 6, _, 4, _, _, _, _, _, _, _, 3, _, _, _, 4, _, _, _, 1, _, _, _, _, _, _, _],
    drums: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'sawtooth', arp: 'sine', lead: 'sine', pad: 'triangle' }, cutoff: { bass: 500 },
  },
  boiler: {
    bpm: 126, root: 48, scale: HARMONIC, chords: [0, 0, 5, 6],
    bass: [0, _, 0, 0, _, 0, _, 0, 0, _, 0, 0, _, 0, 7, _],
    arp: [0, _, 4, _, 7, _, 4, _, 0, _, 4, _, 7, _, 9, _],
    lead: [7, _, 7, _, _, _, 6, 7, 9, _, _, _, 7, _, _, _, 7, _, 7, _, _, _, 6, 7, 11, _, _, _, 9, _, _, _],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'sawtooth', arp: 'square', lead: 'square', pad: 'triangle' }, cutoff: { bass: 900 },
  },
  catacombs: {
    bpm: 80, root: 52, scale: HARMONIC, chords: [0, 5, 2, 4],
    bass: [0, _, _, _, _, _, _, _, 4, _, _, _, _, _, _, _],
    arp: [7, _, _, 4, _, _, 2, _, 4, _, _, _, 9, _, _, _],
    lead: [4, _, _, _, 5, _, _, _, 6, _, _, _, 4, _, _, _, 2, _, _, _, 3, _, _, _, 4, _, _, _, _, _, _, _],
    drums: { kick: 'x.......x.......', snare: '..........x.....', hat: '....x.......x...' },
    waves: { bass: 'sine', arp: 'sine', lead: 'triangle', pad: 'triangle' },
  },
  studio: {
    bpm: 136, root: 53, scale: MIXOLYDIAN, chords: [0, 3, 4, 0],
    bass: [0, _, 0, _, 4, _, 0, _, 0, _, 0, _, 4, _, 5, _],
    arp: [0, 4, 7, 4, 0, 4, 7, 9, 7, 4, 0, 4, 7, 9, 11, 9],
    lead: [7, _, 9, _, 11, _, 9, _, 7, _, _, _, 4, _, _, _, 7, _, 9, _, 11, _, 12, _, 11, _, 9, _, 7, _, _, _],
    drums: { kick: 'x...x...x...x..x', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'square', arp: 'triangle', lead: 'square', pad: 'triangle' },
  },
  casino: {
    bpm: 118, root: 50, scale: MIXOLYDIAN, chords: [0, 3, 0, 4],
    bass: [0, _, 4, _, 0, _, 4, _, 3, _, 5, _, 4, _, 2, _],
    arp: [0, _, 2, 4, _, 2, 4, _, 7, _, 4, 2, _, 4, 2, _],
    lead: [9, _, _, 7, 9, _, 11, _, 9, _, 7, _, 4, _, _, _, 7, _, _, 4, 7, _, 9, _, 7, _, 4, _, 2, _, _, _],
    drums: { kick: 'x.....x.x.....x.', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' },
    waves: { bass: 'triangle', arp: 'square', lead: 'triangle', pad: 'triangle' },
  },
  hunting: {
    bpm: 102, root: 52, scale: DORIAN, chords: [0, 3, 4, 0],
    bass: [0, _, _, 0, 4, _, _, 4, 3, _, _, 3, 4, _, _, 2],
    arp: [0, 2, 4, 7, 4, 2, 0, 2, 3, 5, 7, 5, 4, 2, 0, 2],
    lead: [4, _, 5, _, 7, _, _, 5, 4, _, 2, _, 4, _, _, _, 5, _, 7, _, 9, _, _, 7, 5, _, 4, _, 2, _, _, _],
    drums: { kick: 'x.......x.......', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'triangle', arp: 'triangle', lead: 'square', pad: 'sine' },
  },
  hive: {
    bpm: 108, root: 49, scale: PHRYGIAN_DOMINANT, chords: [0, 1, 0, 4],
    bass: [0, _, 0, _, _, 0, _, 0, 1, _, 1, _, _, 1, _, 4],
    arp: [0, 1, 2, 4, 2, 1, 0, 1, 4, 5, 4, 2, 1, 2, 4, 7],
    lead: [7, _, 8, _, 7, _, 4, _, 5, _, _, _, 4, _, 2, _, 1, _, 2, _, 4, _, 5, _, 4, _, _, _, _, _, _, _],
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx' },
    waves: { bass: 'sawtooth', arp: 'square', lead: 'sawtooth', pad: 'triangle' }, cutoff: { bass: 800 },
  },
  mall: {
    bpm: 96, root: 57, scale: MAJOR, chords: [0, 5, 3, 4],
    bass: [0, _, _, _, 4, _, _, _, 5, _, _, _, 3, _, _, _],
    arp: [0, 2, 4, 7, 4, 2, 0, 2, 4, 7, 9, 7, 4, 2, 0, 2],
    lead: [7, _, _, _, 9, _, 7, _, 4, _, _, _, 5, _, 4, _, 2, _, _, _, 4, _, 5, _, 7, _, _, _, _, _, _, _],
    drums: { kick: 'x.......x.......', snare: '........x.......', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'sine', arp: 'triangle', lead: 'sine', pad: 'triangle' },
  },
  stockade: {
    bpm: 104, root: 46, scale: MINOR, chords: [0, 0, 5, 4],
    bass: [0, _, 0, 0, _, _, 0, _, 0, _, 0, 0, _, _, 3, _],
    arp: [0, _, _, 4, _, _, 7, _, 0, _, _, 4, _, _, 2, _],
    lead: [7, _, _, _, 7, _, 6, _, 4, _, _, _, 2, _, _, _, 3, _, _, _, 4, _, _, _, 2, _, _, _, _, _, _, _],
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'sawtooth', arp: 'square', lead: 'square', pad: 'triangle' }, cutoff: { bass: 600 },
  },
  archive: {
    bpm: 84, root: 50, scale: HARMONIC, chords: [0, 5, 1, 4],
    bass: [0, _, _, _, _, _, _, _, 4, _, _, _, _, _, 3, _],
    arp: [0, _, 4, _, 7, _, 11, _, 7, _, 4, _, 3, _, 4, _],
    lead: [11, _, _, _, 9, _, _, _, 7, _, _, _, 8, _, _, _, 7, _, _, _, 5, _, _, _, 4, _, _, _, _, _, _, _],
    drums: { kick: 'x.......x.......', snare: '................', hat: '..x.......x.....' },
    waves: { bass: 'sine', arp: 'triangle', lead: 'sine', pad: 'sine' },
  },
  core: {
    bpm: 128, root: 45, scale: PHRYGIAN, chords: [0, 1, 0, 4],
    bass: [0, _, 0, _, 0, 0, _, 0, 1, _, 1, _, 1, 1, _, 4],
    arp: [0, 4, 7, 4, 0, 4, 8, 4, 1, 5, 8, 5, 4, 7, 9, 7],
    lead: [7, _, 8, _, 7, _, 4, _, 5, _, _, _, 4, _, 1, _, 0, _, 1, _, 4, _, 5, _, 7, _, _, _, _, _, _, _],
    drums: { kick: 'x...x...x...x..x', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx' },
    waves: { bass: 'sawtooth', arp: 'square', lead: 'sawtooth', pad: 'triangle' }, cutoff: { bass: 1000 },
  },
  // short, sad, plays once
  dead: {
    bpm: 60, root: 52, scale: MINOR, chords: [0, 5], bars: 2, loop: false, alwaysCombat: true,
    bass: [0, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    arp: [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
    lead: [7, _, _, _, 6, _, _, _, 4, _, _, _, 2, _, _, _, 3, _, _, _, 2, _, _, _, 0, _, _, _, _, _, _, _],
    drums: { kick: '................', snare: '................', hat: '................' },
    waves: { bass: 'triangle', arp: 'sine', lead: 'triangle', pad: 'sine' },
  },
  won: {
    bpm: 120, root: 55, scale: MAJOR, chords: [0, 3, 4, 0], alwaysCombat: true,
    bass: [0, _, 0, _, 0, _, 0, _, 3, _, 3, _, 4, _, 4, _],
    arp: [0, 2, 4, 2, 0, 2, 4, 7, 3, 5, 7, 5, 4, 6, 8, 6],
    lead: [4, _, 4, 5, 7, _, _, _, 7, _, 9, _, 7, _, 4, _, 5, _, 5, 4, 5, _, 7, _, 9, _, _, _, _, _, _, _],
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    waves: { bass: 'triangle', arp: 'triangle', lead: 'square', pad: 'triangle' },
  },
};

// The fight music: the floor's own scale and key, but faster, with a driving bass and full drums.
function bossTheme(base, root) {
  return {
    bpm: base.bpm + 28, root, scale: base.scale, chords: [0, 0, 5, 1], alwaysCombat: true,
    bass: [0, 0, _, 0, 0, 0, _, 0, 0, 0, _, 0, 4, 4, _, 5],
    arp: [0, 4, 7, 4, 0, 4, 7, 4, 0, 4, 7, 4, 0, 4, 9, 7],
    lead: [7, _, _, 7, _, 7, _, _, 9, _, 7, _, 6, _, _, _, 7, _, _, 7, _, 7, _, _, 11, _, 9, _, 7, _, _, _],
    drums: { kick: 'x..xx..xx..xx.x.', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx' },
    waves: { bass: 'sawtooth', arp: 'square', lead: 'sawtooth', pad: 'triangle' }, cutoff: { bass: 1200 },
  };
}
MUSIC.boss0 = bossTheme(MUSIC.apartment, 55);
MUSIC.boss1 = bossTheme(MUSIC.sewers, 50);
MUSIC.boss2 = bossTheme(MUSIC.boiler, 48);
MUSIC.boss3 = bossTheme(MUSIC.catacombs, 52);
MUSIC.boss4 = bossTheme(MUSIC.studio, 53);
MUSIC.boss5 = bossTheme(MUSIC.casino, 50);
MUSIC.boss6 = bossTheme(MUSIC.hunting, 52);
MUSIC.boss7 = bossTheme(MUSIC.hive, 49);
MUSIC.boss8 = bossTheme(MUSIC.mall, 57);
MUSIC.boss9 = bossTheme(MUSIC.stockade, 46);
MUSIC.boss10 = bossTheme(MUSIC.archive, 50);
MUSIC.boss11 = bossTheme(MUSIC.core, 45);

const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);

// The pitch of a scale degree, which may be negative or above 7 (the next octave).
function degreeSemis(scale, d) {
  return scale[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
}

// How many steps a note in a pattern lasts: until the next note, at most max steps.
function holdSteps(pattern, i, max) {
  let n = 1;
  while (n < max && n < pattern.length && pattern[(i + n) % pattern.length] == null) n++;
  return n;
}

// One note of the music: goes into the track's own gain node so the whole tune can fade in and out.
function musicNote(m, o) {
  const c = audio.ctx, g = c.createGain(), osc = c.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.t);
  const attack = o.attack || 0.006, end = o.t + o.dur;
  g.gain.setValueAtTime(0.0001, o.t);
  g.gain.linearRampToValueAtTime(o.vol, o.t + attack);
  if (o.sustain) g.gain.setValueAtTime(o.vol, Math.max(o.t + attack, end - 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, end);
  let node = osc;
  if (o.cutoff) {
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = o.cutoff;
    osc.connect(filter);
    node = filter;
  }
  node.connect(g);
  g.connect(m.gain);
  osc.start(o.t);
  osc.stop(end + 0.03);
}

function musicNoise(m, o) {
  const c = audio.ctx, src = c.createBufferSource(), filter = c.createBiquadFilter(), g = c.createGain();
  src.buffer = audio.noise;
  src.loop = true;
  filter.type = o.filter;
  filter.frequency.value = o.freq;
  g.gain.setValueAtTime(o.vol, o.t);
  g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(m.gain);
  src.start(o.t, Math.random() * 0.5);
  src.stop(o.t + o.dur + 0.03);
}

function scheduleStep(m) {
  const d = m.def, t = m.time, stepDur = 60 / d.bpm / 4;
  const s = m.step % 16, bar = Math.floor(m.step / 16), chord = d.chords[bar % d.chords.length];
  const combat = d.alwaysCombat || audio.combat;
  const pitch = (offset, shift) => midiHz(d.root + shift + degreeSemis(d.scale, chord + offset));

  // one soft chord per bar
  if (s === 0) {
    for (const offset of [0, 2, 4]) {
      musicNote(m, { freq: pitch(offset, 0), t, dur: stepDur * 15, type: d.waves.pad, vol: 0.03, attack: 0.25, sustain: true });
    }
  }
  const bass = d.bass[s];
  if (bass != null) {
    musicNote(m, { freq: pitch(bass, -12), t, dur: holdSteps(d.bass, s, 8) * stepDur * 0.92, type: d.waves.bass, vol: 0.15, cutoff: d.cutoff && d.cutoff.bass });
  }
  const arp = d.arp[s];
  if (arp != null) {
    musicNote(m, { freq: pitch(arp, 12), t, dur: holdSteps(d.arp, s, 2) * stepDur * 0.85, type: d.waves.arp, vol: combat ? 0.065 : 0.045 });
  }
  if (combat) {
    const li = m.step % d.lead.length, lead = d.lead[li];
    if (lead != null) {
      musicNote(m, { freq: pitch(lead, 12), t, dur: holdSteps(d.lead, li, 8) * stepDur * 0.9, type: d.waves.lead, vol: 0.075 });
    }
    if (d.drums.kick[s] === 'x') {
      const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.13);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g);
      g.connect(m.gain);
      o.start(t);
      o.stop(t + 0.23);
    }
    if (d.drums.snare[s] === 'x') {
      musicNoise(m, { t, dur: 0.13, vol: 0.2, filter: 'bandpass', freq: 2200 });
      musicNote(m, { freq: 190, t, dur: 0.08, type: 'triangle', vol: 0.1 });
    }
    if (d.drums.hat[s] === 'x') musicNoise(m, { t, dur: 0.03, vol: 0.06, filter: 'highpass', freq: 7000 });
  }
}

function startMusic(name) {
  const c = audio.ctx, def = MUSIC[name];
  stopMusic();
  if (!def) return;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.setTargetAtTime(1, c.currentTime, 0.12);
  gain.connect(audio.musicFilter);
  audio.music = { name, def, gain, time: c.currentTime + 0.08, step: 0 };
}

function stopMusic() {
  const m = audio.music;
  if (!m) return;
  m.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1);
  setTimeout(() => { try { m.gain.disconnect(); } catch (e) { /* already gone */ } }, 900);
  audio.music = null;
}

// Which tune should play right now?
function wantedTrack() {
  if (state === 'title' || state === 'shop' || !world) return 'title';
  if (state === 'dead') return 'dead';
  if (state === 'won') return 'won';
  if (world.enemies.some(e => ENEMIES[e.type].boss && e.chasing)) return 'boss' + world.levelIndex;
  return LEVEL_ORDER[world.levelIndex];
}

// Called a few times a second: picks the tune, sets the volumes and schedules the next notes a little ahead of time.
function updateMusic() {
  const c = audio.ctx;
  if (!c || c.state !== 'running') return;
  const want = wantedTrack();
  if (want !== audio.wanted) {
    audio.wanted = want;
    startMusic(want);
  }
  if (state === 'playing' && world && world.enemies.some(e => e.chasing)) audio.combatUntil = c.currentTime + 2.5;
  audio.combat = c.currentTime < audio.combatUntil;
  // while the game is paused or the bag is open the music goes dull and quiet
  const quiet = state === 'pause' || state === 'bag' || state === 'levelup';
  audio.musicBus.gain.setTargetAtTime(OPTIONS.music ? AUDIO.music * (quiet ? 0.6 : 1) : 0, c.currentTime, 0.08);
  audio.musicFilter.frequency.setTargetAtTime(quiet ? 500 : 18000, c.currentTime, 0.08);

  const m = audio.music;
  if (!m || !OPTIONS.music) return;
  if (m.time < c.currentTime) m.time = c.currentTime + 0.05;   // the page was busy: skip ahead instead of rushing
  const stepDur = 60 / m.def.bpm / 4;
  while (m.time < c.currentTime + 0.3) {
    if (m.def.loop === false && m.step >= m.def.bars * 16) return;
    scheduleStep(m);
    m.time += stepDur;
    m.step++;
  }
}
