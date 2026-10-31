import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GAMBLE_MAX_ROUNDS,
  settleCollectedWin,
  settleGambleBank,
} from '../app/settlementRules.ts';

test('collect moves the exact pending bank once and records the new peak', () => {
  assert.deepEqual(settleCollectedWin(100.1, 20.25, 110), {
    credits: 120.35,
    pendingWin: 0,
    peakBalance: 120.35,
    gambleRound: 0,
  });
});

test('gamble settlement persists a loss as zero and resets its round', () => {
  assert.deepEqual(settleGambleBank(25, 2, false, 2), {
    bankAfter: 0,
    gambleRound: 0,
    round: 3,
  });
});

test('gamble settlement enforces the four-round cap across recovery', () => {
  const fourth = settleGambleBank(10, 3.3, true, GAMBLE_MAX_ROUNDS - 1);
  assert.deepEqual(fourth, { bankAfter: 33, gambleRound: 4, round: 4 });
  assert.throws(() => settleGambleBank(33, 2, true, fourth.gambleRound), /round limit/i);
});
