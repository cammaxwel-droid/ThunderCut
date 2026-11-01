'use client';

import {
  type CSSProperties,
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Image from 'next/image';
import { MoneyText } from './MoneyText';
import { ThunderText } from './ThunderText';
import { ThunderAudioController } from './audio';
import { CoinValueText } from './coinValues';
import { PaylineTrace } from './PaylineTrace';
import { getMiniMinorCoinValues, roundCoinAmount } from './coinRules';
import {
  advanceThunderProgress,
  mergeCoinStormReasons,
  resolveStoredThunderProgress,
  shouldInstantBoltTrigger,
  THUNDER_INTERVAL_MIN,
} from './gameRules';
import { GAMBLE_MAX_ROUNDS, settleCollectedWin, settleGambleBank } from './settlementRules';
import { SequenceCancelledError, VisualSequenceController } from './sequence';

declare global {
  interface Window {
    thunderCutHost?: {
      getLaunchContext: () => Promise<unknown>;
      readGameTransaction?: () => { ok: boolean; found?: boolean; value?: string | null };
      writeGameTransaction?: (value: string | null) => boolean;
      getFullscreen?: () => Promise<boolean>;
      setFullscreen?: (next: boolean) => Promise<boolean>;
      onFullscreenChange?: (callback: (fullscreen: boolean) => void) => () => void;
    };
  }
}

type SymbolKey =
  | 'grass'
  | 'boots'
  | 'fuel'
  | 'trimmer'
  | 'mower'
  | 'bolt'
  | 'cam'
  | 'rideon'
  | 'wild'
  | 'scatter'
  | 'ur_scattered'
  | 'coin';

type GameSymbol = {
  key: SymbolKey;
  icon: string;
  asset: string;
  label: string;
  metric: string;
  weight: number;
  payouts: Record<3 | 4 | 5, number>;
};

type LineWin = {
  line: number;
  symbol: SymbolKey;
  count: 3 | 4 | 5;
  multiplier: number;
  payout: number;
  cells: number[];
  usedWild: boolean;
};

type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type GambleSuit = CardSuit | null;
type GambleChoice = 'red' | 'black' | CardSuit;
type GambleResult = 'red' | 'black' | null;
type JackpotTier = 'mini' | 'minor' | 'major' | 'grand';
type ReelPhase = 'idle' | 'accelerating' | 'spinning' | 'braking' | 'stopped' | 'settled';
type FreeGameChoice = 'classic-cut';

type GambleHistoryEntry = {
  id: number;
  spin: number;
  round: number;
  choice: GambleChoice;
  outcome: Exclude<GambleSuit, null>;
  rank: string;
  hit: boolean;
  bankBefore: number;
  bankAfter: number;
  multiplier: number;
};

type ReelPreviewSymbol = { key: SymbolKey; coinPrize?: CoinPrize };

type CoinPrize = {
  label: string;
  amount: number;
  tier: Exclude<JackpotTier, 'grand'> | null;
};

type SessionSnapshot = {
  id: number;
  credits: number;
  peakBalance: number;
  spins: number;
  elapsedSeconds: number;
  bestWin?: number;
};

type SessionHighScore = {
  id: number;
  name: string;
  peakBalance: number;
  bestWin: number;
  spins: number;
  elapsedSeconds: number;
};

type PersistedGameTransaction = {
  version: 3;
  savedAt: number;
  sessionStartedAt: number;
  credits: number;
  pendingWin: number;
  pendingWinGambleLocked: boolean;
  gambleRound: number;
  activeLines: number;
  betIndex: number;
  spins: number;
  sessionBestWin: number;
  sessionPeakBalance: number;
  metresMowed: number;
  grid: SymbolKey[];
  baseCoinCells: number[];
  baseCoinPrizes: Record<number, CoinPrize>;
  freeGames: number;
  pendingFreeGameChoice: { games: number; label: string } | null;
  coinFeatureQueued: boolean;
  coinFeatureFromThunderCharge: boolean;
  coinFeatureReasons: string[];
  queuedCoinCells: number[];
  queuedCoinPrizes: Record<number, CoinPrize>;
  coinFeatureBet: number;
  coinFeatureJackpotsEligible: boolean;
  coinFeatureMajorCents: number;
  coinFeatureGrandCents: number;
  coinFeatureOpen: boolean;
  coinField: Array<CoinPrize | null>;
  coinRespinsRemaining: number;
  coinFeatureComplete: boolean;
  coinGrandAward: number;
  coinFullScreenBonus: number;
  majorCents: number;
  grandCents: number;
  thunderLifetimeBolts: number;
  thunderNextTarget: number;
  jackpotCycleStats: JackpotCycleStats;
  jackpotWinStats: JackpotWinStat[];
};

type ThunderAwardRecord = {
  awardId: string;
  featureBet: number;
  seedCells: number[];
  seedPrizes: Record<number, CoinPrize>;
  reasons: string[];
  majorCents: number;
  grandCents: number;
  jackpotsEligible: boolean;
};

type CommitResult =
  | { ok: true }
  | { ok: false; reason: 'ownership-lost' | 'storage-failed' };

type JackpotCycleStats = {
  majorSpins: number;
  majorWagered: number;
  grandSpins: number;
  grandWagered: number;
};

type JackpotWinStat = {
  tier: 'major' | 'grand';
  spins: number;
  wagered: number;
};

type BigWinCelebration = {
  target: number;
  displayed: number;
  label: 'BIG WIN' | 'SUPER WIN' | 'MASSIVE WIN' | 'MAJOR WIN' | 'GRAND WIN';
};

type BigWinRequest = {
  amount: number;
  referenceBet: number;
};

const SYMBOLS: GameSymbol[] = [
  { key: 'grass', icon: '🌿', asset: '/game-art/clippings.webp', label: 'Clippings', metric: '120 L', weight: 210, payouts: { 3: 8, 4: 25, 5: 80 } },
  { key: 'boots', icon: '🥾', asset: '/game-art/work-boots.webp', label: 'Work boots', metric: '200 J', weight: 195, payouts: { 3: 14, 4: 40, 5: 140 } },
  { key: 'fuel', icon: '⛽', asset: '/game-art/fuel-can.webp', label: 'Fuel can', metric: '5 L', weight: 165, payouts: { 3: 20, 4: 70, 5: 210 } },
  { key: 'trimmer', icon: '🛠️', asset: '/game-art/line-trimmer.webp', label: 'Line trimmer', metric: '2.4 mm', weight: 135, payouts: { 3: 35, 4: 130, 5: 430 } },
  { key: 'mower', icon: '⚙️', asset: '/game-art/push-mower.webp', label: 'Push mower', metric: '530 mm', weight: 115, payouts: { 3: 50, 4: 200, 5: 850 } },
  { key: 'bolt', icon: '⚡', asset: '/update-assets/storm-bolt.png', label: 'Storm bolt', metric: '240 km/h', weight: 85, payouts: { 3: 85, 4: 425, 5: 1700 } },
  { key: 'cam', icon: '🧑‍🌾', asset: '/game-art/cam.webp', label: 'Cam', metric: '250 m²', weight: 45, payouts: { 3: 170, 4: 850, 5: 4250 } },
  { key: 'rideon', icon: '🚜', asset: '/game-art/ride-on.webp', label: 'Ride-on', metric: '1.2 m', weight: 35, payouts: { 3: 425, 4: 2500, 5: 17000 } },
  { key: 'wild', icon: 'WILD', asset: '/game-art/wild.webp', label: 'Storm Wild', metric: 'SUBSTITUTE', weight: 15, payouts: { 3: 200, 4: 1000, 5: 5000 } },
  { key: 'scatter', icon: '⛈️', asset: '/game-art/scatter.webp', label: 'Free games', metric: 'SCATTER', weight: 0, payouts: { 3: 0, 4: 0, 5: 0 } },
  { key: 'ur_scattered', icon: '×2', asset: '/game-art/ur-scattered.webp', label: 'UR Scattered', metric: 'SCATTER ×2', weight: 0, payouts: { 3: 0, 4: 0, 5: 0 } },
  { key: 'coin', icon: '$', asset: '/game-art/coin.webp', label: 'Mower coin', metric: 'HOLD', weight: 0, payouts: { 3: 0, 4: 0, 5: 0 } },
];

const BASE_SYMBOLS = SYMBOLS.filter((symbol) => symbol.weight > 0);
const BASE_SYMBOL_WEIGHT = BASE_SYMBOLS.reduce((total, symbol) => total + symbol.weight, 0);

const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 0, 0, 1],
  [1, 2, 2, 2, 1],
  [0, 1, 1, 1, 0],
  [2, 1, 1, 1, 2],
  [0, 1, 0, 1, 0],
  [2, 1, 2, 1, 2],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2],
  [0, 2, 2, 2, 0],
  [2, 0, 0, 0, 2],
  [1, 1, 0, 1, 1],
];

const BET_OPTIONS = [1, 2, 5, 10, 20, 30, 40, 50, 100, 200, 500, 1000, 2500, 5000];
const STANDARD_MAX_BET_INDEX = 7;
const STARTING_CREDITS = 100000;
const HIGH_ROLLER_UNLOCK_CREDITS = 50000;
const SCATTER_REEL_CHANCE = 1175;
const BASE_COIN_CHANCE = 1185;
const FREE_GAME_COIN_CHANCE = 1610;
const UR_SCATTER_UPGRADE_CHANCE = 1800;
const HOLD_COIN_CHANCE = 395;
const COIN_TRIGGER_COUNT = 6;
const HOLD_RESPINS = 3;
const STORM_DOOR_AWARD = 3;
const MAX_FREE_GAMES = 100;
const REEL_ACCELERATION_MS = 260;
const REEL_FULL_SPEED_MS = 900;
const FIRST_REEL_BRAKE_MS = 180;
const REEL_STOP_OFFSET_MS = 150;
const FINAL_REEL_SETTLE_MS = 180;
const COIN_RESPIN_DURATION_MS = 900;
const GAMBLE_DRAW_DURATION_MS = 950;
const BIG_WIN_MULTIPLIER = 20;
const JACKPOT_MIN_LINES = 10;
const JACKPOT_MIN_TOTAL_BET = 300;
const FULL_SCREEN_BONUS_MULTIPLIER = 100;
const RED_SUIT_MULTIPLIER = 2.5;
const BLACK_SUIT_MULTIPLIER = 3.3;
const MAJOR_SEED_CENTS = 10_000_000;
const GRAND_SEED_CENTS = 2_000_000_000;
const MAJOR_GROWTH_RATE = 0.0025;
const GRAND_GROWTH_RATE = 0.005;
const SESSION_LOCK_KEY = 'thunder-cut-session-ended-v1';
const ACTIVE_SESSION_KEY = 'thunder-cut-active-session-v1';
const SESSION_SNAPSHOT_KEY = 'thunder-cut-session-snapshot-v1';
const MAJOR_KEY = 'thunder-cut-major-cents-v1';
const GRAND_KEY = 'thunder-cut-grand-cents-v1';
const THUNDER_CHARGE_KEY = 'thunder-cut-charge-v1';
const THUNDER_LIFETIME_KEY = 'thunder-cut-lifetime-bolts-v2';
const THUNDER_NEXT_TARGET_KEY = 'thunder-cut-next-guarantee-at-v2';
const THUNDER_MIGRATION_KEY = 'thunder-cut-charge-migrated-v2';
const THUNDER_AWARD_PENDING_KEY = 'thunder-cut-charge-award-pending-v1';
const HIGH_ROLLER_KEY = 'thunder-cut-high-roller-v1';
const JACKPOT_CYCLE_STATS_KEY = 'thunder-cut-jackpot-cycle-stats-v1';
const HIGH_SCORES_KEY = 'thunder-cut-high-scores-v1';
const AUDIO_SETTINGS_KEY = 'thunder-cut-audio-settings-v2';
const GAME_TRANSACTION_KEY = 'thunder-cut-game-transaction-v2';
const GAMBLE_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7'];
const GAMBLE_SUITS: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const GAMBLE_CHOICES: GambleChoice[] = ['red', 'black', 'hearts', 'diamonds', 'clubs', 'spades'];
const COIN_PROGRESS_THRESHOLDS = [6, 8, 10, 12, 15];
const COIN_LIGHTNING_CUES = ['coinLightning1', 'coinLightning2', 'coinLightning3'] as const;
const NO_WIN_AUDIO_CUES = ['noWin', 'wetRustle', 'frogCroak', 'birdCoo'] as const;
const EMPTY_JACKPOT_CYCLE_STATS: JackpotCycleStats = {
  majorSpins: 0,
  majorWagered: 0,
  grandSpins: 0,
  grandWagered: 0,
};
const SUIT_GLYPHS: Record<CardSuit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};
const COIN_ART_BY_TIER: Record<JackpotTier, string> = {
  mini: '/game-art/mini.webp',
  minor: '/game-art/minor.webp',
  major: '/game-art/major.webp',
  grand: '/game-art/grand.webp',
};

const STARTING_GRID: SymbolKey[] = [
  'bolt', 'grass', 'cam', 'boots', 'rideon',
  'mower', 'fuel', 'wild', 'trimmer', 'mower',
  'grass', 'boots', 'rideon', 'fuel', 'cam',
];

function randomInt(max: number) {
  const range = 0x100000000;
  const limit = Math.floor(range / max) * max;
  const values = new Uint32Array(1);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}

function randomBaseSymbol(): SymbolKey {
  const roll = randomInt(BASE_SYMBOL_WEIGHT);
  let cursor = 0;
  for (const symbol of BASE_SYMBOLS) {
    cursor += symbol.weight;
    if (roll < cursor) return symbol.key;
  }
  return 'grass';
}

function randomBaseGrid(): SymbolKey[] {
  return Array.from({ length: 15 }, randomBaseSymbol);
}

function jackpotsAreEligible(lineCount: number, totalBet: number) {
  return lineCount >= JACKPOT_MIN_LINES && totalBet >= JACKPOT_MIN_TOTAL_BET;
}

function addFeatureSymbols(baseGrid: SymbolKey[], coinChance: number) {
  const grid = [...baseGrid];
  const scatterCells: number[] = [];
  const urScatterCells: number[] = [];
  const coinCells: number[] = [];

  for (let reel = 1; reel <= 4; reel += 1) {
    if (randomInt(10000) < SCATTER_REEL_CHANCE) {
      const cell = randomInt(3) * 5 + reel;
      const isUrScattered = randomInt(10000) < UR_SCATTER_UPGRADE_CHANCE;
      grid[cell] = isUrScattered ? 'ur_scattered' : 'scatter';
      scatterCells.push(cell);
      if (isUrScattered) urScatterCells.push(cell);
    }
  }

  if (coinChance > 0) {
    for (let cell = 0; cell < 15; cell += 1) {
      if (!scatterCells.includes(cell) && randomInt(10000) < coinChance) {
        grid[cell] = 'coin';
        coinCells.push(cell);
      }
    }
  }

  return { grid, scatterCells, urScatterCells, coinCells };
}

function fillCoinSeedCells(existingCells: number[], scatterCells: number[], minimumCount: number) {
  const cells = new Set(existingCells);
  const available = Array.from({ length: 15 }, (_, index) => index)
    .filter((cell) => !cells.has(cell) && !scatterCells.includes(cell));
  while (cells.size < minimumCount && available.length > 0) {
    const candidateIndex = randomInt(available.length);
    cells.add(available[candidateIndex]);
    available.splice(candidateIndex, 1);
  }
  return [...cells];
}

function getSymbol(key: SymbolKey) {
  return SYMBOLS.find((symbol) => symbol.key === key) ?? SYMBOLS[0];
}

function scoreGrid(grid: SymbolKey[], lineCount: number, betPerLine: number): LineWin[] {
  const wins: LineWin[] = [];
  PAYLINES.slice(0, lineCount).forEach((rows, lineIndex) => {
    const cells = rows.map((row, column) => row * 5 + column);
    const symbols = cells.map((cell) => grid[cell]);
    const first = symbols[0];
    if (first === 'scatter' || first === 'ur_scattered' || first === 'coin') return;

    const candidates: LineWin[] = [];
    const addCandidate = (target: SymbolKey, wildOnly = false) => {
      let count = 0;
      while (
        count < symbols.length &&
        (wildOnly ? symbols[count] === 'wild' : symbols[count] === target || symbols[count] === 'wild')
      ) {
        count += 1;
      }
      if (count < 3) return;

      const matchCount = count as 3 | 4 | 5;
      const multiplier = getSymbol(target).payouts[matchCount];
      candidates.push({
        line: lineIndex + 1,
        symbol: target,
        count: matchCount,
        multiplier,
        payout: multiplier * betPerLine,
        cells: cells.slice(0, count),
        usedWild: symbols.slice(0, count).includes('wild'),
      });
    };

    if (first === 'wild') {
      addCandidate('wild', true);
      const substituteTarget = symbols.find((symbol) => symbol !== 'wild');
      if (
        substituteTarget && substituteTarget !== 'scatter' &&
        substituteTarget !== 'ur_scattered' && substituteTarget !== 'coin'
      ) {
        addCandidate(substituteTarget);
      }
    } else {
      addCandidate(first);
    }

    const bestWin = candidates.sort((left, right) => right.payout - left.payout || right.count - left.count)[0];
    if (bestWin) wins.push(bestWin);
  });
  return wins;
}

function getMiniMinorValues(featureBet: number, majorCents: number) {
  return getMiniMinorCoinValues(featureBet, majorCents);
}

function getJackpotValues(featureBet: number, majorCents: number, grandCents: number) {
  const miniMinor = getMiniMinorValues(featureBet, majorCents);
  return {
    mini: miniMinor.mini,
    minor: miniMinor.minor,
    major: majorCents / 100,
    grand: grandCents / 100,
  };
}

function drawHoldCoin(
  featureBet: number,
  majorCents: number,
  allowMajor: boolean,
): CoinPrize {
  const miniMinor = getMiniMinorValues(featureBet, majorCents);
  const roll = randomInt(100000);
  if (roll < 80000) return { label: '1×', amount: roundCoinAmount(featureBet), tier: null };
  if (roll < 91500) return { label: '2×', amount: roundCoinAmount(featureBet * 2), tier: null };
  if (roll < 94500) return { label: '5×', amount: roundCoinAmount(featureBet * 5), tier: null };
  if (roll < 95000) return { label: '10×', amount: roundCoinAmount(featureBet * 10), tier: null };
  if (roll < 98000) return { label: 'MINI', amount: miniMinor.mini, tier: 'mini' };
  if (roll < 99991 || !allowMajor) return { label: 'MINOR', amount: miniMinor.minor, tier: 'minor' };
  return { label: 'MAJOR', amount: roundCoinAmount(majorCents / 100), tier: 'major' };
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatCredits(value: number) {
  return new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function gambleChoiceLabel(choice: GambleChoice) {
  return choice.charAt(0).toUpperCase() + choice.slice(1);
}

function readLocalValue(key: string) {
  try {
    if (key === GAME_TRANSACTION_KEY && window.thunderCutHost?.readGameTransaction) {
      const saved = window.thunderCutHost.readGameTransaction();
      if (!saved.ok) return null;
      if (saved.found) return saved.value ?? null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key: string, value: string) {
  try {
    if (key === GAME_TRANSACTION_KEY && window.thunderCutHost?.writeGameTransaction) {
      if (!window.thunderCutHost.writeGameTransaction(value)) return false;
      // The desktop record is authoritative; the browser copy supports migration.
      try { window.localStorage.setItem(key, value); } catch {}
      return true;
    }
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeLocalValue(key: string) {
  try {
    if (key === GAME_TRANSACTION_KEY && window.thunderCutHost?.writeGameTransaction) {
      if (!window.thunderCutHost.writeGameTransaction(null)) return false;
      try { window.localStorage.removeItem(key); } catch {}
      return true;
    }
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function readProgressiveCents(key: string, fallback: number, seed: number) {
  const stored = Number(readLocalValue(key));
  return Number.isFinite(stored) && stored >= seed ? stored : fallback;
}

function readThunderProgress(fallbackLifetime = 0, fallbackTarget = 0) {
  const storedLifetimeRaw = readLocalValue(THUNDER_LIFETIME_KEY);
  const storedTargetRaw = readLocalValue(THUNDER_NEXT_TARGET_KEY);
  const legacyRaw = readLocalValue(THUNDER_CHARGE_KEY);
  const resolved = resolveStoredThunderProgress(
    storedLifetimeRaw,
    storedTargetRaw,
    legacyRaw,
    fallbackLifetime,
    fallbackTarget,
    randomInt(1_000_000) / 1_000_000,
  );
  writeLocalValue(THUNDER_LIFETIME_KEY, String(resolved.lifetimeBolts));
  writeLocalValue(THUNDER_NEXT_TARGET_KEY, String(resolved.nextTarget));
  writeLocalValue(THUNDER_MIGRATION_KEY, resolved.migration);
  return { lifetimeBolts: resolved.lifetimeBolts, nextTarget: resolved.nextTarget };
}

function readJackpotCycleStats() {
  try {
    const parsed = JSON.parse(readLocalValue(JACKPOT_CYCLE_STATS_KEY) ?? '') as Partial<JackpotCycleStats>;
    const majorSpins = Number(parsed.majorSpins);
    const majorWagered = Number(parsed.majorWagered);
    const grandSpins = Number(parsed.grandSpins);
    const grandWagered = Number(parsed.grandWagered);
    if (
      Number.isFinite(majorSpins) && majorSpins >= 0 &&
      Number.isFinite(majorWagered) && majorWagered >= 0 &&
      Number.isFinite(grandSpins) && grandSpins >= 0 &&
      Number.isFinite(grandWagered) && grandWagered >= 0
    ) {
      return {
        majorSpins: Math.floor(majorSpins),
        majorWagered: roundMoney(majorWagered),
        grandSpins: Math.floor(grandSpins),
        grandWagered: roundMoney(grandWagered),
      };
    }
  } catch {
    // Start a fresh jackpot cycle if the saved statistics are unavailable.
  }
  return { ...EMPTY_JACKPOT_CYCLE_STATS };
}

function cleanPlayerName(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').slice(0, 12);
}

function normalizeSessionSnapshot(value: unknown): SessionSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<SessionSnapshot>;
  const credits = Number(parsed.credits);
  const spins = Number(parsed.spins);
  const elapsedSeconds = Number(parsed.elapsedSeconds);
  const bestWin = Number(parsed.bestWin ?? 0);
  const storedId = Number(parsed.id);
  const storedPeak = Number(parsed.peakBalance);
  if (
    !Number.isFinite(credits) || !Number.isFinite(spins) ||
    !Number.isFinite(elapsedSeconds) || !Number.isFinite(bestWin)
  ) return null;
  return {
    id: Number.isFinite(storedId) ? storedId : Date.now(),
    credits: roundMoney(Math.max(0, credits)),
    peakBalance: roundMoney(Math.max(
      STARTING_CREDITS,
      credits,
      Number.isFinite(storedPeak) ? storedPeak : 0,
    )),
    spins: Math.max(0, Math.floor(spins)),
    elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
    bestWin: roundMoney(Math.max(0, bestWin)),
  };
}

function readSessionSnapshot() {
  try {
    return normalizeSessionSnapshot(JSON.parse(readLocalValue(SESSION_SNAPSHOT_KEY) ?? ''));
  } catch {
    return null;
  }
}

function readHighScores() {
  try {
    const parsed = JSON.parse(readLocalValue(HIGH_SCORES_KEY) ?? '[]') as Array<Partial<SessionHighScore> & { balance?: number }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const id = Number(entry.id);
      const peakBalance = Number(entry.peakBalance ?? entry.balance);
      const bestWin = Number(entry.bestWin);
      const spins = Number(entry.spins);
      const elapsedSeconds = Number(entry.elapsedSeconds);
      if (
        !Number.isFinite(id) || !Number.isFinite(peakBalance) || !Number.isFinite(bestWin) ||
        !Number.isFinite(spins) || !Number.isFinite(elapsedSeconds)
      ) return [];
      return [{
        id,
        name: cleanPlayerName(typeof entry.name === 'string' ? entry.name : '').trim() || 'PLAYER',
        peakBalance: roundMoney(Math.max(0, peakBalance)),
        bestWin: roundMoney(Math.max(0, bestWin)),
        spins: Math.max(0, Math.floor(spins)),
        elapsedSeconds: Math.max(0, Math.floor(elapsedSeconds)),
      }];
    }).sort((left, right) =>
      right.peakBalance - left.peakBalance || right.bestWin - left.bestWin || right.spins - left.spins
    ).slice(0, 5);
  } catch {
    return [];
  }
}

function saveHighScore(entry: SessionHighScore) {
  const next = [...readHighScores().filter((score) => score.id !== entry.id), entry]
    .sort((left, right) =>
      right.peakBalance - left.peakBalance || right.bestWin - left.bestWin || right.spins - left.spins
    )
    .slice(0, 5);
  writeLocalValue(HIGH_SCORES_KEY, JSON.stringify(next));
  return next;
}

function normalizeCoinPrize(value: unknown): CoinPrize | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CoinPrize>;
  if (!(
    typeof candidate.label === 'string' && candidate.label.length > 0 &&
    Number.isFinite(candidate.amount) && Number(candidate.amount) >= 0 &&
    (candidate.tier === null || candidate.tier === 'mini' || candidate.tier === 'minor' || candidate.tier === 'major')
  )) return null;
  return {
    label: candidate.label,
    amount: roundCoinAmount(Number(candidate.amount)),
    tier: candidate.tier,
  };
}

function isCoinPrize(value: unknown): value is CoinPrize {
  return normalizeCoinPrize(value) !== null;
}

function isCellIndexArray(value: unknown) {
  return Array.isArray(value) && value.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < 15) &&
    new Set(value).size === value.length;
}

function isCoinPrizeMap(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([cell, prize]) => {
    const index = Number(cell);
    return Number.isInteger(index) && index >= 0 && index < 15 && isCoinPrize(prize);
  });
}

function normalizeCoinPrizeMap(value: Record<number, CoinPrize>) {
  return Object.fromEntries(
    Object.entries(value).map(([cell, prize]) => [Number(cell), normalizeCoinPrize(prize) as CoinPrize]),
  ) as Record<number, CoinPrize>;
}

function hasExactCoinPrizeCoverage(cells: number[], prizes: Record<number, CoinPrize>) {
  const cellKeys = [...cells].sort((left, right) => left - right);
  const prizeKeys = Object.keys(prizes).map(Number).sort((left, right) => left - right);
  return cellKeys.length === prizeKeys.length && cellKeys.every((cell, index) => cell === prizeKeys[index]);
}

function isJackpotCycleStats(value: unknown): value is JackpotCycleStats {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<JackpotCycleStats>;
  return (
    Number.isInteger(candidate.majorSpins) && Number(candidate.majorSpins) >= 0 &&
    Number.isFinite(candidate.majorWagered) && Number(candidate.majorWagered) >= 0 &&
    Number.isInteger(candidate.grandSpins) && Number(candidate.grandSpins) >= 0 &&
    Number.isFinite(candidate.grandWagered) && Number(candidate.grandWagered) >= 0
  );
}

function normalizeJackpotWinStats(value: unknown): JackpotWinStat[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is JackpotWinStat => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Partial<JackpotWinStat>;
    return (
      (candidate.tier === 'major' || candidate.tier === 'grand') &&
      Number.isInteger(candidate.spins) && Number(candidate.spins) >= 0 &&
      Number.isFinite(candidate.wagered) && Number(candidate.wagered) >= 0
    );
  });
}

