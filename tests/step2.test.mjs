import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  advanceThunderProgress,
  mergeCoinStormReasons,
  nextThunderInterval,
  resolveStoredThunderProgress,
  shouldInstantBoltTrigger,
} from '../app/gameRules.ts';
import { getMiniMinorCoinValues, roundCoinAmount } from '../app/coinRules.ts';

test('hidden Thunder intervals stay inside the authoritative 523–553 range', () => {
  assert.equal(nextThunderInterval(0), 523);
  assert.equal(nextThunderInterval(0.999999), 553);
  for (let index = 0; index < 1000; index += 1) {
    const interval = nextThunderInterval(index / 1000);
    assert.ok(interval >= 523 && interval <= 553);
  }
});

test('paid Bolt progress advances an absolute lifetime target once', () => {
  assert.deepEqual(advanceThunderProgress(519, 523, 3, 0), {
    lifetimeBolts: 522,
    nextTarget: 523,
    awarded: false,
  });
  assert.deepEqual(advanceThunderProgress(522, 523, 2, 0), {
    lifetimeBolts: 524,
    nextTarget: 1047,
    awarded: true,
  });
});

test('seven-Bolt instant trigger uses only final symbols', () => {
  assert.equal(shouldInstantBoltTrigger(['bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt']), false);
  assert.equal(shouldInstantBoltTrigger(['bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt']), true);
  assert.equal(shouldInstantBoltTrigger(Array.from({ length: 8 }, () => 'bolt')), true);
  assert.equal(shouldInstantBoltTrigger(Array.from({ length: 15 }, () => 'bolt')), true);
});

test('fresh Thunder storage chooses 523–553 while explicit legacy progress is preserved', () => {
  assert.deepEqual(resolveStoredThunderProgress(null, null, null, 0, 0, 0.5), {
    lifetimeBolts: 0,
    nextTarget: 538,
    migration: 'fresh',
  });
  assert.deepEqual(resolveStoredThunderProgress(null, null, '0', 0, 0, 0.99), {
    lifetimeBolts: 0,
    nextTarget: 523,
    migration: 'legacy-progress-preserved',
  });
  assert.deepEqual(resolveStoredThunderProgress(null, null, '522', 0, 0, 0.99), {
    lifetimeBolts: 522,
    nextTarget: 523,
    migration: 'legacy-progress-preserved',
  });
  assert.deepEqual(resolveStoredThunderProgress('900', '1440', null, 0, 0, 0), {
    lifetimeBolts: 900,
    nextTarget: 1440,
    migration: 'stored',
  });
});

test('all generated Coin values settle to exact cents', () => {
  for (const bet of [1, 2, 5, 10, 30, 300, 5000]) {
    for (const multiplier of [1, 2, 5, 10]) {
      const value = roundCoinAmount(bet * multiplier);
      assert.equal(value, Math.round(value * 100) / 100);
    }
    const prizes = getMiniMinorCoinValues(bet, 10_000_000);
    assert.equal(prizes.mini, Math.round(prizes.mini * 100) / 100);
    assert.equal(prizes.minor, Math.round(prizes.minor * 100) / 100);
  }
  assert.equal(roundCoinAmount(12.345), 12.35);
});

test('same-result Coin Storm reasons deduplicate without losing distinct entitlements', () => {
  assert.deepEqual(
    mergeCoinStormReasons(['six-coins', 'hidden-thunder-guarantee', 'seven-bolts', 'seven-bolts', '']),
    ['six-coins', 'hidden-thunder-guarantee', 'seven-bolts'],
  );
});

test('Step 2 source keeps reel and coin values tied to authoritative results', async () => {
  const page = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /REEL_PREVIEW_INTERVAL_MS|setInterval\(\s*\(\) => setGrid/);
  assert.match(page, /const finalResult = addFeatureSymbols[\s\S]+setReelPhases/);
  assert.match(page, /CoinValueText amount=\{coinPrize\.amount\}/);
  assert.match(page, /CoinValueText amount=\{coin\.amount\}/);
  assert.match(page, /thunder-cut-game-transaction-v2/);
  assert.match(page, /version: 3/);
  assert.match(page, /freshTransactionOverrides:[\s\S]+credits: STARTING_CREDITS[\s\S]+spins: 0/);
  assert.match(page, /setBaseCoinPrizes\(precomputedCoinPrizes\);[\s\S]+setReelPhases\(Array\.from/);
  assert.match(page, /const commit = persistCommittedTransaction\(\{[\s\S]+pendingWin: bankAfter[\s\S]+if \(handleCommitFailure\(commit, 'Gamble'\)\)[\s\S]+setGambleSuit\(suit\)/);
  assert.match(css, /--coin-arrival-index[\s\S]+hold-coin-face-reveal/);
  assert.doesNotMatch(page, />\s*\{displayedThunderCharge\}\s*\/\s*\{THUNDER_CHARGE_TARGET\}/);
  assert.doesNotMatch(`${page}\n${css}`, /storm[\s_-]*bust/i);
});
