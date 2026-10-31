export type AudioCue =
  | 'appReady'
  | 'heldCoinLand'
  | 'standardWin'
  | 'coinValueHigh'
  | 'chargeUnit'
  | 'uiWarning'
  | 'gambleOpen'
  | 'wildReveal'
  | 'cabinetSlap'
  | 'respinReset'
  | 'wildSubstitute'
  | 'chargeAward'
  | 'reelMotion'
  | 'coinStormTrigger'
  | 'gambleMissTail'
  | 'gambleMissImpact'
  | 'stepperTick'
  | 'bigWinMusic'
  | 'brightSynth'
  | 'uiPress'
  | 'transitionWhoosh'
  | 'paylineHit'
  | 'gambleClose'
  | 'featureMusic'
  | 'featureComplete'
  | 'wetRustle'
  | 'frogCroak'
  | 'counterDown'
  | 'shortVocalCry'
  | 'spinMowerStart'
  | 'freeSpinEngine'
  | 'birdCoo'
  | 'coinRespinWhoosh'
  | 'fuelPour'
  | 'noWin'
  | 'tensionTick'
  | 'coinPayoutRoll'
  | 'brightGlock'
  | 'cashBurst'
  | 'reelStop'
  | 'freshSession'
  | 'reelStopAlt'
  | 'fastTick'
  | 'stormAmbience'
  | 'baseMusic'
  | 'gambleMusic'
  | 'sessionMusic'
  | 'coinLightning1'
  | 'coinLightning2'
  | 'coinLightning3'
  | 'scatterLand'
  | 'stormBoltLand'
  | 'urScatterLand'
  | 'wildHum'
  | 'thunderChargeFull';

type AudioKind = 'sfx' | 'music' | 'ambience';

type AudioAsset = {
  file: string;
  volume: number;
  kind: AudioKind;
  loop?: boolean;
  maxVoices?: number;
  cooldownMs?: number;
};

export type AudioCategory = AudioKind;

const AUDIO_ROOT = '/audio/thunder-cut/';