function readGameTransaction(): PersistedGameTransaction | null {
  try {
    const parsed = JSON.parse(readLocalValue(GAME_TRANSACTION_KEY) ?? '') as
      Omit<PersistedGameTransaction, 'version' | 'gambleRound'> & { version: number; gambleRound?: number };
    const recoveredGambleRound = parsed.gambleRound ?? 0;
    if (
      (parsed?.version !== 2 && parsed?.version !== 3) || !Number.isFinite(parsed.savedAt) ||
      !Number.isFinite(parsed.sessionStartedAt) || parsed.sessionStartedAt <= 0 ||
      !Array.isArray(parsed.grid) || parsed.grid.length !== 15 ||
      !parsed.grid.every((symbol) => SYMBOLS.some((entry) => entry.key === symbol)) ||
      !Array.isArray(parsed.coinField) || parsed.coinField.length !== 15 ||
      !parsed.coinField.every((coin) => coin === null || isCoinPrize(coin)) ||
      !isCellIndexArray(parsed.baseCoinCells) || !isCoinPrizeMap(parsed.baseCoinPrizes) ||
      !isCellIndexArray(parsed.queuedCoinCells) || !isCoinPrizeMap(parsed.queuedCoinPrizes) ||
      !hasExactCoinPrizeCoverage(parsed.baseCoinCells, parsed.baseCoinPrizes) ||
      !parsed.baseCoinCells.every((cell) => parsed.grid[cell] === 'coin') ||
      !Number.isFinite(parsed.credits) || parsed.credits < 0 ||
      !Number.isFinite(parsed.pendingWin) || parsed.pendingWin < 0 ||
      !Number.isFinite(parsed.sessionBestWin) || parsed.sessionBestWin < 0 ||
      !Number.isFinite(parsed.sessionPeakBalance) || parsed.sessionPeakBalance < 0 ||
      !Number.isInteger(parsed.spins) || parsed.spins < 0 ||
      !Number.isInteger(parsed.metresMowed) || parsed.metresMowed < 0 ||
      !Number.isInteger(recoveredGambleRound) || recoveredGambleRound < 0 || recoveredGambleRound > GAMBLE_MAX_ROUNDS ||
      (parsed.pendingWin === 0 && recoveredGambleRound !== 0) ||
      !Number.isInteger(parsed.activeLines) || parsed.activeLines < 1 || parsed.activeLines > 20 ||
      !Number.isInteger(parsed.betIndex) || parsed.betIndex < 0 || parsed.betIndex >= BET_OPTIONS.length ||
      !Number.isInteger(parsed.freeGames) || parsed.freeGames < 0 || parsed.freeGames > MAX_FREE_GAMES ||
      (parsed.coinFeatureQueued && parsed.queuedCoinCells.length < COIN_TRIGGER_COUNT) ||
      (parsed.coinFeatureQueued && !hasExactCoinPrizeCoverage(parsed.queuedCoinCells, parsed.queuedCoinPrizes)) ||
      (!parsed.coinFeatureQueued && (parsed.queuedCoinCells.length > 0 || Object.keys(parsed.queuedCoinPrizes).length > 0)) ||
      (parsed.coinFeatureQueued && parsed.coinFeatureOpen) ||
      !Number.isFinite(parsed.coinFeatureBet) || parsed.coinFeatureBet < 0 ||
      !Number.isFinite(parsed.coinFeatureMajorCents) || !Number.isFinite(parsed.coinFeatureGrandCents) ||
      !Number.isInteger(parsed.coinRespinsRemaining) || parsed.coinRespinsRemaining < 0 ||
      parsed.coinRespinsRemaining > HOLD_RESPINS ||
      !Number.isFinite(parsed.coinGrandAward) || parsed.coinGrandAward < 0 ||
      !Number.isFinite(parsed.coinFullScreenBonus) || parsed.coinFullScreenBonus < 0 ||
      !Array.isArray(parsed.coinFeatureReasons) || !parsed.coinFeatureReasons.every((reason) => typeof reason === 'string') ||
      (parsed.coinFeatureOpen && parsed.coinField.filter(Boolean).length < COIN_TRIGGER_COUNT) ||
      (parsed.coinFeatureOpen && parsed.coinFeatureBet <= 0) ||
      (!parsed.coinFeatureOpen && parsed.coinField.some(Boolean)) ||
      (!parsed.coinFeatureOpen && (parsed.coinFeatureComplete || parsed.coinGrandAward > 0 || parsed.coinFullScreenBonus > 0)) ||
      (parsed.coinFeatureComplete !== (parsed.coinFeatureOpen && (
        parsed.coinField.every(Boolean) || parsed.coinRespinsRemaining === 0
      ))) ||
      (parsed.pendingFreeGameChoice !== null && (
        !parsed.pendingFreeGameChoice || !Number.isInteger(parsed.pendingFreeGameChoice.games) ||
        parsed.pendingFreeGameChoice.games <= 0 || typeof parsed.pendingFreeGameChoice.label !== 'string'
      ))
    ) return null;
    const normalizedBaseCoinPrizes = normalizeCoinPrizeMap(parsed.baseCoinPrizes);
    const normalizedQueuedCoinPrizes = normalizeCoinPrizeMap(parsed.queuedCoinPrizes);
    const normalizedCoinField = parsed.coinField.map((coin) => coin === null ? null : normalizeCoinPrize(coin));
    const storedThunder = readThunderProgress();
    const thunderLifetimeBolts = Number.isInteger(parsed.thunderLifetimeBolts) && parsed.thunderLifetimeBolts >= 0
      ? parsed.thunderLifetimeBolts
      : storedThunder.lifetimeBolts;
    const thunderNextTarget = Number.isInteger(parsed.thunderNextTarget) && parsed.thunderNextTarget > thunderLifetimeBolts
      ? parsed.thunderNextTarget
      : Math.max(storedThunder.nextTarget, thunderLifetimeBolts + THUNDER_INTERVAL_MIN);
    return {
      ...parsed,
      version: 3,
      gambleRound: recoveredGambleRound,
      credits: roundMoney(parsed.credits),
      pendingWin: roundMoney(parsed.pendingWin),
      sessionBestWin: roundMoney(parsed.sessionBestWin),
      sessionPeakBalance: roundMoney(parsed.sessionPeakBalance),
      baseCoinPrizes: normalizedBaseCoinPrizes,
      queuedCoinPrizes: normalizedQueuedCoinPrizes,
      coinField: normalizedCoinField,
      majorCents: Number.isFinite(parsed.majorCents) && parsed.majorCents >= MAJOR_SEED_CENTS
        ? parsed.majorCents
        : readProgressiveCents(MAJOR_KEY, MAJOR_SEED_CENTS, MAJOR_SEED_CENTS),
      grandCents: Number.isFinite(parsed.grandCents) && parsed.grandCents >= GRAND_SEED_CENTS
        ? parsed.grandCents
        : readProgressiveCents(GRAND_KEY, GRAND_SEED_CENTS, GRAND_SEED_CENTS),
      thunderLifetimeBolts,
      thunderNextTarget,
      jackpotCycleStats: isJackpotCycleStats(parsed.jackpotCycleStats)
        ? parsed.jackpotCycleStats
        : readJackpotCycleStats(),
      jackpotWinStats: normalizeJackpotWinStats(parsed.jackpotWinStats),
    };
  } catch {
    return null;
  }
}

