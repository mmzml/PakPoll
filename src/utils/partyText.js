// Relative luminance of a hex colour like "ffef00" (WCAG formula)
function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const outline = color => [
  `-1px 0 ${color}`, `1px 0 ${color}`, `0 -1px ${color}`, `0 1px ${color}`,
].join(', ');

// Style for text drawn in a party's colour. Very dark colours (e.g. PPP black) get a
// light outline so they show on dark backgrounds; very light ones (e.g. yellow) get a
// dark outline so they show on white. Mid-tone colours are left as they are.
export function partyTextStyle(hex) {
  const style = { color: `#${hex}`, fontWeight: 'bold' };
  const lum = luminance(hex);
  if (lum < 0.08) style.textShadow = outline('rgba(255, 255, 255, 0.6)');
  else if (lum > 0.6) style.textShadow = outline('rgba(0, 0, 0, 0.45)');
  return style;
}