export const AUDIO_ASSETS: Record<AudioCue, AudioAsset> = {
  appReady: { file: '01_Musical_Sting_With_Vocal_Pop.wav', volume: 0.22, kind: 'sfx', cooldownMs: 1000 },
  heldCoinLand: { file: '02_Glass_Clink_Ping.wav', volume: 0.42, kind: 'sfx', maxVoices: 8, cooldownMs: 24 },
  standardWin: { file: '03_Musical_Rattle_Sting.wav', volume: 0.43, kind: 'sfx', cooldownMs: 250 },
  coinValueHigh: { file: '04_Ding_Glass_Tinkle.wav', volume: 0.4, kind: 'sfx', maxVoices: 3, cooldownMs: 60 },
  chargeUnit: { file: '05_Electronic_Throb_Sting.wav', volume: 0.26, kind: 'sfx', maxVoices: 4, cooldownMs: 70 },
  uiWarning: { file: '06_Alarm_Pop_Sting.wav', volume: 0.28, kind: 'sfx', cooldownMs: 350 },
  gambleOpen: { file: '07_Whoosh_Pop_Ping.wav', volume: 0.32, kind: 'sfx', cooldownMs: 250 },
  wildReveal: { file: '08_Electronic_Synth_Sting.wav', volume: 0.34, kind: 'sfx', maxVoices: 2, cooldownMs: 160 },
  cabinetSlap: { file: '09_Impact_Pop.wav', volume: 0.3, kind: 'sfx', cooldownMs: 120 },
  respinReset: { file: '10_Ding_Dong_Tinkle.wav', volume: 0.4, kind: 'sfx', cooldownMs: 220 },
  wildSubstitute: { file: '11_Musical_Sting_With_Vocal_Whoosh.wav', volume: 0.4, kind: 'sfx', cooldownMs: 280 },
  chargeAward: { file: '12_Electronic_Siren_Sting.wav', volume: 0.45, kind: 'sfx', cooldownMs: 600 },
  reelMotion: { file: '13_Rolling_Mechanical_Rumble.wav', volume: 0.22, kind: 'sfx', loop: true },
  coinStormTrigger: { file: '14_Rising_Engine_Rev_Music.wav', volume: 0.48, kind: 'sfx', cooldownMs: 700 },
  gambleMissTail: { file: '15_Glass_Shatter.wav', volume: 0.42, kind: 'sfx', cooldownMs: 300 },
  gambleMissImpact: { file: '16_Glass_Shatter_Impact.wav', volume: 0.48, kind: 'sfx', cooldownMs: 300 },
  stepperTick: { file: '17_Glass_Clink_Tail.wav', volume: 0.18, kind: 'sfx', maxVoices: 2, cooldownMs: 45 },
  bigWinMusic: { file: '18_Long_Video_Game_Win_Music.wav', volume: 0.48, kind: 'music', cooldownMs: 1000 },
  brightSynth: { file: '19_Bright_Synth_Sting.wav', volume: 0.42, kind: 'sfx', cooldownMs: 280 },
  uiPress: { file: '20_Short_Low_Vocal_Blip.wav', volume: 0.16, kind: 'sfx', maxVoices: 2, cooldownMs: 45 },
  transitionWhoosh: { file: '21_Whoosh_Arrow_Burst.wav', volume: 0.3, kind: 'sfx', cooldownMs: 180 },
  paylineHit: { file: '22_Ping_Clink_Ding.wav', volume: 0.28, kind: 'sfx', maxVoices: 5, cooldownMs: 55 },
  gambleClose: { file: '23_Passing_Siren_Sweep.wav', volume: 0.25, kind: 'sfx', cooldownMs: 220 },
  featureMusic: { file: '24_Video_Game_Music_Loop.wav', volume: 0.23, kind: 'music', loop: true },
  featureComplete: { file: '25_Short_Music_Jingle.wav', volume: 0.4, kind: 'sfx', cooldownMs: 400 },
  wetRustle: { file: '26_Static_Water_Rustle.wav', volume: 0.2, kind: 'sfx', cooldownMs: 600 },
  frogCroak: { file: '27_Frog_Croak.wav', volume: 0.19, kind: 'sfx', cooldownMs: 1000 },
  counterDown: { file: '28_Telephone_Alarm_Tick.wav', volume: 0.24, kind: 'sfx', cooldownMs: 180 },
  shortVocalCry: { file: '29_Short_Vocal_Cry.wav', volume: 0.3, kind: 'sfx', cooldownMs: 350 },
  spinMowerStart: { file: '30_Engine_Start_Rev.wav', volume: 0.38, kind: 'sfx', cooldownMs: 350 },
  freeSpinEngine: { file: '31_Motorboat_Style_Engine.wav', volume: 0.27, kind: 'sfx', cooldownMs: 250 },
  birdCoo: { file: '32_Birdlike_Coo.wav', volume: 0.16, kind: 'sfx', cooldownMs: 1200 },
  coinRespinWhoosh: { file: '33_Spray_Whoosh.wav', volume: 0.32, kind: 'sfx', cooldownMs: 240 },
  fuelPour: { file: '34_Liquid_Pour_Clink.wav', volume: 0.3, kind: 'sfx', cooldownMs: 500 },
  noWin: { file: '35_Crunch_Squish_Crack.wav', volume: 0.22, kind: 'sfx', cooldownMs: 350 },
  tensionTick: { file: '36_Clock_Ticking.wav', volume: 0.2, kind: 'sfx', loop: true },
  coinPayoutRoll: { file: '37_Long_Coin_Clink_Payout_Roll.wav', volume: 0.42, kind: 'sfx', cooldownMs: 700 },
  brightGlock: { file: '38_Bright_Synth_Glockenspiel.wav', volume: 0.43, kind: 'sfx', maxVoices: 3, cooldownMs: 110 },
  cashBurst: { file: '39_Glass_Clink_Percussion.wav', volume: 0.34, kind: 'sfx', cooldownMs: 180 },
  reelStop: { file: '40_Mechanical_Rattle.wav', volume: 0.3, kind: 'sfx', maxVoices: 5, cooldownMs: 0 },
  freshSession: { file: '41_Engine_Start_Impact.wav', volume: 0.38, kind: 'sfx', cooldownMs: 700 },
  reelStopAlt: { file: '42_Scrape_Clatter_Rattle.wav', volume: 0.28, kind: 'sfx', maxVoices: 3, cooldownMs: 0 },
  fastTick: { file: '43_Fast_Clockwork_Ticking.wav', volume: 0.2, kind: 'sfx', loop: true },
  stormAmbience: { file: 'ambience_storm_rain_loop.ogg', volume: 0.12, kind: 'ambience', loop: true },
  baseMusic: { file: 'music_base_game_loop.ogg', volume: 0.22, kind: 'music', loop: true },
  gambleMusic: { file: 'music_gamble_loop.ogg', volume: 0.21, kind: 'music', loop: true },
  sessionMusic: { file: 'music_session_summary.ogg', volume: 0.18, kind: 'music', loop: true },
  coinLightning1: { file: 'sfx_coin_storm_lightning_01.wav', volume: 0.36, kind: 'sfx', cooldownMs: 900 },
  coinLightning2: { file: 'sfx_coin_storm_lightning_02.wav', volume: 0.38, kind: 'sfx', cooldownMs: 900 },
  coinLightning3: { file: 'sfx_coin_storm_lightning_03.wav', volume: 0.42, kind: 'sfx', cooldownMs: 900 },
  scatterLand: { file: 'sfx_scatter_land.wav', volume: 0.42, kind: 'sfx', maxVoices: 4, cooldownMs: 55 },
  stormBoltLand: { file: 'sfx_storm_bolt_land.wav', volume: 0.34, kind: 'sfx', maxVoices: 4, cooldownMs: 70 },
  urScatterLand: { file: 'sfx_ur_scattered_land.wav', volume: 0.48, kind: 'sfx', maxVoices: 4, cooldownMs: 90 },
  wildHum: { file: 'sfx_wild_hum_loop.wav', volume: 0.1, kind: 'ambience', loop: true },
  thunderChargeFull: { file: 'stinger_thunder_charge_full.wav', volume: 0.55, kind: 'sfx', cooldownMs: 2500 },
};

