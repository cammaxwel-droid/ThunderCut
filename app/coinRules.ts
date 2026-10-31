export function roundCoinAmount(amount: number) {
  return Math.round(Math.max(0, amount) * 100) / 100;
}

export function getMiniMinorCoinValues(featureBet: number, majorCents: number) {
  const majorValue = roundCoinAmount(majorCents / 100);
  return {
    mini: roundCoinAmount(Math.min(featureBet * 10, majorValue * 0.1)),
    minor: roundCoinAmount(Math.min(featureBet * 25, majorValue * 0.5)),
  };
}

export function formatExactCoinAmount(amount: number) {
  const exactAmount = roundCoinAmount(amount);
  return new Intl.NumberFormat('en-AU', {
    minimumFractionDigits: Number.isInteger(exactAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(exactAmount);
}
