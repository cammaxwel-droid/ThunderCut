'use client';

import type { CSSProperties } from 'react';
import { formatExactCoinAmount, roundCoinAmount } from './coinRules';

type CoinValueTextProps = {
  amount: number;
  className?: string;
  compact?: boolean;
};

/**
 * Plain, readable coin value text. Coin faces no longer use the supplied
 * raster alphabet; the exact authoritative amount remains visible and is
 * still shared with settlement and accessibility output.
 */
export function CoinValueText({ amount, className = '', compact = false }: CoinValueTextProps) {
  const exactAmount = roundCoinAmount(amount);
  const formatted = formatExactCoinAmount(exactAmount);
  const lengthClass = formatted.length >= 11
    ? 'is-xlong'
    : formatted.length >= 8
      ? 'is-long'
      : formatted.length >= 6
        ? 'is-medium'
        : '';
  const accessible = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: Number.isInteger(exactAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(exactAmount);

  return (
    <span
      className={`coin-value-text ${compact ? 'is-compact' : ''} ${lengthClass} ${className}`.trim()}
      aria-label={accessible}
      data-exact-value={formatted}
      style={{ '--coin-value-length': formatted.length + 1 } as CSSProperties}
    >
      ${formatted}
    </span>
  );
}
