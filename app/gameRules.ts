export const THUNDER_INTERVAL_MIN = 523;
export const THUNDER_INTERVAL_MAX = 553;
export const INSTANT_BOLT_TRIGGER_COUNT = 7;

export type ThunderProgress = {
  lifetimeBolts: number;
  nextTarget: number;
  awarded: boolean;
};

export type StoredThunderProgress = {
  lifetimeBolts: number;
  nextTarget: number;
  migration: 'stored' | 'legacy-progress-preserved' | 'fresh';
};

export function nextThunderInterval(randomUnit: number) {
  const safeUnit = Math.min(0.999999999, Math.max(0, randomUnit));
  return THUNDER_INTERVAL_MIN + Math.floor(safeUnit * (THUNDER_INTERVAL_MAX - THUNDER_INTERVAL_MIN + 1));
}

export function resolveStoredThunderProgress(
  storedLifetimeRaw: string | null,
  storedTargetRaw: string | null,
  legacyRaw: string | null,
  fallbackLifetime: number,
  fallbackTarget: number,
  randomUnit: number,
): StoredThunderProgress {
  const storedLifetime = storedLifetimeRaw === null ? Number.NaN : Number(storedLifetimeRaw);
  const storedTarget = storedTargetRaw === null ? Number.NaN : Number(storedTargetRaw);
  if (
    Number.isInteger(storedLifetime) && storedLifetime >= 0 &&
    Number.isInteger(storedTarget) && storedTarget > storedLifetime
  ) {
    return { lifetimeBolts: storedLifetime, nextTarget: storedTarget, migration: 'stored' };
  }

  const legacyValue = legacyRaw === null ? Number.NaN : Number(legacyRaw);
  const hasLegacyProgress = Number.isInteger(legacyValue) && legacyValue >= 0 && legacyValue < THUNDER_INTERVAL_MIN;
  const lifetimeBolts = hasLegacyProgress
    ? legacyValue
    : Math.max(0, Math.floor(fallbackLifetime));
  const nextTarget = hasLegacyProgress
    ? THUNDER_INTERVAL_MIN
    : Math.max(
      lifetimeBolts + 1,
      fallbackTarget || lifetimeBolts + nextThunderInterval(randomUnit),
    );
  return {
    lifetimeBolts,
    nextTarget,
    migration: hasLegacyProgress ? 'legacy-progress-preserved' : 'fresh',
  };
}

export function advanceThunderProgress(
  lifetimeBolts: number,
  nextTarget: number,
  qualifyingBolts: number,
  randomUnit: number,
): ThunderProgress {
  const nextLifetime = Math.max(0, Math.floor(lifetimeBolts)) + Math.max(0, Math.floor(qualifyingBolts));
  const awarded = nextLifetime >= nextTarget;
  return {
    lifetimeBolts: nextLifetime,
    nextTarget: awarded ? nextLifetime + nextThunderInterval(randomUnit) : nextTarget,
    awarded,
  };
}

export function shouldInstantBoltTrigger(finalSymbols: readonly string[]) {
  return finalSymbols.filter((symbol) => symbol === 'bolt').length >= INSTANT_BOLT_TRIGGER_COUNT;
}

export function mergeCoinStormReasons(reasons: readonly string[]) {
  return [...new Set(reasons.filter(Boolean))];
}
