/** Relative luminance for the opaque hex colors in our UI palette. */
function luminance(hex: string): number {
 const raw = hex.replace('#', '');
 const full = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
 const channels = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16) / 255)
   .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
 return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrastRatio(foreground: string, background: string): number {
 const a = luminance(foreground), b = luminance(background);
 return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/** Preserve a category color when readable; otherwise use contrasting ink. */
export function readableTextColor(color: string, background: string): string {
 if (contrastRatio(color, background) >= 4.5) return color;
 return contrastRatio('#FFFFFF', background) > contrastRatio('#000000', background) ? '#FFFFFF' : '#000000';
}