const CRITICAL_PRELOAD_CUES: AudioCue[] = [
  'stepperTick', 'uiPress', 'uiWarning', 'cabinetSlap', 'spinMowerStart',
  'reelMotion', 'reelStop', 'reelStopAlt', 'paylineHit', 'standardWin',
  'cashBurst', 'stormAmbience', 'baseMusic', 'scatterLand', 'stormBoltLand',
  'urScatterLand', 'wildReveal', 'wildSubstitute', 'heldCoinLand', 'chargeUnit',
];

const AUDIO_BANKS: Record<'feature' | 'gamble' | 'session' | 'wins', AudioCue[]> = {
  feature: [
    'coinStormTrigger', 'coinRespinWhoosh', 'respinReset', 'coinValueHigh', 'counterDown',
    'shortVocalCry', 'featureComplete', 'fastTick', 'tensionTick', 'coinPayoutRoll',
    'brightGlock', 'brightSynth', 'chargeAward', 'transitionWhoosh', 'freeSpinEngine',
    'coinLightning1', 'coinLightning2', 'coinLightning3', 'thunderChargeFull',
  ],
  gamble: ['gambleOpen', 'gambleClose', 'gambleMissImpact', 'gambleMissTail', 'gambleMusic', 'fastTick', 'tensionTick'],
  session: ['freshSession', 'sessionMusic'],
  wins: ['bigWinMusic', 'brightGlock', 'brightSynth', 'chargeAward', 'coinPayoutRoll', 'coinLightning1', 'coinLightning2', 'coinLightning3'],
};

const PRIORITY_FOUR = new Set<AudioCue>([
  'bigWinMusic', 'thunderChargeFull', 'urScatterLand', 'coinLightning3', 'chargeAward',
]);
const PRIORITY_THREE = new Set<AudioCue>([
  'coinStormTrigger', 'scatterLand', 'wildReveal', 'wildSubstitute', 'brightSynth',
  'brightGlock', 'gambleMissImpact', 'gambleMissTail', 'coinLightning1', 'coinLightning2',
]);

type PlayOptions = {
  delayMs?: number;
  duckMs?: number;
};

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}

