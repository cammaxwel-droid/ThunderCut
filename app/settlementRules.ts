export const GAMBLE_MAX_ROUNDS = 4;

function roundCurrency(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100;
}

export function settleCollectedWin(credits: number, pendingWin: number, peakBalance: number) {
  const nextCredits = roundCurrency(credits + pendingWin);
  return {
    credits: nextCredits,
    pendingWin: 0,
    peakBalance: Math.max(peakBalance, nextCredits),
    gambleRound: 0,
  };
}

export function settleGambleBank(
  bankBefore: number,
  multiplier: number,
  hit: boolean,
  currentRound: number,
) {
  if (!Number.isInteger(currentRound) || currentRound < 0 || currentRound >= GAMBLE_MAX_ROUNDS) {
    throw new RangeError('Gamble round limit reached');
  }
  const round = currentRound + 1;
  return {
    bankAfter: hit ? roundCurrency(bankBefore * multiplier) : 0,
    gambleRound: hit ? round : 0,
    round,
  };
}
