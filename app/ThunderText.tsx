type ThunderTextProps = {
  text: string;
  className?: string;
};

function glyphAsset(character: string) {
  if (/^[A-Z0-9]$/.test(character)) return `/game-font/${character.toLowerCase()}.webp`;
  if (character === '$') return '/game-font/dollar.webp';
  if (character === '×') return '/game-font/x.webp';
  return null;
}

export function ThunderText({ text, className = '' }: ThunderTextProps) {
  return (
    <span className={`thunder-text ${className}`.trim()} role="img" aria-label={text}>
      <span className="thunder-text-visual" aria-hidden="true">
        {Array.from(text.toUpperCase()).map((character, index) => {
          if (/\s/.test(character)) {
            return <i className="thunder-glyph-space" key={`${character}-${index}`} />;
          }
          const asset = glyphAsset(character);
          if (asset) {
            return (
              <i
                className="thunder-glyph"
                key={`${character}-${index}`}
                style={{ backgroundImage: `url("${asset}")` }}
              />
            );
          }
          return <i className="thunder-glyph-fallback" key={`${character}-${index}`}>{character}</i>;
        })}
      </span>
    </span>
  );
}