export class ThunderAudioController {
  private templates = new Map<AudioCue, HTMLAudioElement>();
  private activeVoices = new Map<AudioCue, HTMLAudioElement[]>();
  private activeLoops = new Map<AudioCue, HTMLAudioElement>();
  private desiredLoops = new Set<AudioCue>();
  private desiredMusic: AudioCue | null = null;
  private currentMusic: { cue: AudioCue; audio: HTMLAudioElement } | null = null;
  private lastPlayedAt = new Map<AudioCue, number>();
  private timers = new Map<number, AudioCue>();
  private fadeTimers = new Map<number, HTMLAudioElement>();
  private duckTimer: number | null = null;
  private duckUntil = 0;
  private duckFactor = 1;
  private musicGeneration = 0;
  private unlocked = false;
  private readyCuePlayed = false;
  private disposed = false;
  private suspended = false;
  private masterVolume = 1;
  private muted = false;
  private categoryVolumes: Record<AudioCategory, number> = { sfx: 1, music: 1, ambience: 1 };
  private exclusiveUntil = 0;
  private cueGains = new Map<AudioCue, number>();

  preload() {
    if (this.disposed || this.templates.size > 0) return;
    CRITICAL_PRELOAD_CUES.forEach((cue) => this.ensureTemplate(cue, true));
  }

  preloadBank(bank: keyof typeof AUDIO_BANKS) {
    if (this.disposed) return;
    AUDIO_BANKS[bank].forEach((cue) => this.ensureTemplate(cue, true));
  }

  unlock(playReadyCue = true) {
    if (this.disposed) return;
    this.unlocked = true;
    if (!this.suspended) {
      this.applyDesiredMusic();
      [...this.desiredLoops].forEach((cue) => this.startLoopNow(cue));
    }
    if (playReadyCue && !this.readyCuePlayed) {
      this.readyCuePlayed = true;
      this.playSfx('appReady');
    }
  }