function readPendingThunderAward(): ThunderAwardRecord | null {
  try {
    const parsed = JSON.parse(readLocalValue(THUNDER_AWARD_PENDING_KEY) ?? '') as Partial<ThunderAwardRecord>;
    const migratedAwardId = typeof parsed.awardId === 'string' && parsed.awardId.length > 0
      ? parsed.awardId
      : `legacy-${Date.now()}-${randomInt(1_000_000)}`;
    const migratedReasons = Array.isArray(parsed.reasons)
      ? parsed.reasons
      : ['hidden-thunder-guarantee'];
    const validCells = Array.isArray(parsed.seedCells) && parsed.seedCells.length >= COIN_TRIGGER_COUNT &&
      parsed.seedCells.every((cell) => Number.isInteger(cell) && cell >= 0 && cell < 15) &&
      new Set(parsed.seedCells).size === parsed.seedCells.length;
    if (
      Number.isFinite(parsed.featureBet) && Number(parsed.featureBet) > 0 && validCells &&
      isCoinPrizeMap(parsed.seedPrizes) &&
      hasExactCoinPrizeCoverage(parsed.seedCells as number[], parsed.seedPrizes as Record<number, CoinPrize>) &&
      Object.values(parsed.seedPrizes as Record<number, CoinPrize>).filter((prize) => prize.tier === 'major').length <= 1 &&
      migratedReasons.every((reason) =>
        reason === 'six-coins' || reason === 'hidden-thunder-guarantee' || reason === 'seven-bolts'
      ) &&
      Number.isFinite(parsed.majorCents) && Number(parsed.majorCents) >= MAJOR_SEED_CENTS &&
      Number.isFinite(parsed.grandCents) && Number(parsed.grandCents) >= GRAND_SEED_CENTS &&
      typeof parsed.jackpotsEligible === 'boolean'
    ) {
      const normalized: ThunderAwardRecord = {
      awardId: migratedAwardId,
      featureBet: roundMoney(Number(parsed.featureBet)),
      seedCells: parsed.seedCells as number[],
      seedPrizes: normalizeCoinPrizeMap(parsed.seedPrizes as Record<number, CoinPrize>),
      reasons: mergeCoinStormReasons(migratedReasons),
      majorCents: Number(parsed.majorCents),
      grandCents: Number(parsed.grandCents),
      jackpotsEligible: parsed.jackpotsEligible,
      };
      writeLocalValue(THUNDER_AWARD_PENDING_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch {
    // Ignore a malformed or missing pending award.
  }
  return null;
}

function makeSessionToken() {
  return window.crypto.randomUUID();
}

export default function Home() {
  const [credits, setCredits] = useState(STARTING_CREDITS);
  const [grid, setGrid] = useState<SymbolKey[]>(STARTING_GRID);
  const [reelPhases, setReelPhases] = useState<ReelPhase[]>(() => Array.from({ length: 5 }, () => 'idle'));
  const [reelPreview, setReelPreview] = useState<ReelPreviewSymbol[][]>(() =>
    Array.from({ length: 5 }, () => Array.from({ length: 7 }, () => ({ key: randomBaseSymbol() }))),
  );
  const [activeLines, setActiveLines] = useState(10);
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [pendingWin, setPendingWin] = useState(0);
  const [pendingWinGambleLocked, setPendingWinGambleLocked] = useState(false);
  const [lastPayout, setLastPayout] = useState(0);
  const [winningLines, setWinningLines] = useState<LineWin[]>([]);
  const [activeWinLineIndex, setActiveWinLineIndex] = useState(0);
  const [baseCoinCells, setBaseCoinCells] = useState<number[]>([]);
  const [baseCoinPrizes, setBaseCoinPrizes] = useState<Record<number, CoinPrize>>({});
  const [freeGames, setFreeGames] = useState(0);
  const [pendingFreeGameChoice, setPendingFreeGameChoice] = useState<{ games: number; label: string } | null>(null);
  const [selectedFreeGameChoice, setSelectedFreeGameChoice] = useState<FreeGameChoice>('classic-cut');
  const [freeGamesAwardedNow, setFreeGamesAwardedNow] = useState(0);
  const [freeGamesAwardLabel, setFreeGamesAwardLabel] = useState('SCATTER STORM');
  const [displayedGridIsFreeGame, setDisplayedGridIsFreeGame] = useState(false);
  const [coinFeatureQueued, setCoinFeatureQueued] = useState(false);
  const [coinFeatureFromThunderCharge, setCoinFeatureFromThunderCharge] = useState(false);
  const [coinFeatureReasons, setCoinFeatureReasons] = useState<string[]>([]);
  const [queuedCoinCells, setQueuedCoinCells] = useState<number[]>([]);
  const [queuedCoinPrizes, setQueuedCoinPrizes] = useState<Record<number, CoinPrize>>({});
  const [coinFeatureBet, setCoinFeatureBet] = useState(0);
  const [coinFeatureJackpotsEligible, setCoinFeatureJackpotsEligible] = useState(false);
  const [coinFeatureMajorCents, setCoinFeatureMajorCents] = useState(MAJOR_SEED_CENTS);
  const [coinFeatureGrandCents, setCoinFeatureGrandCents] = useState(GRAND_SEED_CENTS);
  const [coinFeatureOpen, setCoinFeatureOpen] = useState(false);
  const [coinField, setCoinField] = useState<Array<CoinPrize | null>>(
    () => Array.from({ length: 15 }, () => null),
  );
  const [newHoldCells, setNewHoldCells] = useState<number[]>([]);
  const [coinRespinsRemaining, setCoinRespinsRemaining] = useState(HOLD_RESPINS);
  const [coinFeatureSpinning, setCoinFeatureSpinning] = useState(false);
  const [coinFeatureCelebrating, setCoinFeatureCelebrating] = useState(false);
  const [coinFeatureComplete, setCoinFeatureComplete] = useState(false);
  const [coinGrandAward, setCoinGrandAward] = useState(0);
  const [coinFullScreenBonus, setCoinFullScreenBonus] = useState(0);
  const [displayedCoinFeatureTotal, setDisplayedCoinFeatureTotal] = useState(0);
  const [majorCents, setMajorCents] = useState(MAJOR_SEED_CENTS);
  const [grandCents, setGrandCents] = useState(GRAND_SEED_CENTS);
  const [highRollerUnlocked, setHighRollerUnlocked] = useState(
    STARTING_CREDITS >= HIGH_ROLLER_UNLOCK_CREDITS,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gameInfoOpen, setGameInfoOpen] = useState(false);
  const [appVisible, setAppVisible] = useState(true);
  const [audioMuted, setAudioMuted] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1);
  const [musicVolume, setMusicVolume] = useState(0.82);
  const [sfxVolume, setSfxVolume] = useState(0.92);
  const [ambienceVolume, setAmbienceVolume] = useState(0.88);
  const [jackpotCycleStats, setJackpotCycleStats] = useState<JackpotCycleStats>(EMPTY_JACKPOT_CYCLE_STATS);
  const [jackpotWinStats, setJackpotWinStats] = useState<JackpotWinStat[]>([]);
  const [bigWinCelebration, setBigWinCelebration] = useState<BigWinCelebration | null>(null);
  const [, setThunderLifetimeBolts] = useState(0);
  const [, setThunderNextTarget] = useState(523);
  const [thunderChargePulse, setThunderChargePulse] = useState(0);
  const [thunderChargeAwardedNow, setThunderChargeAwardedNow] = useState(false);
  const [message, setMessage] = useState('Storm front ready. Set your lines and bet, then spin.');
  const [spins, setSpins] = useState(0);
  const [sessionBestWin, setSessionBestWin] = useState(0);
  const [sessionPeakBalance, setSessionPeakBalance] = useState(STARTING_CREDITS);
  const [highScores, setHighScores] = useState<SessionHighScore[]>([]);
  const [metresMowed, setMetresMowed] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [sessionGateReady, setSessionGateReady] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endedSnapshot, setEndedSnapshot] = useState<SessionSnapshot | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [gambleOpen, setGambleOpen] = useState(false);
  const [gambleResult, setGambleResult] = useState<GambleResult>(null);
  const [gambleSuit, setGambleSuit] = useState<GambleSuit>(null);
  const [gambleChoice, setGambleChoice] = useState<GambleChoice | null>(null);
  const [selectedGambleChoice, setSelectedGambleChoice] = useState<GambleChoice>('red');
  const [gambleRank, setGambleRank] = useState('A');
  const [gambleRound, setGambleRound] = useState(0);
  const [gambleAnimating, setGambleAnimating] = useState(false);
  const [gambleReacting, setGambleReacting] = useState(false);
  const [gambleHistory, setGambleHistory] = useState<GambleHistoryEntry[]>([]);
  const [persistenceBlocked, setPersistenceBlocked] = useState(false);
  const [slapActive, setSlapActive] = useState(false);
  const [cashBurstKey, setCashBurstKey] = useState(0);
  const spinLock = useRef(false);
  const featureActionLock = useRef(false);
  const collectLock = useRef(false);
  const gambleActionLock = useRef(false);
  const holdAnimationTimer = useRef<number | null>(null);
  const featureUnlockTimer = useRef<number | null>(null);
  const freeGamesAwardTimer = useRef<number | null>(null);
  const thunderChargeTimer = useRef<number | null>(null);
  const bigWinCountTimer = useRef<number | null>(null);
  const bigWinHideTimer = useRef<number | null>(null);
  const heldSpaceTimer = useRef<number | null>(null);
  const deferredBigWinRef = useRef<BigWinRequest | null>(null);
  const keyDownHandlerRef = useRef<(event: KeyboardEvent) => void>(() => undefined);
  const controlDeckRef = useRef<HTMLDivElement | null>(null);
  const reelGridRef = useRef<HTMLDivElement | null>(null);
  const gameInfoRef = useRef<HTMLDialogElement | null>(null);
  const gameInfoButtonRef = useRef<HTMLButtonElement | null>(null);
  const betDecreaseButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionPodRef = useRef<HTMLElement | null>(null);
  const spinButtonRef = useRef<HTMLButtonElement | null>(null);
  const gambleModalRef = useRef<HTMLElement | null>(null);
  const gambleReturnFocusRef = useRef<HTMLElement | null>(null);
  const freeGameChoiceModalRef = useRef<HTMLElement | null>(null);
  const coinFeatureModalRef = useRef<HTMLElement | null>(null);
  const sessionModalRef = useRef<HTMLElement | null>(null);
  const activeSessionToken = useRef('');
  const thunderLifetimeRef = useRef(0);
  const thunderTargetRef = useRef(523);
  const jackpotCycleStatsRef = useRef<JackpotCycleStats>(EMPTY_JACKPOT_CYCLE_STATS);
  const gambleHistoryId = useRef(0);
  const audioRef = useRef<ThunderAudioController | null>(null);
  const previousJackpotEligibility = useRef<boolean | null>(null);
  const coinLightningIndex = useRef(0);
  const bigWinFinishCuePlayed = useRef(false);
  const spaceHeldRef = useRef(false);
  const spaceChoiceConsumedRef = useRef(false);
  const contextSpaceActionRef = useRef<() => void>(() => undefined);
  const spinSequenceRef = useRef(new VisualSequenceController());
  const featureSequenceRef = useRef(new VisualSequenceController());

  const betPerLine = BET_OPTIONS[betIndex];
  const maximumBetIndex = highRollerUnlocked ? BET_OPTIONS.length - 1 : STANDARD_MAX_BET_INDEX;
  const totalBet = activeLines * betPerLine;
  const jackpotEligible = jackpotsAreEligible(activeLines, totalBet);
  const isFreeSpin = freeGames > 0;
  const featureSequenceActive = freeGames > 0 || Boolean(pendingFreeGameChoice) || coinFeatureQueued || coinFeatureOpen;
  const canAdjust =
    sessionGateReady && !sessionEnded && !persistenceBlocked && !spinning && pendingWin === 0 && !gambleOpen &&
    !coinFeatureOpen && !coinFeatureQueued && !pendingFreeGameChoice && freeGames === 0 && !bigWinCelebration;
  const canRequestSpin =
    sessionGateReady && !sessionEnded && !persistenceBlocked && !spinning && !gambleOpen && !coinFeatureOpen &&
    !bigWinCelebration && !pendingFreeGameChoice && !coinFeatureQueued &&
    (freeGames > 0 || pendingWin === 0);
  const canSpin = canRequestSpin && (freeGames > 0 || credits >= totalBet);
  const showWinActions = pendingWin > 0 && !featureSequenceActive;
  const heldCoinCount = coinField.filter(Boolean).length;
  const displayCoinCount = coinFeatureOpen
    ? heldCoinCount
    : coinFeatureQueued
      ? queuedCoinCells.length
      : baseCoinCells.length;
  const currentJackpots = getJackpotValues(totalBet, majorCents, grandCents);
  const featureJackpots = getJackpotValues(
    coinFeatureBet || totalBet,
    coinFeatureMajorCents,
    coinFeatureGrandCents,
  );
  const coinFeatureSubtotal = useMemo(
    () => roundMoney(coinField.reduce((total, coin) => total + (coin?.amount ?? 0), 0)),
    [coinField],
  );
  const coinFeatureTotal = roundMoney(coinFeatureSubtotal + coinGrandAward + coinFullScreenBonus);
  const openStormDoorReels = useMemo(
    () => new Set(
      grid.flatMap((symbol, index) =>
        symbol === 'scatter' || symbol === 'ur_scattered' ? [index % 5] : []
      ),
    ),
    [grid],
  );
  const activeWinLine = winningLines[activeWinLineIndex % Math.max(1, winningLines.length)] ?? null;

  useEffect(() => {
    document.documentElement.classList.toggle('game-fullscreen', isFullscreen);
    return () => document.documentElement.classList.remove('game-fullscreen');
  }, [isFullscreen]);

  useEffect(() => {
    const dialog = gameInfoRef.current;
    if (!dialog) return;
    if (gameInfoOpen) {
      spaceHeldRef.current = false;
      spaceChoiceConsumedRef.current = false;
      if (heldSpaceTimer.current !== null) window.clearTimeout(heldSpaceTimer.current);
      heldSpaceTimer.current = null;
      dialog.showModal();
      const body = dialog.querySelector('.game-info-body');
      if (body) body.scrollTop = 0;
    } else if (dialog.open) {
      dialog.close();
      gameInfoButtonRef.current?.focus({ preventScroll: true });
    }
  }, [gameInfoOpen]);

  function buildGameTransaction(
    overrides: Partial<Omit<PersistedGameTransaction, 'version' | 'savedAt'>> = {},
  ): PersistedGameTransaction {
    return {
      version: 3,
      savedAt: Date.now(),
      sessionStartedAt,
      credits,
      pendingWin,
      pendingWinGambleLocked,
      gambleRound,
      activeLines,
      betIndex,
      spins,
      sessionBestWin,
      sessionPeakBalance,
      metresMowed,
      grid,
      baseCoinCells,
      baseCoinPrizes,
      freeGames,
      pendingFreeGameChoice,
      coinFeatureQueued,
      coinFeatureFromThunderCharge,
      coinFeatureReasons,
      queuedCoinCells,
      queuedCoinPrizes,
      coinFeatureBet,
      coinFeatureJackpotsEligible,
      coinFeatureMajorCents,
      coinFeatureGrandCents,
      coinFeatureOpen,
      coinField,
      coinRespinsRemaining,
      coinFeatureComplete,
      coinGrandAward,
      coinFullScreenBonus,
      majorCents,
      grandCents,
      thunderLifetimeBolts: thunderLifetimeRef.current,
      thunderNextTarget: thunderTargetRef.current,
      jackpotCycleStats,
      jackpotWinStats,
      ...overrides,
    };
  }

  function persistCommittedTransaction(
    overrides: Partial<Omit<PersistedGameTransaction, 'version' | 'savedAt'>> = {},
  ): CommitResult {
    if (!activeSessionToken.current || !ownsActiveSession()) {
      return { ok: false, reason: 'ownership-lost' };
    }
    return writeLocalValue(GAME_TRANSACTION_KEY, JSON.stringify(buildGameTransaction(overrides)))
      ? { ok: true }
      : { ok: false, reason: 'storage-failed' };
  }

  function handleCommitFailure(result: CommitResult, action: string) {
    if (result.ok) return false;
    if (result.reason === 'storage-failed') setPersistenceBlocked(true);
    setMessage(
      result.reason === 'ownership-lost'
        ? `${action} stopped because another Thunder Cut window owns this session.`
        : `${action} was not applied because local save storage is unavailable. Reload after storage is available.`,
    );
    audioRef.current?.playSfx('uiWarning');
    return true;
  }

  useEffect(() => {
    setActiveWinLineIndex(0);
    if (spinning || winningLines.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveWinLineIndex((current) => (current + 1) % winningLines.length);
    }, 1450);
    return () => window.clearInterval(timer);
  }, [spinning, winningLines]);

  const cancelBigWinCelebration = useCallback(() => {
    if (bigWinCountTimer.current !== null) window.clearInterval(bigWinCountTimer.current);
    if (bigWinHideTimer.current !== null) window.clearTimeout(bigWinHideTimer.current);
    bigWinCountTimer.current = null;
    bigWinHideTimer.current = null;
    audioRef.current?.stopCue('bigWinMusic');
    audioRef.current?.stopCue('coinPayoutRoll');
    setBigWinCelebration(null);
  }, []);

  useEffect(() => {
    const audio = new ThunderAudioController();
    audioRef.current = audio;
    try {
      const saved = JSON.parse(readLocalValue(AUDIO_SETTINGS_KEY) ?? '{}') as Partial<{
        muted: boolean;
        master: number;
        music: number;
        sfx: number;
        ambience: number;
      }>;
      const nextMaster = Number.isFinite(saved.master) ? Math.min(1, Math.max(0, Number(saved.master))) : 1;
      const nextMusic = Number.isFinite(saved.music) ? Math.min(1, Math.max(0, Number(saved.music))) : 0.82;
      const nextSfx = Number.isFinite(saved.sfx) ? Math.min(1, Math.max(0, Number(saved.sfx))) : 0.92;
      const nextAmbience = Number.isFinite(saved.ambience) ? Math.min(1, Math.max(0, Number(saved.ambience))) : 0.88;
      const nextMuted = saved.muted === true;
      setMasterVolume(nextMaster);
      setMusicVolume(nextMusic);
      setSfxVolume(nextSfx);
      setAmbienceVolume(nextAmbience);
      setAudioMuted(nextMuted);
      audio.setMasterVolume(nextMaster);
      audio.setCategoryVolume('music', nextMusic);
      audio.setCategoryVolume('sfx', nextSfx);
      audio.setCategoryVolume('ambience', nextAmbience);
      audio.setMuted(nextMuted);
    } catch {
      // Keep safe defaults if an older audio settings record is malformed.
    }
    audio.preload();
    const unlockAudio = () => audio.unlock(false);
    const handleVisibilityChange = () => {
      if (document.hidden) audio.suspend();
      else audio.resume();
    };
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      audio.dispose();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.setMasterVolume(masterVolume);
    audio.setCategoryVolume('music', musicVolume);
    audio.setCategoryVolume('sfx', sfxVolume);
    audio.setCategoryVolume('ambience', ambienceVolume);
    audio.setMuted(audioMuted);
    writeLocalValue(AUDIO_SETTINGS_KEY, JSON.stringify({
      muted: audioMuted,
      master: masterVolume,
      music: musicVolume,
      sfx: sfxVolume,
      ambience: ambienceVolume,
    }));
  }, [ambienceVolume, audioMuted, masterVolume, musicVolume, sfxVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const sessionActive = sessionGateReady && !sessionEnded;
    const stormFeatureActive = coinFeatureOpen || freeGames > 0 || Boolean(pendingFreeGameChoice);
    if (stormFeatureActive) audio.preloadBank('feature');
    if (gambleOpen) audio.preloadBank('gamble');
    if (sessionEnded) audio.preloadBank('session');
    audio.setCueGain('stormAmbience', stormFeatureActive ? 1.65 : 1);
    audio.setLoop('stormAmbience', sessionActive);
    audio.setLoop(
      'wildHum',
      sessionActive && !spinning && !gambleOpen && !coinFeatureOpen && !bigWinCelebration && grid.includes('wild'),
    );
    if (!sessionGateReady || bigWinCelebration) audio.setMusic(null);
    else if (sessionEnded) audio.setMusic('sessionMusic');
    else if (gambleOpen) audio.setMusic('gambleMusic');
    else if (stormFeatureActive) audio.setMusic(null);
    else audio.setMusic('baseMusic');
  }, [bigWinCelebration, coinFeatureOpen, freeGames, gambleOpen, grid, pendingFreeGameChoice, sessionEnded, sessionGateReady, spinning]);

  useEffect(() => {
    if (!sessionGateReady) return;
    if (previousJackpotEligibility.current === null) {
      previousJackpotEligibility.current = jackpotEligible;
      return;
    }
    if (!sessionEnded && previousJackpotEligibility.current !== jackpotEligible) {
      audioRef.current?.playSfx(jackpotEligible ? 'brightSynth' : 'gambleClose');
    }
    previousJackpotEligibility.current = jackpotEligible;
  }, [jackpotEligible, sessionEnded, sessionGateReady]);

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      const storedMajor = Number(readLocalValue(MAJOR_KEY));
      const storedGrand = Number(readLocalValue(GRAND_KEY));
      const storedThunder = readThunderProgress();
      const storedCycleStats = readJackpotCycleStats();
      setHighScores(readHighScores());
      if (Number.isFinite(storedMajor) && storedMajor >= MAJOR_SEED_CENTS) setMajorCents(storedMajor);
      if (Number.isFinite(storedGrand) && storedGrand >= GRAND_SEED_CENTS) setGrandCents(storedGrand);
      const highRollerAvailable =
        STARTING_CREDITS >= HIGH_ROLLER_UNLOCK_CREDITS || readLocalValue(HIGH_ROLLER_KEY) === 'true';
      setHighRollerUnlocked(highRollerAvailable);
      if (highRollerAvailable) writeLocalValue(HIGH_ROLLER_KEY, 'true');
      jackpotCycleStatsRef.current = storedCycleStats;
      setJackpotCycleStats(storedCycleStats);
      thunderLifetimeRef.current = storedThunder.lifetimeBolts;
      thunderTargetRef.current = storedThunder.nextTarget;
      setThunderLifetimeBolts(storedThunder.lifetimeBolts);
      setThunderNextTarget(storedThunder.nextTarget);
      const storedEnded = readLocalValue(SESSION_LOCK_KEY) === 'true';
      const existingActiveToken = readLocalValue(ACTIVE_SESSION_KEY);
      const storedTransaction = readGameTransaction();
      const mustStartFresh = storedEnded || Boolean(existingActiveToken && !storedTransaction);
      setSessionEnded(mustStartFresh);
      if (mustStartFresh) {
        const storedSnapshot = readSessionSnapshot();
        setEndedSnapshot(storedSnapshot);
      } else if (storedTransaction) {
        const snapshot = readSessionSnapshot();
        setSessionStartedAt(storedTransaction.sessionStartedAt || snapshot?.id || Date.now());
        setCredits(roundMoney(Math.max(0, storedTransaction.credits)));
        setPendingWin(roundMoney(Math.max(0, storedTransaction.pendingWin)));
        setPendingWinGambleLocked(Boolean(storedTransaction.pendingWinGambleLocked));
        setGambleRound(storedTransaction.gambleRound);
        setActiveLines(Math.min(20, Math.max(1, Math.floor(storedTransaction.activeLines))));
        setBetIndex(Math.min(BET_OPTIONS.length - 1, Math.max(0, Math.floor(storedTransaction.betIndex))));
        setSpins(Math.max(0, Math.floor(storedTransaction.spins)));
        setSessionBestWin(roundMoney(Math.max(0, storedTransaction.sessionBestWin)));
        setSessionPeakBalance(roundMoney(Math.max(STARTING_CREDITS, storedTransaction.sessionPeakBalance)));
        setMetresMowed(Math.max(0, Math.floor(storedTransaction.metresMowed)));
        setElapsedSeconds(snapshot?.elapsedSeconds ?? 0);
        setGrid(storedTransaction.grid);
        setBaseCoinCells(storedTransaction.baseCoinCells ?? []);
        setBaseCoinPrizes(storedTransaction.baseCoinPrizes ?? {});
        setFreeGames(Math.min(MAX_FREE_GAMES, Math.max(0, storedTransaction.freeGames)));
        setPendingFreeGameChoice(storedTransaction.pendingFreeGameChoice ?? null);
        setCoinFeatureQueued(Boolean(storedTransaction.coinFeatureQueued));
        setCoinFeatureFromThunderCharge(Boolean(storedTransaction.coinFeatureFromThunderCharge));
        setCoinFeatureReasons(storedTransaction.coinFeatureReasons ?? []);
        setQueuedCoinCells(storedTransaction.queuedCoinCells ?? []);
        setQueuedCoinPrizes(storedTransaction.queuedCoinPrizes ?? {});
        setCoinFeatureBet(roundMoney(Math.max(0, storedTransaction.coinFeatureBet)));
        setCoinFeatureJackpotsEligible(Boolean(storedTransaction.coinFeatureJackpotsEligible));
        setCoinFeatureMajorCents(storedTransaction.coinFeatureMajorCents || MAJOR_SEED_CENTS);
        setCoinFeatureGrandCents(storedTransaction.coinFeatureGrandCents || GRAND_SEED_CENTS);
        setCoinFeatureOpen(Boolean(storedTransaction.coinFeatureOpen));
        setCoinField(storedTransaction.coinField);
        setCoinRespinsRemaining(Math.min(HOLD_RESPINS, Math.max(0, storedTransaction.coinRespinsRemaining)));
        setCoinFeatureComplete(Boolean(storedTransaction.coinFeatureComplete));
        setCoinGrandAward(roundMoney(Math.max(0, storedTransaction.coinGrandAward)));
        setCoinFullScreenBonus(roundMoney(Math.max(0, storedTransaction.coinFullScreenBonus)));
        const recoveredMajorCents = Number.isFinite(storedTransaction.majorCents) && storedTransaction.majorCents >= MAJOR_SEED_CENTS
          ? storedTransaction.majorCents
          : (Number.isFinite(storedMajor) && storedMajor >= MAJOR_SEED_CENTS ? storedMajor : MAJOR_SEED_CENTS);
        const recoveredGrandCents = Number.isFinite(storedTransaction.grandCents) && storedTransaction.grandCents >= GRAND_SEED_CENTS
          ? storedTransaction.grandCents
          : (Number.isFinite(storedGrand) && storedGrand >= GRAND_SEED_CENTS ? storedGrand : GRAND_SEED_CENTS);
        const recoveredThunderLifetime = Number.isInteger(storedTransaction.thunderLifetimeBolts) && storedTransaction.thunderLifetimeBolts >= 0
          ? storedTransaction.thunderLifetimeBolts
          : storedThunder.lifetimeBolts;
        const recoveredThunderTarget = Number.isInteger(storedTransaction.thunderNextTarget) && storedTransaction.thunderNextTarget > recoveredThunderLifetime
          ? storedTransaction.thunderNextTarget
          : storedThunder.nextTarget;
        const recoveredCycleStats = storedTransaction.jackpotCycleStats ?? storedCycleStats;
        setMajorCents(recoveredMajorCents);
        setGrandCents(recoveredGrandCents);
        writeLocalValue(MAJOR_KEY, String(recoveredMajorCents));
        writeLocalValue(GRAND_KEY, String(recoveredGrandCents));
        thunderLifetimeRef.current = recoveredThunderLifetime;
        thunderTargetRef.current = recoveredThunderTarget;
        setThunderLifetimeBolts(recoveredThunderLifetime);
        setThunderNextTarget(recoveredThunderTarget);
        writeLocalValue(THUNDER_LIFETIME_KEY, String(recoveredThunderLifetime));
        writeLocalValue(THUNDER_NEXT_TARGET_KEY, String(recoveredThunderTarget));
        jackpotCycleStatsRef.current = recoveredCycleStats;
        setJackpotCycleStats(recoveredCycleStats);
        writeLocalValue(JACKPOT_CYCLE_STATS_KEY, JSON.stringify(recoveredCycleStats));
        setJackpotWinStats(storedTransaction.jackpotWinStats ?? []);
        setDisplayedCoinFeatureTotal(roundMoney(
          storedTransaction.coinField.reduce((total, coin) => total + (coin?.amount ?? 0), 0) +
          storedTransaction.coinGrandAward + storedTransaction.coinFullScreenBonus
        ));
        if (!storedTransaction.coinFeatureFromThunderCharge && !storedTransaction.coinFeatureQueued) {
          removeLocalValue(THUNDER_AWARD_PENDING_KEY);
        }
        setMessage('Recovered the last committed game state. No spin or feature award was duplicated.');
        const token = makeSessionToken();
        activeSessionToken.current = token;
        writeLocalValue(ACTIVE_SESSION_KEY, token);
      } else {
        const initialSessionId = Date.now();
        const token = makeSessionToken();
        if (!removeLocalValue(GAME_TRANSACTION_KEY)) {
      setPersistenceBlocked(true);
      setMessage('Session was not ended because local save storage is unavailable. Reload after storage is available.');
      return;
    }
        setSessionStartedAt(initialSessionId);
        setSessionPeakBalance(STARTING_CREDITS);
        activeSessionToken.current = token;
        writeLocalValue(ACTIVE_SESSION_KEY, token);
        writeLocalValue(
          SESSION_SNAPSHOT_KEY,
          JSON.stringify({
            id: initialSessionId,
            credits: STARTING_CREDITS,
            peakBalance: STARTING_CREDITS,
            spins: 0,
            elapsedSeconds: 0,
            bestWin: 0,
          }),
        );
      }
      setSessionGateReady(true);
      setPersistenceBlocked(false);
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, []);

  useEffect(() => {
    const host = window.thunderCutHost;
    if (host?.getFullscreen && host.onFullscreenChange) {
      let active = true;
      const unsubscribe = host.onFullscreenChange((next) => { if (active) setIsFullscreen(next); });
      void host.getFullscreen().then((next) => { if (active) setIsFullscreen(next); });
      return () => { active = false; unsubscribe(); };
    }
    function syncFullscreenState() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, []);

  useEffect(() => {
    if (
      !sessionGateReady || sessionEnded || !activeSessionToken.current ||
      !ownsActiveSession()
    ) return;
    writeLocalValue(
      SESSION_SNAPSHOT_KEY,
      JSON.stringify({
        id: sessionStartedAt,
        credits,
        peakBalance: sessionPeakBalance,
        spins,
        elapsedSeconds,
        bestWin: sessionBestWin,
      }),
    );
  }, [credits, elapsedSeconds, sessionBestWin, sessionEnded, sessionGateReady, sessionPeakBalance, sessionStartedAt, spins]);

  useEffect(() => {
    if (
      !sessionGateReady || sessionEnded || persistenceBlocked || spinning || coinFeatureSpinning || gambleAnimating ||
      !activeSessionToken.current || !ownsActiveSession()
    ) return;
    persistCommittedTransaction();
  }, [
    activeLines, baseCoinCells, baseCoinPrizes, betIndex, coinFeatureBet, coinFeatureComplete,
    coinFeatureFromThunderCharge, coinFeatureGrandCents, coinFeatureJackpotsEligible,
    coinFeatureMajorCents, coinFeatureOpen, coinFeatureQueued, coinFeatureReasons, coinFeatureSpinning,
    coinField, coinFullScreenBonus, coinGrandAward, coinRespinsRemaining, credits, freeGames, grandCents,
    gambleAnimating, gambleRound, grid, metresMowed, pendingFreeGameChoice, pendingWin, pendingWinGambleLocked,
    queuedCoinCells, queuedCoinPrizes, sessionBestWin, sessionEnded, sessionGateReady, jackpotCycleStats,
    jackpotWinStats, majorCents, persistenceBlocked, sessionPeakBalance, sessionStartedAt, spinning, spins,
  ]);

  useEffect(() => {
    if (
      !appVisible || !sessionGateReady || sessionEnded || spinning || coinFeatureOpen ||
      pendingFreeGameChoice || !coinFeatureQueued
    ) return;
    const transitionToken = featureSequenceRef.current.begin();
    const transitionDelay = coinFeatureFromThunderCharge ? 2150 : 520;
    void featureSequenceRef.current.wait(transitionToken, transitionDelay)
      .then(() => {
        if (!featureSequenceRef.current.isCurrent(transitionToken)) return;
        void startCoinFeature(
          coinFeatureBet,
          queuedCoinCells,
          coinFeatureMajorCents,
          coinFeatureGrandCents,
          coinFeatureJackpotsEligible,
          coinFeatureFromThunderCharge,
          queuedCoinPrizes,
          coinFeatureReasons,
        );
      })
      .catch((error) => {
        if (!(error instanceof SequenceCancelledError)) throw error;
      });
    return () => featureSequenceRef.current.cancel();
  }, [
    appVisible, coinFeatureBet, coinFeatureFromThunderCharge, coinFeatureGrandCents,
    coinFeatureJackpotsEligible, coinFeatureMajorCents, coinFeatureOpen,
    coinFeatureQueued, coinFeatureReasons, queuedCoinCells, queuedCoinPrizes,
    pendingFreeGameChoice, sessionEnded, sessionGateReady, spinning,
  ]);

  useEffect(() => {
    function syncStoredState(event: StorageEvent) {
      if (event.key === MAJOR_KEY) {
        const value = Number(event.newValue);
        if (Number.isFinite(value) && value >= MAJOR_SEED_CENTS) setMajorCents(value);
      }
      if (event.key === GRAND_KEY) {
        const value = Number(event.newValue);
        if (Number.isFinite(value) && value >= GRAND_SEED_CENTS) setGrandCents(value);
      }
      if (event.key === THUNDER_LIFETIME_KEY || event.key === THUNDER_NEXT_TARGET_KEY) {
        const progress = readThunderProgress(thunderLifetimeRef.current, thunderTargetRef.current);
        thunderLifetimeRef.current = progress.lifetimeBolts;
        thunderTargetRef.current = progress.nextTarget;
        setThunderLifetimeBolts(progress.lifetimeBolts);
        setThunderNextTarget(progress.nextTarget);
      }
      if (event.key === HIGH_ROLLER_KEY && event.newValue === 'true') {
        setHighRollerUnlocked(true);
      }
      if (event.key === JACKPOT_CYCLE_STATS_KEY && event.newValue) {
        const nextStats = readJackpotCycleStats();
        jackpotCycleStatsRef.current = nextStats;
        setJackpotCycleStats(nextStats);
      }
      if (event.key === HIGH_SCORES_KEY) setHighScores(readHighScores());
      if (
        event.key === ACTIVE_SESSION_KEY && event.newValue &&
        readLocalValue(ACTIVE_SESSION_KEY) === event.newValue &&
        event.newValue !== activeSessionToken.current
      ) {
        cancelBigWinCelebration();
        deferredBigWinRef.current = null;
        spinSequenceRef.current.cancel();
        featureSequenceRef.current.cancel();
        setSessionEnded(true);
        setPlayerName('');
      }
      if (
        event.key === SESSION_LOCK_KEY && event.newValue === 'true' &&
        readLocalValue(SESSION_LOCK_KEY) === 'true'
      ) {
        cancelBigWinCelebration();
        deferredBigWinRef.current = null;
        spinSequenceRef.current.cancel();
        featureSequenceRef.current.cancel();
        setSessionEnded(true);
        setPlayerName('');
      }
      if (event.key === SESSION_SNAPSHOT_KEY && event.newValue && !ownsActiveSession()) {
        try {
          const parsed = normalizeSessionSnapshot(JSON.parse(event.newValue));
          if (parsed) setEndedSnapshot(parsed);
        } catch {
          // Ignore a malformed snapshot from another window.
        }
      }
    }
    window.addEventListener('storage', syncStoredState);
    return () => window.removeEventListener('storage', syncStoredState);
  }, [cancelBigWinCelebration]);

  useEffect(() => () => {
    if (holdAnimationTimer.current !== null) window.clearTimeout(holdAnimationTimer.current);
    if (featureUnlockTimer.current !== null) window.clearTimeout(featureUnlockTimer.current);
    if (freeGamesAwardTimer.current !== null) window.clearTimeout(freeGamesAwardTimer.current);
    if (thunderChargeTimer.current !== null) window.clearTimeout(thunderChargeTimer.current);
    if (bigWinCountTimer.current !== null) window.clearInterval(bigWinCountTimer.current);
    if (bigWinHideTimer.current !== null) window.clearTimeout(bigWinHideTimer.current);
    if (heldSpaceTimer.current !== null) window.clearTimeout(heldSpaceTimer.current);
    spinSequenceRef.current.cancel();
    featureSequenceRef.current.cancel();
  }, []);

  useEffect(() => {
    if (!sessionGateReady || sessionEnded) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionEnded, sessionGateReady, sessionStartedAt]);

  useEffect(() => {
    if (
      sessionGateReady && !sessionEnded && credits < BET_OPTIONS[0] && pendingWin === 0 &&
      freeGames === 0 && !coinFeatureQueued && !coinFeatureOpen && !spinning && !gambleOpen
    ) {
      endSession();
    }
  });

  function pulseSlap() {
    audioRef.current?.playSfx('cabinetSlap');
    setSlapActive(true);
    window.setTimeout(() => setSlapActive(false), 180);
  }

  async function toggleFullscreen() {
    audioRef.current?.playSfx('transitionWhoosh');
    try {
      const host = window.thunderCutHost;
      if (host?.getFullscreen && host.setFullscreen) {
        setIsFullscreen(await host.setFullscreen(!await host.getFullscreen()));
      } else if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await document.documentElement.requestFullscreen();
      else {
        audioRef.current?.playSfx('uiWarning');
        setMessage('Fullscreen is not available in this window. The desktop app can still be resized normally.');
      }
    } catch {
      audioRef.current?.playSfx('uiWarning');
      setMessage('Fullscreen is not available in this window. The desktop app can still be resized normally.');
    }
  }

  function saveJackpotCycleStats(nextStats: JackpotCycleStats) {
    jackpotCycleStatsRef.current = nextStats;
    setJackpotCycleStats(nextStats);
    writeLocalValue(JACKPOT_CYCLE_STATS_KEY, JSON.stringify(nextStats));
  }

  function addPaidWagerToJackpotCycles(wager: number) {
    const current = jackpotCycleStatsRef.current;
    return {
      majorSpins: current.majorSpins + 1,
      majorWagered: roundMoney(current.majorWagered + wager),
      grandSpins: current.grandSpins + 1,
      grandWagered: roundMoney(current.grandWagered + wager),
    };
  }

  function recordJackpotCycleWins(
    majorWonNow: boolean,
    grandWonNow: boolean,
    existing: JackpotWinStat[] = jackpotWinStats,
  ) {
    if (!majorWonNow && !grandWonNow) return existing;
    const current = jackpotCycleStatsRef.current;
    const awards: JackpotWinStat[] = [];
    if (majorWonNow) awards.push({ tier: 'major', spins: current.majorSpins, wagered: current.majorWagered });
    if (grandWonNow) awards.push({ tier: 'grand', spins: current.grandSpins, wagered: current.grandWagered });
    const next = [
      ...existing.filter((entry) => !awards.some((award) => award.tier === entry.tier)),
      ...awards,
    ];
    return next;
  }

  function resetBankedJackpotCycles(majorWon: boolean, grandWon: boolean) {
    if (!majorWon && !grandWon) return jackpotCycleStatsRef.current;
    const current = jackpotCycleStatsRef.current;
    const next = {
      majorSpins: majorWon ? 0 : current.majorSpins,
      majorWagered: majorWon ? 0 : current.majorWagered,
      grandSpins: grandWon ? 0 : current.grandSpins,
      grandWagered: grandWon ? 0 : current.grandWagered,
    };
    return next;
  }

  function startBigWinCelebration(
    amount: number,
    referenceBet: number,
    forcedLabel?: 'MAJOR WIN' | 'GRAND WIN',
  ) {
    if (!forcedLabel && amount < referenceBet * BIG_WIN_MULTIPLIER) return false;
    if (bigWinCountTimer.current !== null) window.clearInterval(bigWinCountTimer.current);
    if (bigWinHideTimer.current !== null) window.clearTimeout(bigWinHideTimer.current);

    const multiple = referenceBet > 0 ? amount / referenceBet : BIG_WIN_MULTIPLIER;
    const label: BigWinCelebration['label'] = forcedLabel ?? (
      multiple >= 100 ? 'MASSIVE WIN' : multiple >= 50 ? 'SUPER WIN' : 'BIG WIN'
    );
    const duration = Math.min(9000, 5000 + Math.log10(Math.max(1, amount)) * 500);
    const startedAt = performance.now();
    bigWinFinishCuePlayed.current = false;
    const audio = audioRef.current;
    if (label === 'BIG WIN') audio?.playSfx('wildReveal', { duckMs: duration + 1000 });
    else if (label === 'SUPER WIN') audio?.playSfx('wildSubstitute', { duckMs: duration + 1000 });
    else audio?.playSfx('chargeAward', { duckMs: duration + 1000 });
    playCoinLightning('strong');
    audio?.stopCue('bigWinMusic');
    audio?.preloadBank('wins');
    audio?.playSfx('bigWinMusic', { duckMs: duration + 1000 });
    audio?.playSfx('coinPayoutRoll');
    setBigWinCelebration({ target: amount, displayed: 0, label });

    bigWinCountTimer.current = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 2.35);
      setBigWinCelebration({
        target: amount,
        displayed: roundMoney(amount * easedProgress),
        label,
      });
      if (progress < 1) return;
      if (!bigWinFinishCuePlayed.current) {
        bigWinFinishCuePlayed.current = true;
        audioRef.current?.playSfx('brightGlock');
        audioRef.current?.stopCue('coinPayoutRoll');
      }
      if (bigWinCountTimer.current !== null) window.clearInterval(bigWinCountTimer.current);
      bigWinCountTimer.current = null;
      bigWinHideTimer.current = window.setTimeout(() => {
        audioRef.current?.stopCue('bigWinMusic');
        audioRef.current?.stopCue('coinPayoutRoll');
        setBigWinCelebration(null);
        bigWinHideTimer.current = null;
      }, 1000);
    }, 50);
    return true;
  }

  function ownsActiveSession() {
    const storedToken = readLocalValue(ACTIVE_SESSION_KEY);
    return Boolean(activeSessionToken.current) && storedToken === activeSessionToken.current;
  }

  function showNewHoldCoins(cells: number[], duration = 900) {
    if (holdAnimationTimer.current !== null) window.clearTimeout(holdAnimationTimer.current);
    setNewHoldCells(cells);
    holdAnimationTimer.current = window.setTimeout(() => {
      setNewHoldCells([]);
      holdAnimationTimer.current = null;
    }, duration);
  }

  async function stageCoinValueReveal(
    token: number,
    cells: number[],
    field: Array<CoinPrize | null>,
    startingTotal: number,
    finalTotal: number,
  ) {
    setDisplayedCoinFeatureTotal(roundMoney(startingTotal));
    if (cells.length === 0) {
      setDisplayedCoinFeatureTotal(roundMoney(finalTotal));
      return;
    }
    await featureSequenceRef.current.wait(token, 330);
    let stagedTotal = startingTotal;
    for (const [index, cell] of cells.entries()) {
      if (index > 0) await featureSequenceRef.current.wait(token, 65);
      stagedTotal = roundMoney(stagedTotal + (field[cell]?.amount ?? 0));
      setDisplayedCoinFeatureTotal(stagedTotal);
    }
    setDisplayedCoinFeatureTotal(roundMoney(finalTotal));
  }

  function playCoinLightning(strength: 'normal' | 'strong' = 'normal') {
    if (strength === 'strong') {
      audioRef.current?.stopCue('coinLightning1');
      audioRef.current?.stopCue('coinLightning2');
      audioRef.current?.playSfx('coinLightning3', { duckMs: 2300 });
      return;
    }
    const cue = COIN_LIGHTNING_CUES[coinLightningIndex.current % 2];
    coinLightningIndex.current += 1;
    audioRef.current?.playSfx(cue);
  }

  function showThunderChargePulse(level: number, awarded = false) {
    if (thunderChargeTimer.current !== null) window.clearTimeout(thunderChargeTimer.current);
    setThunderChargePulse(level);
    setThunderChargeAwardedNow(awarded);
    if (awarded) audioRef.current?.playSfx('thunderChargeFull', { duckMs: 6400 });
    else audioRef.current?.playSfx('chargeUnit');
    thunderChargeTimer.current = window.setTimeout(() => {
      setThunderChargePulse(0);
      setThunderChargeAwardedNow(false);
      thunderChargeTimer.current = null;
    }, awarded ? 2100 : 1100);
  }

  function releaseFeatureAction(delay = 930) {
    if (featureUnlockTimer.current !== null) window.clearTimeout(featureUnlockTimer.current);
    featureUnlockTimer.current = window.setTimeout(() => {
      featureActionLock.current = false;
      setCoinFeatureSpinning(false);
      setCoinFeatureCelebrating(false);
      featureUnlockTimer.current = null;
      scheduleHeldSpaceAction(80);
    }, delay);
  }

  function changeLines(amount: number) {
    if (!canAdjust) return;
    const nextLines = Math.min(20, Math.max(1, activeLines + amount));
    if (nextLines === activeLines) return;
    audioRef.current?.playSfx('stepperTick');
    setActiveLines(nextLines);
  }

  function changeBet(amount: number) {
    if (!canAdjust) return;
    const nextBetIndex = Math.min(maximumBetIndex, Math.max(0, betIndex + amount));
    if (nextBetIndex === betIndex) return;
    audioRef.current?.playSfx('stepperTick');
    setBetIndex(nextBetIndex);
  }

  function guideToAffordableBet() {
    audioRef.current?.playSfx('uiWarning');
    const affordableLines = Math.max(1, Math.min(activeLines, Math.floor(credits / BET_OPTIONS[0])));
    const affordablePerLine = credits / affordableLines;
    let affordableBetIndex = 0;
    for (let index = 0; index <= maximumBetIndex; index += 1) {
      if (BET_OPTIONS[index] <= affordablePerLine) affordableBetIndex = index;
    }
    setActiveLines(affordableLines);
    setBetIndex(affordableBetIndex);
    setMessage(
      `Bet guided to ${affordableLines} ${affordableLines === 1 ? 'line' : 'lines'} × ${formatMoney(BET_OPTIONS[affordableBetIndex])} so the next spin fits the balance.`,
    );
    window.setTimeout(() => {
      if (affordableBetIndex > 0) betDecreaseButtonRef.current?.focus({ preventScroll: true });
      else controlDeckRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function requestSpin() {
    if (!canRequestSpin) return;
    if (freeGames === 0 && credits < BET_OPTIONS[0]) return;
    if (freeGames === 0 && credits < totalBet) {
      guideToAffordableBet();
      return;
    }
    void spin();
  }

  function scheduleHeldSpaceAction(delay = 90) {
    if (!spaceHeldRef.current) return;
    if (heldSpaceTimer.current !== null) window.clearTimeout(heldSpaceTimer.current);
    heldSpaceTimer.current = window.setTimeout(() => {
      heldSpaceTimer.current = null;
      if (spaceHeldRef.current && !spaceChoiceConsumedRef.current) {
        contextSpaceActionRef.current();
      }
    }, delay);
  }

  function confirmFreeGameChoice() {
    if (persistenceBlocked || !pendingFreeGameChoice || selectedFreeGameChoice !== 'classic-cut') return;
    const confirmedChoice = pendingFreeGameChoice;
    const nextFreeGames = Math.min(MAX_FREE_GAMES, freeGames + confirmedChoice.games);
    audioRef.current?.playSfx('uiPress');
    audioRef.current?.playSfx('transitionWhoosh', { delayMs: 80 });
    const commit = persistCommittedTransaction({ freeGames: nextFreeGames, pendingFreeGameChoice: null });
    if (handleCommitFailure(commit, 'Free Games selection')) return;
    setPersistenceBlocked(false);
    setFreeGames(nextFreeGames);
    setFreeGamesAwardLabel(confirmedChoice.label);
    setFreeGamesAwardedNow(confirmedChoice.games);
    setPendingFreeGameChoice(null);
    setMessage(`${confirmedChoice.games} Free Games selected. Storm ambience up — Space spins.`);
    spaceChoiceConsumedRef.current = true;
  }

  function resetDemoBalanceOnly() {
    if (!sessionGateReady || sessionEnded || persistenceBlocked || spinning || gambleOpen || featureSequenceActive) return;
    const nextPeak = Math.max(sessionPeakBalance, STARTING_CREDITS);
    const commit = persistCommittedTransaction({
      credits: STARTING_CREDITS,
      pendingWin: 0,
      pendingWinGambleLocked: false,
      gambleRound: 0,
      sessionPeakBalance: nextPeak,
    });
    if (handleCommitFailure(commit, 'Demo balance reset')) return;
    setPersistenceBlocked(false);
    audioRef.current?.playSfx('freshSession');
    setCredits(STARTING_CREDITS);
    setPendingWin(0);
    setPendingWinGambleLocked(false);
    setLastPayout(0);
    setSessionPeakBalance(nextPeak);
    setMessage(`${formatMoney(STARTING_CREDITS)} demo balance restored. Lifetime Thunder Charge and records were preserved.`);
  }

  async function startCoinFeature(
    featureBet: number,
    seedCells: number[],
    majorSnapshotCents: number,
    grandSnapshotCents: number,
    jackpotsEligible: boolean,
    fromThunderCharge: boolean,
    suppliedSeedPrizes: Record<number, CoinPrize>,
    reasons: string[],
  ) {
    if (!ownsActiveSession() || persistenceBlocked) return;
    if (!hasExactCoinPrizeCoverage(seedCells, suppliedSeedPrizes)) {
      setPersistenceBlocked(true);
      setMessage('Coin Storm recovery stopped because its committed coin values are incomplete. Reload to retry the last safe state.');
      audioRef.current?.playSfx('uiWarning');
      return;
    }
    const audio = audioRef.current;
    audio?.preloadBank('feature');
    featureActionLock.current = true;
    if (featureUnlockTimer.current !== null) window.clearTimeout(featureUnlockTimer.current);
    setJackpotWinStats([]);
    let majorAlreadyHeld = false;
    const nextField = Array.from({ length: 15 }, () => null as CoinPrize | null);
    seedCells.forEach((cell) => {
      const coin = suppliedSeedPrizes[cell];
      if (coin.tier === 'major') majorAlreadyHeld = true;
      nextField[cell] = coin;
    });

    const fullScreen = seedCells.length === 15;
    const winsGrand = fullScreen && jackpotsEligible;
    const fullScreenBonus = fullScreen && !jackpotsEligible
      ? featureBet * FULL_SCREEN_BONUS_MULTIPLIER
      : 0;
    const mergedReasons = mergeCoinStormReasons(reasons);
    const openingWinStats = recordJackpotCycleWins(majorAlreadyHeld, winsGrand, []);
    const commit = persistCommittedTransaction({
      coinFeatureQueued: false,
      coinFeatureFromThunderCharge: fromThunderCharge,
      coinFeatureReasons: mergedReasons,
      queuedCoinCells: [],
      queuedCoinPrizes: {},
      coinFeatureBet: featureBet,
      coinFeatureJackpotsEligible: jackpotsEligible,
      coinFeatureMajorCents: majorSnapshotCents,
      coinFeatureGrandCents: grandSnapshotCents,
      coinFeatureOpen: true,
      coinField: nextField,
      coinRespinsRemaining: fullScreen ? 0 : HOLD_RESPINS,
      coinFeatureComplete: fullScreen,
      coinGrandAward: winsGrand ? grandSnapshotCents / 100 : 0,
      coinFullScreenBonus: fullScreenBonus,
      jackpotWinStats: openingWinStats,
    });
    if (handleCommitFailure(commit, 'Coin Storm')) {
      featureActionLock.current = false;
      return;
    }
    setPersistenceBlocked(false);
    setCoinFeatureBet(featureBet);
    setCoinFeatureFromThunderCharge(fromThunderCharge);
    setCoinFeatureReasons(mergedReasons);
    setCoinFeatureJackpotsEligible(jackpotsEligible);
    setCoinFeatureMajorCents(majorSnapshotCents);
    setCoinFeatureGrandCents(grandSnapshotCents);
    setCoinField(nextField);
    const arrivalDuration = Math.max(900, 760 + Math.max(0, seedCells.length - 1) * 65);
    showNewHoldCoins(seedCells, arrivalDuration);
    setCoinRespinsRemaining(fullScreen ? 0 : HOLD_RESPINS);
    setCoinFeatureSpinning(true);
    setCoinFeatureCelebrating(fullScreen || majorAlreadyHeld);
    setCoinFeatureComplete(fullScreen);
    setCoinGrandAward(winsGrand ? grandSnapshotCents / 100 : 0);
    setCoinFullScreenBonus(fullScreenBonus);
    setCoinFeatureQueued(false);
    setQueuedCoinCells([]);
    setQueuedCoinPrizes({});
    setCoinFeatureOpen(true);
    setJackpotWinStats(openingWinStats);
    audio?.playSfx('transitionWhoosh');
    audio?.playSequence('heldCoinLand', seedCells.length, 72, 8);
    playCoinLightning(fullScreen || majorAlreadyHeld ? 'strong' : 'normal');
    if (fromThunderCharge) audio?.playSfx('chargeAward', { duckMs: 2100 });
    const miniCount = nextField.filter((coin) => coin?.tier === 'mini').length;
    const minorCount = nextField.filter((coin) => coin?.tier === 'minor').length;
    if (majorAlreadyHeld) audio?.playSfx('chargeAward', { duckMs: 2050 });
    else if (minorCount > 0) audio?.playSfx('brightSynth');
    else if (miniCount > 0) audio?.playSfx('brightGlock');
    setMessage(
      fromThunderCharge
        ? `Thunder Charge awards a free Coin Storm with ${seedCells.length} held coins.`
        : `${seedCells.length} Mower Coins start the hold-and-respin feature.`,
    );

    const openingTotal = roundMoney(
      nextField.reduce((total, coin) => total + (coin?.amount ?? 0), 0) +
      (winsGrand ? grandSnapshotCents / 100 : 0) + fullScreenBonus
    );
    const revealToken = featureSequenceRef.current.begin();
    try {
      await stageCoinValueReveal(revealToken, seedCells, nextField, 0, openingTotal);
    } catch (error) {
      if (!(error instanceof SequenceCancelledError)) throw error;
      setDisplayedCoinFeatureTotal(openingTotal);
      featureActionLock.current = false;
      setCoinFeatureSpinning(false);
      return;
    }

    if (winsGrand) {
      featureActionLock.current = true;
      setMessage(`FULL SCREEN! The Grand of ${formatMoney(grandSnapshotCents / 100)} is won.`);
      releaseFeatureAction(1200);
    } else if (fullScreen) {
      featureActionLock.current = true;
      setMessage(`FULL SCREEN! ${formatMoney(fullScreenBonus)} bonus — Grand required 10+ lines and a $300+ total bet.`);
      releaseFeatureAction(1000);
    } else if (majorAlreadyHeld) {
      releaseFeatureAction(900);
    } else {
      releaseFeatureAction(180);
    }
  }

  async function respinCoinFeature() {
    if (
      sessionEnded || !coinFeatureOpen || coinFeatureComplete ||
      coinFeatureSpinning || coinFeatureCelebrating || featureActionLock.current ||
      coinRespinsRemaining <= 0 || persistenceBlocked || !ownsActiveSession()
    ) return;

    featureActionLock.current = true;
    pulseSlap();
    audioRef.current?.playSfx('coinRespinWhoosh');
    const finalRespin = coinRespinsRemaining === 1;
    audioRef.current?.setLoop('fastTick', !finalRespin);
    audioRef.current?.setLoop('tensionTick', finalRespin);
    playCoinLightning();
    setCoinFeatureSpinning(true);
    showNewHoldCoins([]);
    const featureToken = featureSequenceRef.current.begin();
    try {
      await featureSequenceRef.current.wait(featureToken, COIN_RESPIN_DURATION_MS);
    } catch (error) {
      if (!(error instanceof SequenceCancelledError)) throw error;
      audioRef.current?.setLoop('fastTick', false);
      audioRef.current?.setLoop('tensionTick', false);
      setCoinFeatureSpinning(false);
      featureActionLock.current = false;
      return;
    }
    audioRef.current?.setLoop('fastTick', false);
    audioRef.current?.setLoop('tensionTick', false);
    if (!ownsActiveSession()) {
      setCoinFeatureSpinning(false);
      featureActionLock.current = false;
      return;
    }

    const previousHeldCount = coinField.filter(Boolean).length;
    const nextField = [...coinField];
    const landedCells: number[] = [];
    let majorAlreadyHeld = nextField.some((coin) => coin?.tier === 'major');

    for (let cell = 0; cell < nextField.length; cell += 1) {
      if (
        nextField[cell] === null &&
        randomInt(10000) < HOLD_COIN_CHANCE
      ) {
        const coin = drawHoldCoin(
          coinFeatureBet,
          coinFeatureMajorCents,
          coinFeatureJackpotsEligible && !majorAlreadyHeld,
        );
        if (coin.tier === 'major') majorAlreadyHeld = true;
        nextField[cell] = coin;
        landedCells.push(cell);
      }
    }

    const nextHeldCount = nextField.filter(Boolean).length;
    const fullScreen = nextHeldCount === 15;
    const nextRespins = landedCells.length > 0
      ? HOLD_RESPINS
      : Math.max(0, coinRespinsRemaining - 1);
    const complete = fullScreen || nextRespins === 0;
    const majorLanded = landedCells.some((cell) => nextField[cell]?.tier === 'major');
    const winsGrand = fullScreen && coinFeatureJackpotsEligible;
    const fullScreenBonus = fullScreen && !coinFeatureJackpotsEligible
      ? coinFeatureBet * FULL_SCREEN_BONUS_MULTIPLIER
      : 0;
    const nextGrandAward = winsGrand ? coinFeatureGrandCents / 100 : (fullScreen ? 0 : coinGrandAward);
    const nextFullScreenBonus = fullScreen ? fullScreenBonus : coinFullScreenBonus;
    const nextJackpotWinStats = recordJackpotCycleWins(majorLanded, winsGrand);
    const commit = persistCommittedTransaction({
      coinField: nextField,
      coinRespinsRemaining: fullScreen ? 0 : nextRespins,
      coinFeatureComplete: complete,
      coinGrandAward: nextGrandAward,
      coinFullScreenBonus: nextFullScreenBonus,
      jackpotWinStats: nextJackpotWinStats,
    });
    if (handleCommitFailure(commit, 'Coin Storm respin')) {
      setCoinFeatureSpinning(false);
      featureActionLock.current = false;
      return;
    }
    setPersistenceBlocked(false);

    setCoinField(nextField);
    setCoinRespinsRemaining(fullScreen ? 0 : nextRespins);
    setCoinFeatureComplete(complete);
    setCoinFeatureCelebrating(fullScreen || majorLanded);
    setCoinGrandAward(nextGrandAward);
    setCoinFullScreenBonus(nextFullScreenBonus);
    setJackpotWinStats(nextJackpotWinStats);
    const arrivalDuration = Math.max(900, 760 + Math.max(0, landedCells.length - 1) * 65);
    showNewHoldCoins(landedCells, arrivalDuration);
    const nextFeatureTotal = roundMoney(
      nextField.reduce((total, coin) => total + (coin?.amount ?? 0), 0) +
      nextGrandAward + nextFullScreenBonus
    );
    try {
      await stageCoinValueReveal(
        featureToken,
        landedCells,
        nextField,
        coinFeatureTotal,
        nextFeatureTotal,
      );
    } catch (error) {
      if (!(error instanceof SequenceCancelledError)) throw error;
      setDisplayedCoinFeatureTotal(nextFeatureTotal);
    }

    if (landedCells.length > 0) {
      const landedCoins = landedCells.flatMap((cell) => nextField[cell] ? [nextField[cell] as CoinPrize] : []);
      audioRef.current?.playSequence('heldCoinLand', landedCells.length, 76, 8);
      audioRef.current?.playSfx('respinReset');
      const crossedProgressStep = COIN_PROGRESS_THRESHOLDS.some(
        (threshold) => previousHeldCount < threshold && nextHeldCount >= threshold,
      );
      if (majorLanded) {
        playCoinLightning('strong');
        audioRef.current?.playSfx('chargeAward', { duckMs: 2050 });
      } else {
        if (landedCoins.some((coin) => coin.label === '5×' || coin.label === '10×')) {
          audioRef.current?.playSfx('coinValueHigh');
        }
        if (landedCoins.some((coin) => coin.tier === 'minor')) audioRef.current?.playSfx('brightSynth');
        else if (landedCoins.some((coin) => coin.tier === 'mini') || crossedProgressStep) {
          audioRef.current?.playSfx('brightGlock');
        }
      }
    } else {
      audioRef.current?.playSfx('shortVocalCry');
      audioRef.current?.playSfx('counterDown', { delayMs: 90 });
      if (complete) audioRef.current?.playSfx('featureComplete', { delayMs: 260 });
    }

    if (winsGrand) {
      playCoinLightning('strong');
      audioRef.current?.playSfx('chargeAward', { duckMs: 2500 });
      setCoinGrandAward(nextGrandAward);
      setCoinFullScreenBonus(0);
      setMessage(`FULL SCREEN! The Grand of ${formatMoney(coinFeatureGrandCents / 100)} is won.`);
      releaseFeatureAction(1200);
    } else if (fullScreen) {
      playCoinLightning('strong');
      audioRef.current?.playSfx('bigWinMusic', { duckMs: 2200 });
      setCoinGrandAward(0);
      setCoinFullScreenBonus(nextFullScreenBonus);
      setMessage(`FULL SCREEN! ${formatMoney(fullScreenBonus)} bonus — Grand required 10+ lines and a $300+ total bet.`);
      releaseFeatureAction(1000);
    } else if (landedCells.length > 0) {
      setMessage(`${landedCells.length} new ${landedCells.length === 1 ? 'coin' : 'coins'} held. Respins reset to 3.`);
      if (majorLanded) {
        releaseFeatureAction(900);
      } else {
        releaseFeatureAction(180);
      }
    } else if (nextRespins > 0) {
      setMessage(`No new coin. ${nextRespins} ${nextRespins === 1 ? 'respin' : 'respins'} remaining.`);
      releaseFeatureAction(180);
    } else {
      setMessage('No new coin. Respins complete — bank the feature win.');
      releaseFeatureAction(420);
    }

    scheduleHeldSpaceAction(140);
  }

  function bankCoinFeature() {
    if (
      sessionEnded || !coinFeatureOpen || !coinFeatureComplete || coinFeatureSpinning ||
      coinFeatureCelebrating || featureActionLock.current || persistenceBlocked || !ownsActiveSession()
    ) return;
    featureActionLock.current = true;
    audioRef.current?.setLoop('fastTick', false);
    audioRef.current?.setLoop('tensionTick', false);
    const majorWon = coinField.some((coin) => coin?.tier === 'major');
    const grandWon = coinGrandAward > 0;
    const featureWin = coinFeatureTotal;
    const nextPendingWin = roundMoney(pendingWin + featureWin);
    const nextSessionBestWin = Math.max(sessionBestWin, featureWin);
    const nextCycleStats = resetBankedJackpotCycles(majorWon, grandWon);
    const nextMajorCents = majorWon ? MAJOR_SEED_CENTS : majorCents;
    const nextGrandCents = grandWon ? GRAND_SEED_CENTS : grandCents;
    const commit = persistCommittedTransaction({
      pendingWin: nextPendingWin,
      pendingWinGambleLocked: pendingWinGambleLocked || majorWon || grandWon,
      gambleRound: 0,
      sessionBestWin: nextSessionBestWin,
      coinFeatureFromThunderCharge: false,
      coinFeatureReasons: [],
      coinFeatureJackpotsEligible: false,
      coinFeatureOpen: false,
      coinField: Array.from({ length: 15 }, () => null),
      coinRespinsRemaining: HOLD_RESPINS,
      coinFeatureComplete: false,
      coinGrandAward: 0,
      coinFullScreenBonus: 0,
      majorCents: nextMajorCents,
      grandCents: nextGrandCents,
      jackpotCycleStats: nextCycleStats,
      jackpotWinStats: [],
    });
    if (handleCommitFailure(commit, 'Coin Storm bank')) {
      featureActionLock.current = false;
      return;
    }
    setPersistenceBlocked(false);
    if (coinFeatureFromThunderCharge) removeLocalValue(THUNDER_AWARD_PENDING_KEY);
    if (majorWon) writeLocalValue(MAJOR_KEY, String(nextMajorCents));
    if (grandWon) writeLocalValue(GRAND_KEY, String(nextGrandCents));
    saveJackpotCycleStats(nextCycleStats);
    setPendingWin(nextPendingWin);
    setLastPayout(featureWin);
    setSessionBestWin(nextSessionBestWin);
    if (majorWon || grandWon) setPendingWinGambleLocked(true);
    if (majorWon) {
      setMajorCents(MAJOR_SEED_CENTS);
    }
    if (grandWon) {
      setGrandCents(GRAND_SEED_CENTS);
    }
    setCoinFeatureOpen(false);
    setCoinFeatureFromThunderCharge(false);
    setCoinFeatureReasons([]);
    setCoinFeatureJackpotsEligible(false);
    setCoinFeatureComplete(false);
    setCoinFeatureSpinning(false);
    setCoinFeatureCelebrating(false);
    setCoinField(Array.from({ length: 15 }, () => null));
    setNewHoldCells([]);
    setCoinRespinsRemaining(HOLD_RESPINS);
    setCoinGrandAward(0);
    setCoinFullScreenBonus(0);
    setDisplayedCoinFeatureTotal(0);
    setJackpotWinStats([]);
    setThunderChargePulse(0);
    setThunderChargeAwardedNow(false);
    setMessage(
      `${formatMoney(featureWin)} from the Coin Storm added to the win bank.${
        majorWon || grandWon ? ' Major and Grand awards are collect-only.' : ''
      }`,
    );
    const deferredBigWin = deferredBigWinRef.current;
    deferredBigWinRef.current = null;
    const countedWinStarted = startBigWinCelebration(
      roundMoney(featureWin + (deferredBigWin?.amount ?? 0)),
      deferredBigWin?.referenceBet ?? coinFeatureBet,
      grandWon ? 'GRAND WIN' : majorWon ? 'MAJOR WIN' : undefined,
    );
    if (!countedWinStarted) {
      audioRef.current?.playSfx('coinPayoutRoll', { duckMs: 1800 });
      audioRef.current?.playSfx('gambleClose', { delayMs: 250 });
    }
    scheduleHeldSpaceAction(160);
  }

  async function spin() {
    if (spinLock.current || !canSpin || persistenceBlocked || sessionEnded || !ownsActiveSession()) return;

    const usingFreeGame = freeGames > 0;
    const preSpinCycleStats = { ...jackpotCycleStatsRef.current };
    spinLock.current = true;
    pulseSlap();
    if (usingFreeGame) audioRef.current?.playSfx('freeSpinEngine');
    else {
      audioRef.current?.playSfx('stepperTick');
      audioRef.current?.playSfx('spinMowerStart');
    }
    audioRef.current?.setLoop('reelMotion', true);
    setSpinning(true);
    setWinningLines([]);
    setBaseCoinCells([]);
    setBaseCoinPrizes({});
    setLastPayout(0);
    setDisplayedGridIsFreeGame(false);
    if (freeGamesAwardTimer.current !== null) {
      window.clearTimeout(freeGamesAwardTimer.current);
      freeGamesAwardTimer.current = null;
    }
    setFreeGamesAwardedNow(0);
    setMessage(
      usingFreeGame
        ? `Free game in progress · ${freeGames} remaining.`
        : `Mowing ${activeLines} lines through the storm…`,
    );

    let nextMajorCents = majorCents;
    let nextGrandCents = grandCents;
    let nextCycleStats = preSpinCycleStats;
    if (!usingFreeGame) {
      nextCycleStats = addPaidWagerToJackpotCycles(totalBet);
      nextMajorCents = readProgressiveCents(MAJOR_KEY, majorCents, MAJOR_SEED_CENTS);
      nextGrandCents = readProgressiveCents(GRAND_KEY, grandCents, GRAND_SEED_CENTS);
      nextMajorCents += Math.max(1, Math.round(totalBet * 100 * MAJOR_GROWTH_RATE));
      nextGrandCents += Math.max(1, Math.round(totalBet * 100 * GRAND_GROWTH_RATE));
    }

    const spinJackpotsEligible = jackpotsAreEligible(activeLines, totalBet);
    const finalResult = addFeatureSymbols(
      randomBaseGrid(),
      usingFreeGame ? FREE_GAME_COIN_CHANCE : BASE_COIN_CHANCE,
    );
    const precomputedCoinPrizes: Record<number, CoinPrize> = {};
    let precomputedMajor = false;
    finalResult.coinCells.forEach((cell) => {
      const prize = drawHoldCoin(totalBet, nextMajorCents, spinJackpotsEligible && !precomputedMajor);
      if (prize.tier === 'major') precomputedMajor = true;
      precomputedCoinPrizes[cell] = prize;
    });

    /*
     * Accept and durably commit the exact result before any reel can reveal it.
     * The visual sequence may be fast-forwarded on visibility loss, but an
     * accepted wager/free game can never be refunded after its outcome exists.
     */
    const scatters = finalResult.scatterCells.length;
    const urScatterCount = finalResult.urScatterCells.length;
    const coinCount = finalResult.coinCells.length;
    const qualifyingBoltCount = usingFreeGame
      ? 0
      : finalResult.grid.filter((symbol) => symbol === 'bolt').length;
    const displayedBoltCount = finalResult.grid.filter((symbol) => symbol === 'bolt').length;
    const wildCount = finalResult.grid.filter((symbol) => symbol === 'wild').length;
    const normalScatterCount = Math.max(0, scatters - urScatterCount);
    const wins = scoreGrid(finalResult.grid, activeLines, betPerLine);
    const linePayout = wins.reduce((total, win) => total + win.payout, 0);
    const baseScatterPayout = scatters === 3 ? totalBet * 2 : scatters === 4 ? totalBet * 10 : 0;
    const scatterPayout = baseScatterPayout * (urScatterCount > 0 ? 2 : 1);
    const gamesAwarded = scatters === 4
      ? 15
      : scatters === 3
        ? 8
        : usingFreeGame && scatters === 2
          ? STORM_DOOR_AWARD
          : 0;
    const payout = linePayout + scatterPayout;
    const remainingGames = usingFreeGame ? Math.max(0, freeGames - 1) : freeGames;
    const initialChoiceAward = !usingFreeGame && gamesAwarded > 0 ? gamesAwarded : 0;
    const nextFreeGames = Math.min(MAX_FREE_GAMES, remainingGames + (initialChoiceAward > 0 ? 0 : gamesAwarded));
    const appliedGamesAwarded = Math.min(MAX_FREE_GAMES - remainingGames, gamesAwarded);
    const naturalCoinTrigger = coinCount >= COIN_TRIGGER_COUNT;
    const instantBoltTrigger = shouldInstantBoltTrigger(finalResult.grid);
    let thunderChargeTrigger = false;
    let nextThunderLifetimeBolts = thunderLifetimeRef.current;
    let nextThunderTarget = thunderTargetRef.current;

    if (qualifyingBoltCount > 0) {
      const storedProgress = readThunderProgress(thunderLifetimeRef.current, thunderTargetRef.current);
      const advanced = advanceThunderProgress(
        storedProgress.lifetimeBolts,
        storedProgress.nextTarget,
        qualifyingBoltCount,
        randomInt(1_000_000) / 1_000_000,
      );
      thunderChargeTrigger = advanced.awarded;
      nextThunderLifetimeBolts = advanced.lifetimeBolts;
      nextThunderTarget = advanced.nextTarget;
    }

    let nextCoinFeatureQueued: boolean = coinFeatureQueued;
    let nextCoinFeatureFromThunderCharge = coinFeatureFromThunderCharge;
    let nextCoinFeatureReasons = coinFeatureReasons;
    let nextQueuedCoinCells = queuedCoinCells;
    let nextQueuedCoinPrizes = queuedCoinPrizes;
    let nextCoinFeatureBet = coinFeatureBet;
    let nextCoinFeatureJackpotsEligible = coinFeatureJackpotsEligible;
    let nextFeatureMajorCents = coinFeatureMajorCents;
    let nextFeatureGrandCents = coinFeatureGrandCents;
    let pendingThunderAwardToStore: ThunderAwardRecord | null = null;

    const hiddenThunderTrigger = thunderChargeTrigger || instantBoltTrigger;
    if (naturalCoinTrigger || hiddenThunderTrigger) {
      const featureSeedCells = naturalCoinTrigger
        ? finalResult.coinCells
        : fillCoinSeedCells(finalResult.coinCells, finalResult.scatterCells, COIN_TRIGGER_COUNT);
      const featureReasons = mergeCoinStormReasons([
        naturalCoinTrigger ? 'six-coins' : '',
        thunderChargeTrigger ? 'hidden-thunder-guarantee' : '',
        instantBoltTrigger ? 'seven-bolts' : '',
      ]);
      nextCoinFeatureQueued = true;
      nextCoinFeatureFromThunderCharge = hiddenThunderTrigger;
      nextCoinFeatureReasons = featureReasons;
      nextQueuedCoinCells = featureSeedCells;
      const featurePrizeMap: Record<number, CoinPrize> = {};
      let featureHasMajor = false;
      featureSeedCells.forEach((cell) => {
        const prize = precomputedCoinPrizes[cell] ?? drawHoldCoin(
          totalBet,
          nextMajorCents,
          spinJackpotsEligible && !featureHasMajor,
        );
        if (prize.tier === 'major') featureHasMajor = true;
        featurePrizeMap[cell] = prize;
      });
      if (!featureSeedCells.some((cell) => featurePrizeMap[cell]?.tier === 'mini' || featurePrizeMap[cell]?.tier === 'minor')) {
        const bonusCandidates = featureSeedCells.filter((cell) => featurePrizeMap[cell]?.tier !== 'major');
        if (bonusCandidates.length > 0) {
          const bonusCell = bonusCandidates[randomInt(bonusCandidates.length)];
          const miniMinor = getMiniMinorValues(totalBet, nextMajorCents);
          featurePrizeMap[bonusCell] = randomInt(4) === 0
            ? { label: 'MINOR', amount: miniMinor.minor, tier: 'minor' }
            : { label: 'MINI', amount: miniMinor.mini, tier: 'mini' };
        }
      }
      nextQueuedCoinPrizes = featurePrizeMap;
      finalResult.coinCells.forEach((cell) => {
        if (featurePrizeMap[cell]) precomputedCoinPrizes[cell] = featurePrizeMap[cell];
      });
      nextCoinFeatureBet = totalBet;
      nextCoinFeatureJackpotsEligible = spinJackpotsEligible;
      nextFeatureMajorCents = nextMajorCents;
      nextFeatureGrandCents = nextGrandCents;
      if (hiddenThunderTrigger) {
        pendingThunderAwardToStore = {
          awardId: makeSessionToken(),
          featureBet: totalBet,
          seedCells: featureSeedCells,
          seedPrizes: nextQueuedCoinPrizes,
          reasons: featureReasons,
          majorCents: nextMajorCents,
          grandCents: nextGrandCents,
          jackpotsEligible: spinJackpotsEligible,
        };
      }
    }

    const gamesAwardLabel = urScatterCount > 0 && baseScatterPayout > 0
      ? 'UR SCATTERED ×2 PAY'
      : usingFreeGame ? 'STORM DOORS RETRIGGER' : 'SCATTER STORM';
    const nextPendingFreeGameChoice = initialChoiceAward > 0
      ? { games: initialChoiceAward, label: gamesAwardLabel }
      : pendingFreeGameChoice;
    const commit = persistCommittedTransaction({
      credits: usingFreeGame ? credits : roundMoney(credits - totalBet),
      pendingWin: roundMoney(pendingWin + payout),
      spins: spins + 1,
      sessionBestWin: Math.max(sessionBestWin, payout),
      metresMowed: metresMowed + 24 + activeLines * 3,
      grid: finalResult.grid,
      baseCoinCells: finalResult.coinCells,
      baseCoinPrizes: precomputedCoinPrizes,
      freeGames: nextFreeGames,
      pendingFreeGameChoice: nextPendingFreeGameChoice,
      coinFeatureQueued: nextCoinFeatureQueued,
      coinFeatureFromThunderCharge: nextCoinFeatureFromThunderCharge,
      coinFeatureReasons: nextCoinFeatureReasons,
      queuedCoinCells: nextQueuedCoinCells,
      queuedCoinPrizes: nextQueuedCoinPrizes,
      coinFeatureBet: nextCoinFeatureBet,
      coinFeatureJackpotsEligible: nextCoinFeatureJackpotsEligible,
      coinFeatureMajorCents: nextFeatureMajorCents,
      coinFeatureGrandCents: nextFeatureGrandCents,
      majorCents: nextMajorCents,
      grandCents: nextGrandCents,
      thunderLifetimeBolts: nextThunderLifetimeBolts,
      thunderNextTarget: nextThunderTarget,
      jackpotCycleStats: nextCycleStats,
    });
    if (handleCommitFailure(commit, usingFreeGame ? 'Free Game' : 'Spin')) {
      audioRef.current?.setLoop('reelMotion', false);
      setSpinning(false);
      spinLock.current = false;
      return;
    }
    setPersistenceBlocked(false);
    if (!usingFreeGame) {
      setCredits(roundMoney(credits - totalBet));
      setMajorCents(nextMajorCents);
      setGrandCents(nextGrandCents);
      writeLocalValue(MAJOR_KEY, String(nextMajorCents));
      writeLocalValue(GRAND_KEY, String(nextGrandCents));
      saveJackpotCycleStats(nextCycleStats);
    }
    thunderLifetimeRef.current = nextThunderLifetimeBolts;
    thunderTargetRef.current = nextThunderTarget;
    setThunderLifetimeBolts(nextThunderLifetimeBolts);
    setThunderNextTarget(nextThunderTarget);
    writeLocalValue(THUNDER_LIFETIME_KEY, String(nextThunderLifetimeBolts));
    writeLocalValue(THUNDER_NEXT_TARGET_KEY, String(nextThunderTarget));
    if (pendingThunderAwardToStore) {
      writeLocalValue(THUNDER_AWARD_PENDING_KEY, JSON.stringify(pendingThunderAwardToStore));
    }

    // Coin faces are attached to the already-committed result before the first
    // stopped column is revealed, preventing blank or previous-spin values.
    setBaseCoinPrizes(precomputedCoinPrizes);

    // Preserve all 35 existing decorative RNG draws, independently of the result.
    // Only the stopped cells reveal the committed symbols and exact coin faces.
    setReelPreview(Array.from({ length: 5 }, () =>
      Array.from({ length: 7 }, () => ({ key: randomBaseSymbol() })),
    ));
    setReelPhases(Array.from({ length: 5 }, () => 'accelerating'));
    const spinToken = spinSequenceRef.current.begin();
    const revealGrid = [...grid];
    try {
      await spinSequenceRef.current.wait(spinToken, REEL_ACCELERATION_MS);
      setReelPhases(Array.from({ length: 5 }, () => 'spinning'));
      await spinSequenceRef.current.wait(spinToken, REEL_FULL_SPEED_MS);
      for (let reel = 0; reel < 5; reel += 1) {
        setReelPhases((current) => current.map((phase, index) =>
          index < reel ? 'settled' : index === reel ? 'braking' : phase
        ));
        await spinSequenceRef.current.wait(
          spinToken,
          reel === 0 ? FIRST_REEL_BRAKE_MS : REEL_STOP_OFFSET_MS,
        );
        for (let row = 0; row < 3; row += 1) {
          const cell = row * 5 + reel;
          revealGrid[cell] = finalResult.grid[cell];
        }
        setGrid([...revealGrid]);
        setReelPhases((current) => current.map((phase, index) => index === reel ? 'stopped' : phase));
        audioRef.current?.playSfx(reel % 2 === 0 ? 'reelStop' : 'reelStopAlt');
      }
      await spinSequenceRef.current.wait(spinToken, FINAL_REEL_SETTLE_MS);
    } catch (error) {
      if (!(error instanceof SequenceCancelledError)) throw error;
      // The accepted result is already durable. Fast-forward its presentation.
    }
    setGrid(finalResult.grid);
    setReelPhases(Array.from({ length: 5 }, () => 'settled'));
    audioRef.current?.setLoop('reelMotion', false);
    if (!ownsActiveSession()) {
      setSpinning(false);
      spinLock.current = false;
      return;
    }
    const resultAudioDelay = 130;

    audioRef.current?.playSequence('scatterLand', normalScatterCount, 140, 2, resultAudioDelay);
    audioRef.current?.playSequence('urScatterLand', urScatterCount, 160, 1, resultAudioDelay);
    audioRef.current?.playSequence('heldCoinLand', coinCount, 70, 6, resultAudioDelay);
    if (displayedBoltCount > 0) audioRef.current?.playSfx('stormBoltLand', { delayMs: resultAudioDelay });
    if (wildCount > 0) audioRef.current?.playSfx('wildReveal', { delayMs: resultAudioDelay });
    if (qualifyingBoltCount > 0) {
      audioRef.current?.playSequence('chargeUnit', qualifyingBoltCount, 85, 5, resultAudioDelay);
      showThunderChargePulse(Math.min(5, qualifyingBoltCount), thunderChargeTrigger);
    }
    if (instantBoltTrigger && !thunderChargeTrigger) {
      showThunderChargePulse(5, true);
      playCoinLightning('strong');
    }

    setGrid(finalResult.grid);
    setDisplayedGridIsFreeGame(usingFreeGame);
    setBaseCoinCells(finalResult.coinCells);
    setBaseCoinPrizes(precomputedCoinPrizes);
    setWinningLines(wins);
    setLastPayout(payout);
    if (payout > 0) setSessionBestWin((current) => Math.max(current, payout));
    setSpins((current) => current + 1);
    setMetresMowed((current) => current + 24 + activeLines * 3);
    setFreeGames(nextFreeGames);
    setCoinFeatureQueued(nextCoinFeatureQueued);
    setCoinFeatureFromThunderCharge(nextCoinFeatureFromThunderCharge);
    setCoinFeatureReasons(nextCoinFeatureReasons);
    setQueuedCoinCells(nextQueuedCoinCells);
    setQueuedCoinPrizes(nextQueuedCoinPrizes);
    setCoinFeatureBet(nextCoinFeatureBet);
    setCoinFeatureJackpotsEligible(nextCoinFeatureJackpotsEligible);
    setCoinFeatureMajorCents(nextFeatureMajorCents);
    setCoinFeatureGrandCents(nextFeatureGrandCents);

    if (initialChoiceAward > 0) {
      setSelectedFreeGameChoice('classic-cut');
      setPendingFreeGameChoice({ games: initialChoiceAward, label: gamesAwardLabel });
      setFreeGamesAwardedNow(0);
    } else if (appliedGamesAwarded > 0) {
      setFreeGamesAwardLabel(gamesAwardLabel);
      setFreeGamesAwardedNow(appliedGamesAwarded);
      freeGamesAwardTimer.current = window.setTimeout(() => {
        setFreeGamesAwardedNow(0);
        freeGamesAwardTimer.current = null;
      }, 1900);
    }

    if (payout > 0) {
      setPendingWin((current) => roundMoney(current + payout));
      setCashBurstKey((current) => current + 1);
    }
    const payoutQualifiesAsBig = payout > 0 && payout >= totalBet * BIG_WIN_MULTIPLIER;
    if (wins.length > 0) audioRef.current?.playSequence('paylineHit', wins.length, 82, 5, resultAudioDelay);
    if (wins.some((win) => win.usedWild)) {
      audioRef.current?.playSfx('wildSubstitute', { delayMs: resultAudioDelay });
    }
    if (wins.some((win) => win.symbol === 'fuel')) {
      audioRef.current?.playSfx('fuelPour', { delayMs: resultAudioDelay });
    }
    if (payout > 0) {
      audioRef.current?.playSfx('cashBurst', { delayMs: resultAudioDelay });
      if (!payoutQualifiesAsBig && appliedGamesAwarded === 0) {
        audioRef.current?.playSfx('standardWin', { delayMs: resultAudioDelay });
      }
    }
    if (appliedGamesAwarded > 0) {
      if (usingFreeGame || urScatterCount > 0) playCoinLightning('strong');
      if (usingFreeGame && scatters === 2) {
        audioRef.current?.playSfx('wildSubstitute', { delayMs: resultAudioDelay, duckMs: 1900 });
      } else if (scatters === 4) {
        audioRef.current?.playSfx('brightSynth', { delayMs: resultAudioDelay, duckMs: 1900 });
      } else {
        audioRef.current?.playSfx('appReady', { delayMs: resultAudioDelay, duckMs: 1900 });
      }
      if (urScatterCount > 0 && baseScatterPayout > 0) {
        audioRef.current?.playSfx('chargeAward', { delayMs: resultAudioDelay + 180, duckMs: 1900 });
      }
    }
    if (naturalCoinTrigger) {
      audioRef.current?.playSfx('coinStormTrigger', { delayMs: resultAudioDelay, duckMs: 2040 });
    }
    if (
      payout === 0 && appliedGamesAwarded === 0 && !naturalCoinTrigger && !hiddenThunderTrigger &&
      coinCount === 0 && displayedBoltCount === 0 && wildCount === 0
    ) {
      audioRef.current?.playSfx(NO_WIN_AUDIO_CUES[randomInt(NO_WIN_AUDIO_CUES.length)], {
        delayMs: resultAudioDelay,
      });
    }
    if (usingFreeGame && nextFreeGames === 0 && !nextCoinFeatureQueued && initialChoiceAward === 0) {
      audioRef.current?.playSfx('featureComplete', { delayMs: resultAudioDelay + 250 });
    }
    const featureSequenceFinished = nextFreeGames === 0 && !nextCoinFeatureQueued && initialChoiceAward === 0;
    if (!featureSequenceFinished && payoutQualifiesAsBig) {
      const deferred = deferredBigWinRef.current;
      deferredBigWinRef.current = {
        amount: roundMoney((deferred?.amount ?? 0) + payout),
        referenceBet: deferred?.referenceBet ?? totalBet,
      };
    } else if (featureSequenceFinished) {
      const deferred = deferredBigWinRef.current;
      const amountToCount = roundMoney((deferred?.amount ?? 0) + (payoutQualifiesAsBig ? payout : 0));
      deferredBigWinRef.current = null;
      if (amountToCount > 0) {
        startBigWinCelebration(
          amountToCount,
          deferred?.referenceBet ?? totalBet,
        );
      }
    }

    const resultMessages: string[] = [];
    if (payout > 0) resultMessages.push(`${formatMoney(payout)} added to the win bank`);
    if (baseScatterPayout > 0 && urScatterCount > 0) {
      resultMessages.push('UR SCATTERED counts as a Scatter and doubles the Scatter pay');
    }
    if (appliedGamesAwarded > 0) {
      resultMessages.push(
        usingFreeGame && scatters === 2
          ? `2 Storm Doors open and add ${appliedGamesAwarded} free games`
          : `${scatters} scatters award ${appliedGamesAwarded} free games`,
      );
    }
    if (thunderChargeTrigger) {
      resultMessages.push(
        naturalCoinTrigger
          ? 'Thunder Charge complete — one Coin Storm triggered'
          : 'Hidden Thunder Charge complete — free Coin Storm awarded',
      );
    } else if (instantBoltTrigger) {
      resultMessages.push('7 or more Storm Bolts landed — instant Coin Storm awarded');
    } else if (naturalCoinTrigger) resultMessages.push(`${coinCount} coins trigger Coin Storm`);
    else if (coinCount > 0) resultMessages.push(`${coinCount} / 6 Mower Coins landed${usingFreeGame ? ' in the free game' : ''}`);
    if (!hiddenThunderTrigger && qualifyingBoltCount > 0) {
      resultMessages.push(`${qualifyingBoltCount} Storm ${qualifyingBoltCount === 1 ? 'Bolt' : 'Bolts'} fed the hidden Thunder Charge`);
    }
    if (resultMessages.length === 0) {
      resultMessages.push(
        usingFreeGame
          ? `Free game complete · ${nextFreeGames} remaining`
          : `No win · ${formatMoney(totalBet)} used · balance ${formatMoney(credits - totalBet)}`,
      );
    }
    setMessage(`${resultMessages.join(' · ')}.`);

    setSpinning(false);
    spinLock.current = false;

    if (!nextCoinFeatureQueued && initialChoiceAward === 0 && !bigWinCelebration) {
      scheduleHeldSpaceAction(120);
    }
  }

  function collectWin() {
    if (
      collectLock.current || pendingWin <= 0 || featureSequenceActive ||
      bigWinCelebration || gambleReacting || gambleActionLock.current || persistenceBlocked ||
      sessionEnded || !ownsActiveSession()
    ) return;
    collectLock.current = true;
    const collected = pendingWin;
    const collectedSettlement = settleCollectedWin(credits, collected, sessionPeakBalance);
    const nextCredits = collectedSettlement.credits;
    const nextPeakBalance = collectedSettlement.peakBalance;
    const unlocksHighRoller = !highRollerUnlocked && nextCredits >= HIGH_ROLLER_UNLOCK_CREDITS;
    const commit = persistCommittedTransaction({
      credits: nextCredits,
      pendingWin: 0,
      pendingWinGambleLocked: false,
      gambleRound: 0,
      sessionPeakBalance: nextPeakBalance,
    });
    if (handleCommitFailure(commit, 'Collect')) {
      collectLock.current = false;
      return;
    }
    setPersistenceBlocked(false);
    audioRef.current?.playSfx('cashBurst');
    if (gambleOpen) audioRef.current?.playSfx('gambleClose');
    setCredits(nextCredits);
    setSessionPeakBalance(nextPeakBalance);
    if (unlocksHighRoller) {
      audioRef.current?.playSfx('brightSynth', { duckMs: 1400 });
      setHighRollerUnlocked(true);
      writeLocalValue(HIGH_ROLLER_KEY, 'true');
    }
    setPendingWin(0);
    setPendingWinGambleLocked(false);
    setGambleOpen(false);
    setGambleResult(null);
    setGambleSuit(null);
    setGambleChoice(null);
    setSelectedGambleChoice('red');
    setGambleRound(0);
    setMessage(
      unlocksHighRoller
        ? `${formatMoney(collected)} collected — HIGH ROLLER unlocked up to $5,000 per line.`
        : `${formatMoney(collected)} collected. Demo balance updated.`,
    );
    window.setTimeout(() => { collectLock.current = false; }, 80);
  }

  function openGamble() {
    if (
      pendingWin <= 0 || spinning || featureSequenceActive ||
      bigWinCelebration || pendingWinGambleLocked || gambleRound >= GAMBLE_MAX_ROUNDS || persistenceBlocked ||
      sessionEnded || !ownsActiveSession()
    ) return;
    audioRef.current?.preloadBank('gamble');
    gambleReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    audioRef.current?.playSfx('gambleOpen');
    setGambleResult(null);
    setGambleSuit(null);
    setGambleChoice(null);
    setGambleOpen(true);
  }

  async function chooseGamble(choice: GambleChoice) {
    if (
      gambleActionLock.current || gambleAnimating || pendingWin <= 0 ||
      gambleResult !== null || gambleRound >= GAMBLE_MAX_ROUNDS || persistenceBlocked || sessionEnded || !ownsActiveSession()
    ) return;
    const bankBefore = pendingWin;
    const round = gambleRound + 1;
    gambleActionLock.current = true;
    pulseSlap();
    const finalGambleRound = round === GAMBLE_MAX_ROUNDS;
    audioRef.current?.setLoop('fastTick', !finalGambleRound);
    audioRef.current?.setLoop('tensionTick', finalGambleRound);
    setGambleChoice(choice);
    setGambleAnimating(true);
    const gambleToken = featureSequenceRef.current.begin();
    try {
      await featureSequenceRef.current.wait(gambleToken, GAMBLE_DRAW_DURATION_MS);
    } catch (error) {
      if (!(error instanceof SequenceCancelledError)) throw error;
      audioRef.current?.setLoop('fastTick', false);
      audioRef.current?.setLoop('tensionTick', false);
      setGambleAnimating(false);
      gambleActionLock.current = false;
      return;
    }
    audioRef.current?.setLoop('fastTick', false);
    audioRef.current?.setLoop('tensionTick', false);
    if (!ownsActiveSession()) {
      setGambleAnimating(false);
      gambleActionLock.current = false;
      return;
    }

    const suit = GAMBLE_SUITS[randomInt(GAMBLE_SUITS.length)];
    const result: GambleResult =
      suit === 'hearts' || suit === 'diamonds' ? 'red' :
      'black';
    const rank = GAMBLE_RANKS[randomInt(GAMBLE_RANKS.length)];
    const colourChoice = choice === 'red' || choice === 'black';
    const hit = colourChoice ? result === choice : suit === choice;
    const multiplier = colourChoice
      ? 2
      : choice === 'hearts' || choice === 'diamonds'
        ? RED_SUIT_MULTIPLIER
        : BLACK_SUIT_MULTIPLIER;
    const gambleSettlement = settleGambleBank(bankBefore, multiplier, hit, gambleRound);
    const bankAfter = gambleSettlement.bankAfter;
    const nextGambleRound = gambleSettlement.gambleRound;
    const nextSessionBestWin = Math.max(sessionBestWin, bankAfter);
    const commit = persistCommittedTransaction({
      pendingWin: bankAfter,
      gambleRound: nextGambleRound,
      sessionBestWin: nextSessionBestWin,
    });
    if (handleCommitFailure(commit, 'Gamble')) {
      setGambleChoice(null);
      setGambleAnimating(false);
      gambleActionLock.current = false;
      return;
    }
    setPersistenceBlocked(false);

    gambleHistoryId.current += 1;
    setGambleHistory((current) => [{
      id: gambleHistoryId.current,
      spin: spins,
      round,
      choice,
      outcome: suit,
      rank,
      hit,
      bankBefore,
      bankAfter,
      multiplier,
    }, ...current]);

    setGambleSuit(suit);
    setGambleRank(rank);
    setGambleResult(result);
    setGambleRound(nextGambleRound);
    audioRef.current?.playSfx('paylineHit');

    if (hit) {
      if (colourChoice) audioRef.current?.playSfx('standardWin');
      else if (choice === 'hearts' || choice === 'diamonds') audioRef.current?.playSfx('wildReveal');
      else audioRef.current?.playSfx('wildSubstitute');
      audioRef.current?.playSfx('cashBurst', { delayMs: 90 });
      setPendingWin(bankAfter);
      setSessionBestWin(nextSessionBestWin);
      setCashBurstKey((current) => current + 1);
      setMessage(
        `${rank}${SUIT_GLYPHS[suit]} hits ${gambleChoiceLabel(choice)}. ` +
        `${multiplier}× pays ${formatMoney(bankAfter)}.`,
      );
    } else {
      audioRef.current?.playSfx('gambleMissImpact');
      audioRef.current?.playSfx('gambleMissTail', { delayMs: 80, duckMs: 1200 });
      setPendingWin(0);
      setMessage(`${rank}${SUIT_GLYPHS[suit]} misses ${gambleChoiceLabel(choice)}. The gamble bank is gone.`);
    }
    setGambleAnimating(false);
    setGambleReacting(true);
    window.setTimeout(() => {
      gambleActionLock.current = false;
      setGambleReacting(false);
      scheduleHeldSpaceAction(80);
    }, 520);
  }

  function gambleAgain() {
    audioRef.current?.playSfx('uiPress');
    setGambleResult(null);
    setGambleSuit(null);
    setGambleChoice(null);
    setSelectedGambleChoice('red');
  }

  function settleAndCloseGamble() {
    if (gambleAnimating || gambleReacting || gambleActionLock.current) return;
    if (pendingWin > 0) {
      collectWin();
      return;
    }
    audioRef.current?.playSfx('gambleClose');
    setGambleOpen(false);
    setGambleResult(null);
    setGambleSuit(null);
    setGambleChoice(null);
    setGambleRound(0);
  }

  function endSession() {
    if (
      spinning || gambleOpen || coinFeatureOpen || coinFeatureQueued ||
      freeGames > 0 || pendingWin > 0 || !ownsActiveSession()
    ) return;
    audioRef.current?.playSfx('respinReset', { duckMs: 1260 });
    const snapshot: SessionSnapshot = {
      id: sessionStartedAt,
      credits,
      peakBalance: sessionPeakBalance,
      spins,
      elapsedSeconds,
      bestWin: sessionBestWin,
    };
    writeLocalValue(SESSION_SNAPSHOT_KEY, JSON.stringify(snapshot));
    writeLocalValue(SESSION_LOCK_KEY, 'true');
    removeLocalValue(GAME_TRANSACTION_KEY);
    setEndedSnapshot(snapshot);
    setSessionEnded(true);
    setPlayerName('');
    setMessage('Session ended. Add your name, then start a fresh game.');
  }

  function resetSessionState(nextSessionStartedAt = Date.now()) {
    cancelBigWinCelebration();
    audioRef.current?.setLoop('reelMotion', false);
    audioRef.current?.setLoop('fastTick', false);
    audioRef.current?.setLoop('tensionTick', false);
    audioRef.current?.stopCue('bigWinMusic');
    audioRef.current?.stopCue('coinPayoutRoll');
    deferredBigWinRef.current = null;
    setCredits(STARTING_CREDITS);
    setGrid(STARTING_GRID);
    setReelPhases(Array.from({ length: 5 }, () => 'idle'));
    setActiveLines(10);
    setBetIndex(1);
    setSpinning(false);
    setPendingWin(0);
    setPendingWinGambleLocked(false);
    setLastPayout(0);
    setWinningLines([]);
    setBaseCoinCells([]);
    setBaseCoinPrizes({});
    setFreeGames(0);
    setPendingFreeGameChoice(null);
    setFreeGamesAwardedNow(0);
    setFreeGamesAwardLabel('SCATTER STORM');
    setDisplayedGridIsFreeGame(false);
    setCoinFeatureQueued(false);
    setCoinFeatureFromThunderCharge(false);
    setCoinFeatureReasons([]);
    setQueuedCoinCells([]);
    setQueuedCoinPrizes({});
    setCoinFeatureBet(0);
    setCoinFeatureJackpotsEligible(false);
    setCoinFeatureMajorCents(majorCents);
    setCoinFeatureGrandCents(grandCents);
    setCoinFeatureOpen(false);
    setCoinField(Array.from({ length: 15 }, () => null));
    setNewHoldCells([]);
    setCoinRespinsRemaining(HOLD_RESPINS);
    setCoinFeatureSpinning(false);
    setCoinFeatureCelebrating(false);
    setCoinFeatureComplete(false);
    setCoinGrandAward(0);
    setCoinFullScreenBonus(0);
    setDisplayedCoinFeatureTotal(0);
    setThunderChargePulse(0);
    setThunderChargeAwardedNow(false);
    setMessage('Fresh storm unlocked. Set your lines and bet, then spin.');
    setSpins(0);
    setSessionBestWin(0);
    setSessionPeakBalance(STARTING_CREDITS);
    setMetresMowed(0);
    setSessionStartedAt(nextSessionStartedAt);
    setElapsedSeconds(0);
    setSessionEnded(false);
    setEndedSnapshot(null);
    setSessionGateReady(true);
    setPlayerName('');
    setGambleOpen(false);
    setGambleResult(null);
    setGambleSuit(null);
    setGambleChoice(null);
    setSelectedGambleChoice('red');
    setGambleRank('A');
    setGambleRound(0);
    setGambleAnimating(false);
    setGambleReacting(false);
    setGambleHistory([]);
    setPersistenceBlocked(false);
    setSlapActive(false);
    setCashBurstKey(0);
    spinLock.current = false;
    featureActionLock.current = false;
    collectLock.current = false;
    gambleActionLock.current = false;
    gambleHistoryId.current = 0;
    if (holdAnimationTimer.current !== null) window.clearTimeout(holdAnimationTimer.current);
    if (featureUnlockTimer.current !== null) window.clearTimeout(featureUnlockTimer.current);
    if (freeGamesAwardTimer.current !== null) window.clearTimeout(freeGamesAwardTimer.current);
    if (thunderChargeTimer.current !== null) window.clearTimeout(thunderChargeTimer.current);
    if (heldSpaceTimer.current !== null) window.clearTimeout(heldSpaceTimer.current);
    spinSequenceRef.current.cancel();
    featureSequenceRef.current.cancel();
    spaceHeldRef.current = false;
    spaceChoiceConsumedRef.current = false;
    holdAnimationTimer.current = null;
    featureUnlockTimer.current = null;
    freeGamesAwardTimer.current = null;
    thunderChargeTimer.current = null;
    heldSpaceTimer.current = null;
  }

  function startFreshSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const completedSession = endedSnapshot ?? readSessionSnapshot() ?? {
      id: sessionStartedAt,
      credits,
      peakBalance: sessionPeakBalance,
      spins,
      elapsedSeconds,
      bestWin: sessionBestWin,
    };
    setHighScores(saveHighScore({
      id: completedSession.id,
      name: cleanPlayerName(playerName).trim() || 'PLAYER',
      peakBalance: completedSession.peakBalance,
      bestWin: completedSession.bestWin ?? 0,
      spins: completedSession.spins,
      elapsedSeconds: completedSession.elapsedSeconds,
    }));
    const latestMajorCents = readProgressiveCents(MAJOR_KEY, majorCents, MAJOR_SEED_CENTS);
    const latestGrandCents = readProgressiveCents(GRAND_KEY, grandCents, GRAND_SEED_CENTS);
    const pendingThunderAwardRaw = readLocalValue(THUNDER_AWARD_PENDING_KEY);
    const pendingThunderAward = readPendingThunderAward();
    if (pendingThunderAwardRaw && !pendingThunderAward) {
      setPersistenceBlocked(true);
      setMessage('Fresh session paused: the saved Thunder Charge award is incomplete, so its coin values were not redrawn or discarded.');
      audioRef.current?.playSfx('uiWarning');
      return;
    }
    const latestThunderProgress = readThunderProgress(thunderLifetimeRef.current, thunderTargetRef.current);
    const latestCycleStats = readJackpotCycleStats();
    const nextSessionId = Date.now();
    const pendingField = Array.from({ length: 15 }, () => null as CoinPrize | null);
    pendingThunderAward?.seedCells.forEach((cell) => {
      pendingField[cell] = pendingThunderAward.seedPrizes[cell];
    });
    const pendingFullScreen = pendingField.every(Boolean);
    const pendingMajorHeld = pendingField.some((coin) => coin?.tier === 'major');
    const pendingGrandWon = Boolean(pendingThunderAward?.jackpotsEligible && pendingFullScreen);
    const pendingFullScreenBonus = pendingThunderAward && pendingFullScreen && !pendingThunderAward.jackpotsEligible
      ? roundMoney(pendingThunderAward.featureBet * FULL_SCREEN_BONUS_MULTIPLIER)
      : 0;
    const openingWinStats: JackpotWinStat[] = [
      ...(pendingMajorHeld ? [{
        tier: 'major' as const,
        spins: latestCycleStats.majorSpins,
        wagered: latestCycleStats.majorWagered,
      }] : []),
      ...(pendingGrandWon ? [{
        tier: 'grand' as const,
        spins: latestCycleStats.grandSpins,
        wagered: latestCycleStats.grandWagered,
      }] : []),
    ];
    const freshTransactionOverrides: Omit<PersistedGameTransaction, 'version' | 'savedAt'> = {
      sessionStartedAt: nextSessionId,
      credits: STARTING_CREDITS,
      pendingWin: 0,
      pendingWinGambleLocked: false,
      gambleRound: 0,
      activeLines: 10,
      betIndex: 1,
      spins: 0,
      sessionBestWin: 0,
      sessionPeakBalance: STARTING_CREDITS,
      metresMowed: 0,
      grid: STARTING_GRID,
      baseCoinCells: [],
      baseCoinPrizes: {},
      freeGames: 0,
      pendingFreeGameChoice: null,
      coinFeatureQueued: false,
      coinFeatureFromThunderCharge: Boolean(pendingThunderAward),
      coinFeatureReasons: pendingThunderAward?.reasons ?? [],
      queuedCoinCells: [],
      queuedCoinPrizes: {},
      coinFeatureBet: pendingThunderAward?.featureBet ?? 0,
      coinFeatureJackpotsEligible: pendingThunderAward?.jackpotsEligible ?? false,
      coinFeatureMajorCents: pendingThunderAward?.majorCents ?? latestMajorCents,
      coinFeatureGrandCents: pendingThunderAward?.grandCents ?? latestGrandCents,
      coinFeatureOpen: Boolean(pendingThunderAward),
      coinField: pendingField,
      coinRespinsRemaining: pendingFullScreen ? 0 : HOLD_RESPINS,
      coinFeatureComplete: pendingFullScreen,
      coinGrandAward: pendingGrandWon ? Number(pendingThunderAward?.grandCents ?? 0) / 100 : 0,
      coinFullScreenBonus: pendingFullScreenBonus,
      majorCents: latestMajorCents,
      grandCents: latestGrandCents,
      thunderLifetimeBolts: latestThunderProgress.lifetimeBolts,
      thunderNextTarget: latestThunderProgress.nextTarget,
      jackpotCycleStats: latestCycleStats,
      jackpotWinStats: openingWinStats,
    };
    const highRollerAvailable =
      STARTING_CREDITS >= HIGH_ROLLER_UNLOCK_CREDITS || readLocalValue(HIGH_ROLLER_KEY) === 'true';
    const token = makeSessionToken();
    if (!writeLocalValue(ACTIVE_SESSION_KEY, token)) {
      setPersistenceBlocked(true);
      setMessage('Fresh session could not start because local save storage is unavailable. Nothing was reset.');
      audioRef.current?.playSfx('uiWarning');
      return;
    }
    activeSessionToken.current = token;
    const commit = persistCommittedTransaction(freshTransactionOverrides);
    if (handleCommitFailure(commit, 'Fresh session')) return;

    removeLocalValue(SESSION_LOCK_KEY);
    removeLocalValue(SESSION_SNAPSHOT_KEY);
    resetSessionState(nextSessionId);
    setPersistenceBlocked(false);
    setMajorCents(latestMajorCents);
    setGrandCents(latestGrandCents);
    setHighRollerUnlocked(highRollerAvailable);
    if (highRollerAvailable) writeLocalValue(HIGH_ROLLER_KEY, 'true');
    jackpotCycleStatsRef.current = latestCycleStats;
    setJackpotCycleStats(latestCycleStats);
    thunderLifetimeRef.current = latestThunderProgress.lifetimeBolts;
    thunderTargetRef.current = latestThunderProgress.nextTarget;
    setThunderLifetimeBolts(latestThunderProgress.lifetimeBolts);
    setThunderNextTarget(latestThunderProgress.nextTarget);
    audioRef.current?.playSfx('brightGlock');
    audioRef.current?.playSfx('freshSession', { delayMs: 120, duckMs: 1190 });

    if (pendingThunderAward) {
      const pendingGrandAward = pendingGrandWon ? pendingThunderAward.grandCents / 100 : 0;
      const openingTotal = roundMoney(
        pendingField.reduce((total, coin) => total + (coin?.amount ?? 0), 0) +
        pendingGrandAward + pendingFullScreenBonus
      );
      setCoinFeatureBet(pendingThunderAward.featureBet);
      setCoinFeatureFromThunderCharge(true);
      setCoinFeatureReasons(pendingThunderAward.reasons);
      setCoinFeatureJackpotsEligible(pendingThunderAward.jackpotsEligible);
      setCoinFeatureMajorCents(pendingThunderAward.majorCents);
      setCoinFeatureGrandCents(pendingThunderAward.grandCents);
      setCoinField(pendingField);
      setCoinRespinsRemaining(pendingFullScreen ? 0 : HOLD_RESPINS);
      setCoinFeatureComplete(pendingFullScreen);
      setCoinGrandAward(pendingGrandAward);
      setCoinFullScreenBonus(pendingFullScreenBonus);
      setJackpotWinStats(openingWinStats);
      setCoinFeatureOpen(true);
      setCoinFeatureSpinning(true);
      setCoinFeatureCelebrating(pendingFullScreen || pendingMajorHeld);
      featureActionLock.current = true;
      const arrivalDuration = Math.max(900, 760 + Math.max(0, pendingThunderAward.seedCells.length - 1) * 65);
      showNewHoldCoins(pendingThunderAward.seedCells, arrivalDuration);
      setMessage(`Recovered Thunder Charge Coin Storm with ${pendingThunderAward.seedCells.length} committed coins.`);
      const revealToken = featureSequenceRef.current.begin();
      void stageCoinValueReveal(revealToken, pendingThunderAward.seedCells, pendingField, 0, openingTotal)
        .catch((error) => {
          if (!(error instanceof SequenceCancelledError)) throw error;
          setDisplayedCoinFeatureTotal(openingTotal);
        })
        .finally(() => releaseFeatureAction(pendingFullScreen ? 1000 : pendingMajorHeld ? 900 : 180));
    }
  }

  function isEditableKeyboardTarget(target: EventTarget | null) {
    return target instanceof HTMLElement && Boolean(
      target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]'),
    );
  }

  function restoreSafeGameFocus() {
    window.requestAnimationFrame(() => {
      const modalTarget = sessionEnded
        ? sessionModalRef.current
        : coinFeatureOpen
          ? coinFeatureModalRef.current
          : pendingFreeGameChoice
            ? freeGameChoiceModalRef.current
          : gambleOpen
            ? gambleModalRef.current
            : null;
      if (modalTarget) {
        modalTarget.focus({ preventScroll: true });
        return;
      }
      if (spinButtonRef.current && !spinButtonRef.current.disabled) {
        spinButtonRef.current.focus({ preventScroll: true });
        return;
      }
      actionPodRef.current?.focus({ preventScroll: true });
    });
  }

  function handleGamePointerUp(event: ReactPointerEvent<HTMLElement>) {
    if (gameInfoOpen || (event.target as HTMLElement).closest('.game-info-button')) return;
    if (event.button !== 0 || isEditableKeyboardTarget(event.target)) return;
    restoreSafeGameFocus();
  }

  function performContextSpaceAction() {
    if (gameInfoOpen) return;
    if (!sessionGateReady || sessionEnded || bigWinCelebration) return;
    if (pendingFreeGameChoice) {
      confirmFreeGameChoice();
      return;
    }
    if (coinFeatureOpen) {
      if (coinFeatureComplete) bankCoinFeature();
      else void respinCoinFeature();
      return;
    }
    if (gambleOpen) {
      if (gambleAnimating || gambleReacting || gambleActionLock.current) return;
      if (gambleResult === null) void chooseGamble(selectedGambleChoice);
      else settleAndCloseGamble();
      return;
    }
    if (canRequestSpin) requestSpin();
  }

  function handleGameKeyDown(event: KeyboardEvent) {
    // Let the information dialog own scrolling, focus and its native buttons.
    if (gameInfoOpen) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.game-info-button') && (event.code === 'Space' || event.code === 'Enter')) return;
    if (event.isComposing || isEditableKeyboardTarget(target)) return;

    if (gambleOpen && event.code === 'Tab') {
      const modal = gambleModalRef.current;
      if (!modal) return;
      event.preventDefault();
      event.stopPropagation();
      const buttons = Array.from(modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
        .filter((button) => button.tabIndex >= 0 && button.getClientRects().length > 0 && getComputedStyle(button).visibility !== 'hidden');
      const index = buttons.findIndex((button) => button === document.activeElement);
      const nextIndex = index < 0
        ? event.shiftKey ? buttons.length - 1 : 0
        : (index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
      (buttons[nextIndex] ?? modal).focus({ preventScroll: true });
      return;
    }

    if (gambleOpen && event.code === 'Enter') {
      const button = target?.closest('button');
      if (button instanceof HTMLButtonElement && gambleModalRef.current?.contains(button)) {
        // Preserve native activation of the focused control, including Gamble again.
        if (event.repeat || button.disabled) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
    }

    if (event.code === 'Space') {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat || spaceHeldRef.current || event.ctrlKey || event.altKey || event.metaKey) return;
      spaceHeldRef.current = true;
      spaceChoiceConsumedRef.current = false;
      contextSpaceActionRef.current();
      return;
    }

    if ((event.code === 'Enter') && (pendingFreeGameChoice || gambleOpen)) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) contextSpaceActionRef.current();
      return;
    }

    if (event.code === 'KeyG') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat && !gambleOpen) openGamble();
      return;
    }

    if (event.code === 'KeyZ') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) resetDemoBalanceOnly();
      return;
    }

    const adjustmentKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (adjustmentKeys.includes(event.code)) {
      event.preventDefault();
      event.stopPropagation();
      if (gambleOpen && gambleResult === null && !gambleAnimating && !gambleReacting) {
        const currentIndex = Math.max(0, GAMBLE_CHOICES.indexOf(selectedGambleChoice));
        const direction = event.code === 'ArrowLeft' || event.code === 'ArrowUp' ? -1 : 1;
        const nextIndex = (currentIndex + direction + GAMBLE_CHOICES.length) % GAMBLE_CHOICES.length;
        audioRef.current?.playSfx('stepperTick');
        setSelectedGambleChoice(GAMBLE_CHOICES[nextIndex]);
        return;
      }
      if (pendingFreeGameChoice) {
        setSelectedFreeGameChoice('classic-cut');
        return;
      }
      if (!sessionGateReady || sessionEnded || !canAdjust || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.code === 'ArrowLeft') changeLines(-1);
      if (event.code === 'ArrowRight') changeLines(1);
      if (event.code === 'ArrowDown') changeBet(-1);
      if (event.code === 'ArrowUp') changeBet(1);
    }
  }

  useEffect(() => {
    keyDownHandlerRef.current = handleGameKeyDown;
    contextSpaceActionRef.current = performContextSpaceAction;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      keyDownHandlerRef.current(event);
    }
    function onKeyUp(event: KeyboardEvent) {
      if (event.code !== 'Space' || event.isComposing) return;
      if ((event.target as HTMLElement | null)?.closest('.game-info-button, .game-info-dialog')) return;
      if (!isEditableKeyboardTarget(event.target)) {
        event.preventDefault();
        event.stopPropagation();
      }
      spaceHeldRef.current = false;
      spaceChoiceConsumedRef.current = false;
      if (heldSpaceTimer.current !== null) {
        window.clearTimeout(heldSpaceTimer.current);
        heldSpaceTimer.current = null;
      }
    }
    function clearHeldSpace() {
      spaceHeldRef.current = false;
      spaceChoiceConsumedRef.current = false;
      if (heldSpaceTimer.current !== null) window.clearTimeout(heldSpaceTimer.current);
      heldSpaceTimer.current = null;
    }
    function onVisibilityChange() {
      setAppVisible(!document.hidden);
      if (document.hidden) {
        clearHeldSpace();
        spinSequenceRef.current.cancel();
        featureSequenceRef.current.cancel();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', clearHeldSpace);
    document.addEventListener('visibilitychange', onVisibilityChange);
    setAppVisible(!document.hidden);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', clearHeldSpace);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearHeldSpace();
    };
  }, []);

  useEffect(() => {
    if (!gambleOpen && !coinFeatureOpen && !pendingFreeGameChoice && !sessionEnded) return;
    spaceHeldRef.current = false;
    spaceChoiceConsumedRef.current = false;
    if (heldSpaceTimer.current !== null) window.clearTimeout(heldSpaceTimer.current);
    heldSpaceTimer.current = null;
  }, [coinFeatureOpen, gambleOpen, pendingFreeGameChoice, sessionEnded]);

  useEffect(() => {
    if (!gambleOpen) return;
    const modal = gambleModalRef.current;
    if (!modal) return;
    modal.focus({ preventScroll: true });

    function keepGambleFocus(event: FocusEvent) {
      if (event.target instanceof Node && !modal!.contains(event.target)) {
        modal!.focus({ preventScroll: true });
      }
    }
    document.addEventListener('focusin', keepGambleFocus);
    return () => {
      document.removeEventListener('focusin', keepGambleFocus);
      const previous = gambleReturnFocusRef.current;
      window.requestAnimationFrame(() => {
        if (gambleModalRef.current) return;
        if (previous?.isConnected && previous.getClientRects().length > 0 &&
            !(previous instanceof HTMLButtonElement && previous.disabled)) {
          previous.focus({ preventScroll: true });
        } else if (spinButtonRef.current && !spinButtonRef.current.disabled) {
          spinButtonRef.current.focus({ preventScroll: true });
        } else {
          actionPodRef.current?.focus({ preventScroll: true });
        }
      });
    };
  }, [gambleOpen]);

  const revealedSuit = gambleSuit ? SUIT_GLYPHS[gambleSuit] : null;

  return (
    <main
      className={`site-shell ${spinning || gambleOpen || coinFeatureOpen || sessionEnded ? 'is-motion-busy' : ''}`}
      onPointerUpCapture={handleGamePointerUp}
    >
      <div className="rain-layer" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#game" aria-label="Cam the Mower Man Thunder Cut home">
          <span className="brand-logo" aria-hidden="true"><Image src="/update-assets/minimal-logo.png" alt="" width={1254} height={1254} unoptimized /></span>
          <span><small>Cam the Mower Man</small>THUNDER CUT</span>
        </a>
        <div className="topbar-actions">
          <button
            ref={gameInfoButtonRef}
            className="topbar-toggle game-info-button"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={gameInfoOpen}
            onClick={() => setGameInfoOpen(true)}
            disabled={spinning || gambleOpen || featureSequenceActive || Boolean(bigWinCelebration) || sessionEnded}
          >Game info</button>
          <div className="audio-menu">
            <button
              className="topbar-toggle audio-toggle"
              type="button"
              onClick={() => setAudioMuted((muted) => !muted)}
              aria-pressed={audioMuted}
              aria-label={audioMuted ? 'Unmute sound' : 'Mute sound'}
            >
              <span aria-hidden="true">{audioMuted ? '🔇' : '🔊'}</span> Sound
            </button>
          </div>
          <button
            className="topbar-toggle fullscreen-toggle"
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <span aria-hidden="true">{isFullscreen ? '▣' : '⛶'}</span>
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        </div>
      </header>

      <section className="game-stage" id="game" aria-labelledby="game-title">
        <div className="marquee compact-marquee">
          <div>
            <p className="eyebrow">Storm season starts now</p>
            <h1 id="game-title"><ThunderText text="CAM THE MOWER MAN" className="title-font" /></h1>
          </div>
          <div className="thunder-title"><i aria-hidden="true">⚡</i><ThunderText text="THUNDER CUT" className="title-font" /><i aria-hidden="true">⚡</i></div>
          <p>Five reels · twenty lines · demo dollars only</p>
        </div>

        <section className={`machine ${slapActive ? 'is-slapped' : ''} ${spinning ? 'is-spinning' : ''}`} aria-label="Five reel, three row pokie simulator">
          <div className="feature-topbar">
            <div className="jackpot-ribbon" aria-label="Coin Storm jackpot values">
              {(['mini', 'minor', 'major', 'grand'] as JackpotTier[]).map((tier) => {
                const isLocked = (tier === 'major' || tier === 'grand') && !jackpotEligible;
                return (
                  <div className={`jackpot jackpot-${tier} ${isLocked ? 'is-locked' : ''}`} key={tier}>
                    <span className="jackpot-art-face" aria-hidden="true">
                      <Image className="jackpot-art" src={COIN_ART_BY_TIER[tier]} alt="" draggable={false} width={256} height={256} unoptimized />
                      <CoinValueText amount={currentJackpots[tier]} className="jackpot-face-value" compact />
                    </span>
                    <span>{tier}{tier === 'major' || tier === 'grand' ? isLocked ? ' locked' : ' eligible' : ''}</span>
                    <strong><MoneyText text={formatMoney(currentJackpots[tier])} className="jackpot-readout" /></strong>
                  </div>
                );
              })}
            </div>
            <div className="storm-battery" aria-label={`${displayCoinCount} Mower Coins held`}>
              <div className="battery-label">
                <span>Coin Storm progress</span>
                <small>6 trigger · eligible 15 wins Grand</small>
              </div>
              <div className="battery-segments coin-progress-bars">
                {COIN_PROGRESS_THRESHOLDS.map((threshold) => (
                  <i className={displayCoinCount >= threshold ? 'is-filled' : ''} key={threshold}>
                    <b>$</b><small>{threshold}</small>
                  </i>
                ))}
              </div>
            </div>
          </div>

          <div className={`jackpot-entry-status ${jackpotEligible ? 'is-eligible' : 'is-locked'}`}>
            <b aria-hidden="true">{jackpotEligible ? '⚡' : '🔒'}</b>
            <span>Major + Grand {jackpotEligible ? 'unlocked' : 'locked'}</span>
            <small>{jackpotEligible ? 'Trigger settings qualify' : 'Requires 10+ lines and $300+ total bet'}</small>
          </div>

          <div
            className={`thunder-charge is-hidden-charge ${thunderChargePulse > 0 ? 'is-pulsing' : ''} ${thunderChargeAwardedNow ? 'is-full' : ''}`}
            aria-label="Hidden Thunder Charge. Paid base-game Storm Bolts feed a persistent surprise Coin Storm award."
          >
            <div className="thunder-charge-label">
              <span><b aria-hidden="true">⚡</b> Thunder Charge</span>
              <small>Paid base-game Storm Bolts feed a hidden persistent charge</small>
            </div>
            <div className="thunder-charge-track" aria-hidden="true">
              <i /><b /><b /><b />
            </div>
          </div>

          <div className="machine-status">
            <div><span>Balance</span><strong><MoneyText text={formatMoney(credits)} className="status-value-font" /></strong></div>
            <div><span>Win bank</span><strong><MoneyText text={formatMoney(pendingWin)} className="status-value-font" /></strong></div>
            <div><span>Free games</span><strong><MoneyText text={String(freeGames)} className="status-value-font" /></strong></div>
            <div><span>Last win</span><strong><MoneyText text={formatMoney(lastPayout)} className="status-value-font" /></strong></div>
          </div>

          <div className="reel-zone">
            <div className="reel-frame">
              <span className="frame-bolt frame-bolt-left" aria-hidden="true">ϟ</span>
              <span className="frame-bolt frame-bolt-right" aria-hidden="true">ϟ</span>
              {isFreeSpin && (
                <div className="storm-door-strip" aria-label={`${displayedGridIsFreeGame ? openStormDoorReels.size : 0} Storm Doors open`}>
                  <div className="storm-door-title">
                    <strong>Storm Doors</strong>
                    <small>2 open = +3</small>
                  </div>
                  {[1, 2, 3, 4].map((reel) => {
                    const isOpen = displayedGridIsFreeGame && openStormDoorReels.has(reel);
                    return (
                      <span className={isOpen ? 'is-open' : ''} key={reel} aria-label={`Reel ${reel + 1} door ${isOpen ? 'open' : 'closed'}`}>
                        <i aria-hidden="true">{isOpen ? '⚡' : '▥'}</i>
                        <small>R{reel + 1}</small>
                      </span>
                    );
                  })}
                </div>
              )}
              <div ref={reelGridRef} className="reel-grid reel-column-grid" aria-label="Current reel symbols" aria-busy={spinning}>
                {Array.from({ length: 5 }, (_, reel) => {
                  const phase = reelPhases[reel] ?? 'idle';
                  const reelIsMoving = phase === 'accelerating' || phase === 'spinning' || phase === 'braking';
                  return (
                    <div className={`reel-column phase-${phase}`} key={reel} data-reel={reel + 1}>
                      {Array.from({ length: 3 }, (_, row) => {
                        const index = row * 5 + reel;
                        const key = grid[index];
                        const symbol = getSymbol(key);
                        const coinPrize = key === 'coin' ? baseCoinPrizes[index] : undefined;
                        const coinArt = coinPrize?.tier ? COIN_ART_BY_TIER[coinPrize.tier] : symbol.asset;
                        const isActiveWinner = Boolean(activeWinLine?.cells.includes(index));
                        return (
                          <div
                            className={`symbol symbol-${key} ${reelIsMoving ? 'is-spinning' : ''} ${isActiveWinner ? 'is-winner' : ''}`}
                            key={index}
                            aria-hidden={reelIsMoving || undefined}
                            data-coin-tier={coinPrize?.tier || undefined}
                            aria-label={`Row ${row + 1}, reel ${reel + 1}: ${coinPrize?.tier ? coinPrize.label : symbol.label}, ${symbol.metric}${coinPrize ? `, ${formatMoney(coinPrize.amount)}` : ''}`}
                          >
                            <span className="symbol-icon" aria-hidden="true">
                              <Image src={coinArt} alt="" draggable={false} width={256} height={256} unoptimized />
                              {key === 'coin' && coinPrize && <CoinValueText amount={coinPrize.amount} className="reel-coin-value" compact />}
                            </span>
                          </div>
                        );
                      })}
                      {reelIsMoving && (
                        <div className="reel-motion-strip" aria-hidden="true">
                          {[0, 1].map((copy) => (
                            <div className="reel-strip-cycle" key={copy}>
                              {reelPreview[reel].map((preview, previewIndex) => (
                                <span className="reel-preview-symbol symbol-icon" key={previewIndex}>
                                  <Image src={getSymbol(preview.key).asset} alt="" draggable={false} width={256} height={256} unoptimized />
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              {activeWinLine && !spinning && (
                <PaylineTrace gridRef={reelGridRef} rows={PAYLINES[activeWinLine.line - 1]}
                  line={activeWinLine.line} usedWild={activeWinLine.usedWild} amount={formatMoney(activeWinLine.payout)} />
              )}
              </div>

              {thunderChargePulse > 0 && (
                <div className="bolt-transfer-layer" aria-hidden="true">
                  {grid.flatMap((symbol, index) => symbol === 'bolt' ? [
                    <i
                      key={index}
                      style={{ '--bolt-x': `${10 + (index % 5) * 20}%`, '--bolt-y': `${16.667 + Math.floor(index / 5) * 33.333}%` } as CSSProperties}
                    />,
                  ] : [])}
                </div>
              )}

              {cashBurstKey > 0 && lastPayout > 0 && (
                <div className="cash-burst" key={cashBurstKey} aria-hidden="true">
                  {Array.from({ length: 9 }, (_, index) => <span key={index}>$</span>)}
                </div>
              )}
              {freeGamesAwardedNow > 0 && (
                <div className="free-games-splash" aria-live="polite">
                  <ThunderText text={freeGamesAwardLabel} className="feature-title-font" />
                  <strong><ThunderText text={`+${freeGamesAwardedNow} FREE GAMES`} className="feature-win-font" /></strong>
                </div>
              )}
              {thunderChargeAwardedNow && (
                <div className="thunder-charge-splash" aria-live="assertive">
                  <ThunderText text="THUNDER CHARGE FULL" className="feature-title-font" />
                  <strong><ThunderText text="FREE COIN STORM" className="feature-win-font" /></strong>
                  <small>Hidden storm entitlement awarded</small>
                </div>
              )}
              {bigWinCelebration && (
                <div
                  className={`big-win-count ${bigWinCelebration.label.toLowerCase().replaceAll(' ', '-')}`}
                  role="status"
                  aria-label={`${bigWinCelebration.label}. Counting to ${formatMoney(bigWinCelebration.target)}.`}
                >
                  <ThunderText text={bigWinCelebration.label} className="big-win-title-font" />
                  <strong><ThunderText text={formatMoney(bigWinCelebration.displayed)} className="big-win-value-font" /></strong>
                  <small aria-hidden="true">Thunder win count</small>
                  <div className="big-win-coins" aria-hidden="true">
                    {Array.from({ length: 8 }, (_, index) => <i key={index}>$</i>)}
                  </div>
                  <button className="big-win-skip" type="button" onClick={cancelBigWinCelebration}>Skip</button>
                </div>
              )}
            </div>

            <aside className="action-pod" aria-label="Main game controls" ref={actionPodRef} tabIndex={-1}>
              {showWinActions ? (
                <>
                  <button className="collect-button" type="button" onClick={collectWin} disabled={Boolean(bigWinCelebration) || persistenceBlocked}>
                    Collect <small>{formatMoney(pendingWin)}</small>
                  </button>
                  {pendingWinGambleLocked || gambleRound >= GAMBLE_MAX_ROUNDS ? (
                    <div className="jackpot-lock-note"><b>🔒</b><span>{pendingWinGambleLocked ? 'Major / Grand' : '4 rounds complete'}</span><small>collect only</small></div>
                  ) : (
                    <button className="gamble-button" type="button" onClick={openGamble} disabled={Boolean(bigWinCelebration) || persistenceBlocked}>
                      Gamble <small>colour or suit</small>
                    </button>
                  )}
                </>
              ) : (
                <button ref={spinButtonRef} className="spin-button" type="button" onClick={requestSpin} disabled={!canRequestSpin}>
                  <b aria-hidden="true">⚡</b>
                  <span>{spinning ? 'Spinning' : isFreeSpin ? 'Free spin' : credits < totalBet ? 'Lower bet' : 'Spin'}</span>
                  <small>{isFreeSpin ? `${freeGames} remaining` : `Bet ${formatMoney(totalBet)}`}</small>
                </button>
              )}
              <p><kbd>SPACE</kbd> spin</p>
            </aside>
          </div>

          <div className="win-strip" aria-live="polite" aria-atomic="true">
            <span className="win-strip-label">Result</span>
            <p>{message}</p>
            {winningLines.length > 0 && (
              <div className="winning-line-tags" aria-label="Winning paylines">
                {winningLines.map((win) => (
                  <span key={win.line}>L{win.line} · {win.count}× {getSymbol(win.symbol).label}{win.usedWild && win.symbol !== 'wild' ? ' + WILD' : ''} · {formatMoney(win.payout)}</span>
                ))}
              </div>
            )}
          </div>

          <div className="control-deck compact-controls" ref={controlDeckRef} tabIndex={-1}>
            <div className="stepper">
              <span>Lines <small className="stepper-key-hint" aria-hidden="true">← / →</small></span>
              <div>
                <button type="button" onClick={() => changeLines(-1)} disabled={!canAdjust || activeLines === 1} aria-label="Decrease active lines">−</button>
                <strong>{activeLines}</strong>
                <button type="button" onClick={() => changeLines(1)} disabled={!canAdjust || activeLines === 20} aria-label="Increase active lines">+</button>
              </div>
            </div>
            <div className="stepper">
              <span>Bet / line <small className="stepper-key-hint" aria-hidden="true">↓ / ↑</small></span>
              <div>
                <button ref={betDecreaseButtonRef} type="button" onClick={() => changeBet(-1)} disabled={!canAdjust || betIndex === 0} aria-label="Decrease bet per line">−</button>
                <strong>{formatMoney(betPerLine)}</strong>
                <button type="button" onClick={() => changeBet(1)} disabled={!canAdjust || betIndex === maximumBetIndex} aria-label="Increase bet per line">+</button>
              </div>
            </div>
            <div className="total-bet">
              <span>Total bet</span>
              <strong>{formatMoney(totalBet)}</strong>
              <small>{activeLines} lines × {formatMoney(betPerLine)}<br />{highRollerUnlocked ? 'HIGH ROLLER · $5,000 MAX' : '$50,000 BALANCE UNLOCKS HIGH ROLLER'}</small>
            </div>
          </div>

          <div className="line-meter" aria-label={`${activeLines} of 20 paylines active`}>
            {PAYLINES.map((_, index) => (
              <span
                key={index}
                className={`${index < activeLines ? 'is-active' : ''} ${winningLines.some((win) => win.line === index + 1) ? 'is-win' : ''}`}
                title={`Payline ${index + 1}`}
              >{index + 1}</span>
            ))}
          </div>
        </section>

        <aside className="metric-rack" aria-label="Mowing metrics">
          <div><span>Area mowed</span><strong>{formatCredits(metresMowed)} m²</strong></div>
          <div><span>Cut height</span><strong>75 mm</strong></div>
          <div><span>Deck power</span><strong>3.2 kW</strong></div>
          <div><span>Session</span><strong>{formatTime(elapsedSeconds)}</strong></div>
        </aside>
      </section>

      <dialog ref={gameInfoRef} className="game-info-dialog" aria-labelledby="game-info-title"
        onCancel={() => setGameInfoOpen(false)} onClose={() => setGameInfoOpen(false)}>
        <header className="game-info-header">
          <h2 id="game-info-title">Game info</h2>
          <button type="button" className="topbar-toggle" onClick={() => setGameInfoOpen(false)}>Back to game</button>
        </header>
        <div className="game-info-body">
      <section className="info-grid" aria-label="Game information">
        <article className="info-panel paytable-panel">
          <p className="eyebrow">Line wins</p>
          <h2><ThunderText text="Paytable multipliers" className="section-title-font" /></h2>
          <p className="panel-intro">Matching symbols pay left to right. Storm Wild substitutes for every line symbol except Coins and Scatters. Three Scatters pay 2× total bet + 8 free games; four pay 10× + 15. UR Scattered counts as a Scatter and doubles that Scatter pay. During free games, two Scatters open the Storm Doors for +3 games.</p>
          <div className="paytable">
            <div className="paytable-head"><span>Symbol</span><span>3</span><span>4</span><span>5</span></div>
            {[...BASE_SYMBOLS].reverse().map((symbol) => (
              <div key={symbol.key}>
                <span><i aria-hidden="true"><Image src={symbol.asset} alt="" draggable={false} width={256} height={256} unoptimized /></i> {symbol.label}</span>
                <strong>{symbol.payouts[3]}×</strong>
                <strong>{formatCredits(symbol.payouts[4])}×</strong>
                <strong>{formatCredits(symbol.payouts[5])}×</strong>
              </div>
            ))}
          </div>
          <div className="special-symbol-rules" aria-label="Special symbols">
            {(['scatter', 'ur_scattered', 'coin'] as SymbolKey[]).map((key) => {
              const symbol = getSymbol(key);
              return (
                <div key={key}>
                  <span className="special-symbol-art" aria-hidden="true">
                    <Image src={symbol.asset} alt="" draggable={false} width={256} height={256} unoptimized />
                    {key === 'coin' && <ThunderText text="$" className="special-coin-value" />}
                  </span>
                  <span><strong>{symbol.label}</strong><small>{key === 'scatter' ? '3 or 4 award free games' : key === 'ur_scattered' ? 'Counts as Scatter · doubles Scatter pay' : '6 trigger Coin Storm'}</small></span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="info-panel odds-panel">
          <p className="eyebrow">Coin Storm</p>
          <h2><ThunderText text="Hold. Respin. Reset." className="section-title-font" /></h2>
          <div className="odds-number"><ThunderText text="6 COINS" className="feature-title-font" /></div>
          <p>Six coins on a paid spin—or during free games—lock in and start Coin Storm after the triggering result settles. Every new held coin resets the counter to three. Mini and Minor appear on held coins. An eligible Major appears as a rare MAJOR coin; the Grand is only awarded for filling all 15 positions.</p>
          <div className="feature-rules">
            <div><strong>3</strong><span>Respins</span><small>reset on a coin</small></div>
            <div><strong>11.85%</strong><span>Paid cell</span><small>fixed coin chance</small></div>
            <div><strong>16.1%</strong><span>Free-game cell</span><small>extra coin chance</small></div>
            <div><strong>3.95%</strong><span>Empty cell</span><small>fixed respin chance</small></div>
            <div><strong>15</strong><span>Full screen</span><small>eligible Grand</small></div>
          </div>
          <div className="bonus-path">
            <span><b>MINI + MINOR</b> can land on any Coin Storm coin.</span>
            <span><b>MAJOR</b> lands on a rare coin only after a qualifying trigger.</span>
            <span><b>GRAND</b> needs an eligible 15 / 15 full screen.</span>
          </div>
          <p className="math-note">Fixed odds stay independent of bet size, which never changes symbol, Scatter, Coin or respin chances. Paid base-game Storm Bolts feed a hidden persistent Thunder Charge; seven or more Bolts on one final screen trigger Coin Storm instantly. Every Coin Storm begins with at least one Mini or Minor among its trigger coins. Major and Grand still require 10+ active lines with a $300+ total bet on the triggering spin; a non-eligible full screen pays 100× instead. Uncertified demo model.</p>
        </article>

        <article className="info-panel session-panel">
          <p className="eyebrow">Session controls</p>
          <h2><ThunderText text="Keep it a demo." className="section-title-font" /></h2>
          <div className="session-stats">
            <div><strong>{spins}</strong><span>spins</span></div>
            <div><strong>{formatTime(elapsedSeconds)}</strong><span>elapsed</span></div>
            <div><strong>{formatMoney(sessionPeakBalance)}</strong><span>peak balance</span></div>
          </div>
          <p>Ending a session opens the name and high-score screen. Save the run and start a fresh demo balance immediately—no PIN is required.</p>
          <p className="jackpot-cycle-summary">Current jackpot cycles: Major {jackpotCycleStats.majorSpins} paid spins / {formatMoney(jackpotCycleStats.majorWagered)} wagered · Grand {jackpotCycleStats.grandSpins} paid spins / {formatMoney(jackpotCycleStats.grandWagered)} wagered.</p>
          <div className="session-actions">
            <button type="button" onClick={() => { setGameInfoOpen(false); endSession(); }} disabled={spinning || gambleOpen || coinFeatureOpen || coinFeatureQueued || pendingWin > 0 || freeGames > 0}>End session</button>
          </div>
        </article>
      </section>

      <footer>
        <strong><ThunderText text="CAM THE MOWER MAN - THUNDER CUT" className="footer-title-font" /></strong>
        <p>ThunderCut - Cam The Mower Man - SS - SCATTEREDBRAIN SLOTS - native.games - Cameron Maxwell M - A Game by Native.</p>
        <p>An original learning simulator. Every $ is a demo dollar with no cash value.</p>
      </footer>
        </div>
      </dialog>

      {pendingFreeGameChoice && !coinFeatureOpen && (
        <div className="modal-backdrop free-game-choice-backdrop">
          <section
            ref={freeGameChoiceModalRef}
            className="free-game-choice-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-game-choice-title"
            tabIndex={-1}
          >
            <Image className="free-choice-bolt left" src="/update-assets/storm-bolt.png" alt="" width={320} height={320} unoptimized />
            <Image className="free-choice-bolt right" src="/update-assets/storm-bolt.png" alt="" width={320} height={320} unoptimized />
            <p className="eyebrow">Scatter Storm awarded</p>
            <h2 id="free-game-choice-title"><ThunderText text="Choose Free Games" className="modal-title-font" /></h2>
            <p className="free-choice-instruction">Use the arrow keys, then press Space or Enter. Mouse selection works too.</p>
            <button
              className={`free-game-choice-card ${selectedFreeGameChoice === 'classic-cut' ? 'is-selected' : ''}`}
              type="button"
              onClick={confirmFreeGameChoice}
              aria-pressed={selectedFreeGameChoice === 'classic-cut'}
            >
              <Image src="/game-art/scatter.webp" alt="" width={256} height={256} unoptimized />
              <span><b>Classic Cut</b><strong>{pendingFreeGameChoice.games} Free Games</strong><small>Original reel odds · Storm Doors can retrigger · extra Coin chance</small></span>
            </button>
            <button className="free-choice-confirm" type="button" onClick={confirmFreeGameChoice}>Start {pendingFreeGameChoice.games} Free Games</button>
          </section>
        </div>
      )}

      {gambleOpen && (
        <div className="modal-backdrop gamble-backdrop">
          <section ref={gambleModalRef} className="gamble-modal" role="dialog" aria-modal="true" aria-labelledby="gamble-title" tabIndex={-1}>
            <button
              className="modal-close"
              type="button"
              onClick={settleAndCloseGamble}
                       disabled={gambleAnimating || gambleReacting || persistenceBlocked}
              aria-label={pendingWin > 0 ? 'Collect win and close' : 'Close gamble'}
            >×</button>
            <p className="eyebrow">Double or precision call</p>
            <h2 id="gamble-title"><ThunderText text="Pick colour or suit" className="modal-title-font" /></h2>
            <p className="gamble-bank"><span>Gamble bank</span><strong><ThunderText text={formatMoney(pendingWin)} className="gamble-value-font" /></strong></p>

            {gambleHistory.length > 0 && (
              <section className="gamble-history" aria-label="Gamble history, newest suit first">
                <ol>
                  {gambleHistory.map((entry) => {
                    const outcomeLabel = `${entry.rank} of ${entry.outcome}`;
                    return (
                      <li
                        className={`history-suit suit-${entry.outcome} ${entry.hit ? 'is-hit' : 'is-miss'}`}
                        key={entry.id}
                        aria-label={`${outcomeLabel}. Called ${gambleChoiceLabel(entry.choice)}. ${
                          entry.hit
                            ? `Hit at ${entry.multiplier} times. Bank changed from ${formatMoney(entry.bankBefore)} to ${formatMoney(entry.bankAfter)}.`
                            : `Miss. Bank changed from ${formatMoney(entry.bankBefore)} to ${formatMoney(entry.bankAfter)}.`
                        } Spin ${entry.spin}, round ${entry.round}.`}
                        title={`${gambleChoiceLabel(entry.choice)} · ${entry.hit ? 'HIT' : 'MISS'} · ${formatMoney(entry.bankBefore)} → ${formatMoney(entry.bankAfter)}`}
                      >
                        <span aria-hidden="true">{SUIT_GLYPHS[entry.outcome]}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <div className={`gamble-card ${gambleResult ? `result-${gambleResult} ${pendingWin > 0 ? 'is-hit' : 'is-miss'}` : ''} ${gambleSuit ? `suit-${gambleSuit}` : ''} ${gambleAnimating ? 'is-flipping' : ''}`} aria-live="polite">
              {gambleResult ? (
                <>
                  <span className="card-corner card-corner-top"><b>{gambleRank}</b><i>{revealedSuit}</i></span>
                  <span className="card-suit" aria-hidden="true">{revealedSuit}</span>
                  <span className="card-corner card-corner-bottom"><b>{gambleRank}</b><i>{revealedSuit}</i></span>
                  <strong>{gambleChoice ? `${gambleChoiceLabel(gambleChoice)} ${pendingWin > 0 ? 'HIT' : 'MISS'}` : gambleResult.toUpperCase()}</strong>
                </>
              ) : (
                <><span className="suit-preview" aria-hidden="true">♥ ♦<br />♣ ♠</span><strong>{gambleAnimating ? 'CALLING…' : 'MAKE A CALL'}</strong></>
              )}
            </div>

            {gambleResult === null ? (
              <div className="gamble-choice-grid">
                {GAMBLE_CHOICES.map((choice) => {
                  const isColour = choice === 'red' || choice === 'black';
                  const isRed = choice === 'red' || choice === 'hearts' || choice === 'diamonds';
                  const label = isColour ? gambleChoiceLabel(choice) : SUIT_GLYPHS[choice];
                  const detail = choice === 'red' ? '♥ ♦ · 2×' : choice === 'black' ? '♣ ♠ · 2×' : isRed ? '2.5×' : '3.3×';
                  return (
                    <button
                      className={`${isColour ? `${choice}-choice colour-choice` : `suit-choice ${isRed ? 'red-suit' : 'black-suit'}`} ${selectedGambleChoice === choice ? 'is-keyboard-selected' : ''}`}
                      type="button"
                      onClick={() => {
                        setSelectedGambleChoice(choice);
                        void chooseGamble(choice);
                      }}
                      disabled={gambleAnimating || gambleReacting}
                      aria-pressed={selectedGambleChoice === choice}
                      key={choice}
                    >
                      {label} <small>{detail}</small>
                    </button>
                  );
                })}
              </div>
            ) : pendingWin > 0 ? (
              <div className="gamble-result-actions">
                 {gambleRound < GAMBLE_MAX_ROUNDS && <button type="button" onClick={gambleAgain} disabled={gambleReacting}>Gamble again</button>}
                <button type="button" onClick={collectWin} disabled={gambleReacting}>Collect {formatMoney(pendingWin)}</button>
              </div>
            ) : (
              <button className="return-button" type="button" onClick={settleAndCloseGamble} disabled={gambleReacting}>Back to reels</button>
            )}

            <p className="gamble-disclosure">Each suit 25% · colour 2× · red suit 2.5× · black suit 3.3× · maximum four rounds</p>
          </section>
        </div>
      )}

      {coinFeatureOpen && (
        <div className="modal-backdrop coin-feature-backdrop">
          <section ref={coinFeatureModalRef} className={`coin-feature-modal hold-feature-modal ${coinFeatureSpinning ? 'is-respinning' : ''} ${coinFeatureCelebrating ? 'is-celebrating' : ''}`} role="dialog" aria-modal="true" aria-labelledby="coin-feature-title" tabIndex={-1}>
            <div className="coin-feature-heading">
              <div>
                <p className="eyebrow">{
                  coinFeatureReasons.includes('seven-bolts')
                    ? 'Seven Bolt instant award'
                    : coinFeatureFromThunderCharge ? 'Hidden Thunder Charge award' : 'Six coins triggered'
                }</p>
                <h2 id="coin-feature-title"><ThunderText text="Coin Storm" className="modal-title-font" /></h2>
              </div>
              <div className="coin-feature-tier-strip" aria-label="Coin Storm prize values">
                {(['mini', 'minor', 'major', 'grand'] as JackpotTier[]).map((tier) => {
                  const locked = (tier === 'major' || tier === 'grand') && !coinFeatureJackpotsEligible;
                  return (
                    <span className={`jackpot-${tier} ${locked ? 'is-locked' : ''}`} key={tier}>
                      <Image src={COIN_ART_BY_TIER[tier]} alt="" width={96} height={96} unoptimized />
                      <b>{tier}</b>
                      <MoneyText text={locked ? 'LOCKED' : formatMoney(featureJackpots[tier])} className="coin-feature-tier-value" />
                    </span>
                  );
                })}
              </div>
              <div className={`coin-storm-stage ${coinFeatureSpinning ? 'is-spinning' : ''} ${newHoldCells.length > 0 ? 'is-hit' : ''}`} aria-hidden="true">
                <Image className="stage-bolt stage-bolt-left" src="/update-assets/storm-bolt.png" alt="" draggable={false} width={256} height={256} unoptimized />
                <Image className="stage-mower" src="/game-art/ride-on.webp" alt="" draggable={false} width={256} height={256} unoptimized />
                <Image className="stage-coin" src="/game-art/coin.webp" alt="" draggable={false} width={256} height={256} unoptimized />
                <Image className="stage-bolt stage-bolt-right" src="/update-assets/storm-bolt.png" alt="" draggable={false} width={256} height={256} unoptimized />
              </div>
            </div>

            <div className="coin-feature-layout">
              <div className="coin-feature-board">
                <p className="coin-feature-readout" aria-live="polite">
                  <span><b>{coinFeatureComplete ? 'Done' : coinRespinsRemaining}</b> respins</span>
                  <span><b>{heldCoinCount} / 15</b> coins</span>
                   <span>Win <strong>{formatMoney(displayedCoinFeatureTotal)}</strong></span>
                </p>

                <div className="battery-segments hold-progress-bars" aria-label={`${heldCoinCount} coins held toward ${coinFeatureJackpotsEligible ? 'Grand' : 'the full-screen bonus'}`}>
                  {COIN_PROGRESS_THRESHOLDS.map((threshold) => (
                    <i className={heldCoinCount >= threshold ? 'is-filled' : ''} key={threshold}><b>$</b><small>{threshold}</small></i>
                  ))}
                </div>

                <div className="hold-grid" aria-label={`${heldCoinCount} of 15 coin positions filled`}>
                  {coinField.map((coin, index) => {
                    const coinArt = coin?.tier ? COIN_ART_BY_TIER[coin.tier] : '/game-art/coin.webp';
                    return (
                      <div
                         className={`${coin ? 'is-held' : 'is-empty'} ${coin?.tier ? `prize-${coin.tier}` : ''} ${newHoldCells.includes(index) ? 'is-new' : ''}`}
                         style={{ '--coin-arrival-index': Math.max(0, newHoldCells.indexOf(index)) } as CSSProperties}
                        key={index}
                        aria-label={coin ? `${coin.label}, ${formatMoney(coin.amount)}` : 'Empty coin position'}
                      >
                        <Image className="hold-coin-art" src={coinArt} alt="" aria-hidden="true" draggable={false} width={256} height={256} unoptimized />
                        {coin ? (
                          <span className="hold-coin-face" aria-hidden="true">
                            <CoinValueText amount={coin.amount} className="hold-coin-value" compact />
                          </span>
                        ) : <span className="empty-coin-mark" aria-hidden="true">+</span>}
                      </div>
                    );
                  })}
                </div>

                {coinFeatureCelebrating && coinGrandAward > 0 ? (
                  <div className="grand-win-banner" aria-live="assertive"><Image src="/game-art/grand.webp" alt="" aria-hidden="true" width={256} height={256} unoptimized /><ThunderText text="Full screen Grand" className="feature-title-font" /><strong><ThunderText text={formatMoney(coinGrandAward)} className="feature-win-font" /></strong></div>
                ) : coinFeatureCelebrating && coinFullScreenBonus > 0 ? (
                  <div className="grand-win-banner full-screen-bonus-banner" aria-live="assertive"><Image src="/game-art/coin.webp" alt="" aria-hidden="true" width={256} height={256} unoptimized /><ThunderText text="Full screen bonus" className="feature-title-font" /><strong><ThunderText text={formatMoney(coinFullScreenBonus)} className="feature-win-font" /></strong></div>
                ) : coinFeatureCelebrating && coinField.some((coin) => coin?.tier === 'major') ? (
                  <div className="major-win-banner" aria-live="assertive"><Image src="/game-art/major.webp" alt="" aria-hidden="true" width={256} height={256} unoptimized /><ThunderText text="Major coin locked" className="feature-title-font" /><strong><ThunderText text={formatMoney(coinFeatureMajorCents / 100)} className="feature-win-font" /></strong></div>
                ) : null}
                <footer className="coin-feature-footer">
                  {jackpotWinStats.length > 0 && (
                    <div className="jackpot-win-stat-list" aria-label="Jackpot cycle statistics">
                      {jackpotWinStats.map((entry) => (
                        <div className={`jackpot-win-stat jackpot-${entry.tier}`} key={entry.tier}>
                          <b>{entry.tier}</b>
                          <span><strong>{entry.spins}</strong> paid spins</span>
                          <span><strong>{formatMoney(entry.wagered)}</strong> demo wagered</span>
                          <small>since the previous {entry.tier} or tracking began</small>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="coin-feature-action">
                    {coinFeatureComplete ? (
                      <button className="bank-feature-button" type="button" onClick={bankCoinFeature} disabled={coinFeatureCelebrating || persistenceBlocked}>
                      {coinFeatureCelebrating ? 'Jackpot celebration…' : `Bank ${formatMoney(coinFeatureTotal)}`}
                    </button>
                  ) : (
                    <button className="feature-respin-button" type="button" onClick={respinCoinFeature} disabled={coinFeatureSpinning || coinFeatureCelebrating || persistenceBlocked}>
                      <b aria-hidden="true">⚡</b>
                      <span>{coinFeatureCelebrating ? 'Jackpot!' : coinFeatureSpinning ? 'Mowing…' : 'Respin'}</span>
                      <small>{coinRespinsRemaining} remaining</small>
                      </button>
                    )}
                  </div>
                </footer>
              </div>
            </div>
          </section>
        </div>
      )}

      {sessionGateReady && sessionEnded && (
        <div className="modal-backdrop session-lock-backdrop">
          <section ref={sessionModalRef} className="session-lock-modal" role="dialog" aria-modal="true" aria-labelledby="session-lock-title" tabIndex={-1}>
            <span className="session-lock-icon" aria-hidden="true">🏁</span>
            <p className="eyebrow">Session finished</p>
            <h2 id="session-lock-title"><ThunderText text="Mower parked" className="modal-title-font" /></h2>
            <p>Add your name for the local peak-balance board, then start a fresh {formatMoney(STARTING_CREDITS)} demo balance. No PIN is required.</p>
            <div className="final-session-stats">
              <div><span>Peak balance</span><strong>{formatMoney(endedSnapshot?.peakBalance ?? sessionPeakBalance)}</strong></div>
              <div><span>Spins played</span><strong>{endedSnapshot?.spins ?? spins}</strong></div>
              <div><span>Biggest win</span><strong>{formatMoney(endedSnapshot?.bestWin ?? sessionBestWin)}</strong></div>
              <div><span>Time</span><strong>{formatTime(endedSnapshot?.elapsedSeconds ?? elapsedSeconds)}</strong></div>
            </div>
            <section className="high-score-board" aria-labelledby="high-score-title">
              <div className="high-score-heading">
                <span aria-hidden="true">🏆</span>
                <div><small>Local records</small><h3 id="high-score-title"><ThunderText text="Thunder Cut high scores" className="score-title-font" /></h3></div>
              </div>
              {highScores.length > 0 ? (
                <ol>
                  {highScores.map((score, index) => (
                    <li key={score.id}>
                      <b><span>#{index + 1}</span><small>{score.name}</small></b>
                      <span><small>Peak balance</small><strong>{formatMoney(score.peakBalance)}</strong></span>
                      <span><small>Best win</small><strong>{formatMoney(score.bestWin)}</strong></span>
                      <span><small>Run</small><strong>{score.spins} spins · {formatTime(score.elapsedSeconds)}</strong></span>
                    </li>
                  ))}
                </ol>
              ) : <p>No finished sessions yet — this run can set the first record.</p>}
            </section>
            <form className="session-reset-form" onSubmit={startFreshSession}>
              <label htmlFor="session-name">Player name</label>
              <input
                id="session-name"
                className="player-name-input"
                type="text"
                autoComplete="nickname"
                maxLength={12}
                value={playerName}
                onChange={(event) => setPlayerName(cleanPlayerName(event.target.value))}
                placeholder="PLAYER"
                autoFocus
              />
              <button type="submit">Save score &amp; start fresh session</button>
            </form>
            <small className="session-reset-note">No PIN or account is connected.</small>
          </section>
        </div>
      )}
    </main>
  );
}






