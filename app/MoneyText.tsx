type MoneyTextProps = {
  text: string;
  className?: string;
};

const MONEY_GLYPHS: Record<string, string> = {
  '$': 'dollar',
  ',': 'comma',
  '.': 'period',
};

function glyphAsset(character: string) {
  if (/^[0-9]$/.test(character)) return `/money-font/${character}.webp`;
  const namedGlyph = MONEY_GLYPHS[character];
  return namedGlyph ? `/money-font/${namedGlyph}.webp` : null;
}

function glyphClass(character: string) {
  if (character === '$') return 'money-glyph-dollar';
  if (character === ',') return 'money-glyph-comma';
  if (character === '.') return 'money-glyph-period';
  return 'money-glyph-digit';
}

export function MoneyText({ text, className = '' }: MoneyTextProps) {
  return (
    <span className={`money-text ${className}`.trim()} role="img" aria-label={text}>
      <span className="money-text-visual" aria-hidden="true">
        {Array.from(text).map((character, index) => {
          if (/\s/.test(character)) {
            return <i className="money-glyph-space" key={`${character}-${index}`} />;
          }
          const asset = glyphAsset(character);
          if (asset) {
            return (
              <i
                className={`money-glyph ${glyphClass(character)}`}
                key={`${character}-${index}`}
                style={{ WebkitMaskImage: `url("${asset}")`, maskImage: `url("${asset}")` }}
              />
            );
          }
          return <i className="money-glyph-fallback" key={`${character}-${index}`}>{character}</i>;
        })}
      </span>
    </span>
  );
}
