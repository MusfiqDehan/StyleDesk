export const DEFAULT_BRAND_COLOR = "#7040c1";

export function isBrandColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function luminance(color: string) {
  const channels = [1, 3, 5].map((start) => {
    const channel = parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getBrandTheme(value?: string | null) {
  const primary = isBrandColor(value) ? value : DEFAULT_BRAND_COLOR;
  const light = luminance(primary);
  return {
    primary,
    // Choose the higher-contrast foreground, including for very light custom colors.
    foreground: light > 0.179 ? "#000000" : "#ffffff",
    text: light > 0.179 ? "#282333" : primary,
  };
}