  playSfx(cue: AudioCue, options: PlayOptions = {}) {
    if (this.disposed || this.suspended || !this.unlocked) return;
    if (options.delayMs && options.delayMs > 0) {
      const timer = window.setTimeout(() => {
        this.timers.delete(timer);
        this.playSfx(cue, { duckMs: options.duckMs });
      }, options.delayMs);
      this.timers.set(timer, cue);
      return;
    }

    const config = AUDIO_ASSETS[cue];
    const now = performance.now();
    const priority = PRIORITY_FOUR.has(cue) ? 4 : PRIORITY_THREE.has(cue) ? 3 : 2;
    if (priority < 3 && now < this.exclusiveUntil) return;
    if (priority === 4) {
      this.exclusiveUntil = Math.max(this.exclusiveUntil, now + (options.duckMs ?? 2200));
      this.stopLowerPriorityVoices();
    }
    const lastPlayed = this.lastPlayedAt.get(cue) ?? -Infinity;
    if (now - lastPlayed < (config.cooldownMs ?? 0)) return;
    const voices = this.activeVoices.get(cue) ?? [];
    if (voices.length >= (config.maxVoices ?? 1)) return;
    const template = this.ensureTemplate(cue, false);
    if (!template) return;

    const audio = template.cloneNode(true) as HTMLAudioElement;
    audio.loop = false;
    audio.volume = this.cueVolume(cue);
    voices.push(audio);
    this.activeVoices.set(cue, voices);
    this.lastPlayedAt.set(cue, now);

    const cleanup = () => {
      const nextVoices = (this.activeVoices.get(cue) ?? []).filter((voice) => voice !== audio);
      if (nextVoices.length > 0) this.activeVoices.set(cue, nextVoices);
      else this.activeVoices.delete(cue);
      audio.removeEventListener('ended', cleanup);
      audio.removeEventListener('error', cleanup);
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
    void audio.play().catch(cleanup);
    if (options.duckMs) this.duckMusic(options.duckMs);
  }

  playSequence(cue: AudioCue, count: number, intervalMs = 70, maximum = 8, initialDelayMs = 0) {
    const plays = Math.min(Math.max(0, count), maximum);
    for (let index = 0; index < plays; index += 1) {
      this.playSfx(cue, { delayMs: initialDelayMs + index * intervalMs });
    }
  }

  setLoop(cue: AudioCue, enabled: boolean) {
    if (enabled) {
      this.desiredLoops.add(cue);
      if (this.unlocked) this.startLoopNow(cue);
    } else {
      this.desiredLoops.delete(cue);
      this.stopLoop(cue);
    }
  }

  stopLoop(cue: AudioCue) {
    const audio = this.activeLoops.get(cue);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    this.activeLoops.delete(cue);
  }

  setMusic(cue: AudioCue | null) {
    this.desiredMusic = cue;
    if (cue) this.ensureTemplate(cue, true);
    if (this.unlocked && !this.suspended) this.applyDesiredMusic();
  }

  stopCue(cue: AudioCue) {
    this.timers.forEach((scheduledCue, timer) => {
      if (scheduledCue !== cue) return;
      window.clearTimeout(timer);
      this.timers.delete(timer);
    });
    (this.activeVoices.get(cue) ?? []).forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeVoices.delete(cue);
    this.stopLoop(cue);
  }

  duckMusic(durationMs: number, factor = 0.35) {
    const now = performance.now();
    this.duckUntil = Math.max(this.duckUntil, now + durationMs);
    this.duckFactor = Math.min(this.duckFactor, factor);
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    if (this.currentMusic) this.currentMusic.audio.volume = this.musicTargetVolume(this.currentMusic.cue);
    this.duckTimer = window.setTimeout(() => {
      this.duckUntil = 0;
      this.duckFactor = 1;
      if (this.currentMusic) this.currentMusic.audio.volume = this.cueVolume(this.currentMusic.cue);
      this.duckTimer = null;
    }, Math.max(0, this.duckUntil - now));
  }

  setMasterVolume(volume: number) {
    this.masterVolume = clampVolume(volume);
    this.refreshVolumes();
  }

  setCategoryVolume(category: AudioCategory, volume: number) {
    this.categoryVolumes[category] = clampVolume(volume);
    this.refreshVolumes();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.refreshVolumes();
  }

  setCueGain(cue: AudioCue, gain: number) {
    this.cueGains.set(cue, Math.max(0, gain));
    this.refreshVolumes();
  }

  suspend() {
    if (this.disposed || this.suspended) return;
    this.suspended = true;
    this.musicGeneration += 1;
    this.clearFadeTimers();
    this.activeLoops.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    this.activeLoops.clear();
    this.timers.forEach((_, timer) => window.clearTimeout(timer));
    this.timers.clear();
    this.activeVoices.forEach((voices) => voices.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    }));
    this.activeVoices.clear();
    if (this.currentMusic) {
      this.currentMusic.audio.pause();
      this.currentMusic.audio.currentTime = 0;
      this.currentMusic = null;
    }
  }

  resume() {
    if (this.disposed || !this.suspended) return;
    this.suspended = false;
    if (!this.unlocked) return;
    this.applyDesiredMusic();
    [...this.desiredLoops].forEach((cue) => this.startLoopNow(cue));
  }

  dispose() {
    this.disposed = true;
    this.musicGeneration += 1;
    this.clearFadeTimers();
    if (this.duckTimer !== null) window.clearTimeout(this.duckTimer);
    this.timers.forEach((_, timer) => window.clearTimeout(timer));
    this.timers.clear();
    this.activeVoices.forEach((voices) => voices.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    }));
    this.activeLoops.forEach((audio) => {
      audio.pause();
      audio.currentTime = 0;
    });
    if (this.currentMusic) {
      this.currentMusic.audio.pause();
      this.currentMusic.audio.currentTime = 0;
    }
    this.activeVoices.clear();
    this.activeLoops.clear();
    this.currentMusic = null;
    this.cueGains.clear();
    this.templates.clear();
  }

  private startLoopNow(cue: AudioCue) {
    if (this.suspended || this.activeLoops.has(cue) || !this.desiredLoops.has(cue)) return;
    const template = this.ensureTemplate(cue, true);
    if (!template) return;
    const audio = template.cloneNode(true) as HTMLAudioElement;
    audio.loop = true;
    audio.volume = this.cueVolume(cue);
    this.activeLoops.set(cue, audio);
    void audio.play().catch(() => {
      if (this.activeLoops.get(cue) === audio) this.activeLoops.delete(cue);
    });
  }

  private applyDesiredMusic() {
    if (this.suspended) return;
    const cue = this.desiredMusic;
    if (this.currentMusic?.cue === cue) return;
    const generation = ++this.musicGeneration;
    const previous = this.currentMusic;
    this.currentMusic = null;
    if (previous) this.fadeOutAndStop(previous.audio, 280);
    if (!cue) return;

    const template = this.ensureTemplate(cue, true);
    if (!template) return;
    const audio = template.cloneNode(true) as HTMLAudioElement;
    audio.loop = true;
    audio.volume = 0;
    this.currentMusic = { cue, audio };
    void audio.play().then(() => {
      if (
        this.disposed || this.suspended || generation !== this.musicGeneration ||
        this.currentMusic?.audio !== audio
      ) {
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      this.fadeIn(audio, cue, 360, generation);
    }).catch(() => {
      if (this.currentMusic?.audio === audio) this.currentMusic = null;
    });
  }

  private fadeIn(audio: HTMLAudioElement, cue: AudioCue, durationMs: number, generation: number) {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      if (
        this.disposed || this.suspended || generation !== this.musicGeneration ||
        this.currentMusic?.audio !== audio
      ) {
        window.clearInterval(timer);
        this.fadeTimers.delete(timer);
        audio.pause();
        audio.currentTime = 0;
        return;
      }
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      audio.volume = clampVolume(this.musicTargetVolume(cue) * progress);
      if (progress < 1) return;
      window.clearInterval(timer);
      this.fadeTimers.delete(timer);
    }, 35);
    this.fadeTimers.set(timer, audio);
  }

  private fadeOutAndStop(audio: HTMLAudioElement, durationMs: number) {
    const startingVolume = audio.volume;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
      audio.volume = clampVolume(startingVolume * (1 - progress));
      if (progress < 1) return;
      window.clearInterval(timer);
      this.fadeTimers.delete(timer);
      audio.pause();
      audio.currentTime = 0;
    }, 35);
    this.fadeTimers.set(timer, audio);
  }

  private cueVolume(cue: AudioCue) {
    const cueGain = this.cueGains.get(cue) ?? 1;
    const config = AUDIO_ASSETS[cue];
    return clampVolume(config.volume * cueGain * this.categoryVolumes[config.kind] * this.masterVolume * (this.muted ? 0 : 1));
  }

  private ensureTemplate(cue: AudioCue, eager: boolean) {
    const existing = this.templates.get(cue);
    if (existing) return existing;
    const config = AUDIO_ASSETS[cue];
    const audio = new Audio(`${AUDIO_ROOT}${encodeURIComponent(config.file)}`);
    audio.preload = eager ? 'auto' : 'metadata';
    audio.loop = Boolean(config.loop);
    audio.volume = this.cueVolume(cue);
    this.templates.set(cue, audio);
    if (eager) audio.load();
    return audio;
  }

  private stopLowerPriorityVoices() {
    this.activeVoices.forEach((voices, cue) => {
      if (PRIORITY_FOUR.has(cue) || PRIORITY_THREE.has(cue)) return;
      voices.forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      this.activeVoices.delete(cue);
    });
  }

  private musicTargetVolume(cue: AudioCue) {
    const activeDuck = performance.now() < this.duckUntil ? this.duckFactor : 1;
    return clampVolume(this.cueVolume(cue) * activeDuck);
  }

  private refreshVolumes() {
    this.templates.forEach((audio, cue) => {
      audio.volume = this.cueVolume(cue);
    });
    this.activeVoices.forEach((voices, cue) => {
      voices.forEach((audio) => { audio.volume = this.cueVolume(cue); });
    });
    this.activeLoops.forEach((audio, cue) => {
      audio.volume = this.cueVolume(cue);
    });
    if (this.currentMusic) this.currentMusic.audio.volume = this.musicTargetVolume(this.currentMusic.cue);
  }

  private clearFadeTimers() {
    this.fadeTimers.forEach((audio, timer) => {
      window.clearInterval(timer);
      audio.pause();
      audio.currentTime = 0;
    });
    this.fadeTimers.clear();
  }
}
